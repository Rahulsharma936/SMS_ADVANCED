'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { ALL_NAV_ITEMS } from '@/components/AppLayout';

/* ── Types ───────────────────────────────── */
interface UserData { id: string; email: string; status: string; createdAt: string; role: { name: string }; }
interface StudentStats { total: number; byStatus: { status: string; count: number }[]; }
interface FeeSummary { total_final: number; by_status: { pending: number; partial: number; paid: number; overdue: number }; }
interface Exam { id: string; name: string; status: string; start_date?: string; end_date?: string; academic_year: string; }
interface Notice { id: string; title: string; priority: string; created_at: string; }
interface Student { id: string; firstName: string; lastName: string; createdAt: string; class?: { name: string }; }

/* ── Helpers ─────────────────────────────── */
function getGreeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
function fmt(n: number) { return n >= 10000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString('en-IN'); }
function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function Icon({ d, size = 14, color }: { d: string; size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" stroke={color || 'currentColor'} viewBox="0 0 24 24" strokeWidth={1.75} style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d={d} /></svg>;
}
function SkLoader() {
  return <div className="widget-body" style={{ padding: '16px' }}>
    {[75, 50, 90, 60].map((w, i) => <div key={i} className="skeleton sk-line" style={{ width: `${w}%` }} />)}
  </div>;
}

/* ── Quick actions ───────────────────────── */
const QUICK = [
  { href: '/students/admit', label: 'New Admission', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z', primary: true, kbd: '' },
  { href: '/attendance', label: 'Attendance', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', primary: true, kbd: 'G+A' },
  { href: '/marks-entry', label: 'Enter Marks', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', primary: true, kbd: 'G+M' },
  { href: '/fees', label: 'Fee Overview', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', primary: true, kbd: 'G+F' },
  { href: '/announcements', label: 'Announce', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z', primary: true, kbd: '' },
  { href: '/exams', label: 'View Exams', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', primary: true, kbd: 'G+E' },
];


/* ── Exam status style ───────────────────── */
function examDotColor(status: string) {
  if (status === 'published') return '#34d399';
  if (status === 'draft') return '#fbbf24';
  return '#71717a';
}

/* ═══════════════════════════════════════════
   DASHBOARD PAGE
   ═══════════════════════════════════════════ */
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [tenantId, setTenantId] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(true);
  const [pinnedHrefs, setPinnedHrefs] = useState<string[]>([]);
  const [recentHrefs, setRecentHrefs] = useState<string[]>([]);

  /* Load recent + pinned from localStorage (client only) */
  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem('sms_recent_modules') || '[]');
      setRecentHrefs(r.slice(0, 5));
      const p = JSON.parse(localStorage.getItem('sms_pinned_modules') || '[]');
      setPinnedHrefs(p);
    } catch { }
  }, []);

  const togglePin = useCallback((href: string) => {
    setPinnedHrefs(prev => {
      const next = prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href].slice(0, 6);
      try { localStorage.setItem('sms_pinned_modules', JSON.stringify(next)); } catch { }
      return next;
    });
  }, []);

  /* widget states */
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [teachers, setTeachers] = useState<number | null>(null);
  const [classCount, setClassCount] = useState<number | null>(null);
  const [subjectCount, setSubjectCount] = useState<number | null>(null);
  const [feeSumm, setFeeSumm] = useState<FeeSummary | null>(null);
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [recent, setRecent] = useState<Student[] | null>(null);
  const [statsLoad, setStatsLoad] = useState(true);
  const [feeLoad, setFeeLoad] = useState(true);
  const [examLoad, setExamLoad] = useState(true);
  const [notLoad, setNotLoad] = useState(true);
  const [recLoad, setRecLoad] = useState(true);
  const [setupDismissed, setSetupDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await fetchApi('/users/me');
        setUser(d.user); setTenantId(d.tenant_id);
        /* tenant name endpoint not available — skip gracefully */
      } catch (e: any) { if (e.message?.includes('Unauthorized') || e.message?.includes('Session expired')) { router.push('/login'); return; } }
      finally { setLoading(false); }

      /* parallel widget fetches — all gracefully failing */
      fetchApi('/students/stats')
        .then(d => setStats(d))
        .catch(() => setStats(null))
        .finally(() => setStatsLoad(false));

      fetchApi('/teachers/count')
        .then(d => setTeachers(d?.count ?? null))
        .catch(() => setTeachers(null))
        .finally(() => setStatsLoad(false));

      fetchApi('/classes/count')
        .then(d => { setClassCount(d?.count ?? 0); })
        .catch(() => { setClassCount(0); });

      fetchApi('/subjects/count')
        .then(d => setSubjectCount(d?.count ?? 0))
        .catch(() => setSubjectCount(0));

      fetchApi('/fees/summary')
        .then(d => setFeeSumm(d?.summary ?? null))
        .catch(() => setFeeSumm(null))
        .finally(() => setFeeLoad(false));

      fetchApi('/exams')
        .then(d => setExams(d?.exams ?? []))
        .catch(() => setExams([]))
        .finally(() => setExamLoad(false));

      fetchApi('/communication/notices')
        .then(d => { setNotices((d?.notices ?? d?.data ?? []).slice(0, 4)); })
        .catch(() => { fetchApi('/communication').then(d => setNotices((d?.announcements ?? []).slice(0, 4))).catch(() => setNotices([])); })
        .finally(() => setNotLoad(false));

      fetchApi('/students?limit=5&sort=createdAt_desc')
        .then(d => setRecent((d?.students ?? []).slice(0, 5)))
        .catch(() => setRecent([]))
        .finally(() => setRecLoad(false));
    })();
  }, [router]);

  if (loading) return <div className="page-loading"><div className="spinner spinner-lg" /></div>;

  const name = user?.email?.split('@')[0] ?? 'there';
  const paid = feeSumm?.by_status?.paid ?? 0;
  const pending = feeSumm?.by_status?.pending ?? 0;
  const overdue = feeSumm?.by_status?.overdue ?? 0;
  const partial = feeSumm?.by_status?.partial ?? 0;
  const feeTotal = paid + pending + overdue + partial || 1;
  const paidPct = Math.round((paid / feeTotal) * 100);
  const totalFinal = feeSumm?.total_final ?? 0;
  const activeExams = exams?.filter(e => e.status === 'published') ?? [];
  const upcomingExams = exams?.filter(e => e.status !== 'completed').slice(0, 4) ?? [];
  const activeStudents = stats?.byStatus?.find(s => s.status === 'ACTIVE')?.count;
  const kpis = [
    { href: '/students', label: 'Students', value: stats?.total ?? '—', color: '#34d399' },
    { href: '/teachers', label: 'Teachers', value: teachers ?? '—', color: '#818cf8' },
    { href: '/exams', label: 'Live Exams', value: activeExams.length, color: '#f87171' },
    { href: '/fees', label: 'Fee Paid', value: `${paidPct}%`, color: '#fbbf24' },
  ];

  /* ── Setup checklist logic ── */
  const setupSteps = [
    { key: 'classes', label: 'Create Classes', href: '/classes', done: (classCount ?? 0) > 0, icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { key: 'subjects', label: 'Add Subjects', href: '/subjects', done: (subjectCount ?? 0) > 0, icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { key: 'teachers', label: 'Add Teachers', href: '/teachers/add', done: (teachers ?? 0) > 0, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { key: 'students', label: 'Admit Students', href: '/students/admit', done: (stats?.total ?? 0) > 0, icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
    { key: 'fees', label: 'Configure Fees', href: '/fees', done: totalFinal > 0, icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { key: 'exams', label: 'Create Exam', href: '/exams', done: (exams?.length ?? 0) > 0, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ];
  const doneCount = setupSteps.filter(s => s.done).length;
  const setupPct = Math.round((doneCount / setupSteps.length) * 100);
  const isNewSchool = doneCount < setupSteps.length && !setupDismissed;
  const nextStep = setupSteps.find(s => !s.done);

  return (
    <AppLayout userEmail={user?.email} userRole={user?.role?.name} schoolName={schoolName || undefined}>

      {/* ── Zone 1: Greeting + KPIs ── */}
      <div className="animate-fade-in-up">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
              {getGreeting()}, {name}
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', fontWeight: 600, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                {user?.role?.name}
              </span>
              {tenantId && <><span style={{ color: 'var(--text-faint)' }}>·</span><span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--text-faint)' }}>{tenantId.slice(0, 8)}…</span></>}
            </p>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '5px 10px', flexShrink: 0 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>

        <div className="kpi-grid">
          {kpis.map(k => (
            <a key={k.href} href={k.href} className="kpi-card">
              <div className="kpi-card-value" style={{ color: k.color }}>{k.value}</div>
              <div className="kpi-card-label">{k.label}</div>
            </a>
          ))}
        </div>
      </div>

      {/* ── Zone 1.5: Setup Checklist (for new schools) ── */}
      {isNewSchool && (
        <div className="setup-banner animate-fade-in-up delay-50">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="setup-banner-title">🏫 School Setup</div>
              <div className="setup-banner-desc">
                {doneCount === 0
                  ? 'Welcome! Complete these steps to get your school up and running.'
                  : `Great progress! ${doneCount} of ${setupSteps.length} steps completed.`}
              </div>
            </div>
            <button onClick={() => setSetupDismissed(true)} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '16px', padding: '4px', lineHeight: 1 }} title="Dismiss">✕</button>
          </div>
          <div className="setup-progress-bar">
            <div className="setup-progress-fill" style={{ width: `${setupPct}%` }} />
          </div>
          <div className="setup-progress-label">
            <span>{doneCount}/{setupSteps.length} completed</span>
            <span>{setupPct}%</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
            {setupSteps.map((s, i) => {
              const isNext = !s.done && s.key === nextStep?.key;
              return (
                <a key={s.key} href={s.href} className={`setup-step ${s.done ? 'done' : ''} ${isNext ? 'next' : ''}`} style={{ display: 'flex' }}>
                  <span className="setup-step-icon">
                    {s.done ? '✓' : <span className="setup-step-num">{i + 1}</span>}
                  </span>
                  <span>{s.label}</span>
                  {isNext && <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--brand-primary)' }}>→ Next</span>}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Smart Next Step Card (when partially set up) ── */}
      {isNewSchool && nextStep && doneCount > 0 && (
        <a href={nextStep.href} className="next-step-card animate-fade-in-up delay-50" style={{ textDecoration: 'none' }}>
          <div className="next-step-card-icon">
            <Icon d={nextStep.icon} size={18} />
          </div>
          <div className="next-step-card-body">
            <div className="next-step-card-title">Next: {nextStep.label}</div>
            <div className="next-step-card-desc">
              {nextStep.key === 'subjects' && 'Add subjects that will be taught in your school.'}
              {nextStep.key === 'teachers' && 'Register teachers and assign them to subjects.'}
              {nextStep.key === 'students' && 'Start admitting students to your classes.'}
              {nextStep.key === 'fees' && 'Set up fee structures and assign to students.'}
              {nextStep.key === 'exams' && 'Create your first exam to start academic tracking.'}
              {nextStep.key === 'classes' && 'Create classes and sections for your school.'}
            </div>
          </div>
          <span className="btn btn-primary" style={{ fontSize: '11px', padding: '6px 14px', flexShrink: 0 }}>Get Started →</span>
        </a>
      )}

      {/* ── Zone 1.5: Recent + Pinned ── */}
      {(recentHrefs.length > 0 || pinnedHrefs.length > 0) && (
        <div className="animate-fade-in-up delay-50" style={{ marginBottom: '4px' }}>
          {pinnedHrefs.length > 0 && (
            <>
              <div className="section-divider" style={{ marginBottom: '10px' }}>
                <span className="section-divider-label">Pinned</span>
                <div className="section-divider-line" />
              </div>
              <div className="chip-row">
                {pinnedHrefs.map(href => {
                  const item = ALL_NAV_ITEMS.find(i => i.href === href);
                  if (!item) return null;
                  return (
                    <a key={href} href={href} className="module-chip pinned">
                      <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                      </svg>
                      {item.label}
                      <span onClick={e => { e.preventDefault(); e.stopPropagation(); togglePin(href); }}
                        style={{ marginLeft: '2px', opacity: 0.6, cursor: 'pointer', fontSize: '11px' }} title="Unpin">✕</span>
                    </a>
                  );
                })}
              </div>
            </>
          )}
          {recentHrefs.length > 0 && (
            <>
              <div className="section-divider" style={{ marginBottom: '10px' }}>
                <span className="section-divider-label">Recently Visited</span>
                <div className="section-divider-line" />
              </div>
              <div className="chip-row">
                {recentHrefs.map(href => {
                  const item = ALL_NAV_ITEMS.find(i => i.href === href);
                  if (!item) return null;
                  const isPinned = pinnedHrefs.includes(href);
                  return (
                    <span key={href} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <a href={href} className="module-chip">
                        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                        </svg>
                        {item.label}
                      </a>
                      <button onClick={() => togglePin(href)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: isPinned ? 'var(--brand-primary)' : 'var(--text-faint)', fontSize: '12px' }} title={isPinned ? 'Unpin' : 'Pin'}>
                        {isPinned ? '★' : '☆'}
                      </button>
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <div className="animate-fade-in-up delay-50">
        <div className="section-divider">
          <span className="section-divider-label">Quick Actions</span>
          <div className="section-divider-line" />
        </div>
        <div className="quick-actions-row">
          {QUICK.map(a => (
            <a key={a.href} href={a.href} className={`quick-action-btn ${a.primary ? 'primary' : ''}`} style={{ position: 'relative' }}>
              <Icon d={a.icon} size={13} />
              {a.label}
              {a.kbd && (
                <span style={{
                  fontSize: '9px', fontFamily: 'var(--font-geist-mono)',
                  color: 'var(--text-faint)', background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '3px', padding: '0 3px', marginLeft: '2px',
                }}>{a.kbd}</span>
              )}
            </a>
          ))}
        </div>
        {/* Keyboard discovery hint */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>Power tip:</span>
          <span style={{
            fontSize: '10px', fontFamily: 'var(--font-geist-mono)',
            background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
            borderRadius: '3px', padding: '1px 5px', color: 'var(--text-muted)',
          }}>⌘K</span>
          <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>command palette</span>
          <span style={{ fontSize: '11px', color: 'var(--text-faint)', margin: '0 2px' }}>·</span>
          <span style={{
            fontSize: '10px', fontFamily: 'var(--font-geist-mono)',
            background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
            borderRadius: '3px', padding: '1px 5px', color: 'var(--text-muted)',
          }}>G+A</span>
          <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>jump to attendance</span>
          <span style={{ fontSize: '11px', color: 'var(--text-faint)', margin: '0 2px' }}>·</span>
          <button onClick={() => { }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '11px', color: 'var(--brand-primary)', textDecoration: 'none' }}
            onKeyDown={e => e.key === 'Enter' && undefined}>
            press <code style={{ fontSize: '10px', fontFamily: 'var(--font-geist-mono)' }}>?</code> for all shortcuts
          </button>
        </div>
      </div>

      {/* ── Zone 3: Operational Widgets ── */}
      <div className="animate-fade-in-up delay-100">
        <div className="section-divider">
          <span className="section-divider-label">Operational Overview</span>
          <div className="section-divider-line" />
        </div>

        <div className="ops-grid">

          {/* Widget: Student Snapshot */}
          <div className="widget">
            <div className="widget-head">
              <span className="widget-title">
                <Icon d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" size={13} />
                Students
              </span>
              <a href="/students" className="widget-link">View all →</a>
            </div>
            {statsLoad ? <SkLoader /> : stats ? (
              <div className="widget-body">
                <div className="ops-row">
                  <span className="ops-row-label">Total Enrolled</span>
                  <span className="ops-row-val">{stats.total}</span>
                </div>
                <div className="ops-row">
                  <span className="ops-row-label">Active</span>
                  <span className="ops-row-val" style={{ color: '#34d399' }}>{activeStudents ?? '—'}</span>
                </div>
                {stats.byStatus.filter(s => s.status !== 'ACTIVE' && s.count > 0).map(s => (
                  <div key={s.status} className="ops-row">
                    <span className="ops-row-label" style={{ textTransform: 'capitalize' }}>{s.status.toLowerCase()}</span>
                    <span className="ops-row-val" style={{ color: 'var(--text-muted)' }}>{s.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-widget">
                <p className="empty-widget-text">No students enrolled yet</p>
                <a href="/students/admit" className="widget-link" style={{ marginTop: '4px' }}>Admit first student →</a>
              </div>
            )}
          </div>

          {/* Widget: Fee Collection */}
          <div className="widget">
            <div className="widget-head">
              <span className="widget-title">
                <Icon d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={13} />
                Fee Collection
              </span>
              <a href="/fees" className="widget-link">Details →</a>
            </div>
            {feeLoad ? <SkLoader /> : feeSumm ? (
              <div className="widget-body">
                <div className="ops-row">
                  <span className="ops-row-label">Total Billed</span>
                  <span className="ops-row-val">₹{fmt(totalFinal)}</span>
                </div>
                <div style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>Collection rate</span>
                    <span style={{ fontWeight: 600, color: '#34d399' }}>{paidPct}%</span>
                  </div>
                  <div className="fee-bar-track">
                    <div className="fee-bar-fill" style={{ width: `${paidPct}%` }} />
                  </div>
                  <div className="fee-bar-labels">
                    <span>{paid} paid</span>
                    <span>{overdue} overdue</span>
                  </div>
                </div>
                <div className="ops-row">
                  <span className="ops-row-label">Pending</span>
                  <span className="ops-row-val" style={{ color: '#fbbf24' }}>{pending}</span>
                </div>
                {overdue > 0 && <div className="ops-row">
                  <span className="ops-row-label">Overdue</span>
                  <span className="ops-row-val" style={{ color: '#f87171' }}>{overdue} <a href="/fees/defaulters" style={{ fontSize: '10px', color: 'var(--brand-primary)' }}>→ view</a></span>
                </div>}
              </div>
            ) : (
              <div className="empty-widget">
                <p className="empty-widget-text">No fee structure configured</p>
                <a href="/fees" className="widget-link" style={{ marginTop: '4px' }}>Set up fees →</a>
              </div>
            )}
          </div>

          {/* Widget: Exams */}
          <div className="widget">
            <div className="widget-head">
              <span className="widget-title">
                <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" size={13} />
                Exams
              </span>
              <a href="/exams" className="widget-link">Manage →</a>
            </div>
            {examLoad ? <SkLoader /> : upcomingExams.length > 0 ? (
              <div className="widget-body">
                {upcomingExams.map(e => (
                  <div key={e.id} className="exam-item">
                    <div className="exam-dot" style={{ background: examDotColor(e.status) }} />
                    <span className="exam-name">{e.name}</span>
                    <span className="exam-meta">
                      {e.start_date ? fmtDate(e.start_date) : e.academic_year}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-widget">
                <p className="empty-widget-text">No upcoming exams</p>
                <a href="/exams" className="widget-link" style={{ marginTop: '4px' }}>Create exam →</a>
              </div>
            )}
          </div>

          {/* Widget: Notice Board */}
          <div className="widget">
            <div className="widget-head">
              <span className="widget-title">
                <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" size={13} />
                Notice Board
              </span>
              <a href="/notice-board" className="widget-link">All notices →</a>
            </div>
            {notLoad ? <SkLoader /> : notices && notices.length > 0 ? (
              <div className="widget-body">
                {notices.map(n => (
                  <div key={n.id} className="notice-item">
                    <span className={`notice-badge ${n.priority === 'high' ? 'high' : 'normal'}`}>{n.priority}</span>
                    <span className="notice-title">{n.title}</span>
                    <div style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '2px' }}>{timeAgo(n.created_at)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-widget">
                <p className="empty-widget-text">No notices posted</p>
                <a href="/notice-board" className="widget-link" style={{ marginTop: '4px' }}>Post a notice →</a>
              </div>
            )}
          </div>

        </div>{/* /ops-grid */}
      </div>

      {/* ── Zone 4: Recent Admissions ── */}
      <div className="animate-fade-in-up delay-100">
        <div className="section-divider">
          <span className="section-divider-label">Recent Admissions</span>
          <div className="section-divider-line" />
        </div>
        <div className="widget" style={{ marginBottom: '24px' }}>
          {recLoad ? <SkLoader /> : recent && recent.length > 0 ? (
            <div className="widget-body">
              {recent.map(s => (
                <div key={s.id} className="feed-item">
                  <div className="feed-icon" style={{ background: 'rgba(99,102,241,0.1)' }}>
                    <Icon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" size={14} color="#818cf8" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="feed-text"><strong>{s.firstName} {s.lastName}</strong>{s.class ? ' — ' + s.class.name : ''}</div>
                    <div className="feed-time">{timeAgo(s.createdAt)}</div>
                  </div>
                  <a href={`/students/${s.id}`} style={{ fontSize: '11px', color: 'var(--brand-primary)', textDecoration: 'none', flexShrink: 0 }}>View →</a>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-widget">
              <p className="empty-widget-text">No recent admissions</p>
              <a href="/students/admit" className="widget-link" style={{ marginTop: '4px' }}>Admit a student →</a>
            </div>
          )}
        </div>
      </div>

    </AppLayout>
  );
}
