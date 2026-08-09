import express from 'express';
import {
  getDashboard,
  getProjectDashboard,
  getUserMetrics,
} from '../handlers/dashboard';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Get user's main dashboard (all accessible projects)
router.get('/', getDashboard);

// Get project-specific dashboard
router.get('/project/:projectId', getProjectDashboard);

// Get user's personal metrics and assigned tasks
router.get('/my-metrics', getUserMetrics);

export default router;
