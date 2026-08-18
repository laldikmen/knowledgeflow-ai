import { Request, Response } from 'express';
import { query } from '../db/connection';
import * as AWS from 'aws-sdk';
import { randomUUID } from 'crypto';
import { extractText } from '../utils/textExtraction';

const s3 = new AWS.S3({
  region: process.env.S3_REGION || 'us-east-1',
});

export const uploadDocument = async (req: Request, res: Response) => {
  try {
    const { title, document_type, description } = req.body;
    // The frontend sends project_id (snake_case); accept both spellings.
    const projectId = req.body.project_id ?? req.body.projectId;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project is required',
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

    // Check if user can upload (not viewer)
    if (accessResult.rows.length > 0 && accessResult.rows[0].project_role === 'viewer') {
      return res.status(403).json({
        success: false,
        error: 'Viewers cannot upload documents',
      });
    }

    // Validate file size (max 50MB)
    if (req.file.size > 50 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: 'File size exceeds 50MB limit',
      });
    }

    // Generate S3 key
    const fileExtension = req.file.originalname.split('.').pop();
    const fileName = `${randomUUID()}.${fileExtension}`;
    const s3Key = `projects/${projectId}/documents/${fileName}`;

    // Upload to S3
    const bucket = process.env.S3_BUCKET || 'knowledgeflow-documents';
    const region = process.env.S3_REGION || 'us-east-1';
    const uploadParams = {
      Bucket: bucket,
      Key: s3Key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    // @ts-ignore
    await s3.upload(uploadParams).promise();

    const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;

    // Save metadata to database
    const result = await query(
      `INSERT INTO documents (project_id, uploaded_by, title, description, file_name, file_type, document_type, s3_key, s3_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'uploaded')
       RETURNING id, title, file_name, document_type, status, uploaded_at`,
      [projectId, req.user.id, title || req.file.originalname, description, req.file.originalname, req.file.mimetype, document_type, s3Key, s3Url]
    );

    const document = result.rows[0];

    // Extract the document's text so it's ready for AI processing (Bedrock).
    // Wrapped so a parse failure never fails the upload itself.
    try {
      const extracted = await extractText(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      );
      if (extracted) {
        await query(
          `INSERT INTO document_texts (document_id, extracted_text)
           VALUES ($1, $2)
           ON CONFLICT (document_id) DO UPDATE SET extracted_text = $2, updated_at = NOW()`,
          [document.id, extracted],
        );
      }
    } catch (extractionError) {
      console.error('Text extraction step failed:', extractionError);
    }

    return res.status(201).json({
      success: true,
      data: document,
      message: 'Document uploaded successfully',
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload document',
    });
  }
};

// List all documents the current user can access: admins see every document,
// members see documents in the projects they belong to.
export const getAllDocuments = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const isAdmin = req.user.system_role === 'admin';

    const base = `
      SELECT
        d.id, d.title, d.description, d.file_name, d.file_type, d.document_type,
        d.status, d.project_id,
        p.name AS project_name,
        u.name AS uploaded_by,
        d.uploaded_at AS created_at
      FROM documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      LEFT JOIN projects p ON d.project_id = p.id
    `;

    const sql = isAdmin
      ? `${base} ORDER BY d.uploaded_at DESC`
      : `${base}
         WHERE d.project_id IN (
           SELECT project_id FROM project_members WHERE user_id = $1
         )
         ORDER BY d.uploaded_at DESC`;

    const result = await query(sql, isAdmin ? [] : [req.user.id]);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get all documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const getProjectDocuments = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

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
      [projectId, req.user.id]
    );

    if (accessResult.rows.length === 0 && req.user.system_role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this project',
      });
    }

    // Get documents
    const result = await query(
      `SELECT
        d.id, d.title, d.description, d.file_name, d.file_type, d.document_type,
        d.status,
        u.name as uploaded_by_name, u.email as uploaded_by_email,
        d.uploaded_at
      FROM documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE d.project_id = $1
      ORDER BY d.uploaded_at DESC`,
      [projectId]
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const getDocumentDetail = async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Get document and verify access
    const result = await query(
      `SELECT
        d.id, d.project_id, d.title, d.description, d.file_name, d.file_type, d.document_type,
        d.status,
        u.name as uploaded_by_name, u.email as uploaded_by_email,
        d.uploaded_at,
        pm.project_role
      FROM documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      LEFT JOIN project_members pm ON d.project_id = pm.project_id AND pm.user_id = $1
      WHERE d.id = $2`,
      [req.user.id, documentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    const document = result.rows[0];

    // Check access
    if (document.project_role === null && req.user.system_role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Viewers may only see confirmed AI content; contributors/managers/admins
    // can also see drafts (enforced here, not just in the UI).
    const isViewer =
      document.project_role === 'viewer' && req.user.system_role !== 'admin';

    // AI-generated summary for this document (draft until a human confirms it).
    const summaryResult = await query(
      `SELECT id, summary_text, review_status, ai_confidence
       FROM ai_summaries WHERE document_id = $1`,
      [documentId]
    );

    const summaryRow = summaryResult.rows[0];
    document.summary =
      summaryRow && (!isViewer || summaryRow.review_status === 'confirmed')
        ? {
            id: summaryRow.id,
            text: summaryRow.summary_text,
            status: summaryRow.review_status,
            confidence: summaryRow.ai_confidence,
          }
        : null;

    // AI-extracted decisions (each carries its own id + review status).
    const decisionsResult = await query(
      `SELECT id, decision_text, source_excerpt, review_status, ai_confidence, reviewed_by
       FROM decisions WHERE document_id = $1
       ORDER BY id ASC`,
      [documentId]
    );

    document.decisions = decisionsResult.rows
      .filter((row) => !isViewer || row.review_status === 'confirmed')
      .map((row) => ({
        id: row.id,
        text: row.decision_text,
        source: row.source_excerpt,
        status: row.review_status,
        confidence: row.ai_confidence,
      }));

    return res.json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error('Get document detail error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const deleteDocument = async (req: Request, res: Response) => {
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
      `SELECT d.id, d.project_id, d.s3_key FROM documents d WHERE d.id = $1`,
      [documentId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    const document = docResult.rows[0];

    // Check access (admin or project manager)
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
        error: 'Only admins and project managers can delete documents',
      });
    }

    // Delete from S3
    if (document.s3_key) {
      const deleteParams = {
        Bucket: process.env.S3_BUCKET || 'knowledgeflow-documents',
        Key: document.s3_key,
      };
      // @ts-ignore
      await s3.deleteObject(deleteParams).promise();
    }

    // Delete from database (cascade will handle related records)
    await query('DELETE FROM documents WHERE id = $1', [documentId]);

    return res.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const setDocumentText = async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { extracted_text } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    if (!extracted_text || !extracted_text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Extracted text is required',
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
        error: 'Only admins and managers can set document text',
      });
    }

    // Store or update document text
    await query(
      `INSERT INTO document_texts (document_id, extracted_text)
       VALUES ($1, $2)
       ON CONFLICT (document_id) DO UPDATE SET extracted_text = $2`,
      [documentId, extracted_text]
    );

    return res.json({
      success: true,
      message: 'Document text stored successfully',
    });
  } catch (error) {
    console.error('Set document text error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
