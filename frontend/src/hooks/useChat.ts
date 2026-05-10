'use client';

/**
 * useChat.ts — Socket.IO hook for the Chat System (Phase 11)
 *
 * Provides:
 *  - Lazy connection (connects only when called)
 *  - Auto-reconnect via socket.io-client defaults
 *  - Typed events
 *  - Cleanup on unmount
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

interface ChatMessage {
  id:              string;
  conversation_id: string;
  sender_id:       string;
  sender:          { id: string; email: string };
  content:         string;
  message_type:    string;
  created_at:      string;
  statuses:        { user_id: string; status: string }[];
}

interface TypingEvent {
  conversation_id: string;
  user_id:         string;
  is_typing:       boolean;
}

interface UseChatOptions {
  token:    string;
  tenantId: string;
  onNewMessage?:    (msg: ChatMessage) => void;
  onMessageRead?:   (data: any) => void;
  onTypingUpdate?:  (data: TypingEvent) => void;
  onDelivered?:     (data: any) => void;
}

export const useChat = ({
  token, tenantId,
  onNewMessage, onMessageRead, onTypingUpdate, onDelivered,
}: UseChatOptions) => {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token || !tenantId) return;

    const socket = io(`${BACKEND_URL}/chat`, {
      auth:       { token, tenant_id: tenantId },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay:    1000,
    });

    socketRef.current = socket;

    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('error', (err: { message: string }) => {
      console.error('[Socket error]', err.message);
    });

    if (onNewMessage)   socket.on('message:new',       onNewMessage);
    if (onMessageRead)  socket.on('message:read',      onMessageRead);
    if (onTypingUpdate) socket.on('typing:update',     onTypingUpdate);
    if (onDelivered)    socket.on('message:delivered', onDelivered);

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tenantId]);

  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('conversation:join', { conversation_id: conversationId });
  }, []);

  const sendMessage = useCallback((conversationId: string, content: string) => {
    socketRef.current?.emit('message:send', { conversation_id: conversationId, content });
  }, []);

  const markRead = useCallback((messageId: string) => {
    socketRef.current?.emit('message:read', { message_id: messageId });
  }, []);

  const readAllInConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('conversation:read_all', { conversation_id: conversationId });
  }, []);

  const startTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('typing:start', { conversation_id: conversationId });
  }, []);

  const stopTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('typing:stop', { conversation_id: conversationId });
  }, []);

  return { connected, joinConversation, sendMessage, markRead, readAllInConversation, startTyping, stopTyping };
};
