import express from 'express';
import {
  processDocument,
  reviewSummary,
  reviewDecision,
  reviewActionItem,
  getAISummary,
  getAIDecisions,
} from '../handlers/ai';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Process document with AI
router.post('/process/:documentId', processDocument);

// Review AI-generated content
router.post('/summary/:documentId/review', reviewSummary);
router.post('/decision/:decisionId/review', reviewDecision);
router.post('/action-item/:taskId/review', reviewActionItem);

// Get AI-generated content
router.get('/summary/:documentId', getAISummary);
router.get('/decisions/:documentId', getAIDecisions);

export default router;
