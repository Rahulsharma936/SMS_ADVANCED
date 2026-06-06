'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

interface Announcement {
  id: string; title: string; message: string; target_type: string; target_id: string | null;
  created_at: string; expires_at: string | null;
  createdBy: { email: string };
}
interface ClassOption   { id: string; name: string; }
interface SectionOption { id: string; name: string; class_id: string; }

const TARGET_CFG: Record<string, { label: string; icon: string; badgeBg: string; badgeColor: string }> = {
  school:  { label: 'School-wide', icon: '🏫', badgeBg: 'rgba(34,197,94,0.1)',  badgeColor: '#4ade80' },
  class:   { label: 'Class',       icon: '📚', badgeBg: 'rgba(59,130,246,0.1)', badgeColor: '#60a5fa' },
  section: { label: 'Section',     icon: '🔷', badgeBg: 'rgba(139,92,246,0.1)', badgeColor: '#a78bfa' },
};

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1)  return `${Math.floor(diff / 60000)}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function AnnouncementsPage() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classes,  setClasses]   = useState<ClassOption[]>([]);
  const [sections, setSections]  = useState<SectionOption[]>([]);
  const [loading,  setLoading]   = useState(true);
  const [creating, setCreating]  = useState(false);
  const [showForm, setShowForm]  = useState(false);
  const [error,    setError]     = useState('');
  const [success,  setSuccess]   = useState('');
  const [userData, setUserData]  = useState<{ email?: string; role?: string; school?: string }>({});
  const [filterTarget, setFilterTarget] = useState('');

  const [form, setForm] = useState({
    title: '', message: '', target_type: 'school', target_id: '', expires_at: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [a, cl, sc] = await Promise.all([
        fetchApi('/communication'),
        fetchApi('/classes'),
        fetchApi('/sections'),
      ]);
      setAnnouncements(a.announcements || []);
      setClasses(cl.classes || []);
      setSections(sc.sections || []);
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
      await fetchApi('/communication', {
        method: 'POST',
        data: {
          title:       form.title,
          message:     form.message,
          target_type: form.target_type,
          target_id:   form.target_id || undefined,
          expires_at:  form.expires_at || undefined,
        },
      });
      setForm({ title: '', message: '', target_type: 'school', target_id: '', expires_at: '' });
      setShowForm(false);
      setSuccess('Announcement published and notifications sent!');
      load();
      setTimeout(() => setSuccess(''), 5000);
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  };

  const filteredSections = sections.filter(s => s.class_id === form.target_id);

  const displayed = filterTarget
    ? announcements.filter(a => a.target_type === filterTarget)
    : announcements;

  const counts = {
    total:   announcements.length,
    school:  announcements.filter(a => a.target_type === 'school').length,
    class:   announcements.filter(a => a.target_type === 'class').length,
    section: announcements.filter(a => a.target_type === 'section').length,
    active:  announcements.filter(a => !a.expires_at || new Date(a.expires_at) > new Date()).length,
  };

  if (loading) return (
    <AppLayout userEmail={userData.email} userRole={userData.role} schoolName={userData.school}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
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
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              📢 Announcements
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              Broadcast to your entire school, a class, or a section — with automatic notification delivery
            </p>
          </div>
          <button onClick={() => { setShowForm(!showForm); setError(''); }} className="btn btn-primary">
            {showForm ? '✕ Cancel' : '+ New Announcement'}
          </button>
        </div>
      </div>

      {/* ── Alerts ─────────────────────────────────────── */}
      {success && <div className="alert alert-success" style={{ marginBottom: '16px' }}>{success}</div>}

      {/* ── KPI strip ─────────────────────────────────── */}
      <div className="kpi-grid" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(4,1fr)' }}>
        {[
          { label: 'Total',      value: counts.total,   color: 'var(--text-primary)' },
          { label: 'Active',     value: counts.active,  color: '#4ade80' },
          { label: 'School-wide',value: counts.school,  color: '#60a5fa' },
          { label: 'Class/Section', value: counts.class + counts.section, color: '#a78bfa' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-card-value" style={{ color: k.color }}>{k.value}</div>
            <div className="kpi-card-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Compose form ─────────────────────────────── */}
      {showForm && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>
            Create Announcement
          </h2>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {error && <div className="alert alert-error">{error}</div>}
            <div>
              <label className="form-label">Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Announcement title" required className="input" />
            </div>
            <div>
              <label className="form-label">Message *</label>
              <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Announcement message body…" required rows={4}
                className="input" style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label className="form-label">Target Audience *</label>
                <select value={form.target_type}
                  onChange={e => setForm(f => ({ ...f, target_type: e.target.value, target_id: '' }))}
                  className="input">
                  <option value="school">🏫 Whole School</option>
                  <option value="class">📚 Class</option>
                  <option value="section">🔷 Section</option>
                </select>
              </div>

              {form.target_type === 'class' && (
                <div>
                  <label className="form-label">Class *</label>
                  <select value={form.target_id}
                    onChange={e => setForm(f => ({ ...f, target_id: e.target.value }))} required className="input">
                    <option value="">— Select class —</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {form.target_type === 'section' && (
                <div>
                  <label className="form-label">Section *</label>
                  <select value={form.target_id}
                    onChange={e => setForm(f => ({ ...f, target_id: e.target.value }))} required className="input">
                    <option value="">— Select section —</option>
                    {filteredSections.length > 0
                      ? filteredSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                      : sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                    }
                  </select>
                </div>
              )}

              <div>
                <label className="form-label">Expires At (optional)</label>
                <input type="datetime-local" value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  style={{ colorScheme: 'dark' }} className="input" />
              </div>
            </div>

            {/* Audience preview */}
            <div className="alert alert-info" style={{ fontSize: '12px' }}>
              📣 This announcement will be sent to&nbsp;
              <strong>
                {form.target_type === 'school' ? 'all active users'
                  : form.target_type === 'class' ? `all students and teachers in the selected class`
                  : 'all students in the selected section'}
              </strong>
              &nbsp;as in-app notifications.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" disabled={creating} className="btn btn-primary">
                {creating ? 'Publishing…' : 'Publish Announcement'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filter tabs ──────────────────────────────────── */}
      <div className="filter-bar" style={{ marginBottom: '16px' }}>
        {[
          { val: '',        label: `All (${counts.total})` },
          { val: 'school',  label: `🏫 School-wide (${counts.school})` },
          { val: 'class',   label: `📚 Class (${counts.class})` },
          { val: 'section', label: `🔷 Section (${counts.section})` },
        ].map(f => (
          <button key={f.val} onClick={() => setFilterTarget(f.val)}
            className="btn"
            style={{
              fontSize: '12px', padding: '5px 12px',
              background: filterTarget === f.val ? 'var(--brand-subtle)' : 'var(--bg-elevated)',
              border: `1px solid ${filterTarget === f.val ? 'rgba(99,102,241,0.3)' : 'var(--border-default)'}`,
              color: filterTarget === f.val ? '#a5b4fc' : 'var(--text-secondary)',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Announcement list ─────────────────────────────── */}
      {displayed.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
            <p className="empty-state-title">No announcements</p>
            <p className="empty-state-desc">Create your first announcement to broadcast news and updates to your school community.</p>
            <button onClick={() => setShowForm(true)} className="btn btn-primary" style={{ marginTop: '8px' }}>
              + Create Announcement
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {displayed.map(ann => {
            const cfg = TARGET_CFG[ann.target_type] || TARGET_CFG.school;
            const isExpired = ann.expires_at && new Date(ann.expires_at) < new Date();
            return (
              <div key={ann.id}
                className="card"
                style={{ opacity: isExpired ? 0.55 : 1, position: 'relative', overflow: 'hidden' }}>
                {/* Target accent stripe */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px',
                  background: cfg.badgeColor,
                }} />
                <div style={{ paddingLeft: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                        padding: '2px 7px', borderRadius: '3px',
                        background: cfg.badgeBg, color: cfg.badgeColor,
                      }}>
                        {cfg.icon} {cfg.label}
                      </span>
                      {isExpired && (
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '3px', background: 'rgba(113,113,122,0.12)', color: '#71717a' }}>
                          Expired
                        </span>
                      )}
                      {ann.expires_at && !isExpired && (
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '3px', background: 'rgba(59,130,246,0.08)', color: '#60a5fa' }}>
                          Expires {new Date(ann.expires_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-faint)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {relativeTime(ann.created_at)}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    {ann.title}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {ann.message}
                  </p>

                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)',
                    fontSize: '11px', color: 'var(--text-faint)',
                  }}>
                    <span>By {ann.createdBy.email.split('@')[0]}</span>
                    <span>·</span>
                    <span>{new Date(ann.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
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
