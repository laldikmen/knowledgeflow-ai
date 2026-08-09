import { Request, Response } from 'express';
import { query } from '../db/connection';
import AWS from 'aws-sdk';

const bedrock = new AWS.Bedrock({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const bedrockRuntime = new AWS.BedrockRuntime({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

interface ClaudeResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

async function callBedrock(prompt: string): Promise<string> {
  try {
    // Mock responses for MVP testing - replace with real Bedrock call when configured
    if (process.env.NODE_ENV === 'development') {
      console.log('[MOCK AI Chat] Processing question');

      if (
        prompt.toLowerCase().includes('decision') ||
        prompt.toLowerCase().includes('decided')
      ) {
        return 'Based on the available documents, the key decisions made include: 1) Infrastructure migration to cloud, 2) Marketing budget increase, 3) API modernization. These were confirmed by project managers and are documented in the meeting transcripts.';
      } else if (
        prompt.toLowerCase().includes('deadline') ||
        prompt.toLowerCase().includes('when')
      ) {
        return 'According to the extracted tasks, the main deadlines are: Cloud migration by October 31st, 2026; Marketing initiatives by September 15th, 2026; API deprecation by December 31st, 2026. These timelines are tracked in the action items and dashboard.';
      } else if (
        prompt.toLowerCase().includes('owner') ||
        prompt.toLowerCase().includes('responsible')
      ) {
        return 'Based on the task assignments and suggested owners from the documents: John Smith leads the database migration, Sarah Johnson oversees marketing initiatives, and the Engineering Lead manages API modernization. Specific task assignments can be found in the task tracker.';
      } else if (
        prompt.toLowerCase().includes('summary') ||
        prompt.toLowerCase().includes('overview')
      ) {
        return 'The project involves strategic initiatives for Q3-Q4 including cloud infrastructure migration, marketing expansion, and API modernization. All initiatives have been documented with clear ownership, deadlines, and risk assessments.';
      }

      return 'Based on the available documents in this project, I can see information about meetings, decisions, and tasks. For a more specific answer, could you rephrase your question to be more specific about what you\'re looking for (e.g., "What were the decisions?", "Who is responsible?", "What are the deadlines?")?';
    }

    // Real Bedrock API call
    const params = {
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-06-01',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    };

    const response = await bedrockRuntime.invokeModel(params).promise();
    const body = JSON.parse(response.body?.toString() || '{}') as ClaudeResponse;
    const text = body.content[0]?.text || '';
    return text;
  } catch (error) {
    console.error('Bedrock API error:', error);
    throw new Error('Failed to call Bedrock API');
  }
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !['what', 'when', 'where', 'which', 'that', 'this', 'from', 'with', 'have', 'been', 'will', 'does', 'should', 'could'].includes(word));
}

async function findRelevantDocuments(projectId: number, userId: number, userRole: string, keywords: string[]): Promise<Array<{id: number; title: string; text: string; similarity: number}>> {
  try {
    // Get all accessible documents for this project
    const accessibleDocs = await query(
      `SELECT d.id, d.title, dt.extracted_text
       FROM documents d
       LEFT JOIN document_texts dt ON d.id = dt.document_id
       WHERE d.project_id = $1
       AND d.project_id IN (
         SELECT pm.project_id FROM project_members pm WHERE pm.user_id = $2
         UNION
         SELECT id FROM projects WHERE id = $1 AND EXISTS (
           SELECT 1 FROM users WHERE id = $3 AND system_role = 'admin'
         )
       )
       AND dt.extracted_text IS NOT NULL
       ORDER BY d.uploaded_at DESC
       LIMIT 10`,
      [projectId, userId, userId]
    );

    // Score documents by keyword relevance
    const scoredDocs = accessibleDocs.rows.map(doc => {
      const textLower = (doc.extracted_text || '').toLowerCase();
      const matchCount = keywords.filter(kw => textLower.includes(kw)).length;
      const wordCount = textLower.split(/\s+/).length;
      const similarity = matchCount > 0 ? matchCount / Math.max(wordCount / 100, 1) : 0;

      return {
        id: doc.id,
        title: doc.title,
        text: doc.extracted_text,
        similarity,
      };
    });

    // Return top 3 most relevant documents
    return scoredDocs.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
  } catch (error) {
    console.error('Find relevant documents error:', error);
    return [];
  }
}

export const askQuestion = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { question } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    if (!question || !question.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Question is required',
      });
    }

    if (question.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Question is too long (max 1000 characters)',
      });
    }

    // Check project access
    const accessResult = await query(
      `SELECT pm.project_role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [projectId, req.user.id]
    );

    if (accessResult.rows.length === 0 && req.user.system_role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this project',
      });
    }

    // Get project details
    const projectResult = await query(
      'SELECT name FROM projects WHERE id = $1',
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    const projectName = projectResult.rows[0].name;

    // Extract keywords from question
    const keywords = extractKeywords(question);

    // Find relevant documents using keyword matching
    const relevantDocs = await findRelevantDocuments(
      parseInt(projectId as string),
      req.user.id,
      accessResult.rows[0]?.project_role || 'viewer',
      keywords
    );

    // Build context from relevant documents
    let context = `Project: ${projectName}\n\n`;

    if (relevantDocs.length > 0) {
      context += 'Relevant documents:\n\n';
      relevantDocs.forEach((doc, index) => {
        const excerpt = doc.text.substring(0, 500);
        context += `[Document ${index + 1}: ${doc.title}]\n${excerpt}...\n\n`;
      });
    } else {
      context +=
        'Note: No specific documents found for this query. Please try more specific keywords.\n\n';
    }

    context += `Based on the documents above, please answer this question: ${question}

If the documents do not contain enough information to fully answer the question, please state what information is missing.

Always cite which documents you're referencing in your answer.`;

    // Call Bedrock to generate answer
    const answer = await callBedrock(context);

    // Store conversation in chat_messages
    const chatResult = await query(
      `INSERT INTO chat_messages (project_id, user_id, question, answer, sources_json)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [projectId, req.user.id, question, answer, JSON.stringify(relevantDocs.map(d => ({id: d.id, title: d.title})))]
    );

    return res.json({
      success: true,
      data: {
        chat_id: chatResult.rows[0].id,
        question,
        answer,
        sources: relevantDocs.map(doc => ({
          document_id: doc.id,
          document_title: doc.title,
          excerpt: doc.text.substring(0, 200),
        })),
        created_at: chatResult.rows[0].created_at,
      },
    });
  } catch (error) {
    console.error('Ask question error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process question',
    });
  }
};

export const getChatHistory = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const limitQuery = req.query.limit;
    const limitParam = limitQuery ? (Array.isArray(limitQuery) ? limitQuery[0] : typeof limitQuery === 'string' ? limitQuery : '20') : '20';
    const projectIdNum = parseInt(projectId as string);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Check project access
    const accessResult = await query(
      `SELECT pm.project_role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [projectIdNum, req.user.id]
    );

    if (accessResult.rows.length === 0 && req.user.system_role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this project',
      });
    }

    // Get chat history for this project and user
    const result = await query(
      `SELECT
        c.id, c.question, c.answer, c.sources_json,
        u.name as user_name,
        c.created_at
      FROM chat_messages c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.project_id = $1 AND c.user_id = $2
      ORDER BY c.created_at DESC
      LIMIT $3`,
      [projectIdNum, req.user.id, parseInt(limitParam as string)]
    );

    return res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        question: row.question,
        answer: row.answer,
        sources: row.sources_json ? (typeof row.sources_json === 'string' ? JSON.parse(row.sources_json) : row.sources_json) : [],
        user_name: row.user_name,
        created_at: row.created_at,
      })),
    });
  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const getProjectChatHistory = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const limitQuery = req.query.limit;
    const limitParam = limitQuery ? (Array.isArray(limitQuery) ? limitQuery[0] : typeof limitQuery === 'string' ? limitQuery : '50') : '50';

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Check project access (managers/admins can see all, others only their own)
    const projectIdNum2 = parseInt(projectId as string);
    const accessResult = await query(
      `SELECT pm.project_role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [projectIdNum2, req.user.id]
    );

    if (accessResult.rows.length === 0 && req.user.system_role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this project',
      });
    }

    const isManager =
      req.user.system_role === 'admin' ||
      accessResult.rows[0]?.project_role === 'manager';

    // Get chat history (managers see all, others see only their own)
    let sql = `
      SELECT
        c.id, c.question, c.answer, c.sources_json,
        u.name as user_name, u.email,
        c.created_at
      FROM chat_messages c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.project_id = $1
    `;

    const params: any[] = [projectIdNum2];

    if (!isManager) {
      sql += ` AND c.user_id = $2`;
      params.push(req.user.id);
    }

    sql += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limitParam as string));

    const result = await query(sql, params);

    return res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        question: row.question,
        answer: row.answer,
        sources: row.sources_json ? (typeof row.sources_json === 'string' ? JSON.parse(row.sources_json) : row.sources_json) : [],
        user_name: row.user_name,
        user_email: row.email,
        created_at: row.created_at,
      })),
    });
  } catch (error) {
    console.error('Get project chat history error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
