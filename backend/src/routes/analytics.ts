import express from 'express';
import { getAnalytics } from '../handlers/analytics';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

router.use(verifyToken);
router.get('/', getAnalytics);

export default router;
