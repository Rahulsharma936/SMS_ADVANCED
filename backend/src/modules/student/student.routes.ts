import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import {
  admitStudent, getStudents, getStudentById, updateStudent,
  deleteStudent, transferStudent, bulkPromote, bulkStatusUpdate,
  bulkImport, exportStudents, getStudentStats, uploadDocument,
} from './student.controller';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();

// ─── Multer config ───
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../../uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });
const memoryUpload = multer({ storage: multer.memoryStorage() }); // For xlsx parsing

// All routes require tenant + auth
router.use(tenantMiddleware, authMiddleware);

// ─── Stats ───
router.get('/stats', getStudentStats);

// ─── Export ───
router.get('/export', rbacMiddleware(['Admin']), exportStudents);

// ─── Bulk Operations ───
router.post('/bulk-import', rbacMiddleware(['Admin']), memoryUpload.single('file'), bulkImport);
router.post('/bulk-promote', rbacMiddleware(['Admin']), bulkPromote);
router.post('/bulk-status', rbacMiddleware(['Admin']), bulkStatusUpdate);

// ─── CRUD ───
router.post('/', rbacMiddleware(['Admin']), admitStudent);
router.get('/', getStudents);
router.get('/:id', getStudentById);
router.patch('/:id', rbacMiddleware(['Admin']), updateStudent);
router.delete('/:id', rbacMiddleware(['Admin']), deleteStudent);

// ─── Transfer ───
router.post('/:id/transfer', rbacMiddleware(['Admin']), transferStudent);

// ─── Document Upload ───
router.post('/:id/documents', rbacMiddleware(['Admin']), upload.single('file'), uploadDocument);

export default router;
