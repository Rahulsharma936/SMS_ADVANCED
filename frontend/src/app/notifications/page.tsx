'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface InAppNotification {
  id: string; type: string; title: string; message: string;
  is_read: boolean; ref_id: string | null; created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  announcement: { icon: '📢', color: 'text-blue-400' },
  fee_due:      { icon: '💰', color: 'text-amber-400' },
  result:       { icon: '📊', color: 'text-green-400' },
  attendance:   { icon: '📋', color: 'text-purple-400' },
  notice:       { icon: '📌', color: 'text-orange-400' },
  general:      { icon: '🔔', color: 'text-gray-400' },
};

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [filter, setFilter]               = useState<'all' | 'unread'>('all');
  const [loading, setLoading]             = useState(true);
  const [markingAll, setMarkingAll]       = useState(false);

  const load = async (unreadOnly = false) => {
    setLoading(true);
    try {
      const d = await fetchApi(`/communication/notifications${unreadOnly ? '?unread=true' : ''}`);
      setNotifications(d.notifications || []);
      setUnreadCount(d.unread_count ?? 0);
    } catch (e: any) {
      if (e.message?.includes('Unauthorized')) router.push('/login');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => {
    try {
      await fetchApi(`/communication/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch {}
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await fetchApi('/communication/notifications/read-all', { method: 'PATCH' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {} finally { setMarkingAll(false); }
  };

  const grouped = notifications.reduce<Record<string, InAppNotification[]>>((acc, n) => {
    const date = new Date(n.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(n);
    return acc;
  }, {});

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/announcements" className="text-gray-400 hover:text-white transition-colors">Announcements</a>
            <a href="/notice-board" className="text-gray-400 hover:text-white transition-colors">Notice Board</a>
            <a href="/notifications" className="text-indigo-400 font-medium">Notifications</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Notifications</h1>
              {unreadCount > 0 && (
                <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                  {unreadCount}
                </span>
              )}
            </div>
            <p className="text-gray-500 mt-1">Your in-app notification inbox</p>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} disabled={markingAll}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-40">
              {markingAll ? 'Marking…' : '✓ Mark all read'}
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {(['all', 'unread'] as const).map(f => (
            <button key={f} onClick={() => { setFilter(f); load(f === 'unread'); }}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                filter === f
                  ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
              }`}>
              {f === 'all' ? `All (${notifications.length})` : `Unread (${unreadCount})`}
            </button>
          ))}
        </div>

        {/* Grouped notifications */}
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <div className="text-5xl mb-3">🔔</div>
            <p>No notifications yet. You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, notifs]) => (
              <div key={date}>
                <h2 className="text-xs text-gray-600 uppercase tracking-widest font-semibold mb-3">{date}</h2>
                <div className="space-y-2">
                  {notifs.map(n => {
                    const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.general;
                    return (
                      <div key={n.id}
                        onClick={() => !n.is_read && markRead(n.id)}
                        className={`flex gap-4 items-start p-4 rounded-2xl border transition-all cursor-pointer ${
                          n.is_read
                            ? 'bg-white/[0.02] border-white/5 opacity-60 hover:opacity-80'
                            : 'bg-white/5 border-white/10 hover:border-indigo-500/30 hover:bg-indigo-500/5'
                        }`}>
                        <div className="w-10 h-10 shrink-0 rounded-full bg-white/5 flex items-center justify-center text-xl">
                          {cfg.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-semibold truncate ${n.is_read ? 'text-gray-400' : 'text-white'}`}>
                              {n.title}
                            </p>
                            <div className="flex items-center gap-2 shrink-0">
                              {!n.is_read && <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />}
                              <span className="text-xs text-gray-600">{relativeTime(n.created_at)}</span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                          <span className={`text-xs capitalize mt-1 inline-block ${cfg.color}`}>{n.type.replace('_', ' ')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
