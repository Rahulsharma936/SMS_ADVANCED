import { Router } from 'express';
import { createSyllabus, getSyllabi, addTopics } from './syllabus.controller';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
router.use(tenantMiddleware, authMiddleware);

router.post('/', rbacMiddleware(['Admin']), createSyllabus);
router.get('/', getSyllabi);
router.post('/:id/topics', rbacMiddleware(['Admin']), addTopics);

export default router;
