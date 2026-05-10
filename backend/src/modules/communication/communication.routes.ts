import { Router } from 'express';
import {
  createAnnouncement, getAnnouncements,
  createNotice, getNotices,
  getMyNotifications, markAsRead, markAllAsRead,
  createTemplate, getTemplates, updateTemplate,
  getQueueStatus, triggerQueueProcess,
  sendManualNotification,
} from './communication.controller';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { authMiddleware }   from '../../middlewares/auth.middleware';
import { rbacMiddleware }   from '../../middlewares/rbac.middleware';

const router = Router();
router.use(tenantMiddleware, authMiddleware);

// ─── Announcements ───────────────────────────────────────────────────────────
// Static paths before param paths
router.post('/',           rbacMiddleware(['Admin', 'Teacher']), createAnnouncement);
router.get('/',                                                  getAnnouncements);

// ─── Notices ─────────────────────────────────────────────────────────────────
router.post('/notices',    rbacMiddleware(['Admin']),            createNotice);
router.get('/notices',                                           getNotices);

// ─── In-App Notifications ────────────────────────────────────────────────────
router.get('/notifications',                                     getMyNotifications);
router.patch('/notifications/read-all',                          markAllAsRead);
router.patch('/notifications/:id/read',                          markAsRead);

// ─── Templates ───────────────────────────────────────────────────────────────
router.post('/templates',           rbacMiddleware(['Admin']),   createTemplate);
router.get('/templates',            rbacMiddleware(['Admin']),   getTemplates);
router.patch('/templates/:id',      rbacMiddleware(['Admin']),   updateTemplate);

// ─── Queue ───────────────────────────────────────────────────────────────────
router.get('/queue/status',         rbacMiddleware(['Admin']),   getQueueStatus);
router.post('/queue/process',       rbacMiddleware(['Admin']),   triggerQueueProcess);

// ─── Manual send ─────────────────────────────────────────────────────────────
router.post('/send',                rbacMiddleware(['Admin']),   sendManualNotification);

export default router;
