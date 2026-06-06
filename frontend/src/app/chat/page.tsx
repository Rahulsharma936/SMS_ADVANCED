'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

interface Conversation {
  id: string; type: string; updated_at: string;
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
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export default function ChatPage() {
  const router = useRouter();
  const [convs,        setConvs]       = useState<Conversation[]>([]);
  const [users,        setUsers]       = useState<User[]>([]);
  const [loading,      setLoading]     = useState(true);
  const [newChat,      setNewChat]     = useState(false);
  const [targetUser,   setTarget]      = useState('');
  const [starting,     setStarting]    = useState(false);
  const [error,        setError]       = useState('');
  const [currentUser,  setCurrentUser] = useState<User | null>(null);
  const [searchQuery,  setSearch]      = useState('');

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

  /* Counts */
  const unreadCount = convs.filter(c =>
    c.last_message && !c.last_message.is_read && c.last_message.sender_id !== currentUser?.id
  ).length;

  const filtered = searchQuery
    ? convs.filter(c => c.other_user?.email.toLowerCase().includes(searchQuery.toLowerCase()))
    : convs;

  return (
    <AppLayout>

      {/* ── Page header ──────────────────────────────────── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                💬 Messages
              </h1>
              {unreadCount > 0 && (
                <span style={{
                  background: 'var(--brand-primary)', color: 'white',
                  fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                  borderRadius: '100px', animation: 'pulse-dot 2s ease-in-out infinite',
                }}>
                  {unreadCount} unread
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              Parent-teacher conversations — secure, role-restricted messaging
            </p>
          </div>
          <button onClick={openNewChat} className="btn btn-primary">
            + New Chat
          </button>
        </div>
      </div>

      {/* ── KPI strip ────────────────────────────────────── */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: '20px' }}>
        <div className="kpi-card">
          <div className="kpi-card-value" style={{ color: 'var(--text-primary)' }}>{convs.length}</div>
          <div className="kpi-card-label">Conversations</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-value" style={{ color: unreadCount > 0 ? '#6366f1' : 'var(--text-primary)' }}>{unreadCount}</div>
          <div className="kpi-card-label">Unread</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-value" style={{ color: 'var(--text-primary)' }}>
            {convs.filter(c => c.last_message && (Date.now() - new Date(c.last_message.created_at).getTime()) < 86400000).length}
          </div>
          <div className="kpi-card-label">Active Today</div>
        </div>
      </div>

      {/* ── New chat form ─────────────────────────────────── */}
      {newChat && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
            Start New Conversation
          </h2>
          {error && <div className="alert alert-error" style={{ marginBottom: '12px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <select value={targetUser} onChange={e => setTarget(e.target.value)} className="input" style={{ flex: 1 }}>
              <option value="">— Select user to chat with —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
            </select>
            <button onClick={startConversation} disabled={starting || !targetUser} className="btn btn-primary">
              {starting ? '…' : 'Start'}
            </button>
            <button onClick={() => { setNewChat(false); setError(''); }} className="btn btn-ghost">✕</button>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '8px' }}>
            Access rules apply — you can only chat with authorized users based on your role.
          </p>
        </div>
      )}

      {/* ── Search ───────────────────────────────────────── */}
      {convs.length > 3 && (
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text-faint)' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={searchQuery} onChange={e => setSearch(e.target.value)}
            className="input" placeholder="Search conversations…"
            style={{ paddingLeft: '32px' }} />
        </div>
      )}

      {/* ── Conversation list ─────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div style={{ fontSize: '36px', marginBottom: '4px' }}>💬</div>
            <p className="empty-state-title">
              {searchQuery ? `No conversations matching "${searchQuery}"` : 'No conversations yet'}
            </p>
            <p className="empty-state-desc">
              {searchQuery
                ? 'Try a different search term.'
                : 'Start a conversation with a teacher or parent to begin messaging.'}
            </p>
            {!searchQuery && (
              <button onClick={openNewChat} className="btn btn-primary" style={{ marginTop: '8px' }}>
                + Start New Chat
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.map((conv, idx) => {
            const isUnread = conv.last_message && !conv.last_message.is_read &&
                             conv.last_message.sender_id !== currentUser?.id;
            const avatarColors = [
              'linear-gradient(135deg,#6366f1,#8b5cf6)',
              'linear-gradient(135deg,#3b82f6,#6366f1)',
              'linear-gradient(135deg,#06b6d4,#3b82f6)',
              'linear-gradient(135deg,#10b981,#06b6d4)',
            ];
            const avatarColor = avatarColors[idx % avatarColors.length];

            return (
              <a key={conv.id} href={`/chat/${conv.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '14px 16px',
                  borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  background: isUnread ? 'rgba(99,102,241,0.05)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'background var(--transition-fast)',
                  position: 'relative',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isUnread ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.025)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = isUnread ? 'rgba(99,102,241,0.05)' : 'transparent'}
              >
                {/* Unread indicator */}
                {isUnread && (
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: '3px', background: 'var(--brand-primary)',
                  }} />
                )}

                {/* Avatar */}
                <div style={{
                  width: '42px', height: '42px', borderRadius: '50%',
                  background: avatarColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700, fontSize: '14px', flexShrink: 0,
                }}>
                  {conv.other_user ? initials(conv.other_user.email) : '?'}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <p style={{
                      fontSize: '13px', fontWeight: isUnread ? 600 : 500,
                      color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      margin: 0,
                    }}>
                      {conv.other_user?.email ?? 'Unknown'}
                    </p>
                    <span style={{ fontSize: '11px', color: 'var(--text-faint)', flexShrink: 0, marginLeft: '8px' }}>
                      {conv.last_message ? timeAgo(conv.last_message.created_at) : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {conv.other_user?.role && (
                      <span style={{
                        fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                        padding: '1px 5px', borderRadius: '3px',
                        background: 'var(--bg-overlay)', color: 'var(--text-muted)',
                        flexShrink: 0,
                      }}>
                        {conv.other_user.role.name}
                      </span>
                    )}
                    <p style={{
                      fontSize: '12px', color: isUnread ? '#a5b4fc' : 'var(--text-muted)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      margin: 0, flex: 1,
                    }}>
                      {conv.last_message
                        ? (conv.last_message.sender_id === currentUser?.id ? '↑ ' : '') + conv.last_message.content
                        : 'No messages yet — start the conversation'}
                    </p>
                    {isUnread && (
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                    )}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}

    </AppLayout>
  );
}
