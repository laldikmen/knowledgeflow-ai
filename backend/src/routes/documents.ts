import express from 'express';
import multer from 'multer';
import {
  uploadDocument,
  getAllDocuments,
  getProjectDocuments,
  getDocumentDetail,
  deleteDocument,
  setDocumentText,
} from '../handlers/documents';
import { verifyToken, requireProjectAccess } from '../middleware/auth';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

// All routes require authentication
router.use(verifyToken);

// List all accessible documents
router.get('/', getAllDocuments);

// Upload document
router.post('/upload', upload.single('file'), uploadDocument);

// Set document extracted text (for AI processing)
router.post('/:documentId/text', setDocumentText);

// Get documents in project
router.get('/project/:projectId', requireProjectAccess, getProjectDocuments);

// Get document details
router.get('/:documentId', getDocumentDetail);

// Delete document
router.delete('/:documentId', deleteDocument);

export default router;
