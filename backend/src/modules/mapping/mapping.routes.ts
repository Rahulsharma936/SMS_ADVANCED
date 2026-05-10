import { Router } from 'express';
import { createMapping, getMappings } from './mapping.controller';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(tenantMiddleware, authMiddleware);

router.post('/', rbacMiddleware(['Admin']), createMapping);
router.get('/', getMappings);

export default router;
