import { Request, Response } from 'express';
import { query } from '../db/connection';
import AWS from 'aws-sdk';
import { randomUUID } from 'crypto';

const s3 = new AWS.S3({
  region: process.env.S3_REGION || 'us-east-1',
});

export const uploadDocument = async (req: Request, res: Response) => {
  try {
    const { projectId, title, document_type, description } = req.body;

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
    const uploadParams = {
      Bucket: process.env.S3_BUCKET || 'knowledgeflow-documents',
      Key: s3Key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    await s3.upload(uploadParams).promise();

    // Save metadata to database
    const result = await query(
      `INSERT INTO documents (project_id, uploaded_by, title, description, file_name, file_type, document_type, s3_key, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'uploaded')
       RETURNING id, title, file_name, document_type, status, uploaded_at`,
      [projectId, req.user.id, title || req.file.originalname, description, req.file.originalname, req.file.mimetype, document_type, s3Key]
    );

    const document = result.rows[0];

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

    // Get AI-generated content
    const aiResult = await query(
      `SELECT
        s.summary_text, s.review_status as summary_review_status, s.ai_confidence as summary_confidence,
        d2.decision_text, d2.review_status as decision_review_status, d2.ai_confidence as decision_confidence
      FROM documents doc
      LEFT JOIN ai_summaries s ON doc.id = s.document_id
      LEFT JOIN decisions d2 ON doc.id = d2.document_id
      WHERE doc.id = $1`,
      [documentId]
    );

    if (aiResult.rows.length > 0) {
      document.ai_summary = aiResult.rows[0].summary_text;
      document.summary_review_status = aiResult.rows[0].summary_review_status;
      document.summary_confidence = aiResult.rows[0].summary_confidence;
      document.decisions = aiResult.rows.filter(row => row.decision_text);
    }

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
      await s3.deleteObject({
        Bucket: process.env.S3_BUCKET || 'knowledgeflow-documents',
        Key: document.s3_key,
      }).promise();
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
