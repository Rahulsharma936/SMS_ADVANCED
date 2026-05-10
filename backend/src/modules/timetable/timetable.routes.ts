import { Router } from 'express';
import { createTimetable, addSlot, deleteSlot, getTimetable } from './timetable.controller';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
router.use(tenantMiddleware, authMiddleware);

router.post('/', rbacMiddleware(['Admin']), createTimetable);
router.post('/slots', rbacMiddleware(['Admin']), addSlot);
router.delete('/slots/:slotId', rbacMiddleware(['Admin']), deleteSlot);
router.get('/:class_id/:section_id', getTimetable);

export default router;
