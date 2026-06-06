'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

interface ClassData { id: string; name: string; sections: { id: string; name: string }[]; }
interface ReportEntry {
  student_id: string; name: string; roll: string | null;
  present: number; absent: number; late: number; excused: number;
  total: number; percentage: number;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '5px' }}>{children}</label>;
}

function PctBar({ pct }: { pct: number }) {
  const color = pct >= 75 ? '#4ade80' : pct >= 50 ? '#fbbf24' : '#f87171';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: '64px', height: '4px', background: 'var(--bg-overlay)', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.4s ease' }}/>
      </div>
      <span style={{ fontSize: '12px', fontWeight: 600, color, minWidth: '34px' }}>{pct}%</span>
    </div>
  );
}

export default function AttendanceReportPage() {
  const [classes,       setClasses]       = useState<ClassData[]>([]);
  const [classId,       setClassId]       = useState('');
  const [sectionId,     setSectionId]     = useState('');
  const [fromDate,      setFromDate]      = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]; });
  const [toDate,        setToDate]        = useState(new Date().toISOString().split('T')[0]);
  const [report,        setReport]        = useState<ReportEntry[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading,       setLoading]       = useState(false);

  const selectedClass = classes.find(c => c.id === classId);
  const avgPct  = report.length > 0 ? Math.round(report.reduce((a, r) => a + r.percentage, 0) / report.length) : 0;
  const below75 = report.filter(r => r.percentage < 75);

  useEffect(() => {
    fetchApi('/classes').then(d => setClasses(d.classes)).catch(() => {});
  }, []);

  const loadReport = async () => {
    if (!classId || !sectionId) return;
    setLoading(true);
    try {
      const data = await fetchApi(`/attendance/report/class?class_id=${classId}&section_id=${sectionId}&from_date=${fromDate}&to_date=${toDate}`);
      setReport(data.report);
      setTotalSessions(data.totalSessions);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <AppLayout>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Report</h1>
          <p className="page-subtitle">Class-wise attendance summary for a date range</p>
        </div>
        <a href="/attendance" className="btn btn-secondary" style={{ fontSize: '12px' }}>← Mark Attendance</a>
      </div>

      {/* Filter card */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
        <div style={{ minWidth: '140px' }}>
          <FieldLabel>Class</FieldLabel>
          <select value={classId} onChange={e => { setClassId(e.target.value); setSectionId(''); }} className="input" style={{ width: '100%' }}>
            <option value="">Select class</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {selectedClass && (
          <div style={{ minWidth: '120px' }}>
            <FieldLabel>Section</FieldLabel>
            <select value={sectionId} onChange={e => setSectionId(e.target.value)} className="input" style={{ width: '100%' }}>
              <option value="">Select section</option>
              {selectedClass.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <FieldLabel>From</FieldLabel>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="input" style={{ colorScheme: 'dark', width: 'auto' }}/>
        </div>
        <div>
          <FieldLabel>To</FieldLabel>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="input" style={{ colorScheme: 'dark', width: 'auto' }}/>
        </div>
        <button onClick={loadReport} disabled={!classId || !sectionId || loading} className="btn btn-primary" style={{ padding: '8px 18px' }}>
          {loading
            ? <><div className="spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }}/> Loading…</>
            : 'Generate Report'
          }
        </button>
      </div>

      {/* Empty prompt */}
      {!report.length && !loading && (
        <div className="empty-state" style={{ minHeight: '35vh' }}>
          <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          <p className="empty-state-title">No report generated yet</p>
          <p className="empty-state-desc">Select a class, section, and date range, then click Generate Report.</p>
        </div>
      )}

      {/* Summary KPI cards */}
      {report.length > 0 && (
        <>
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', marginBottom: '16px' }}>
            {[
              { label: 'Total Sessions', value: totalSessions,    color: '#60a5fa' },
              { label: 'Avg Attendance', value: `${avgPct}%`,     color: avgPct >= 75 ? '#4ade80' : '#fbbf24' },
              { label: 'Students',       value: report.length,    color: 'var(--text-primary)' },
              { label: 'Below 75%',      value: below75.length,   color: below75.length > 0 ? '#f87171' : '#4ade80' },
            ].map(c => (
              <div key={c.label} className="kpi-card">
                <div className="kpi-card-value" style={{ color: c.color }}>{c.value}</div>
                <div className="kpi-card-label">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Below-75% alert */}
          {below75.length > 0 && (
            <div className="alert alert-warning" style={{ marginBottom: '14px' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75} style={{ flexShrink: 0, marginTop: '1px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <span><strong>{below75.length} student{below75.length !== 1 ? 's' : ''}</strong> have attendance below 75% — {below75.map(r => r.name.split(' ')[0]).join(', ')}</span>
            </div>
          )}

          {/* Report table */}
          <div className="data-table-wrap">
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Roll</th>
                    <th>Student</th>
                    <th style={{ textAlign: 'center', color: '#4ade80' }}>Present</th>
                    <th style={{ textAlign: 'center', color: '#f87171' }}>Absent</th>
                    <th style={{ textAlign: 'center', color: '#fbbf24' }}>Late</th>
                    <th style={{ textAlign: 'center', color: '#60a5fa' }}>Excused</th>
                    <th>Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map(r => (
                    <tr key={r.student_id}>
                      <td style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--text-faint)' }}>{r.roll ?? '—'}</td>
                      <td style={{ fontWeight: 500 }}>{r.name}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#4ade80' }}>{r.present}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#f87171' }}>{r.absent}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#fbbf24' }}>{r.late}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#60a5fa' }}>{r.excused}</td>
                      <td><PctBar pct={r.percentage}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}
