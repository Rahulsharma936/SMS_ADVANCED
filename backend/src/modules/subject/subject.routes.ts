import { Router } from 'express';
import { createSubject, getSubjects, getSubjectCount } from './subject.controller';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(tenantMiddleware, authMiddleware);

router.post('/', rbacMiddleware(['Admin']), createSubject);
router.get('/count', getSubjectCount); // P2A: lightweight count for dashboard
router.get('/', getSubjects);

export default router;
