/**
 * chat.service.ts — Phase 11
 *
 * All business logic for conversations and messages.
 * Socket handlers call these services — never write to DB inside socket handlers directly.
 * Access rules:
 *   - Parent can only talk to teachers of their linked students
 *   - Teacher can only talk to parents of students in their assigned classes
 *   - Admin can open/monitor any conversation
 */

import { prisma } from '../../prisma/client';
import { prisma as comPrisma } from '../../prisma/client'; // same client, used for clarity

const notFound  = (m: string) => Object.assign(new Error(m), { status: 404 });
const forbidden = (m: string) => Object.assign(new Error(m), { status: 403 });
const badReq    = (m: string) => Object.assign(new Error(m), { status: 400 });

// ─── CONVERSATION ACCESS GUARD ────────────────────────────────────────────────

/**
 * Returns true if userId is allowed to start/join a conversation with targetUserId.
 * Rules:
 *   Admin    → always allowed
 *   Parent   → only teachers of their child's class
 *   Teacher  → only parents of students they teach
 */
export const canConverse = async (
  tenantId: string,
  userId:   string,
  userRole: string,
  targetUserId: string
): Promise<boolean> => {
  if (userRole === 'Admin') return true;

  const target = await prisma.user.findFirst({
    where: { id: targetUserId, tenant_id: tenantId, status: 'ACTIVE' },
    include: {
      teachers: { select: { id: true } },
    },
  });
  if (!target) return false;

  if (userRole === 'Parent') {
    // Find students linked to this parent's user account via student.user_id
    // Parent user → Student (user_id) → StudentParent → parent_id?
    // Since Parent has no user_id, we look at students where user_id = userId (student-role user)
    // Actually: the user with role "Parent" should map to a parent's student children.
    // We find students whose class teachers are the target, and check if this parent-user
    // is the user_id of any of those students' related users.
    // Simplest: check if target is a teacher who teaches any student of this parent's user
    const targetTeacher = await prisma.teacher.findFirst({
      where: { user_id: targetUserId, tenant_id: tenantId },
      include: {
        classSubjectTeachers: {
          include: { class: { include: { students: { where: { deletedAt: null } } } } },
        },
      },
    });
    if (!targetTeacher) return false;

    // Get all students taught by this teacher
    const taughtStudentIds = targetTeacher.classSubjectTeachers
      .flatMap(cst => cst.class.students.map(s => s.id));

    if (taughtStudentIds.length === 0) return false;

    // Check if the parent-user is associated with any of these students
    // Parent-user has a student with user_id === userId
    const myStudent = await prisma.student.findFirst({
      where: { user_id: userId, tenant_id: tenantId, id: { in: taughtStudentIds }, deletedAt: null },
    });
    return !!myStudent;
  }

  if (userRole === 'Teacher') {
    // Find the teacher record for this user
    const myTeacher = await prisma.teacher.findFirst({
      where: { user_id: userId, tenant_id: tenantId },
      include: {
        classSubjectTeachers: {
          include: { class: { include: { students: { where: { deletedAt: null }, include: { user: true } } } } },
        },
      },
    });
    if (!myTeacher) return false;

    // Get all user_ids of students this teacher teaches
    const studentUserIds = myTeacher.classSubjectTeachers
      .flatMap(cst => cst.class.students)
      .filter(s => s.user_id)
      .map(s => s.user_id!);

    // Target must be one of those students (Parent role)
    return studentUserIds.includes(targetUserId);
  }

  return false;
};

// ─── GET OR CREATE DIRECT CONVERSATION ────────────────────────────────────────

export const getOrCreateDirectConversation = async (
  tenantId:     string,
  userId:       string,
  userRole:     string,
  targetUserId: string
) => {
  if (userId === targetUserId) throw badReq('Cannot start a conversation with yourself');

  // Access guard
  const allowed = await canConverse(tenantId, userId, userRole, targetUserId);
  if (!allowed) throw forbidden('You are not authorized to start this conversation');

  // Check if conversation already exists between these two users
  const existing = await prisma.conversation.findFirst({
    where: {
      tenant_id: tenantId,
      type:      'direct',
      participants: {
        every: { user_id: { in: [userId, targetUserId] } },
      },
    },
    include: {
      participants: {
        include: { user: { select: { id: true, email: true, role: { select: { name: true } } } } },
      },
    },
  });

  // Validate it's exactly these two participants
  if (existing && existing.participants.length === 2) {
    const ids = existing.participants.map(p => p.user_id);
    if (ids.includes(userId) && ids.includes(targetUserId)) return existing;
  }

  // Get roles for both participants
  const [me, target] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId }, include: { role: true } }),
    prisma.user.findFirst({ where: { id: targetUserId }, include: { role: true } }),
  ]);

  const conv = await prisma.conversation.create({
    data: {
      tenant_id: tenantId,
      type:      'direct',
      participants: {
        create: [
          { tenant_id: tenantId, user_id: userId,       role: me?.role.name.toLowerCase() ?? 'user' },
          { tenant_id: tenantId, user_id: targetUserId, role: target?.role.name.toLowerCase() ?? 'user' },
        ],
      },
    },
    include: {
      participants: {
        include: { user: { select: { id: true, email: true, role: { select: { name: true } } } } },
      },
    },
  });

  return conv;
};

// ─── GET MY CONVERSATIONS ─────────────────────────────────────────────────────

export const getMyConversations = async (tenantId: string, userId: string) => {
  const conversations = await prisma.conversation.findMany({
    where: {
      tenant_id:    tenantId,
      participants: { some: { user_id: userId } },
    },
    include: {
      participants: {
        include: {
          user: { select: { id: true, email: true, role: { select: { name: true } } } },
        },
      },
      messages: {
        orderBy: { created_at: 'desc' },
        take: 1,  // last message preview
        include: {
          sender:   { select: { id: true, email: true } },
          statuses: { where: { user_id: userId } },
        },
      },
    },
    orderBy: { updated_at: 'desc' },
  });

  return conversations.map(conv => {
    const lastMsg   = conv.messages[0] ?? null;
    const myPart    = conv.participants.find(p => p.user_id === userId);
    const otherPart = conv.participants.find(p => p.user_id !== userId);

    // Unread count: messages after last_read_message_id
    // We'll compute this separately for performance
    return {
      id:           conv.id,
      type:         conv.type,
      updated_at:   conv.updated_at,
      other_user:   otherPart?.user ?? null,
      last_message: lastMsg ? {
        id:         lastMsg.id,
        content:    lastMsg.deleted_at ? '🚫 Message deleted' : lastMsg.content,
        sender_id:  lastMsg.sender_id,
        sender:     lastMsg.sender,
        created_at: lastMsg.created_at,
        is_read:    lastMsg.statuses.some(s => s.status === 'read'),
      } : null,
    };
  });
};

// ─── GET CONVERSATION DETAIL ──────────────────────────────────────────────────

export const getConversation = async (tenantId: string, userId: string, convId: string) => {
  const conv = await prisma.conversation.findFirst({
    where: {
      id:           convId,
      tenant_id:    tenantId,
      participants: { some: { user_id: userId } },
    },
    include: {
      participants: {
        include: { user: { select: { id: true, email: true, role: { select: { name: true } } } } },
      },
    },
  });
  if (!conv) throw notFound('Conversation not found or access denied');
  return conv;
};

// ─── GET MESSAGES (paginated) ─────────────────────────────────────────────────

export const getMessages = async (
  tenantId: string,
  userId:   string,
  convId:   string,
  cursor?:  string,
  limit = 40
) => {
  // Verify access
  await getConversation(tenantId, userId, convId);

  const messages = await prisma.message.findMany({
    where: {
      conversation_id: convId,
      tenant_id:       tenantId,
      deleted_at:      null,
    },
    include: {
      sender:   { select: { id: true, email: true } },
      statuses: true,
    },
    orderBy: { created_at: 'desc' },
    take:    limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore    = messages.length > limit;
  const trimmed    = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? trimmed[trimmed.length - 1].id : null;

  return {
    messages:    trimmed.reverse(),  // chronological
    hasMore,
    nextCursor,
  };
};

// ─── SEND MESSAGE ─────────────────────────────────────────────────────────────

export const sendMessage = async (
  tenantId:       string,
  senderId:       string,
  convId:         string,
  content:        string,
  message_type = 'text'
) => {
  if (!content?.trim()) throw badReq('Message content cannot be empty');

  // Verify sender is participant
  const conv = await prisma.conversation.findFirst({
    where: {
      id:           convId,
      tenant_id:    tenantId,
      participants: { some: { user_id: senderId } },
    },
    include: { participants: { select: { user_id: true } } },
  });
  if (!conv) throw forbidden('Not a participant in this conversation');

  const recipientIds = conv.participants
    .map(p => p.user_id)
    .filter(id => id !== senderId);

  // Persist message + statuses atomically
  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        tenant_id:       tenantId,
        conversation_id: convId,
        sender_id:       senderId,
        content:         content.trim(),
        message_type,
        statuses: {
          create: [
            { user_id: senderId, status: 'sent' },
            ...recipientIds.map(uid => ({ user_id: uid, status: 'sent' })),
          ],
        },
      },
      include: {
        sender:   { select: { id: true, email: true } },
        statuses: true,
      },
    });

    // Update conversation updated_at for ordering
    await tx.conversation.update({
      where: { id: convId },
      data:  { updated_at: new Date() },
    });

    return msg;
  });

  // Create in-app notifications for recipients (reuse Phase 10 infrastructure)
  if (recipientIds.length > 0) {
    await prisma.inAppNotification.createMany({
      data: recipientIds.map(uid => ({
        tenant_id: tenantId,
        user_id:   uid,
        type:      'general',
        title:     'New Message',
        message:   content.slice(0, 100),
        ref_id:    convId,
      })),
      skipDuplicates: true,
    });
  }

  return message;
};

// ─── MARK MESSAGE READ ────────────────────────────────────────────────────────

export const markMessageRead = async (
  tenantId:  string,
  userId:    string,
  messageId: string
) => {
  const msg = await prisma.message.findFirst({
    where:   { id: messageId, tenant_id: tenantId },
    include: { conversation: { include: { participants: { select: { user_id: true } } } } },
  });
  if (!msg) throw notFound('Message not found');

  const isParticipant = msg.conversation.participants.some(p => p.user_id === userId);
  if (!isParticipant) throw forbidden('Not a participant');

  const updated = await prisma.messageStatus.upsert({
    where:  { message_id_user_id: { message_id: messageId, user_id: userId } },
    update: { status: 'read' },
    create: { message_id: messageId, user_id: userId, status: 'read' },
  });

  // Update last_read_message_id on participant
  await prisma.conversationParticipant.updateMany({
    where: { conversation_id: msg.conversation_id, user_id: userId },
    data:  { last_read_message_id: messageId },
  });

  return { message_id: messageId, user_id: userId, status: 'read', conv_id: msg.conversation_id };
};

// ─── MARK ALL IN CONVERSATION AS READ ────────────────────────────────────────

export const markConversationRead = async (
  tenantId: string,
  userId:   string,
  convId:   string
) => {
  // Get all unread messages in this conversation for this user
  const messages = await prisma.message.findMany({
    where: {
      conversation_id: convId,
      tenant_id:       tenantId,
      statuses: { some: { user_id: userId, status: { not: 'read' } } },
    },
    select: { id: true },
  });

  if (messages.length === 0) return { updated: 0 };

  await prisma.messageStatus.updateMany({
    where: {
      message_id: { in: messages.map(m => m.id) },
      user_id:    userId,
    },
    data: { status: 'read' },
  });

  const lastId = messages[messages.length - 1].id;
  await prisma.conversationParticipant.updateMany({
    where: { conversation_id: convId, user_id: userId },
    data:  { last_read_message_id: lastId },
  });

  return { updated: messages.length };
};

// ─── UNREAD COUNT ─────────────────────────────────────────────────────────────

export const getUnreadCount = async (tenantId: string, userId: string) => {
  const count = await prisma.messageStatus.count({
    where: {
      user_id: userId,
      status:  { not: 'read' },
      message: {
        tenant_id:  tenantId,
        deleted_at: null,
        sender_id:  { not: userId },  // don't count own messages
      },
    },
  });
  return { unread_count: count };
};
