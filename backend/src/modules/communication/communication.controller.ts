import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenant.middleware';
import * as svc   from './communication.service';
import * as queue from './notification.queue';

const handle = (res: Response, err: any) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error('[CommunicationController]', err);
  return res.status(500).json({ error: 'Internal Server Error' });
};

// ─── Announcements ────────────────────────────────────────────────────────────

export const createAnnouncement = async (req: TenantRequest, res: Response) => {
  try {
    const { title, message, target_type, target_id, expires_at } = req.body;
    if (!title || !message || !target_type) {
      res.status(400).json({ error: 'title, message, and target_type are required' }); return;
    }
    const ann = await svc.createAnnouncement(req.tenantId!, req.user!.id, { title, message, target_type, target_id, expires_at });
    res.status(201).json({ message: 'Announcement created and notifications queued', announcement: ann });
  } catch (err: any) { handle(res, err); }
};

export const getAnnouncements = async (req: TenantRequest, res: Response) => {
  try {
    const { target_type, target_id } = req.query;
    const data = await svc.getAnnouncements(req.tenantId!, target_type as string, target_id as string);
    res.status(200).json({ announcements: data });
  } catch (err: any) { handle(res, err); }
};

// ─── Notices ─────────────────────────────────────────────────────────────────

export const createNotice = async (req: TenantRequest, res: Response) => {
  try {
    const { title, content, priority, expires_at } = req.body;
    if (!title || !content) { res.status(400).json({ error: 'title and content are required' }); return; }
    const notice = await svc.createNotice(req.tenantId!, req.user!.id, { title, content, priority, expires_at });
    res.status(201).json({ message: 'Notice created', notice });
  } catch (err: any) { handle(res, err); }
};

export const getNotices = async (req: TenantRequest, res: Response) => {
  try {
    const data = await svc.getNotices(req.tenantId!, req.query.priority as string);
    res.status(200).json({ notices: data });
  } catch (err: any) { handle(res, err); }
};

// ─── In-App Notifications ─────────────────────────────────────────────────────

export const getMyNotifications = async (req: TenantRequest, res: Response) => {
  try {
    const unread_only = req.query.unread === 'true';
    const data = await svc.getMyNotifications(req.tenantId!, req.user!.id, unread_only);
    res.status(200).json(data);
  } catch (err: any) { handle(res, err); }
};

export const markAsRead = async (req: TenantRequest, res: Response) => {
  try {
    const notif = await svc.markAsRead(req.tenantId!, req.user!.id, req.params.id);
    res.status(200).json({ message: 'Marked as read', notification: notif });
  } catch (err: any) { handle(res, err); }
};

export const markAllAsRead = async (req: TenantRequest, res: Response) => {
  try {
    const result = await svc.markAllAsRead(req.tenantId!, req.user!.id);
    res.status(200).json({ message: `${result.count} notifications marked as read` });
  } catch (err: any) { handle(res, err); }
};

// ─── Templates ───────────────────────────────────────────────────────────────

export const createTemplate = async (req: TenantRequest, res: Response) => {
  try {
    const { name, type, channel, template_body } = req.body;
    if (!name || !type || !channel || !template_body) {
      res.status(400).json({ error: 'name, type, channel, template_body are required' }); return;
    }
    const tmpl = await svc.createTemplate(req.tenantId!, { name, type, channel, template_body });
    res.status(201).json({ message: 'Template created', template: tmpl });
  } catch (err: any) { handle(res, err); }
};

export const getTemplates = async (req: TenantRequest, res: Response) => {
  try {
    const data = await svc.getTemplates(req.tenantId!, req.query.type as string, req.query.channel as string);
    res.status(200).json({ templates: data });
  } catch (err: any) { handle(res, err); }
};

export const updateTemplate = async (req: TenantRequest, res: Response) => {
  try {
    const tmpl = await svc.updateTemplate(req.tenantId!, req.params.id, req.body);
    res.status(200).json({ message: 'Template updated', template: tmpl });
  } catch (err: any) { handle(res, err); }
};

// ─── Queue ───────────────────────────────────────────────────────────────────

export const getQueueStatus = async (req: TenantRequest, res: Response) => {
  try {
    const data = await queue.getQueueStatus(req.tenantId!);
    res.status(200).json({ queue: data });
  } catch (err: any) { handle(res, err); }
};

export const triggerQueueProcess = async (req: TenantRequest, res: Response) => {
  try {
    const result = await queue.processQueue(req.tenantId!, 100);
    res.status(200).json({ message: 'Queue processed', ...result });
  } catch (err: any) { handle(res, err); }
};

// ─── Manual notification ─────────────────────────────────────────────────────

export const sendManualNotification = async (req: TenantRequest, res: Response) => {
  try {
    const { user_id, title, message, channels } = req.body;
    if (!user_id || !title || !message) {
      res.status(400).json({ error: 'user_id, title, and message are required' }); return;
    }
    const notif = await svc.sendManualNotification(req.tenantId!, user_id, title, message, channels);
    res.status(200).json({ message: 'Notification sent', notification: notif });
  } catch (err: any) { handle(res, err); }
};
