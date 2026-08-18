import express from 'express';
import { getProjectTimeline } from '../handlers/timeline';
import { verifyToken, requireProjectAccess } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Unified activity feed for a project (admin or project member only)
router.get('/:projectId', requireProjectAccess, getProjectTimeline);

export default router;
