import { Router } from 'express';
import { getMe, getUsers } from './user.controller';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();

// /api/users
// Apply middleware to protect the route
router.get('/me', tenantMiddleware, authMiddleware, getMe);

// List all users in the tenant (requires auth, scoped to tenant)
router.get('/', tenantMiddleware, authMiddleware, getUsers);

// Example of purely Admin route using RBAC
// router.get('/admin-only', tenantMiddleware, authMiddleware, rbacMiddleware(['Admin']), getMe);

export default router;

