import express from 'express';
import {
  getUsers,
  createUser,
  updateUser,
  setUserMemberships,
  updateUserStatus,
  deleteUser,
} from '../handlers/users';
import { verifyToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// List users (any authenticated user — needed for task-owner dropdowns)
router.get('/', getUsers);

// Create a user account (admin only)
router.post('/', requireAdmin, createUser);

// Update a user account (admin only)
router.put('/:userId', requireAdmin, updateUser);

// Replace a user's project memberships (admin only)
router.put('/:userId/memberships', requireAdmin, setUserMemberships);

// Activate / deactivate a user account (admin only)
router.patch('/:userId/status', requireAdmin, updateUserStatus);

// Permanently delete a user account (admin only)
router.delete('/:userId', requireAdmin, deleteUser);

export default router;
