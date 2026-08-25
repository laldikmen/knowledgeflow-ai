import express from 'express';
import {
  askQuestion,
  getChatHistory,
  getProjectChatHistory,
  listConversations,
  getConversationMessages,
} from '../handlers/chat';
import { verifyToken, requireProjectAccess } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Ask a question in a project context (optionally within an existing conversation)
router.post('/:projectId', requireProjectAccess, askQuestion);

// List the caller's conversations for a project (history sidebar)
router.get('/:projectId/conversations', requireProjectAccess, listConversations);

// Get all messages in one conversation
router.get('/:projectId/conversations/:conversationId', requireProjectAccess, getConversationMessages);

// Get user's chat history for a specific project (flat messages — legacy)
router.get('/:projectId/my-history', requireProjectAccess, getChatHistory);

// Get all chat history for a project (managers only)
router.get('/:projectId/history', requireProjectAccess, getProjectChatHistory);

export default router;
