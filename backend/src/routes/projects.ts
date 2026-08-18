import express from 'express';
import {
  getAccessibleProjects,
  getProjectDetail,
  createProject,
  addProjectMember,
  removeProjectMember,
} from '../handlers/projects';
import { verifyToken, requireProjectAccess } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Get all accessible projects
router.get('/', getAccessibleProjects);

// Create new project (admin only)
router.post('/', createProject);

// Get project details
router.get('/:projectId', requireProjectAccess, getProjectDetail);

// Add member to project
router.post('/:projectId/members', requireProjectAccess, addProjectMember);

// Remove member from project
router.delete('/:projectId/members/:userId', requireProjectAccess, removeProjectMember);

export default router;
