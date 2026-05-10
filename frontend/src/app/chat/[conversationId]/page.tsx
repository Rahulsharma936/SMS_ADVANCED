'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { useChat } from '@/hooks/useChat';
import Cookies from 'js-cookie';

interface Message {
  id:           string;
  sender_id:    string;
  sender:       { id: string; email: string };
  content:      string;
  message_type: string;
  created_at:   string;
  statuses:     { user_id: string; status: string }[];
}
interface Participant {
  user_id: string;
  user:    { id: string; email: string; role: { name: string } };
  role:    string;
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function ConversationPage() {
  const router  = useRouter();
  const params  = useParams();
  const convId  = params.conversationId as string;

  const [messages, setMessages]     = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myId, setMyId]             = useState('');
  const [myEmail, setMyEmail]       = useState('');
  const [loading, setLoading]       = useState(true);
  const [hasMore, setHasMore]       = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [input, setInput]           = useState('');
  const [sending, setSending]       = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [connected, setIsConnected] = useState(false);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const typingTimer  = useRef<NodeJS.Timeout | null>(null);
  const token    = Cookies.get('token') || '';
  const tenantId = Cookies.get('tenantId') || '';

  // ── Socket.IO ──────────────────────────────────────────────────────────────
  const chat = useChat({
    token,
    tenantId,
    onNewMessage: useCallback((msg: Message) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }, []),
    onTypingUpdate: useCallback((data: { conversation_id: string; user_id: string; is_typing: boolean }) => {
      if (data.conversation_id !== convId) return;
      setTypingUsers(prev => {
        const next = new Set(prev);
        data.is_typing ? next.add(data.user_id) : next.delete(data.user_id);
        return next;
      });
    }, [convId]),
    onMessageRead: useCallback((_data: any) => {
      // Update delivery status in local state
      setMessages(prev => prev.map(m => ({
        ...m,
        statuses: m.statuses.map(s =>
          s.user_id !== myId ? { ...s, status: 'read' } : s
        ),
      })));
    }, [myId]),
  });

  // ── Load initial data ──────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const [me, convData, msgData] = await Promise.all([
          fetchApi('/users/me'),
          fetchApi(`/chat/${convId}`),
          fetchApi(`/chat/${convId}/messages`),
        ]);
        setMyId(me.user.id);
        setMyEmail(me.user.email);
        setParticipants(convData.conversation.participants);
        setMessages(msgData.messages || []);
        setHasMore(msgData.hasMore);
        setNextCursor(msgData.nextCursor);
      } catch (e: any) {
        if (e.message?.includes('Unauthorized')) router.push('/login');
      } finally { setLoading(false); }
    };
    init();
  }, [convId, router]);

  // ── Join room + mark read after connection ──────────────────────────────
  useEffect(() => {
    if (chat.connected && convId) {
      chat.joinConversation(convId);
      chat.readAllInConversation(convId);
      setIsConnected(true);
    }
  }, [chat.connected, convId]);

  // ── Scroll to bottom on initial load ──────────────────────────────────────
  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [loading]);

  // ── Load more messages ────────────────────────────────────────────────────
  const loadMore = async () => {
    if (!nextCursor || !hasMore) return;
    const d = await fetchApi(`/chat/${convId}/messages?cursor=${nextCursor}`);
    setMessages(prev => [...(d.messages || []), ...prev]);
    setHasMore(d.hasMore);
    setNextCursor(d.nextCursor);
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput('');
    chat.stopTyping(convId);

    // Optimistic: send via socket
    chat.sendMessage(convId, content);
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    chat.startTyping(convId);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => chat.stopTyping(convId), 2000);
  };

  const otherParticipant = participants.find(p => p.user_id !== myId);
  const typingOthers = [...typingUsers].filter(uid => uid !== myId);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center gap-3 shrink-0">
        <a href="/chat" className="text-gray-400 hover:text-white transition-colors mr-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-sm font-bold shrink-0">
          {otherParticipant?.user.email[0].toUpperCase() ?? '?'}
        </div>
        <div>
          <p className="font-semibold text-sm">{otherParticipant?.user.email ?? 'Chat'}</p>
          <p className="text-xs text-gray-500 capitalize">
            {otherParticipant?.role}
            {connected
              ? <span className="ml-2 text-emerald-400">● Online</span>
              : <span className="ml-2 text-gray-600">● Connecting…</span>}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {hasMore && (
          <div className="text-center">
            <button onClick={loadMore}
              className="text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 px-3 py-1.5 rounded-lg transition-colors">
              Load earlier messages
            </button>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMe = msg.sender_id === myId;
          const showDate = i === 0 || (
            new Date(msg.created_at).toDateString() !==
            new Date(messages[i - 1].created_at).toDateString()
          );
          const isRead = msg.statuses.some(s => s.user_id !== myId && s.status === 'read');

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="text-center my-3">
                  <span className="text-xs text-gray-600 bg-white/5 px-3 py-1 rounded-full">
                    {new Date(msg.created_at).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
                  </span>
                </div>
              )}
              <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? 'bg-gradient-to-br from-blue-500 to-violet-600 text-white rounded-br-sm'
                      : 'bg-white/10 text-gray-100 rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>
                  <div className={`flex items-center gap-1 text-xs text-gray-600 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <span>{formatTime(msg.created_at)}</span>
                    {isMe && (
                      <span className={isRead ? 'text-blue-400' : 'text-gray-600'} title={isRead ? 'Read' : 'Sent'}>
                        {isRead ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingOthers.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-white/10 px-4 py-2.5 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-white/10 bg-gray-950 p-4 shrink-0">
        <div className="flex items-end gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-blue-500/50 transition-colors">
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send)"
            rows={1}
            className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-600 resize-none focus:outline-none max-h-32"
            style={{ lineHeight: '1.5' }}
          />
          <button onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0 disabled:opacity-30 hover:scale-105 transition-all">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-700 mt-1.5 text-center">
          {connected ? `🔒 End-to-end message persistence enabled` : '⏳ Connecting to realtime service…'}
        </p>
      </div>
    </div>
  );
}
