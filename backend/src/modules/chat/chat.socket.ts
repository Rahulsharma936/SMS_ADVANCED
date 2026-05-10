/**
 * chat.socket.ts — Phase 11
 *
 * Socket.IO event handlers. This file registers events on a given io instance.
 * Architecture:
 *   - Socket handlers validate auth then delegate to chat.service
 *   - NO direct DB writes inside handlers — all writes go through service
 *   - Tenant isolation: each socket joins a tenant room on connect
 *   - Room naming: "conv:{conversationId}" — participants auto-join on connect
 *
 * Connection flow:
 *   1. Client sends JWT + tenant_id in handshake auth
 *   2. Socket middleware verifies JWT, attaches user to socket.data
 *   3. On connect: user auto-joins all their conversation rooms
 *   4. On message:send → persist → emit to room
 */

import { Server, Socket } from 'socket.io';
import { verifyToken } from '../../utils/jwt.utils';
import { prisma } from '../../prisma/client';
import * as chatService from './chat.service';

interface SocketUser {
  id:        string;
  email:     string;
  tenant_id: string;
  role:      string;
}

// Use a typed socket via generic parameter
type ChatSocket = Socket & { data: { user: SocketUser } };

// ─── Auth Middleware ──────────────────────────────────────────────────────────

const socketAuthMiddleware = async (socket: ChatSocket, next: (err?: Error) => void) => {
  try {
    const token    = socket.handshake.auth?.token     as string | undefined;
    const tenantId = socket.handshake.auth?.tenant_id as string | undefined;

    if (!token || !tenantId) {
      return next(new Error('Authentication required: missing token or tenant_id'));
    }

    const decoded = verifyToken(token) as any;
    if (!decoded?.id || !decoded?.tenant_id) {
      return next(new Error('Authentication failed: invalid token'));
    }

    if (decoded.tenant_id !== tenantId) {
      return next(new Error('Authentication failed: tenant mismatch'));
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return next(new Error('Tenant not found'));

    socket.data.user = {
      id:        decoded.id,
      email:     decoded.email,
      tenant_id: tenantId,
      role:      decoded.role ?? 'User',
    };

    next();
  } catch {
    next(new Error('Authentication failed: invalid or expired token'));
  }
};

export const registerChatSocket = (io: Server) => {
  const chatNamespace = io.of('/chat');
  chatNamespace.use((s, next) => socketAuthMiddleware(s as unknown as ChatSocket, next));

  chatNamespace.on('connection', async (rawSocket) => {
    const socket = rawSocket as unknown as ChatSocket;
    const user   = socket.data.user;
    console.log(`[Socket] User connected: ${user.email} (${user.id})`);

    // ── Auto-join all user's conversation rooms ──
    try {
      const convs = await prisma.conversationParticipant.findMany({
        where:  { user_id: user.id, tenant_id: user.tenant_id },
        select: { conversation_id: true },
      });
      const rooms = convs.map(c => `conv:${c.conversation_id}`);
      if (rooms.length > 0) await socket.join(rooms);
      console.log(`[Socket] ${user.email} joined ${rooms.length} conversation rooms`);
    } catch (e) {
      console.error('[Socket] Failed to join rooms:', e);
    }

    // ── conversation:join ──────────────────────────────────────────────────
    socket.on('conversation:join', async (data: { conversation_id: string }) => {
      try {
        const { conversation_id } = data;
        // Verify participant
        const part = await prisma.conversationParticipant.findFirst({
          where: { conversation_id, user_id: user.id, tenant_id: user.tenant_id },
        });
        if (!part) { socket.emit('error', { message: 'Not a participant' }); return; }

        await socket.join(`conv:${conversation_id}`);
        socket.emit('conversation:joined', { conversation_id });

        // Mark all messages as delivered for this user
        await prisma.messageStatus.updateMany({
          where: {
            user_id: user.id,
            status:  'sent',
            message: { conversation_id, tenant_id: user.tenant_id, deleted_at: null },
          },
          data: { status: 'delivered' },
        });

        // Notify room of delivery
        chatNamespace.to(`conv:${conversation_id}`).emit('message:delivered', {
          conversation_id,
          user_id: user.id,
        });
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── message:send ───────────────────────────────────────────────────────
    socket.on('message:send', async (data: {
      conversation_id: string;
      content:         string;
      message_type?:   string;
    }) => {
      try {
        const { conversation_id, content, message_type } = data;

        if (!conversation_id || !content?.trim()) {
          socket.emit('error', { message: 'conversation_id and content are required' }); return;
        }

        // Persist FIRST, then emit
        const message = await chatService.sendMessage(
          user.tenant_id, user.id, conversation_id, content, message_type ?? 'text'
        );

        // Emit to all participants in the room
        chatNamespace.to(`conv:${conversation_id}`).emit('message:new', {
          ...message,
          sender: { id: user.id, email: user.email },
        });

        // Confirm to sender
        socket.emit('message:sent', { temp_id: data.conversation_id, message_id: message.id });

      } catch (err: any) {
        socket.emit('error', { message: err.message ?? 'Failed to send message' });
      }
    });

    // ── message:read ───────────────────────────────────────────────────────
    socket.on('message:read', async (data: { message_id: string }) => {
      try {
        const result = await chatService.markMessageRead(user.tenant_id, user.id, data.message_id);

        // Notify sender that message was read
        chatNamespace.to(`conv:${result.conv_id}`).emit('message:read', {
          message_id:      data.message_id,
          read_by_user_id: user.id,
          conv_id:         result.conv_id,
        });
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── conversation:read_all ──────────────────────────────────────────────
    socket.on('conversation:read_all', async (data: { conversation_id: string }) => {
      try {
        const result = await chatService.markConversationRead(
          user.tenant_id, user.id, data.conversation_id
        );
        chatNamespace.to(`conv:${data.conversation_id}`).emit('message:read', {
          conversation_id: data.conversation_id,
          read_by_user_id: user.id,
          batch:           true,
        });
        socket.emit('conversation:read_ack', { ...result, conversation_id: data.conversation_id });
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── typing:start ───────────────────────────────────────────────────────
    socket.on('typing:start', (data: { conversation_id: string }) => {
      // Realtime only — NOT persisted
      socket.to(`conv:${data.conversation_id}`).emit('typing:update', {
        conversation_id: data.conversation_id,
        user_id:         user.id,
        is_typing:       true,
      });
    });

    // ── typing:stop ────────────────────────────────────────────────────────
    socket.on('typing:stop', (data: { conversation_id: string }) => {
      socket.to(`conv:${data.conversation_id}`).emit('typing:update', {
        conversation_id: data.conversation_id,
        user_id:         user.id,
        is_typing:       false,
      });
    });

    // ── disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] ${user.email} disconnected: ${reason}`);
    });
  });

  return chatNamespace;
};
