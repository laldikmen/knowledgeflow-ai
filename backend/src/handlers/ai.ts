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
      console.log('[MOCK AI] Processing with mock responses');

      if (prompt.includes('summary')) {
        return 'This document outlines strategic initiatives for Q3-Q4. Key focuses include cloud infrastructure migration, marketing budget expansion, and API modernization. The team identified critical dependencies and risks around resource allocation and timeline management.';
      } else if (prompt.includes('Extract all key decisions')) {
        return '["Migrate databases to cloud infrastructure by October 31st", "Increase marketing budget by 20%", "Deprecate legacy API by December 31st 2026", "Establish migration task force by end of August"]';
      } else if (prompt.includes('Extract all action items')) {
        return '[{"title":"Set up migration task force","suggested_owner_text":"John Smith","deadline":"2026-08-31"},{"title":"Allocate 20% additional marketing budget","suggested_owner_text":"Sarah Johnson","deadline":"2026-09-15"},{"title":"Communicate API deprecation to stakeholders","suggested_owner_text":"Engineering Lead","deadline":"2026-09-01"}]';
      }
      return '';
    }

    // Real Bedrock API call
    const params = {
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-06-01',
        max_tokens: 2048,
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

export const processDocument = async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Get document
    const docResult = await query(
      `SELECT d.id, d.project_id, d.file_name, d.document_type, d.s3_key
       FROM documents d WHERE d.id = $1`,
      [documentId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    const document = docResult.rows[0];

    // Check project access (manager or admin)
    const accessResult = await query(
      `SELECT pm.project_role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [document.project_id, req.user.id]
    );

    const isAdmin = req.user.system_role === 'admin';
    const isManager = accessResult.rows.length > 0 && accessResult.rows[0].project_role === 'manager';

    if (!isAdmin && !isManager) {
      return res.status(403).json({
        success: false,
        error: 'Only managers and admins can process documents',
      });
    }

    // Get document text (if it exists)
    const textResult = await query(
      `SELECT extracted_text FROM document_texts WHERE document_id = $1`,
      [documentId]
    );

    if (textResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Document text not yet extracted. Please upload document with text content.',
      });
    }

    const documentText = textResult.rows[0].extracted_text;

    // Call Bedrock to generate summary
    const summaryPrompt = `Analyze the following document and provide a concise summary (2-3 paragraphs).

Document:
${documentText}

Provide only the summary, nothing else.`;

    const summary = await callBedrock(summaryPrompt);

    // Store summary (delete old one first if exists)
    await query('DELETE FROM ai_summaries WHERE document_id = $1', [documentId]);
    await query(
      `INSERT INTO ai_summaries (document_id, summary_text, review_status, ai_confidence)
       VALUES ($1, $2, $3, $4)`,
      [documentId, summary, 'draft', 0.85]
    );

    // Call Bedrock to extract decisions
    const decisionsPrompt = `Extract all key decisions made in this document. Format as a JSON array of strings.

Document:
${documentText}

Return ONLY valid JSON array with no markdown formatting or explanation. Example: ["Decision 1", "Decision 2"]`;

    const decisionsText = await callBedrock(decisionsPrompt);
    let decisions: string[] = [];
    try {
      decisions = JSON.parse(decisionsText);
    } catch {
      decisions = [decisionsText];
    }

    // Store decisions (delete old ones first and re-insert)
    await query('DELETE FROM decisions WHERE document_id = $1 AND created_by_ai = true', [documentId]);
    for (const decisionText of decisions) {
      if (decisionText.trim()) {
        await query(
          `INSERT INTO decisions (document_id, decision_text, review_status, ai_confidence, created_by_ai)
           VALUES ($1, $2, $3, $4, true)`,
          [documentId, decisionText, 'draft', 0.82]
        );
      }
    }

    // Call Bedrock to extract action items
    const actionItemsPrompt = `Extract all action items, tasks, and next steps from this document.
For each item, identify: title, suggested owner (by name if mentioned), and deadline if mentioned.
Format as JSON array with objects containing: title, suggested_owner_text, deadline.

Document:
${documentText}

Return ONLY valid JSON array with no markdown formatting. Example: [{"title":"Task 1","suggested_owner_text":"John","deadline":"2026-09-15"}]`;

    const actionItemsText = await callBedrock(actionItemsPrompt);
    let actionItems: Array<{ title: string; suggested_owner_text?: string; deadline?: string }> = [];
    try {
      actionItems = JSON.parse(actionItemsText);
    } catch {
      actionItems = [];
    }

    // Store action items
    for (const item of actionItems) {
      if (item.title?.trim()) {
        await query(
          `INSERT INTO action_items (
            document_id, project_id, task_title, suggested_owner_text,
            deadline, status, risk_level, created_by_ai, ai_confidence
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)`,
          [
            documentId,
            document.project_id,
            item.title,
            item.suggested_owner_text || null,
            item.deadline || null,
            'draft',
            'medium',
            0.80,
          ]
        );
      }
    }

    // Update document status
    await query('UPDATE documents SET status = $1 WHERE id = $2', ['processed', documentId]);

    return res.json({
      success: true,
      data: {
        documentId,
        summary_generated: true,
        decisions_count: decisions.length,
        action_items_count: actionItems.length,
      },
      message: 'Document processed successfully with AI insights',
    });
  } catch (error) {
    console.error('Process document error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process document',
    });
  }
};

export const reviewSummary = async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { review_status, review_note } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    if (!['confirmed', 'rejected'].includes(review_status)) {
      return res.status(400).json({
        success: false,
        error: 'Review status must be confirmed or rejected',
      });
    }

    // Get document and check access
    const docResult = await query(
      `SELECT d.project_id FROM documents d WHERE d.id = $1`,
      [documentId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    const document = docResult.rows[0];

    // Check access (admin/manager only)
    const accessResult = await query(
      `SELECT pm.project_role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [document.project_id, req.user.id]
    );

    const isAdmin = req.user.system_role === 'admin';
    const isManager = accessResult.rows.length > 0 && accessResult.rows[0].project_role === 'manager';

    if (!isAdmin && !isManager) {
      return res.status(403).json({
        success: false,
        error: 'Only managers and admins can review AI content',
      });
    }

    // Update summary review
    await query(
      `UPDATE ai_summaries
       SET review_status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, review_note = $3
       WHERE document_id = $4`,
      [review_status, req.user.id, review_note || null, documentId]
    );

    return res.json({
      success: true,
      message: `Summary ${review_status} successfully`,
    });
  } catch (error) {
    console.error('Review summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const reviewDecision = async (req: Request, res: Response) => {
  try {
    const { decisionId } = req.params;
    const { review_status, review_note } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    if (!['confirmed', 'rejected'].includes(review_status)) {
      return res.status(400).json({
        success: false,
        error: 'Review status must be confirmed or rejected',
      });
    }

    // Get decision and check access
    const decResult = await query(
      `SELECT d.document_id FROM decisions d WHERE d.id = $1`,
      [decisionId]
    );

    if (decResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Decision not found',
      });
    }

    const decision = decResult.rows[0];

    // Get document to check project access
    const docResult = await query(
      `SELECT project_id FROM documents WHERE id = $1`,
      [decision.document_id]
    );

    const document = docResult.rows[0];

    // Check access
    const accessResult = await query(
      `SELECT pm.project_role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [document.project_id, req.user.id]
    );

    const isAdmin = req.user.system_role === 'admin';
    const isManager = accessResult.rows.length > 0 && accessResult.rows[0].project_role === 'manager';

    if (!isAdmin && !isManager) {
      return res.status(403).json({
        success: false,
        error: 'Only managers and admins can review AI content',
      });
    }

    // Update decision review
    await query(
      `UPDATE decisions
       SET review_status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, review_note = $3
       WHERE id = $4`,
      [review_status, req.user.id, review_note || null, decisionId]
    );

    return res.json({
      success: true,
      message: `Decision ${review_status} successfully`,
    });
  } catch (error) {
    console.error('Review decision error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const reviewActionItem = async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { review_status, review_note } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    if (!['confirmed', 'rejected'].includes(review_status)) {
      return res.status(400).json({
        success: false,
        error: 'Review status must be confirmed or rejected',
      });
    }

    // Get task and check access
    const taskResult = await query(
      `SELECT project_id FROM action_items WHERE id = $1`,
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    const task = taskResult.rows[0];

    // Check access (admin/manager only)
    const accessResult = await query(
      `SELECT pm.project_role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [task.project_id, req.user.id]
    );

    const isAdmin = req.user.system_role === 'admin';
    const isManager = accessResult.rows.length > 0 && accessResult.rows[0].project_role === 'manager';

    if (!isAdmin && !isManager) {
      return res.status(403).json({
        success: false,
        error: 'Only managers and admins can review AI content',
      });
    }

    // Update task review status
    const newStatus = review_status === 'confirmed' ? 'confirmed' : 'rejected';
    await query(
      `UPDATE action_items
       SET review_status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, review_note = $3, status = $4
       WHERE id = $5`,
      [review_status, req.user.id, review_note || null, newStatus, taskId]
    );

    return res.json({
      success: true,
      message: `Task ${review_status} successfully`,
    });
  } catch (error) {
    console.error('Review action item error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const getAISummary = async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Get document and check access
    const docResult = await query(
      `SELECT project_id FROM documents WHERE id = $1`,
      [documentId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    const document = docResult.rows[0];

    // Check access
    const accessResult = await query(
      `SELECT pm.project_role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [document.project_id, req.user.id]
    );

    if (accessResult.rows.length === 0 && req.user.system_role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get summary
    const result = await query(
      `SELECT
        id, summary_text, review_status, ai_confidence,
        reviewed_by, reviewed_at, review_note,
        created_at
      FROM ai_summaries
      WHERE document_id = $1`,
      [documentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Summary not found',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const getAIDecisions = async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Get document and check access
    const docResult = await query(
      `SELECT project_id FROM documents WHERE id = $1`,
      [documentId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    const document = docResult.rows[0];

    // Check access
    const accessResult = await query(
      `SELECT pm.project_role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [document.project_id, req.user.id]
    );

    if (accessResult.rows.length === 0 && req.user.system_role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get decisions
    const result = await query(
      `SELECT
        id, decision_text, source_excerpt, review_status, ai_confidence,
        reviewed_by, reviewed_at, review_note,
        created_at
      FROM decisions
      WHERE document_id = $1
      ORDER BY created_at DESC`,
      [documentId]
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get decisions error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
