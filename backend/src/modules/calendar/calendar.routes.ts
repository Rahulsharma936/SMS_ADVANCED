import { Router } from 'express';
import { createEvent, getEvents, updateEvent, deleteEvent } from './calendar.controller';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
router.use(tenantMiddleware, authMiddleware);

router.post('/events', rbacMiddleware(['Admin']), createEvent);
router.get('/events', getEvents);
router.patch('/events/:id', rbacMiddleware(['Admin']), updateEvent);
router.delete('/events/:id', rbacMiddleware(['Admin']), deleteEvent);

export default router;
