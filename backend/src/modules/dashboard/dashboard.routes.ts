import { Router } from 'express';
import { getDashboardSummary } from './dashboard.controller';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// P2B: Consolidated dashboard data in one request
router.get('/summary', getDashboardSummary);

export default router;
