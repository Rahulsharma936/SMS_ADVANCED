'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

interface Notice {
  id: string; title: string; content: string; priority: string;
  published_at: string; expires_at: string | null;
  createdBy: { email: string };
}

const PRIORITY_CFG: Record<string, {
  label: string; icon: string;
  badge: string; badgeBg: string; badgeColor: string;
  borderColor: string; accentColor: string;
}> = {
  high:   {
    label: 'High Priority', icon: '🔴',
    badge: 'HIGH', badgeBg: 'rgba(239,68,68,0.12)', badgeColor: '#f87171',
    borderColor: 'rgba(239,68,68,0.25)', accentColor: '#f87171',
  },
  medium: {
    label: 'Medium Priority', icon: '🟡',
    badge: 'MED', badgeBg: 'rgba(245,158,11,0.12)', badgeColor: '#fbbf24',
    borderColor: 'rgba(245,158,11,0.2)', accentColor: '#fbbf24',
  },
  low:    {
    label: 'Low Priority', icon: '🟢',
    badge: 'LOW', badgeBg: 'rgba(34,197,94,0.1)', badgeColor: '#4ade80',
    borderColor: 'rgba(34,197,94,0.15)', accentColor: '#4ade80',
  },
};

function relativeDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return null;
  const expired = new Date(expiresAt) < new Date();
  const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  return (
    <span style={{
      fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '3px',
      letterSpacing: '0.04em', textTransform: 'uppercase',
      background: expired ? 'rgba(113,113,122,0.12)' : daysLeft <= 3 ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
      color: expired ? '#71717a' : daysLeft <= 3 ? '#f87171' : '#60a5fa',
    }}>
      {expired ? 'Expired' : daysLeft === 1 ? 'Expires tomorrow' : `Expires in ${daysLeft}d`}
    </span>
  );
}

export default function NoticeBoardPage() {
  const router = useRouter();
  const [notices,    setNotices]   = useState<Notice[]>([]);
  const [filter,     setFilter]    = useState('');
  const [loading,    setLoading]   = useState(true);
  const [showForm,   setShowForm]  = useState(false);
  const [creating,   setCreating]  = useState(false);
  const [error,      setError]     = useState('');
  const [success,    setSuccess]   = useState('');
  const [form,       setForm]      = useState({ title: '', content: '', priority: 'medium', expires_at: '' });
  const [userData,   setUserData]  = useState<{ email?: string; role?: string; school?: string }>({});

  const load = async (p?: string) => {
    setLoading(true);
    try {
      const d = await fetchApi(`/communication/notices${p ? `?priority=${p}` : ''}`);
      setNotices(d.notices || []);
    } catch (e: any) {
      if (e.message?.includes('Unauthorized')) router.push('/login');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    try {
      const stored = localStorage.getItem('sms_user_ctx');
      if (stored) setUserData(JSON.parse(stored));
    } catch {}
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setCreating(true);
    try {
      await fetchApi('/communication/notices', {
        method: 'POST',
        data: { title: form.title, content: form.content, priority: form.priority, expires_at: form.expires_at || undefined },
      });
      setForm({ title: '', content: '', priority: 'medium', expires_at: '' });
      setShowForm(false);
      setSuccess('Notice posted successfully!');
      load();
      setTimeout(() => setSuccess(''), 4000);
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  };

  const sorted = [...notices].sort((a, b) => {
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
  });

  const counts = { high: 0, medium: 0, low: 0, total: notices.length };
  notices.forEach(n => { if (n.priority in counts) (counts as any)[n.priority]++; });
  const activeCount = notices.filter(n => !n.expires_at || new Date(n.expires_at) > new Date()).length;

  if (loading) return (
    <AppLayout userEmail={userData.email} userRole={userData.role} schoolName={userData.school}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner spinner-lg" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout userEmail={userData.email} userRole={userData.role} schoolName={userData.school}>

      {/* ── Page header ─────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              📌 Notice Board
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              Persistent pinned communications and operational notices
            </p>
          </div>
          <button onClick={() => { setShowForm(!showForm); setError(''); }}
            className="btn btn-primary">
            {showForm ? '✕ Cancel' : '+ Post Notice'}
          </button>
        </div>
      </div>

      {/* ── Success / error alerts ───────────────────────── */}
      {success && <div className="alert alert-success" style={{ marginBottom: '16px' }}>{success}</div>}

      {/* ── KPI strip ───────────────────────────────────── */}
      <div className="kpi-grid" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(4,1fr)' }}>
        {[
          { label: 'Total Notices', value: counts.total, color: 'var(--text-primary)' },
          { label: 'Active',        value: activeCount,  color: '#4ade80' },
          { label: 'High Priority', value: counts.high,  color: '#f87171' },
          { label: 'Medium',        value: counts.medium,color: '#fbbf24' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-card-value" style={{ color: k.color }}>{k.value}</div>
            <div className="kpi-card-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Compose form ─────────────────────────────────── */}
      {showForm && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>
            Post a Notice
          </h2>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {error && <div className="alert alert-error">{error}</div>}
            <div>
              <label className="form-label">Notice Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. School closure on 15th Jan" required className="input" />
            </div>
            <div>
              <label className="form-label">Content *</label>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Full notice content…" required rows={4}
                className="input" style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="form-label">Priority</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="input">
                  <option value="high">🔴 High — Urgent</option>
                  <option value="medium">🟡 Medium — Standard</option>
                  <option value="low">🟢 Low — Informational</option>
                </select>
              </div>
              <div>
                <label className="form-label">Expiry Date (optional)</label>
                <input type="datetime-local" value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  style={{ colorScheme: 'dark' }} className="input" />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" disabled={creating} className="btn btn-primary">
                {creating ? 'Posting…' : 'Post Notice'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filter tabs ─────────────────────────────────── */}
      <div className="filter-bar" style={{ marginBottom: '16px' }}>
        {[
          { val: '',       label: `All (${counts.total})` },
          { val: 'high',   label: `🔴 High (${counts.high})` },
          { val: 'medium', label: `🟡 Medium (${counts.medium})` },
          { val: 'low',    label: `🟢 Low (${counts.low})` },
        ].map(f => (
          <button key={f.val} onClick={() => { setFilter(f.val); load(f.val || undefined); }}
            className="btn"
            style={{
              fontSize: '12px', padding: '5px 12px',
              background: filter === f.val ? 'var(--brand-subtle)' : 'var(--bg-elevated)',
              border: `1px solid ${filter === f.val ? 'rgba(99,102,241,0.3)' : 'var(--border-default)'}`,
              color: filter === f.val ? '#a5b4fc' : 'var(--text-secondary)',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Notice cards ─────────────────────────────────── */}
      {sorted.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <p className="empty-state-title">No notices posted yet</p>
            <p className="empty-state-desc">Post your first notice to broadcast important information to your school community.</p>
            <button onClick={() => setShowForm(true)} className="btn btn-primary" style={{ marginTop: '8px' }}>
              + Post First Notice
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sorted.map(notice => {
            const cfg = PRIORITY_CFG[notice.priority] || PRIORITY_CFG.medium;
            const isExpired = notice.expires_at && new Date(notice.expires_at) < new Date();
            return (
              <div key={notice.id}
                className="card"
                style={{
                  borderColor: cfg.borderColor,
                  opacity: isExpired ? 0.6 : 1,
                  position: 'relative', overflow: 'hidden',
                }}>
                {/* Priority accent stripe */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px',
                  background: cfg.accentColor,
                }} />
                <div style={{ paddingLeft: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
                        textTransform: 'uppercase', padding: '2px 7px', borderRadius: '3px',
                        background: cfg.badgeBg, color: cfg.badgeColor,
                      }}>
                        {cfg.icon} {cfg.badge}
                      </span>
                      {notice.priority === 'high' && !isExpired && (
                        <span style={{ fontSize: '10px', color: '#f87171', animation: 'pulse-dot 1.5s infinite' }}>● Urgent</span>
                      )}
                      <ExpiryBadge expiresAt={notice.expires_at} />
                    </div>
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    {notice.title}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {notice.content}
                  </p>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px',
                    paddingTop: '10px', borderTop: '1px solid var(--border-subtle)',
                    fontSize: '11px', color: 'var(--text-faint)',
                  }}>
                    <span>Posted by {notice.createdBy.email.split('@')[0]}</span>
                    <span>·</span>
                    <span>{relativeDate(notice.published_at)}</span>
                    {notice.expires_at && (
                      <>
                        <span>·</span>
                        <span>Expires {relativeDate(notice.expires_at)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
