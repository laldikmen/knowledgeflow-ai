import express from 'express';
import {
  askQuestion,
  getChatHistory,
  getProjectChatHistory,
} from '../handlers/chat';
import { verifyToken, requireProjectAccess } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Ask a question in a project context
router.post('/:projectId', requireProjectAccess, askQuestion);

// Get user's chat history for a specific project
router.get('/:projectId/my-history', requireProjectAccess, getChatHistory);

// Get all chat history for a project (managers only)
router.get('/:projectId/history', requireProjectAccess, getProjectChatHistory);

export default router;
