import { Router } from 'express';
import {
  createTeacher,
  getTeachers,
  getTeacherById,
  updateTeacher,
  assignClassTeacher,
  assignSubjectToTeacher,
  getTeacherWorkload,
} from './teacher.controller';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// Teacher CRUD
router.post('/', rbacMiddleware(['Admin']), createTeacher);
router.get('/', getTeachers);
router.get('/:id', getTeacherById);
router.patch('/:id', rbacMiddleware(['Admin']), updateTeacher);

// Assignment endpoints
router.post('/assign-class', rbacMiddleware(['Admin']), assignClassTeacher);
router.post('/assign-subject', rbacMiddleware(['Admin']), assignSubjectToTeacher);

// Workload
router.get('/:id/workload', getTeacherWorkload);

export default router;
