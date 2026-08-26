import express from 'express';
import {
  getNotifications,
  markAllRead,
  markOneRead,
  triggerDigest,
} from '../handlers/notifications';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

router.use(verifyToken);

// The caller's recent notifications + unread count
router.get('/', getNotifications);

// Mark all read
router.post('/read', markAllRead);

// Mark one read
router.patch('/:id/read', markOneRead);

// Manually run the daily digest (admin only) — for the demo and local testing
router.post('/run-digest', triggerDigest);

export default router;
