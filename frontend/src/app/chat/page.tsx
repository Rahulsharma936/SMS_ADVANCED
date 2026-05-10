'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import Cookies from 'js-cookie';

interface Conversation {
  id: string;
  type: string;
  updated_at: string;
  other_user: { id: string; email: string; role: { name: string } } | null;
  last_message: {
    id: string; content: string; sender_id: string;
    sender: { id: string; email: string }; created_at: string; is_read: boolean;
  } | null;
}

interface User { id: string; email: string; }

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function ChatPage() {
  const router = useRouter();
  const [convs, setConvs]         = useState<Conversation[]>([]);
  const [users, setUsers]         = useState<User[]>([]);
  const [loading, setLoading]     = useState(true);
  const [newChat, setNewChat]     = useState(false);
  const [targetUser, setTarget]   = useState('');
  const [starting, setStarting]   = useState(false);
  const [error, setError]         = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const load = useCallback(async () => {
    try {
      const [me, c] = await Promise.all([
        fetchApi('/users/me'),
        fetchApi('/chat'),
      ]);
      setCurrentUser(me.user);
      setConvs(c.conversations || []);
    } catch (e: any) {
      if (e.message?.includes('Unauthorized')) router.push('/login');
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const openNewChat = async () => {
    setNewChat(true);
    if (users.length === 0) {
      try {
        const d = await fetchApi('/users');
        setUsers(d.users?.filter((u: any) => u.id !== currentUser?.id) || []);
      } catch {}
    }
  };

  const startConversation = async () => {
    if (!targetUser) return;
    setStarting(true); setError('');
    try {
      const d = await fetchApi('/chat', { method: 'POST', data: { target_user_id: targetUser } });
      router.push(`/chat/${d.conversation.id}`);
    } catch (e: any) { setError(e.message); }
    finally { setStarting(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-400">💬 Messages</a>
          <button onClick={openNewChat}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-violet-600 rounded-xl text-sm font-medium hover:shadow-blue-500/25 hover:shadow-lg transition-all">
            + New Chat
          </button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {newChat && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Start Conversation</h2>
            {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
            <div className="flex gap-2">
              <select value={targetUser} onChange={e => setTarget(e.target.value)}
                className="flex-1 bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                <option value="">— Select user to chat with —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
              </select>
              <button onClick={startConversation} disabled={starting || !targetUser}
                className="px-4 py-2.5 bg-blue-500 rounded-xl text-sm font-medium disabled:opacity-40 transition-all hover:bg-blue-600">
                {starting ? '…' : 'Start'}
              </button>
              <button onClick={() => { setNewChat(false); setError(''); }}
                className="px-3 py-2.5 bg-white/5 rounded-xl text-sm text-gray-400 hover:text-white">
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2">Access rules apply — you can only chat with authorized users.</p>
          </div>
        )}

        {convs.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <div className="text-5xl mb-3">💬</div>
            <p className="mb-2">No conversations yet.</p>
            <button onClick={openNewChat} className="text-blue-400 hover:text-blue-300 text-sm">Start a new chat →</button>
          </div>
        ) : (
          <div className="space-y-1">
            {convs.map(conv => {
              const isUnread = conv.last_message && !conv.last_message.is_read &&
                               conv.last_message.sender_id !== currentUser?.id;
              return (
                <a key={conv.id} href={`/chat/${conv.id}`}
                  className={`flex items-center gap-3 p-4 rounded-2xl transition-all cursor-pointer ${
                    isUnread ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-white/5 border border-white/10 hover:bg-white/[0.08]'
                  }`}>
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {conv.other_user?.email[0].toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-semibold truncate ${isUnread ? 'text-white' : 'text-gray-300'}`}>
                        {conv.other_user?.email ?? 'Unknown'}
                      </p>
                      <span className="text-xs text-gray-600 shrink-0 ml-2">
                        {conv.last_message ? timeAgo(conv.last_message.created_at) : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={`text-xs truncate ${isUnread ? 'text-blue-300' : 'text-gray-500'}`}>
                        {conv.last_message
                          ? (conv.last_message.sender_id === currentUser?.id ? 'You: ' : '')
                            + conv.last_message.content
                          : 'No messages yet'}
                      </p>
                      {isUnread && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
