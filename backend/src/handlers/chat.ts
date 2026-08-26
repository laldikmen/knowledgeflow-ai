import { Request, Response } from 'express';
import { query } from '../db/connection';
import { callBedrock } from './ai';
import { embedText, toVectorLiteral } from '../utils/embeddings';

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !['what', 'when', 'where', 'which', 'that', 'this', 'from', 'with', 'have', 'been', 'will', 'does', 'should', 'could'].includes(word));
}

type RelevantDoc = { id: number; title: string; text: string; similarity: number };

// Keyword fallback — used when a document has no embeddings yet, or when semantic
// search finds nothing confident. Prefers keyword-matched documents; if none
// match, returns the most recent ones so general questions still get grounding.
async function keywordFallback(
  projectId: number,
  userId: number,
  keywords: string[],
): Promise<RelevantDoc[]> {
  const accessibleDocs = await query(
    `SELECT d.id, d.title, dt.extracted_text
     FROM documents d
     LEFT JOIN document_texts dt ON d.id = dt.document_id
     WHERE d.project_id = $1
     AND d.project_id IN (
       SELECT pm.project_id FROM project_members pm WHERE pm.user_id = $2
       UNION
       SELECT id FROM projects WHERE id = $1 AND EXISTS (
         SELECT 1 FROM users WHERE id = $2 AND system_role = 'admin'
       )
     )
     AND dt.extracted_text IS NOT NULL
     ORDER BY d.uploaded_at DESC
     LIMIT 10`,
    [projectId, userId],
  );

  const scoredDocs = accessibleDocs.rows.map(doc => {
    const textLower = (doc.extracted_text || '').toLowerCase();
    const matchCount = keywords.filter(kw => textLower.includes(kw)).length;
    const wordCount = textLower.split(/\s+/).length;
    const similarity = matchCount > 0 ? matchCount / Math.max(wordCount / 100, 1) : 0;
    return { id: doc.id, title: doc.title, text: doc.extracted_text, similarity };
  });

  const matched = scoredDocs.filter(doc => doc.similarity > 0);
  return (matched.length > 0 ? matched : scoredDocs)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
}

// Hybrid retrieval: semantic (vector) search over document chunks, re-ranked with
// a small keyword bonus, returning the best chunk per document (top 3). Falls back
// to keyword search when there are no embeddings or no confident semantic match —
// so both un-embedded documents and general questions still work.
async function findRelevantDocuments(
  projectId: number,
  userId: number,
  _userRole: string,
  keywords: string[],
  question: string,
): Promise<RelevantDoc[]> {
  try {
    const queryVec = await embedText(question);
    const vec = await query(
      `SELECT dc.document_id, d.title, dc.chunk_text,
              1 - (dc.embedding <=> $1::vector) AS similarity
       FROM document_chunks dc
       JOIN documents d ON d.id = dc.document_id
       WHERE d.project_id = $2
       AND d.project_id IN (
         SELECT pm.project_id FROM project_members pm WHERE pm.user_id = $3
         UNION
         SELECT id FROM projects WHERE id = $2 AND EXISTS (
           SELECT 1 FROM users WHERE id = $3 AND system_role = 'admin'
         )
       )
       ORDER BY dc.embedding <=> $1::vector
       LIMIT 12`,
      [toVectorLiteral(queryVec), projectId, userId],
    );

    if (vec.rows.length > 0) {
      // Best chunk per document; blended score = cosine similarity + keyword bonus.
      const byDoc = new Map<number, RelevantDoc>();
      for (const r of vec.rows) {
        const tl = (r.chunk_text || '').toLowerCase();
        const kw = keywords.filter(k => tl.includes(k)).length;
        const score = Number(r.similarity) + Math.min(kw * 0.03, 0.15);
        const prev = byDoc.get(r.document_id);
        if (!prev || score > prev.similarity) {
          byDoc.set(r.document_id, {
            id: r.document_id,
            title: r.title,
            text: r.chunk_text,
            similarity: score,
          });
        }
      }
      const top = [...byDoc.values()].sort((a, b) => b.similarity - a.similarity).slice(0, 3);
      // Keep only confident matches; if the best is weak, use the keyword fallback.
      const confident = top.filter(t => t.similarity >= 0.3);
      if (confident.length > 0) return confident;
    }
  } catch (error) {
    console.error('Semantic retrieval failed, falling back to keyword:', error);
  }

  try {
    return await keywordFallback(projectId, userId, keywords);
  } catch (error) {
    console.error('Find relevant documents error:', error);
    return [];
  }
}

// Ask the model for a short 2-3 word title summarising a conversation's topic,
// derived from its first question. Falls back to the first few words of the
// question if the model call fails or returns something unusable.
async function generateChatTitle(question: string): Promise<string> {
  const fallback = () => {
    const w = question.trim().replace(/[?.!]+$/, '').split(/\s+/).slice(0, 3).join(' ');
    return (w.length > 32 ? w.slice(0, 32).trim() : w) || 'New chat';
  };
  try {
    const prompt = `Summarize the topic of this question as a short title of 2 to 3 words. Use Title Case. No quotes, no punctuation, no trailing period. Return ONLY the title.\n\nQuestion: ${question}`;
    const raw = await callBedrock(prompt, 20);
    const cleaned = (raw || '')
      .replace(/["'`]/g, '')
      .replace(/[\n\r]+/g, ' ')
      .replace(/[.?!]+$/, '')
      .trim();
    const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 4).join(' ');
    if (words.length < 2) return fallback();
    return words.length > 36 ? words.slice(0, 36).trim() : words;
  } catch {
    return fallback();
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
      keywords,
      question
    );

    // The spec's exact wording for "no grounding found". Used verbatim so the
    // assistant never fabricates an answer when the accessible documents can't
    // support one.
    const NO_INFO_MESSAGE =
      'I could not find this information in the documents available to your account.';

    // If nothing in the accessible documents matched, don't even call the model
    // — there is nothing to ground on. Answer with the exact required message.
    let answer: string;
    if (relevantDocs.length === 0) {
      answer = NO_INFO_MESSAGE;
    } else {
      let context = `Project: ${projectName}\n\nRelevant documents:\n\n`;
      relevantDocs.forEach((doc, index) => {
        const excerpt = doc.text.substring(0, 1500);
        context += `[Document ${index + 1}: ${doc.title}]\n${excerpt}...\n\n`;
      });

      context += `Answer the question using ONLY the documents above. Do not use outside knowledge.

Question: ${question}

Rules:
- If the documents above do not contain enough information to answer, reply with EXACTLY this sentence and nothing else: "${NO_INFO_MESSAGE}"
- Otherwise, answer concisely. For every fact you state, cite the document it came from by its number in square brackets, e.g. [Document 1]. Only cite documents you actually used.`;

      // Call Bedrock to generate a grounded answer.
      answer = await callBedrock(context);
    }

    // When the answer is the "not found" message, there is nothing to cite.
    const answeredFromDocs = answer.trim() !== NO_INFO_MESSAGE;

    // Figure out which of the retrieved documents the model actually cited
    // (by "[Document N]" / "Document N"), and list only those as sources — so
    // the Sources reflect what the answer used, not everything we retrieved.
    const citedNumbers = new Set<number>();
    const citeRegex = /Document\s+(\d+)/gi;
    let citeMatch: RegExpExecArray | null;
    while ((citeMatch = citeRegex.exec(answer)) !== null) {
      const n = parseInt(citeMatch[1], 10);
      if (n >= 1 && n <= relevantDocs.length) citedNumbers.add(n);
    }
    // If the model cited specific documents, keep only those; otherwise fall
    // back to the retrieved (keyword-matched) set.
    const usedDocs = citedNumbers.size > 0
      ? relevantDocs.filter((_, index) => citedNumbers.has(index + 1))
      : relevantDocs;

    const sources = answeredFromDocs
      ? usedDocs.map(doc => ({
          document_id: doc.id,
          document_title: doc.title,
          excerpt: doc.text.substring(0, 200),
        }))
      : [];

    // Swap numeric references ("[Document 1]") for the document's real name so
    // the inline citations read the same as the Sources list.
    if (answeredFromDocs) {
      answer = answer.replace(/\[?\bDocument\s+(\d+)\b\]?/gi, (full, num) => {
        const idx = parseInt(num, 10) - 1;
        return idx >= 0 && idx < relevantDocs.length ? `[${relevantDocs[idx].title}]` : full;
      });
    }

    // Resolve the conversation this message belongs to. If the client passed a
    // conversation_id it owns, append to it; otherwise start a new conversation
    // and give it an AI-generated 2-3 word title from this first question.
    let conversationId: number | null = null;
    let conversationTitle = '';
    const rawConvId = Number(req.body.conversation_id);
    if (Number.isInteger(rawConvId) && rawConvId > 0) {
      const owned = await query(
        `SELECT id, title FROM chat_conversations
         WHERE id = $1 AND project_id = $2 AND user_id = $3`,
        [rawConvId, projectId, req.user.id]
      );
      if (owned.rows.length > 0) {
        conversationId = owned.rows[0].id;
        conversationTitle = owned.rows[0].title;
      }
    }
    if (!conversationId) {
      conversationTitle = await generateChatTitle(question);
      const convIns = await query(
        `INSERT INTO chat_conversations (project_id, user_id, title)
         VALUES ($1, $2, $3) RETURNING id`,
        [projectId, req.user.id, conversationTitle]
      );
      conversationId = convIns.rows[0].id;
    }

    // Store the message under its conversation and bump the conversation's
    // updated_at so the history sidebar orders most-recent first.
    const chatResult = await query(
      `INSERT INTO chat_messages (project_id, user_id, conversation_id, question, answer, sources_json)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [
        projectId,
        req.user.id,
        conversationId,
        question,
        answer,
        JSON.stringify(sources.map(s => ({ id: s.document_id, title: s.document_title }))),
      ]
    );
    await query(`UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1`, [conversationId]);

    return res.json({
      success: true,
      data: {
        chat_id: chatResult.rows[0].id,
        conversation_id: conversationId,
        conversation_title: conversationTitle,
        question,
        answer,
        sources,
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

// List the caller's conversations for a project (for the history sidebar). One
// row per conversation — not per message — newest activity first.
export const listConversations = async (req: Request, res: Response) => {
  try {
    const projectIdNum = parseInt(req.params.projectId as string);
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const accessResult = await query(
      `SELECT pm.project_role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [projectIdNum, req.user.id]
    );
    if (accessResult.rows.length === 0 && req.user.system_role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied to this project' });
    }

    const result = await query(
      `SELECT c.id, c.title, c.created_at, c.updated_at,
              COUNT(m.id) AS message_count
       FROM chat_conversations c
       LEFT JOIN chat_messages m ON m.conversation_id = c.id
       WHERE c.project_id = $1 AND c.user_id = $2
       GROUP BY c.id
       ORDER BY c.updated_at DESC
       LIMIT 100`,
      [projectIdNum, req.user.id]
    );

    return res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        title: row.title,
        message_count: Number(row.message_count),
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    });
  } catch (error) {
    console.error('List conversations error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Return all messages in one of the caller's conversations, oldest first.
export const getConversationMessages = async (req: Request, res: Response) => {
  try {
    const projectIdNum = parseInt(req.params.projectId as string);
    const conversationId = parseInt(req.params.conversationId as string);
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    // The conversation must belong to this user in this project.
    const conv = await query(
      `SELECT id, title FROM chat_conversations
       WHERE id = $1 AND project_id = $2 AND user_id = $3`,
      [conversationId, projectIdNum, req.user.id]
    );
    if (conv.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const msgs = await query(
      `SELECT id, question, answer, sources_json, created_at
       FROM chat_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId]
    );

    return res.json({
      success: true,
      data: {
        id: conv.rows[0].id,
        title: conv.rows[0].title,
        messages: msgs.rows.map(row => ({
          id: row.id,
          question: row.question,
          answer: row.answer,
          sources: row.sources_json
            ? (typeof row.sources_json === 'string' ? JSON.parse(row.sources_json) : row.sources_json)
            : [],
          created_at: row.created_at,
        })),
      },
    });
  } catch (error) {
    console.error('Get conversation messages error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
