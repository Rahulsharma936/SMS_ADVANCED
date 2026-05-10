import { Router } from 'express';
import { updateProgress, getProgress } from './curriculum.controller';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();
router.use(tenantMiddleware, authMiddleware);

router.patch('/progress', updateProgress);
router.get('/progress', getProgress);

export default router;
