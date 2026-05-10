import { Router } from 'express';
import {
  markAttendance, getClassAttendance, getStudentAttendance,
  getClassReport, getAbsenteeList,
  applyLeave, updateLeaveStatus, getLeaves,
  biometricSync,
} from './attendance.controller';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// Attendance marking & viewing
router.post('/mark', rbacMiddleware(['Admin', 'Teacher']), markAttendance);
router.get('/class', getClassAttendance);
router.get('/student/:id', getStudentAttendance);

// Reports
router.get('/report/class', getClassReport);
router.get('/absentees', getAbsenteeList);

// Leave management
router.post('/leave/apply', applyLeave);
router.patch('/leave/:id', rbacMiddleware(['Admin', 'Teacher']), updateLeaveStatus);
router.get('/leave', getLeaves);

// Biometric sync (admin only)
router.post('/biometric-sync', rbacMiddleware(['Admin']), biometricSync);

export default router;
