import express from 'express';
import {
  login,
  getCurrentUser,
  getInviteInfo,
  setPassword,
  forgotPassword,
} from '../handlers/auth';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/login', login);
router.get('/invite/:token', getInviteInfo);
router.post('/set-password', setPassword);
router.post('/forgot-password', forgotPassword);

// Protected routes
router.get('/me', verifyToken, getCurrentUser);

export default router;
