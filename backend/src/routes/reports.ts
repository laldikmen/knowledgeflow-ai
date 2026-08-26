import express from 'express';
import { getPublicReport, getReportPdf } from '../handlers/reports';

// PUBLIC routes — no authentication. Access is controlled by the unguessable,
// expiring report token in the URL.
const router = express.Router();

router.get('/:token', getPublicReport);
router.get('/:token/pdf', getReportPdf);

export default router;
