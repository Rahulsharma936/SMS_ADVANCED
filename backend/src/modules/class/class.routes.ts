import { Router } from 'express';
import { createClass, getClasses, createSection, getSections } from './class.controller';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();

// All routes require tenant + auth
router.use(tenantMiddleware, authMiddleware);

// Classes
router.post('/', rbacMiddleware(['Admin']), createClass);
router.get('/', getClasses);

// Sections
router.post('/sections', rbacMiddleware(['Admin']), createSection);
router.get('/sections', getSections);

export default router;
