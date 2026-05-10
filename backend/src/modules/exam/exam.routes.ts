import { Router } from 'express';
import {
  createExam, getExams, getExamById, updateExam,
  addExamSubjects, registerStudents,
  bulkEnterMarks, getStudentMarks,
  calculateResults, getClassResults, getStudentResult,
  generateReportCard,
  getGradeScales, upsertGradeScales,
} from './exam.controller';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
router.use(tenantMiddleware, authMiddleware);

// ─── Exam CRUD ───
router.post('/', rbacMiddleware(['Admin']), createExam);
router.get('/', getExams);
router.get('/:id', getExamById);
router.patch('/:id', rbacMiddleware(['Admin']), updateExam);

// ─── Exam Subject Config ───
router.post('/:id/subjects', rbacMiddleware(['Admin']), addExamSubjects);

// ─── Student Registration ───
router.post('/:id/register', rbacMiddleware(['Admin']), registerStudents);

// ─── Marks Entry (Teacher can enter marks for their subjects) ───
router.post('/:id/marks', rbacMiddleware(['Admin', 'Teacher']), bulkEnterMarks);
router.get('/:id/marks/student/:studentId', getStudentMarks);

// ─── Results ───
router.post('/:id/results/calculate', rbacMiddleware(['Admin']), calculateResults);
router.get('/:id/results', getClassResults);
router.get('/:id/results/student/:studentId', getStudentResult);

// ─── Report Card ───
router.post('/:id/report-card/:studentId', rbacMiddleware(['Admin', 'Teacher']), generateReportCard);

// ─── Grade Scales (separate prefix /grade-scales handled in server) ───
export const gradeScaleRouter = Router();
gradeScaleRouter.use(tenantMiddleware, authMiddleware);
gradeScaleRouter.get('/', getGradeScales);
gradeScaleRouter.post('/', rbacMiddleware(['Admin']), upsertGradeScales);

export default router;
