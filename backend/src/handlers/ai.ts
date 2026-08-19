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

    // One classified extraction call. The model separates DECISIONS (choices that
    // were settled) from ACTION ITEMS (work to be done) — an item goes in exactly
    // one list — and self-reports a 0-1 confidence per item.
    const extractionPrompt = `You extract structured knowledge from a business document.

Return ONLY a single JSON object (no markdown, no commentary) with this exact shape:
{
  "summary": "a concise 2-3 paragraph summary",
  "summary_confidence": 0.0,
  "decisions": [ { "text": "the decision", "source": "the exact sentence from the document this came from", "confidence": 0.0 } ],
  "action_items": [ { "title": "the task", "suggested_owner": "person name or null", "deadline": "YYYY-MM-DD or null", "risk": "low|medium|high", "source": "the exact sentence from the document this came from", "confidence": 0.0 } ]
}

Classify every extracted item into EXACTLY ONE list:
- A DECISION is a conclusion or choice that was settled — what the group decided. It is not something still to be done and has no owner or deadline. Example: "Standardize on Amazon S3 for document storage."
- An ACTION ITEM is work someone must do — it has an action verb and usually an owner and/or a deadline. Example: "Set up the migration task force by Aug 31."
- If an item reads as both, put it in action_items when it describes work to be done; otherwise decisions. NEVER put the same item in both lists.
- "source" must be the verbatim sentence (or short quote) from the document that the item was extracted from, so a reviewer can trace it back.
- "confidence" is your own 0.0-1.0 estimate of how clearly the item is stated in the document.
- "risk" is your estimate of how risky/urgent the action item is.

Document:
${documentText}`;

    const raw = await callBedrock(extractionPrompt, 4096);
    let parsed: any = {};
    try {
      parsed = JSON.parse(extractJson(raw));
    } catch {
      parsed = {};
    }

    const clampConfidence = (value: any, fallback: number): number => {
      const n = Number(value);
      return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
    };
    const cleanDeadline = (value?: string | null): string | null => {
      if (!value) return null;
      const match = String(value).match(/\d{4}-\d{2}-\d{2}/);
      return match ? match[0] : null;
    };
    const cleanRisk = (value?: string): string =>
      ['low', 'medium', 'high'].includes(String(value)) ? String(value) : 'medium';

    const summary = typeof parsed.summary === 'string' ? parsed.summary : '';
    const decisions = Array.isArray(parsed.decisions) ? parsed.decisions : [];
    const actionItems = Array.isArray(parsed.action_items) ? parsed.action_items : [];

    // Store summary (delete old one first if exists)
    await query('DELETE FROM ai_summaries WHERE document_id = $1', [documentId]);
    if (summary.trim()) {
      await query(
        `INSERT INTO ai_summaries (document_id, summary_text, review_status, ai_confidence)
         VALUES ($1, $2, $3, $4)`,
        [documentId, summary, 'draft', clampConfidence(parsed.summary_confidence, 0.7)]
      );
    }

    // Store decisions (replace AI-generated ones)
    await query('DELETE FROM decisions WHERE document_id = $1 AND created_by_ai = true', [documentId]);
    for (const d of decisions) {
      const text = typeof d === 'string' ? d : d?.text;
      if (text && String(text).trim()) {
        await query(
          `INSERT INTO decisions (document_id, decision_text, source_excerpt, review_status, ai_confidence, created_by_ai)
           VALUES ($1, $2, $3, $4, $5, true)`,
          [documentId, String(text).trim(), d?.source || null, 'draft', clampConfidence(d?.confidence, 0.7)]
        );
      }
    }

    // Replace previously AI-drafted action items (keep any already reviewed).
    await query(
      `DELETE FROM action_items
       WHERE document_id = $1 AND created_by_ai = true AND status = 'draft'`,
      [documentId]
    );

    // Store action items
    for (const item of actionItems) {
      if (item?.title && String(item.title).trim()) {
        await query(
          `INSERT INTO action_items (
            document_id, project_id, task_title, source_excerpt, suggested_owner_text,
            deadline, status, risk_level, created_by_ai, ai_confidence
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)`,
          [
            documentId,
            document.project_id,
            String(item.title).trim(),
            item.source || null,
            item.suggested_owner || item.suggested_owner_text || null,
            cleanDeadline(item.deadline),
            'draft',
            cleanRisk(item.risk),
            clampConfidence(item.confidence, 0.7),
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

// Edit the AI-generated summary's text (manager/admin). Editing invalidates any
// prior review, so the summary returns to Draft for re-confirmation.
export const updateSummary = async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { summary_text } = req.body;

    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    if (!summary_text || !String(summary_text).trim()) {
      return res.status(400).json({ success: false, error: 'Summary text is required' });
    }

    const docResult = await query(
      `SELECT project_id FROM documents WHERE id = $1`,
      [documentId]
    );
    if (docResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const accessResult = await query(
      `SELECT pm.project_role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [docResult.rows[0].project_id, req.user.id]
    );
    const isAdmin = req.user.system_role === 'admin';
    const isManager = accessResult.rows[0]?.project_role === 'manager';
    if (!isAdmin && !isManager) {
      return res.status(403).json({
        success: false,
        error: 'Only managers and admins can edit AI content',
      });
    }

    const updated = await query(
      `UPDATE ai_summaries
       SET summary_text = $1, review_status = 'draft',
           reviewed_by = NULL, reviewed_at = NULL, review_note = NULL
       WHERE document_id = $2
       RETURNING id`,
      [String(summary_text).trim(), documentId]
    );
    if (updated.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Summary not found' });
    }

    return res.json({ success: true, message: 'Summary updated' });
  } catch (error) {
    console.error('Update summary error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
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

// Edit an AI-extracted decision's text (manager/admin). Editing invalidates any
// prior review, so the decision goes back to Draft for re-confirmation.
export const updateDecision = async (req: Request, res: Response) => {
  try {
    const { decisionId } = req.params;
    const { decision_text } = req.body;

    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    if (!decision_text || !String(decision_text).trim()) {
      return res.status(400).json({ success: false, error: 'Decision text is required' });
    }

    const decResult = await query(
      `SELECT d.document_id, doc.project_id
       FROM decisions d JOIN documents doc ON d.document_id = doc.id
       WHERE d.id = $1`,
      [decisionId]
    );
    if (decResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Decision not found' });
    }

    const accessResult = await query(
      `SELECT pm.project_role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [decResult.rows[0].project_id, req.user.id]
    );
    const isAdmin = req.user.system_role === 'admin';
    const isManager = accessResult.rows[0]?.project_role === 'manager';
    if (!isAdmin && !isManager) {
      return res.status(403).json({
        success: false,
        error: 'Only managers and admins can edit AI content',
      });
    }

    await query(
      `UPDATE decisions
       SET decision_text = $1, review_status = 'draft',
           reviewed_by = NULL, reviewed_at = NULL, review_note = NULL
       WHERE id = $2`,
      [String(decision_text).trim(), decisionId]
    );

    return res.json({ success: true, message: 'Decision updated' });
  } catch (error) {
    console.error('Update decision error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
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
