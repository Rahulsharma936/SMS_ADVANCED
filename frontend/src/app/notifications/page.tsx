'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

interface InAppNotification {
  id: string; type: string; title: string; message: string;
  is_read: boolean; ref_id: string | null; created_at: string;
}

/* ── Type → visual config ─────────────────────────────── */
const TYPE_CFG: Record<string, { icon: string; color: string; bg: string; label: string; href?: string }> = {
  announcement: { icon: '📢', color: '#60a5fa', bg: 'rgba(59,130,246,0.1)',  label: 'Announcement',  href: '/announcements' },
  fee_due:      { icon: '💰', color: '#fbbf24', bg: 'rgba(245,158,11,0.1)',  label: 'Fee Due',       href: '/fees' },
  result:       { icon: '📊', color: '#4ade80', bg: 'rgba(34,197,94,0.1)',   label: 'Result',        href: '/results' },
  attendance:   { icon: '📋', color: '#a78bfa', bg: 'rgba(139,92,246,0.1)', label: 'Attendance',    href: '/attendance' },
  notice:       { icon: '📌', color: '#fb923c', bg: 'rgba(249,115,22,0.1)', label: 'Notice',        href: '/notice-board' },
  general:      { icon: '🔔', color: '#a1a1aa', bg: 'rgba(113,113,122,0.1)',label: 'System',        href: '/dashboard' },
};

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today    = new Date(); today.setHours(0,0,0,0);
  const yesterday= new Date(today); yesterday.setDate(yesterday.getDate()-1);
  const nd = new Date(d); nd.setHours(0,0,0,0);
  if (nd.getTime() === today.getTime())     return 'Today';
  if (nd.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [filter, setFilter]               = useState<'all' | 'unread'>('all');
  const [loading, setLoading]             = useState(true);
  const [markingAll, setMarkingAll]       = useState(false);
  const [userData, setUserData]           = useState<{ email?: string; role?: string; school?: string }>({});

  const load = useCallback(async (unreadOnly = false) => {
    setLoading(true);
    try {
      const d = await fetchApi(`/communication/notifications${unreadOnly ? '?unread=true' : ''}`);
      setNotifications(d.notifications || []);
      setUnreadCount(d.unread_count ?? 0);
    } catch (e: any) {
      if (e.message?.includes('Unauthorized')) router.push('/login');
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => {
    load();
    // Hydrate user context
    try {
      const stored = localStorage.getItem('sms_user_ctx');
      if (stored) setUserData(JSON.parse(stored));
    } catch {}
  }, [load]);

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

  /* Group by day */
  const grouped = notifications.reduce<Record<string, InAppNotification[]>>((acc, n) => {
    const key = formatDate(n.created_at);
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {});

  const typeBreakdown = Object.entries(
    notifications.reduce<Record<string, number>>((acc, n) => {
      acc[n.type] = (acc[n.type] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 4);

  if (loading) return (
    <AppLayout userEmail={userData.email} userRole={userData.role} schoolName={userData.school}>
      <div className="page-loading" style={{ minHeight: '60vh', background: 'transparent' }}>
        <div className="spinner spinner-lg" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout userEmail={userData.email} userRole={userData.role} schoolName={userData.school}>

      {/* ── Page header ──────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Notifications
              </h1>
              {unreadCount > 0 && (
                <span style={{
                  background: 'var(--brand-primary)', color: 'white',
                  fontSize: '11px', fontWeight: 700,
                  padding: '2px 8px', borderRadius: '100px',
                  animation: 'pulse-dot 2s ease-in-out infinite',
                }}>
                  {unreadCount} unread
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              Your in-app notification inbox — all system events and broadcasts
            </p>
          </div>

          {unreadCount > 0 && (
            <button onClick={markAllRead} disabled={markingAll} className="btn btn-secondary">
              {markingAll
                ? <><div className="spinner" style={{ width: '12px', height: '12px' }} /> Marking…</>
                : '✓ Mark all as read'
              }
            </button>
          )}
        </div>
      </div>

      {/* ── Overview strip (KPI) ─────────────────────────── */}
      <div className="kpi-grid" style={{ marginBottom: '20px' }}>
        <div className="kpi-card">
          <div className="kpi-card-value" style={{ color: 'var(--text-primary)' }}>{notifications.length}</div>
          <div className="kpi-card-label">Total</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-value" style={{ color: unreadCount > 0 ? '#6366f1' : 'var(--text-primary)' }}>{unreadCount}</div>
          <div className="kpi-card-label">Unread</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-value" style={{ color: 'var(--text-primary)' }}>{notifications.filter(n => n.is_read).length}</div>
          <div className="kpi-card-label">Read</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-value" style={{ color: 'var(--text-primary)' }}>{typeBreakdown.length}</div>
          <div className="kpi-card-label">Categories</div>
        </div>
      </div>

      {/* ── Main layout: inbox + sidebar ─────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '20px', alignItems: 'start' }}>

        {/* Left: inbox ───────────────────────────────────── */}
        <div>
          {/* Filter tabs */}
          <div className="filter-bar" style={{ marginBottom: '16px' }}>
            {(['all', 'unread'] as const).map(f => (
              <button key={f} onClick={() => { setFilter(f); load(f === 'unread'); }}
                className="btn"
                style={{
                  fontSize: '12px', padding: '5px 12px',
                  background: filter === f ? 'var(--brand-subtle)' : 'var(--bg-elevated)',
                  border: `1px solid ${filter === f ? 'rgba(99,102,241,0.3)' : 'var(--border-default)'}`,
                  color: filter === f ? '#a5b4fc' : 'var(--text-secondary)',
                }}>
                {f === 'all' ? `All (${notifications.length})` : `Unread (${unreadCount})`}
              </button>
            ))}
          </div>

          {/* Notification list */}
          {Object.keys(grouped).length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="empty-state-title">
                  {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
                </p>
                <p className="empty-state-desc">
                  {filter === 'unread'
                    ? 'No unread notifications. You\'re all caught up.'
                    : 'When the system creates events or broadcasts, they\'ll appear here.'}
                </p>
                {filter === 'unread' && (
                  <button onClick={() => { setFilter('all'); load(false); }} className="btn btn-secondary" style={{ marginTop: '8px' }}>
                    View all notifications
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {Object.entries(grouped).map(([date, notifs]) => (
                <div key={date}>
                  {/* Date divider */}
                  <div className="section-divider" style={{ marginBottom: '10px' }}>
                    <span className="section-divider-label">{date}</span>
                    <div className="section-divider-line" />
                    <span className="section-divider-label" style={{ whiteSpace: 'nowrap' }}>
                      {notifs.filter(n => !n.is_read).length > 0
                        ? `${notifs.filter(n => !n.is_read).length} unread`
                        : 'all read'}
                    </span>
                  </div>

                  {/* Notification rows */}
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {notifs.map((n, idx) => {
                      const cfg = TYPE_CFG[n.type] || TYPE_CFG.general;
                      return (
                        <div key={n.id}
                          onClick={() => !n.is_read && markRead(n.id)}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: '12px',
                            padding: '14px 16px',
                            borderBottom: idx < notifs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                            background: !n.is_read ? 'rgba(99,102,241,0.04)' : 'transparent',
                            cursor: !n.is_read ? 'pointer' : 'default',
                            transition: 'background var(--transition-fast)',
                            position: 'relative',
                          }}
                          onMouseEnter={e => {
                            if (!n.is_read) (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.07)';
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.background = !n.is_read ? 'rgba(99,102,241,0.04)' : 'transparent';
                          }}
                        >
                          {/* Unread indicator stripe */}
                          {!n.is_read && (
                            <div style={{
                              position: 'absolute', left: 0, top: 0, bottom: 0,
                              width: '3px', background: 'var(--brand-primary)',
                              borderRadius: '0 2px 2px 0',
                            }} />
                          )}

                          {/* Icon */}
                          <div style={{
                            width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
                            background: cfg.bg, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: '16px', flexShrink: 0,
                          }}>
                            {cfg.icon}
                          </div>

                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                              <p style={{
                                fontSize: '13px', fontWeight: n.is_read ? 400 : 600,
                                color: n.is_read ? 'var(--text-secondary)' : 'var(--text-primary)',
                                lineHeight: 1.4, margin: 0,
                              }}>
                                {n.title}
                              </p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                {!n.is_read && (
                                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--brand-primary)' }} />
                                )}
                                <span style={{ fontSize: '11px', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                                  {relativeTime(n.created_at)}
                                </span>
                              </div>
                            </div>
                            <p style={{
                              fontSize: '12px', color: 'var(--text-muted)',
                              marginTop: '2px', lineHeight: 1.5,
                              display: '-webkit-box', WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical', overflow: 'hidden',
                            }}>
                              {n.message}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                              <span style={{
                                fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
                                color: cfg.color, padding: '1px 6px',
                                background: cfg.bg, borderRadius: '3px',
                              }}>
                                {cfg.label}
                              </span>
                              {cfg.href && !n.is_read && (
                                <a href={cfg.href} onClick={e => { e.stopPropagation(); markRead(n.id); }}
                                  style={{ fontSize: '11px', color: 'var(--brand-primary)', textDecoration: 'none' }}>
                                  View →
                                </a>
                              )}
                              {!n.is_read && (
                                <button onClick={e => { e.stopPropagation(); markRead(n.id); }}
                                  style={{
                                    fontSize: '11px', background: 'none', border: 'none',
                                    color: 'var(--text-muted)', cursor: 'pointer', padding: 0,
                                  }}>
                                  Mark read
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: sidebar context panel ─────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Category breakdown */}
          <div className="widget">
            <div className="widget-head">
              <span className="widget-title">By Category</span>
            </div>
            <div className="widget-body" style={{ padding: '12px 16px' }}>
              {typeBreakdown.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>No data</p>
              ) : typeBreakdown.map(([type, count]) => {
                const cfg = TYPE_CFG[type] || TYPE_CFG.general;
                const pct = Math.round((count / notifications.length) * 100);
                return (
                  <div key={type} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span>{cfg.icon}</span> {cfg.label}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{count}</span>
                    </div>
                    <div style={{ height: '3px', background: 'var(--bg-overlay)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: '2px', transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick links */}
          <div className="widget">
            <div className="widget-head">
              <span className="widget-title">Communication</span>
            </div>
            <div style={{ padding: '8px' }}>
              {[
                { href: '/announcements', icon: '📢', label: 'Announcements' },
                { href: '/notice-board',  icon: '📌', label: 'Notice Board' },
                { href: '/chat',          icon: '💬', label: 'Messages' },
              ].map(link => (
                <a key={link.href} href={link.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px', borderRadius: 'var(--radius-md)',
                    textDecoration: 'none', color: 'var(--text-secondary)',
                    fontSize: '13px', transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-overlay)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--text-faint)', fontSize: '11px' }}>→</span>
                </a>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="alert alert-info" style={{ flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
            <strong style={{ fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>💡 Tip</strong>
            <span>Click any unread notification to mark it as read. Use "Mark all as read" to clear everything at once.</span>
          </div>
        </div>
      </div>

    </AppLayout>
  );
}
