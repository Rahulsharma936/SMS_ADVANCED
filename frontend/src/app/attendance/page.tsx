'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

interface ClassData { id: string; name: string; sections: { id: string; name: string }[]; }
interface StudentForAttendance {
  id: string; firstName: string; lastName: string;
  roll_number: string | null; admission_number: string;
}
type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

/* ── Status config ── */
const STATUS_CONFIG: Record<AttendanceStatus, { label: string; short: string; key: string; bg: string; text: string; border: string; }> = {
  PRESENT: { label: 'Present', short: 'P', key: 'p', bg: 'rgba(34,197,94,0.12)',  text: '#4ade80', border: 'rgba(34,197,94,0.25)'  },
  ABSENT:  { label: 'Absent',  short: 'A', key: 'a', bg: 'rgba(239,68,68,0.12)',  text: '#f87171', border: 'rgba(239,68,68,0.25)'  },
  LATE:    { label: 'Late',    short: 'L', key: 'l', bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
  EXCUSED: { label: 'Excused', short: 'E', key: 'e', bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
};
const STATUS_ORDER: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
const nextStatus = (s: string): AttendanceStatus => {
  const idx = STATUS_ORDER.indexOf(s as AttendanceStatus);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
};

function Avatar({ name, size = 26 }: { name: string; size?: number }) {
  const initials = name.trim().split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444'];
  const bg = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, color: 'white', flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '5px' }}>{children}</label>;
}

export default function AttendancePage() {
  const [classes,           setClasses]           = useState<ClassData[]>([]);
  const [selectedClassId,   setSelectedClassId]   = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [date,              setDate]              = useState(new Date().toISOString().split('T')[0]);
  const [period,            setPeriod]            = useState('');
  const [students,          setStudents]          = useState<StudentForAttendance[]>([]);
  const [attendance,        setAttendance]        = useState<Record<string, AttendanceStatus>>({});
  const [savedAttendance,   setSavedAttendance]   = useState<Record<string, AttendanceStatus>>({});
  const [pageLoading,       setPageLoading]       = useState(true);
  const [studentsLoading,   setStudentsLoading]   = useState(false);
  const [submitting,        setSubmitting]        = useState(false);
  const [message,           setMessage]           = useState('');
  const [error,             setError]             = useState('');
  const [focusedRow,        setFocusedRow]        = useState<number>(-1);
  const tableRef = useRef<HTMLTableSectionElement>(null);
  const router = useRouter();

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const isToday = date === new Date().toISOString().split('T')[0];

  /* Unsaved changes detection */
  const hasUnsaved = students.length > 0 && JSON.stringify(attendance) !== JSON.stringify(savedAttendance);

  /* ── Counts ── */
  const counts = {
    present: Object.values(attendance).filter(s => s === 'PRESENT').length,
    absent:  Object.values(attendance).filter(s => s === 'ABSENT').length,
    late:    Object.values(attendance).filter(s => s === 'LATE').length,
    excused: Object.values(attendance).filter(s => s === 'EXCUSED').length,
    total:   students.length,
  };
  const presentPct = counts.total > 0 ? Math.round((counts.present / counts.total) * 100) : 0;

  /* ── Load classes ── */
  useEffect(() => {
    fetchApi('/classes')
      .then(d => setClasses(d.classes))
      .catch((err: any) => { if (err.message?.includes('Unauthorized')) router.push('/login'); })
      .finally(() => setPageLoading(false));
  }, [router]);

  /* ── Load students + existing attendance ── */
  const loadStudents = useCallback(async () => {
    if (!selectedClassId || !selectedSectionId) { setStudents([]); setAttendance({}); setSavedAttendance({}); return; }
    setStudentsLoading(true); setMessage(''); setError('');
    try {
      const data = await fetchApi(`/students?class_id=${selectedClassId}&section_id=${selectedSectionId}&limit=200`);
      const list: StudentForAttendance[] = data.students.map((s: any) => ({
        id: s.id, firstName: s.firstName, lastName: s.lastName,
        roll_number: s.roll_number, admission_number: s.admission_number,
      }));
      setStudents(list);

      /* Default everyone PRESENT */
      const init: Record<string, AttendanceStatus> = {};
      list.forEach(s => { init[s.id] = 'PRESENT'; });

      /* Overlay existing records */
      try {
        const periodParam = period ? `&period=${period}` : '&period=null';
        const existing = await fetchApi(`/attendance/class?class_id=${selectedClassId}&section_id=${selectedSectionId}&date=${date}${periodParam}`);
        if (existing.sessions?.length > 0) {
          existing.sessions[0].records.forEach((r: any) => { init[r.student.id] = r.status as AttendanceStatus; });
        }
      } catch { /* no existing */ }

      setAttendance(init);
      setSavedAttendance({ ...init });
    } catch (err) { console.error(err); }
    finally { setStudentsLoading(false); }
  }, [selectedClassId, selectedSectionId, date, period]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  /* ── Save ── */
  const handleSubmit = async () => {
    setError(''); setMessage(''); setSubmitting(true);
    try {
      const records = Object.entries(attendance).map(([student_id, status]) => ({ student_id, status }));
      await fetchApi('/attendance/mark', {
        method: 'POST',
        data: { class_id: selectedClassId, section_id: selectedSectionId, date, period: period ? parseInt(period) : null, records },
      });
      setSavedAttendance({ ...attendance });
      setMessage(`Saved — ${counts.present} present, ${counts.absent} absent, ${counts.late} late, ${counts.excused} excused`);
      setTimeout(() => setMessage(''), 4000);
    } catch (err: any) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  /* ── Toggle & direct set ── */
  const setStatus = (id: string, status: AttendanceStatus) =>
    setAttendance(prev => ({ ...prev, [id]: status }));

  const markAll = (status: AttendanceStatus) => {
    const updated: Record<string, AttendanceStatus> = {};
    students.forEach(s => { updated[s.id] = status; });
    setAttendance(updated);
  };

  /* ── Keyboard nav on table ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!students.length || focusedRow < 0) return;
      const id = students[focusedRow]?.id;
      if (!id) return;
      if (e.key === 'p' || e.key === 'P') { setStatus(id, 'PRESENT'); }
      if (e.key === 'a' || e.key === 'A') { setStatus(id, 'ABSENT'); }
      if (e.key === 'l' || e.key === 'L') { setStatus(id, 'LATE'); }
      if (e.key === 'e' || e.key === 'E') { setStatus(id, 'EXCUSED'); }
      if (e.key === ' ')  { e.preventDefault(); setAttendance(prev => ({ ...prev, [id]: nextStatus(prev[id]) })); }
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedRow(r => Math.min(r + 1, students.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setFocusedRow(r => Math.max(r - 1, 0)); }
      if (e.key === 'Enter' || e.key === 's') { if (e.ctrlKey || e.metaKey || e.key === 's') { e.preventDefault(); handleSubmit(); } }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [students, focusedRow, attendance]);

  if (pageLoading) return <div className="page-loading"><div className="spinner spinner-lg"/></div>;

  const contextReady = selectedClassId && selectedSectionId;
  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <AppLayout>
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">
            {contextReady
              ? <><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedClass?.name}</span> · {selectedClass?.sections.find(s => s.id === selectedSectionId)?.name} · {displayDate}{period ? ` · Period ${period}` : ''}</>
              : 'Select a class and section to begin marking attendance'
            }
          </p>
        </div>
        {/* Quick nav to report */}
        <a href="/attendance/report" className="btn btn-secondary" style={{ fontSize: '12px' }}>
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          Reports
        </a>
      </div>

      {/* ── Context selector card ── */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
        {/* Class */}
        <div style={{ minWidth: '140px' }}>
          <FieldLabel>Class</FieldLabel>
          <select value={selectedClassId}
            onChange={e => { setSelectedClassId(e.target.value); setSelectedSectionId(''); }}
            className="input" style={{ width: '100%' }}>
            <option value="">Select class</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Section */}
        <div style={{ minWidth: '120px' }}>
          <FieldLabel>Section</FieldLabel>
          <select value={selectedSectionId}
            onChange={e => setSelectedSectionId(e.target.value)}
            className="input" disabled={!selectedClassId} style={{ width: '100%' }}>
            <option value="">Select section</option>
            {selectedClass?.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* Date + Today shortcut */}
        <div>
          <FieldLabel>Date</FieldLabel>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="input" style={{ colorScheme: 'dark', width: 'auto' }}/>
            {!isToday && (
              <button onClick={() => setDate(new Date().toISOString().split('T')[0])}
                className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '11px', whiteSpace: 'nowrap' }}
                title="Jump to today">Today</button>
            )}
          </div>
        </div>

        {/* Period */}
        <div style={{ minWidth: '140px' }}>
          <FieldLabel>Period</FieldLabel>
          <select value={period} onChange={e => setPeriod(e.target.value)} className="input" style={{ width: '100%' }}>
            <option value="">Full Day</option>
            {[1,2,3,4,5,6,7,8].map(p => <option key={p} value={p}>Period {p}</option>)}
          </select>
        </div>

        {/* Attendance % pill (only when loaded) */}
        {students.length > 0 && !studentsLoading && (
          <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.03em', color: presentPct >= 75 ? '#4ade80' : presentPct >= 50 ? '#fbbf24' : '#f87171', lineHeight: 1 }}>
              {presentPct}%
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>present</div>
          </div>
        )}
      </div>

      {/* ── Contextual workflow strip (shown when context is ready) ── */}
      {contextReady && !studentsLoading && (
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'12px', alignItems:'center' }}>
          <span style={{ fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-faint)' }}>Jump to</span>
          <a href={`/students?class_id=${selectedClassId}`} className="module-chip" style={{ fontSize:'11px' }}>
            👥 Students in {selectedClass?.name}
          </a>
          <a href="/timetable" className="module-chip" style={{ fontSize:'11px' }}>
            🕐 Timetable
          </a>
          <a href="/attendance/report" className="module-chip" style={{ fontSize:'11px' }}>
            📊 Attendance Report
          </a>
          <a href="/leave" className="module-chip" style={{ fontSize:'11px' }}>
            🗓 Leave Requests
          </a>
        </div>
      )}

      {error   && <div className="alert alert-error"   style={{ marginBottom: '12px' }}>{error}</div>}
      {message && <div className="alert alert-success" style={{ marginBottom: '12px' }}>{message}</div>}

      {/* ── Not selected state ── */}
      {!contextReady && (
        <div className="empty-state" style={{ minHeight: '40vh' }}>
          <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
          </svg>
          <p className="empty-state-title">Select a class and section</p>
          <p className="empty-state-desc">Choose the class, section and date above to load students and begin marking attendance.</p>
        </div>
      )}

      {/* ── Students loading ── */}
      {contextReady && studentsLoading && (
        <div className="data-table-wrap" style={{ padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div className="spinner"/>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading students…</span>
        </div>
      )}

      {/* ── No students ── */}
      {contextReady && !studentsLoading && students.length === 0 && (
        <div className="empty-state" style={{ minHeight: '30vh' }}>
          <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
          </svg>
          <p className="empty-state-title">No students in this class/section</p>
          <p className="empty-state-desc">Admit students to this class before marking attendance.</p>
          <a href="/students/admit" className="btn btn-secondary">Admit Students</a>
        </div>
      )}

      {/* ── Attendance table ── */}
      {contextReady && !studentsLoading && students.length > 0 && (
        <>
          {/* Summary strip + bulk actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {/* Summary chips */}
            {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
              const count = Object.values(attendance).filter(s => s === status).length;
              return (
                <div key={status} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: '100px', fontSize: '12px', fontWeight: 600, color: cfg.text }}>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>{count}</span>
                  <span style={{ fontSize: '10px', opacity: 0.85 }}>{cfg.label}</span>
                </div>
              );
            })}

            {/* Bulk actions */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
                <button key={status} onClick={() => markAll(status as AttendanceStatus)}
                  className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 600, color: cfg.text, border: `1px solid ${cfg.border}`, background: cfg.bg }}>
                  All {cfg.short}
                </button>
              ))}
            </div>
          </div>

          {/* Keyboard hint */}
          <div style={{ fontSize: '10px', color: 'var(--text-faint)', marginBottom: '8px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <span>Click row to focus · then press</span>
            {Object.entries(STATUS_CONFIG).map(([s, cfg]) => (
              <span key={s}><kbd style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '3px', padding: '0 4px', fontFamily: 'var(--font-geist-mono)', fontSize: '10px' }}>{cfg.key.toUpperCase()}</kbd> = {cfg.label}</span>
            ))}
            <span><kbd style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '3px', padding: '0 4px', fontFamily: 'var(--font-geist-mono)', fontSize: '10px' }}>Space</kbd> = cycle</span>
            <span><kbd style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '3px', padding: '0 4px', fontFamily: 'var(--font-geist-mono)', fontSize: '10px' }}>↑↓</kbd> = move</span>
          </div>

          <div className="data-table-wrap" style={{ marginBottom: '14px' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '52px' }}>#</th>
                    <th>Student</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Status</th>
                    <th style={{ width: '240px', textAlign: 'center' }}>Quick Set</th>
                  </tr>
                </thead>
                <tbody ref={tableRef}>
                  {students.map((s, idx) => {
                    const status = attendance[s.id] as AttendanceStatus ?? 'PRESENT';
                    const cfg = STATUS_CONFIG[status];
                    const isFocused = focusedRow === idx;
                    return (
                      <tr key={s.id}
                        onClick={() => setFocusedRow(idx)}
                        style={{ cursor: 'pointer', background: isFocused ? 'var(--bg-overlay)' : undefined, outline: isFocused ? '1px solid var(--brand-primary)' : undefined }}>
                        <td style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--text-faint)', padding: '8px 12px', textAlign: 'right' }}>
                          {s.roll_number ?? s.admission_number.slice(-4)}
                        </td>
                        <td style={{ padding: '8px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                            <Avatar name={`${s.firstName} ${s.lastName}`} size={26}/>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{s.firstName} {s.lastName}</span>
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <button
                            onClick={e => { e.stopPropagation(); setFocusedRow(idx); setAttendance(prev => ({ ...prev, [s.id]: nextStatus(prev[s.id]) })); }}
                            style={{ padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`, cursor: 'pointer', minWidth: '72px', transition: 'all var(--transition-fast)' }}>
                            {cfg.label}
                          </button>
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            {STATUS_ORDER.map(st => {
                              const c = STATUS_CONFIG[st];
                              const active = status === st;
                              return (
                                <button key={st}
                                  onClick={e => { e.stopPropagation(); setFocusedRow(idx); setStatus(s.id, st); }}
                                  style={{ width: '28px', height: '24px', borderRadius: 'var(--radius-sm)', fontSize: '10px', fontWeight: 700, background: active ? c.bg : 'transparent', color: active ? c.text : 'var(--text-faint)', border: active ? `1px solid ${c.border}` : '1px solid transparent', cursor: 'pointer', transition: 'all var(--transition-fast)' }}
                                  title={c.label}>
                                  {c.short}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Save footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--bg-elevated)', border: `1px solid ${hasUnsaved ? 'rgba(245,158,11,0.3)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-lg)', transition: 'border-color var(--transition-fast)' }}>
            {hasUnsaved && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#fbbf24' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fbbf24' }}/>
                Unsaved changes
              </div>
            )}
            <button onClick={handleSubmit} disabled={submitting || !contextReady}
              className="btn btn-primary" style={{ padding: '8px 20px' }}>
              {submitting
                ? <><div className="spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }}/> Saving…</>
                : <>
                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    Save Attendance
                  </>}
            </button>
            <span style={{ fontSize: '11px', color: 'var(--text-faint)', marginLeft: 'auto' }}>
              {counts.total} students · {counts.present}P · {counts.absent}A · {counts.late}L · {counts.excused}E
            </span>
          </div>
        </>
      )}
    </AppLayout>
  );
}
