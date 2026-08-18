import express from 'express';
import {
  createTask,
  getAllTasks,
  getProjectTasks,
  getTaskDetail,
  updateTask,
  deleteTask,
  assignTask,
} from '../handlers/tasks';
import { verifyToken, requireProjectAccess } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// List all accessible tasks
router.get('/', getAllTasks);

// Create task (admin or manager only)
router.post('/', createTask);

// Get tasks by project
router.get('/project/:projectId', requireProjectAccess, getProjectTasks);

// Get task details
router.get('/:taskId', getTaskDetail);

// Update task
router.put('/:taskId', updateTask);

// Delete task (admin or manager only)
router.delete('/:taskId', deleteTask);

// Assign task to user (admin or manager only)
router.post('/:taskId/assign', assignTask);

export default router;
