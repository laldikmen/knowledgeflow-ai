import { Request, Response } from 'express';
import { query } from '../db/connection';

// Unified project activity feed: document uploads, confirmed decisions,
// confirmed summaries, and task status changes — merged in time order.
export const getProjectTimeline = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const result = await query(
      `SELECT type, title, description, ts, task_status FROM (
        -- Document uploads
        SELECT
          'document' AS type,
          'Document uploaded' AS title,
          COALESCE(u.name, 'Someone') || ' uploaded "' || d.title || '"' AS description,
          d.uploaded_at AS ts,
          NULL AS task_status
        FROM documents d
        LEFT JOIN users u ON d.uploaded_by = u.id
        WHERE d.project_id = $1

        UNION ALL
        -- Confirmed decisions
        SELECT
          'decision' AS type,
          'Decision confirmed' AS title,
          COALESCE(u.name, 'A reviewer') || ' confirmed "' || dec.decision_text || '"' AS description,
          dec.reviewed_at AS ts,
          NULL AS task_status
        FROM decisions dec
        JOIN documents d ON dec.document_id = d.id
        LEFT JOIN users u ON dec.reviewed_by = u.id
        WHERE d.project_id = $1
          AND dec.review_status = 'confirmed'
          AND dec.reviewed_at IS NOT NULL

        UNION ALL
        -- Confirmed AI summaries
        SELECT
          'decision' AS type,
          'Summary confirmed' AS title,
          COALESCE(u.name, 'A reviewer') || ' confirmed the AI summary for "' || d.title || '"' AS description,
          s.reviewed_at AS ts,
          NULL AS task_status
        FROM ai_summaries s
        JOIN documents d ON s.document_id = d.id
        LEFT JOIN users u ON s.reviewed_by = u.id
        WHERE d.project_id = $1
          AND s.review_status = 'confirmed'
          AND s.reviewed_at IS NOT NULL

        UNION ALL
        -- Task status changes
        SELECT
          'task' AS type,
          'Task ' || REPLACE(h.new_status, '_', ' ') AS title,
          COALESCE(u.name, 'Someone') || ' moved "' || a.task_title || '" to ' || REPLACE(h.new_status, '_', ' ') AS description,
          h.changed_at AS ts,
          h.new_status AS task_status
        FROM task_status_history h
        JOIN action_items a ON h.task_id = a.id
        LEFT JOIN users u ON h.changed_by = u.id
        WHERE a.project_id = $1
      ) events
      WHERE ts IS NOT NULL
      ORDER BY ts DESC`,
      [projectId]
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get project timeline error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
