import express from 'express';
import { login, getCurrentUser } from '../handlers/auth';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/login', login);

// Protected routes
router.get('/me', verifyToken, getCurrentUser);

export default router;
