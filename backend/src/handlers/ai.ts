import { Request, Response } from 'express';
import { query } from '../db/connection';
import * as AWS from 'aws-sdk';

// Newer Claude models on Bedrock require a cross-region inference profile and the
// Converse API (on-demand direct invoke is not supported).
const BEDROCK_REGION = process.env.BEDROCK_REGION || process.env.S3_REGION || 'eu-central-1';
const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID || 'eu.anthropic.claude-haiku-4-5-20251001-v1:0';

const bedrockRuntime = new AWS.BedrockRuntime({ region: BEDROCK_REGION });

// Send a prompt to Bedrock (Converse API) and return the model's text reply.
export async function callBedrock(
  prompt: string,
  maxTokens = 2048,
): Promise<string> {
  try {
    const response = await bedrockRuntime
      .converse({
        modelId: BEDROCK_MODEL_ID,
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens, temperature: 0 },
      })
      .promise();

    const parts = response.output?.message?.content || [];
    return parts.map((p: any) => p.text || '').join('').trim();
  } catch (error) {
    console.error('Bedrock API error:', error);
    throw new Error('Failed to call Bedrock API');
  }
}

// Claude often wraps JSON in ```json fences; strip them before parsing.
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
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

    // Triggering AI processing is allowed for admins and for members who can
    // contribute (manager or contributor). Viewers are read-only. (spec matrix:
    // "Trigger AI processing" — Admin/Manager/Contributor = Yes, Viewer = No.)
    const isAdmin = req.user.system_role === 'admin';
    const projectRole = accessResult.rows[0]?.project_role;
    const canProcess =
      isAdmin || projectRole === 'manager' || projectRole === 'contributor';

    if (!canProcess) {
      return res.status(403).json({
        success: false,
        error: 'Viewers cannot trigger AI processing',
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
      const parsed = JSON.parse(extractJson(decisionsText));
      decisions = Array.isArray(parsed) ? parsed : [];
    } catch {
      decisions = [];
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
      const parsed = JSON.parse(extractJson(actionItemsText));
      actionItems = Array.isArray(parsed) ? parsed : [];
    } catch {
      actionItems = [];
    }

    // Only accept a real ISO-ish date (YYYY-MM-DD) for the deadline; the model may
    // return free text like "next quarter" which the DATE column would reject.
    const cleanDeadline = (value?: string): string | null => {
      if (!value) return null;
      const match = value.match(/\d{4}-\d{2}-\d{2}/);
      return match ? match[0] : null;
    };

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
            cleanDeadline(item.deadline),
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
      `SELECT project_id, status FROM action_items WHERE id = $1`,
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    const task = taskResult.rows[0];
    const previousStatus = task.status;

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

    // Confirm turns the draft into a tracked task; reject marks it rejected.
    // action_items uses `status` for the lifecycle (there is no review_status column).
    const newStatus = review_status === 'confirmed' ? 'confirmed' : 'rejected';
    await query(
      `UPDATE action_items
       SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP,
           review_note = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [newStatus, req.user.id, review_note || null, taskId]
    );

    // Record the status change in task history.
    if (newStatus !== previousStatus) {
      await query(
        `INSERT INTO task_status_history (task_id, previous_status, new_status, changed_by, change_note)
         VALUES ($1, $2, $3, $4, $5)`,
        [taskId, previousStatus, newStatus, req.user.id, review_note || null]
      );
    }

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

    // Viewers may only see confirmed AI content.
    const isViewer =
      accessResult.rows[0]?.project_role === 'viewer' &&
      req.user.system_role !== 'admin';
    if (isViewer && result.rows[0].review_status !== 'confirmed') {
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

    // Viewers may only see confirmed decisions; others also see drafts.
    const isViewer =
      accessResult.rows[0]?.project_role === 'viewer' &&
      req.user.system_role !== 'admin';

    // Get decisions
    const result = await query(
      `SELECT
        id, decision_text, source_excerpt, review_status, ai_confidence,
        reviewed_by, reviewed_at, review_note,
        created_at
      FROM decisions
      WHERE document_id = $1
        ${isViewer ? "AND review_status = 'confirmed'" : ''}
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
