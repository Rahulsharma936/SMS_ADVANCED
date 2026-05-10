/**
 * communication.service.ts — Phase 10
 *
 * Handles announcements, notices, in-app notifications, and templates.
 * Controllers call service → service enqueues → queue handles delivery.
 */

import { prisma } from '../../prisma/client';
import { enqueueNotification, enqueueBatch } from './notification.queue';

const notFound  = (m: string) => Object.assign(new Error(m), { status: 404 });
const badReq    = (m: string) => Object.assign(new Error(m), { status: 400 });
const forbidden = (m: string) => Object.assign(new Error(m), { status: 403 });

// ─── ANNOUNCEMENT ─────────────────────────────────────────────────────────────

export interface CreateAnnouncementInput {
  title:       string;
  message:     string;
  target_type: 'school' | 'class' | 'section';
  target_id?:  string;
  expires_at?: string;
}

export const createAnnouncement = async (
  tenantId: string,
  userId:   string,
  input:    CreateAnnouncementInput
) => {
  if (input.target_type !== 'school' && !input.target_id) {
    throw badReq('target_id is required for class or section announcements');
  }

  const announcement = await prisma.announcement.create({
    data: {
      tenant_id:   tenantId,
      title:       input.title,
      message:     input.message,
      created_by:  userId,
      target_type: input.target_type,
      target_id:   input.target_id ?? null,
      expires_at:  input.expires_at ? new Date(input.expires_at) : null,
    },
    include: { createdBy: { select: { id: true, email: true } } },
  });

  // Fan-out: identify recipients and enqueue in-app notifications
  await fanOutAnnouncement(tenantId, announcement);

  return announcement;
};

/**
 * Identify recipient users based on target_type and create in-app notifications + queue jobs.
 * Uses a single query per target type to avoid N+1.
 */
async function fanOutAnnouncement(tenantId: string, announcement: any) {
  let users: { id: string; email: string }[] = [];

  if (announcement.target_type === 'school') {
    users = await prisma.user.findMany({
      where:  { tenant_id: tenantId, status: 'ACTIVE' },
      select: { id: true, email: true },
    });
  } else if (announcement.target_type === 'class') {
    // Get all students in this class → their user accounts
    const students = await prisma.student.findMany({
      where:   { tenant_id: tenantId, class_id: announcement.target_id!, deletedAt: null, user_id: { not: null } },
      select:  { user_id: true, user: { select: { id: true, email: true } } },
    });
    users = students.flatMap(s => s.user ? [{ id: s.user.id, email: s.user.email }] : []);
    // Also include teachers assigned to this class
    const classTeachers = await prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        status:    'ACTIVE',
        teachers: { some: { markedSessions: { some: { class_id: announcement.target_id! } } } },
      },
      select: { id: true, email: true },
    });
    users = [...users, ...classTeachers];
  } else if (announcement.target_type === 'section') {
    const students = await prisma.student.findMany({
      where:  { tenant_id: tenantId, section_id: announcement.target_id!, deletedAt: null, user_id: { not: null } },
      select: { user_id: true, user: { select: { id: true, email: true } } },
    });
    users = students.flatMap(s => s.user ? [{ id: s.user.id, email: s.user.email }] : []);
  }

  if (users.length === 0) return;

  // Deduplicate by user_id
  const unique = Array.from(new Map(users.map(u => [u.id, u])).values());

  // Bulk-create in-app notifications
  await prisma.inAppNotification.createMany({
    data: unique.map(u => ({
      tenant_id: tenantId,
      user_id:   u.id,
      type:      'announcement',
      title:     announcement.title,
      message:   announcement.message,
      ref_id:    announcement.id,
    })),
    skipDuplicates: true,
  });

  // Enqueue in_app channel jobs (processed instantly) + future email jobs
  await enqueueBatch(
    unique.map(u => ({
      tenant_id: tenantId,
      type:      'announcement',
      channel:   'in_app',
      recipient: u.id,
      title:     announcement.title,
      message:   announcement.message,
      ref_id:    announcement.id,
    }))
  );
}

export const getAnnouncements = async (
  tenantId:    string,
  target_type?: string,
  target_id?:  string
) => {
  const now = new Date();
  return prisma.announcement.findMany({
    where: {
      tenant_id:  tenantId,
      OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      ...(target_type ? { target_type }                                  : {}),
      ...(target_id   ? { OR: [{ target_id }, { target_type: 'school' }] } : {}),
    },
    include: { createdBy: { select: { id: true, email: true } } },
    orderBy: { created_at: 'desc' },
  });
};

// ─── NOTICE ───────────────────────────────────────────────────────────────────

export interface CreateNoticeInput {
  title:      string;
  content:    string;
  priority?:  'low' | 'medium' | 'high';
  expires_at?: string;
}

export const createNotice = async (
  tenantId: string,
  userId:   string,
  input:    CreateNoticeInput
) => {
  const notice = await prisma.notice.create({
    data: {
      tenant_id:  tenantId,
      title:      input.title,
      content:    input.content,
      priority:   input.priority ?? 'medium',
      created_by: userId,
      expires_at: input.expires_at ? new Date(input.expires_at) : null,
    },
    include: { createdBy: { select: { id: true, email: true } } },
  });

  // Notify all active users about the new notice (in-app only)
  const users = await prisma.user.findMany({
    where:  { tenant_id: tenantId, status: 'ACTIVE' },
    select: { id: true },
  });

  if (users.length > 0) {
    await prisma.inAppNotification.createMany({
      data: users.map(u => ({
        tenant_id: tenantId,
        user_id:   u.id,
        type:      'notice',
        title:     `📌 Notice: ${notice.title}`,
        message:   notice.content.slice(0, 200),
        ref_id:    notice.id,
      })),
      skipDuplicates: true,
    });
  }

  return notice;
};

export const getNotices = async (tenantId: string, priority?: string) => {
  const now = new Date();
  return prisma.notice.findMany({
    where: {
      tenant_id: tenantId,
      OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      ...(priority ? { priority } : {}),
    },
    include: { createdBy: { select: { id: true, email: true } } },
    orderBy: [{ priority: 'desc' }, { published_at: 'desc' }],
  });
};

// ─── IN-APP NOTIFICATIONS ─────────────────────────────────────────────────────

export const getMyNotifications = async (
  tenantId: string,
  userId:   string,
  unread_only = false
) => {
  const [notifications, unreadCount] = await Promise.all([
    prisma.inAppNotification.findMany({
      where: {
        tenant_id: tenantId,
        user_id:   userId,
        ...(unread_only ? { is_read: false } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    }),
    prisma.inAppNotification.count({
      where: { tenant_id: tenantId, user_id: userId, is_read: false },
    }),
  ]);

  return { notifications, unread_count: unreadCount };
};

export const markAsRead = async (
  tenantId: string,
  userId:   string,
  notifId:  string
) => {
  const notif = await prisma.inAppNotification.findFirst({
    where: { id: notifId, tenant_id: tenantId, user_id: userId },
  });
  if (!notif) throw notFound('Notification not found');

  return prisma.inAppNotification.update({
    where: { id: notifId },
    data:  { is_read: true },
  });
};

export const markAllAsRead = async (tenantId: string, userId: string) => {
  return prisma.inAppNotification.updateMany({
    where: { tenant_id: tenantId, user_id: userId, is_read: false },
    data:  { is_read: true },
  });
};

// ─── NOTIFICATION TEMPLATES ───────────────────────────────────────────────────

export interface CreateTemplateInput {
  name:          string;
  type:          string;
  channel:       string;
  template_body: string;
}

export const createTemplate = async (tenantId: string, input: CreateTemplateInput) => {
  return prisma.notificationTemplate.create({
    data: { tenant_id: tenantId, ...input },
  });
};

export const getTemplates = async (tenantId: string, type?: string, channel?: string) => {
  return prisma.notificationTemplate.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true,
      ...(type    ? { type }    : {}),
      ...(channel ? { channel } : {}),
    },
    orderBy: { created_at: 'desc' },
  });
};

export const updateTemplate = async (tenantId: string, id: string, data: Partial<CreateTemplateInput> & { is_active?: boolean }) => {
  const tmpl = await prisma.notificationTemplate.findFirst({ where: { id, tenant_id: tenantId } });
  if (!tmpl) throw notFound('Template not found');
  return prisma.notificationTemplate.update({ where: { id }, data });
};

// ─── SEND MANUAL NOTIFICATION (Admin → specific user) ─────────────────────────

export const sendManualNotification = async (
  tenantId:  string,
  targetUserId: string,
  title:     string,
  message:   string,
  channels:  string[] = ['in_app'],
  ref_id?:   string
) => {
  const user = await prisma.user.findFirst({
    where: { id: targetUserId, tenant_id: tenantId },
    select: { id: true, email: true },
  });
  if (!user) throw notFound('User not found');

  // Create in-app notification
  const notif = await prisma.inAppNotification.create({
    data: { tenant_id: tenantId, user_id: user.id, type: 'general', title, message, ref_id: ref_id ?? null },
  });

  // Enqueue all specified channels
  await enqueueBatch(
    channels.map(ch => ({
      tenant_id: tenantId,
      type:      'general',
      channel:   ch,
      recipient: ch === 'in_app' ? user.id : user.email,
      title,
      message,
      ref_id,
    }))
  );

  return notif;
};
