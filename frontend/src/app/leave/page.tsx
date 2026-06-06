'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

interface LeaveData {
  id: string; from_date: string; to_date: string; reason: string; status: string;
  created_at: string;
  student: { firstName: string; lastName: string; admission_number: string; class: { name: string }; section: { name: string } };
  approvedBy: { firstName: string; lastName: string } | null;
}

interface ClassData    { id: string; name: string; sections: { id: string; name: string }[] }
interface StudentData  { id: string; firstName: string; lastName: string; admission_number: string }

const STATUS_CFG: Record<string, { label: string; badgeBg: string; badgeColor: string; icon: string }> = {
  pending:  { label: 'Pending',  badgeBg: 'rgba(245,158,11,0.12)', badgeColor: '#fbbf24', icon: '⏳' },
  approved: { label: 'Approved', badgeBg: 'rgba(34,197,94,0.12)',  badgeColor: '#4ade80', icon: '✅' },
  rejected: { label: 'Rejected', badgeBg: 'rgba(239,68,68,0.12)',  badgeColor: '#f87171', icon: '❌' },
};

function daysBetween(from: string, to: string) {
  const diff = new Date(to).getTime() - new Date(from).getTime();
  return Math.ceil(diff / 86400000) + 1;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function LeavePage() {
  const [leaves,        setLeaves]       = useState<LeaveData[]>([]);
  const [loading,       setLoading]      = useState(true);
  const [statusFilter,  setStatusFilter] = useState('');
  const [showApply,     setShowApply]    = useState(false);
  const [classes,       setClasses]      = useState<ClassData[]>([]);
  const [students,      setStudents]     = useState<StudentData[]>([]);
  const [applyForm,     setApplyForm]    = useState({ class_id: '', section_id: '', student_id: '', from_date: '', to_date: '', reason: '' });
  const [applyError,    setApplyError]   = useState('');
  const [applyLoading,  setApplyLoading] = useState(false);
  const [success,       setSuccess]      = useState('');
  const [actioning,     setActioning]    = useState<string | null>(null);

  const selectedClass = classes.find(c => c.id === applyForm.class_id);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const data = await fetchApi(`/attendance/leave${params}`);
      setLeaves(data.leaves || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadLeaves(); }, [statusFilter]);

  const openApplyForm = async () => {
    setShowApply(true);
    try { const data = await fetchApi('/classes'); setClasses(data.classes || []); } catch {}
  };

  const loadStudents = async (classId: string, sectionId: string) => {
    try {
      const data = await fetchApi(`/students?class_id=${classId}&section_id=${sectionId}`);
      setStudents(data.students.map((s: any) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, admission_number: s.admission_number })));
    } catch {}
  };

  const handleApply = async () => {
    if (!applyForm.student_id || !applyForm.from_date || !applyForm.to_date || !applyForm.reason) {
      setApplyError('All fields are required'); return;
    }
    if (new Date(applyForm.to_date) < new Date(applyForm.from_date)) {
      setApplyError('End date cannot be before start date'); return;
    }
    setApplyLoading(true); setApplyError('');
    try {
      await fetchApi('/attendance/leave/apply', {
        method: 'POST',
        data: { student_id: applyForm.student_id, from_date: applyForm.from_date, to_date: applyForm.to_date, reason: applyForm.reason },
      });
      setShowApply(false);
      setApplyForm({ class_id: '', section_id: '', student_id: '', from_date: '', to_date: '', reason: '' });
      setSuccess('Leave application submitted successfully!');
      loadLeaves();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) { setApplyError(err.message); }
    finally { setApplyLoading(false); }
  };

  const handleAction = async (id: string, status: string) => {
    setActioning(id + status);
    try {
      await fetchApi(`/attendance/leave/${id}`, { method: 'PATCH', data: { status } });
      setLeaves(prev => prev.map(l => l.id === id ? { ...l, status } : l));
      setSuccess(`Leave ${status} successfully!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { alert(err.message); }
    finally { setActioning(null); }
  };

  /* ── KPI counts ─── */
  const total    = leaves.length;
  const pending  = leaves.filter(l => l.status === 'pending').length;
  const approved = leaves.filter(l => l.status === 'approved').length;
  const rejected = leaves.filter(l => l.status === 'rejected').length;

  return (
    <AppLayout>

      {/* ── Page header ──────────────────────────────────── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Leave Applications
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              Manage student leave requests — approve, reject, or track status
            </p>
          </div>
          <button onClick={openApplyForm} className="btn btn-primary">
            + Apply Leave
          </button>
        </div>
      </div>

      {/* ── Success toast ────────────────────────────────── */}
      {success && <div className="alert alert-success" style={{ marginBottom: '16px' }}>{success}</div>}

      {/* ── KPI strip ────────────────────────────────────── */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: '20px' }}>
        {[
          { label: 'Total',    value: total,    color: 'var(--text-primary)',
            onClick: () => setStatusFilter('') },
          { label: 'Pending',  value: pending,  color: '#fbbf24',
            onClick: () => setStatusFilter(statusFilter === 'pending' ? '' : 'pending') },
          { label: 'Approved', value: approved, color: '#4ade80',
            onClick: () => setStatusFilter(statusFilter === 'approved' ? '' : 'approved') },
          { label: 'Rejected', value: rejected, color: '#f87171',
            onClick: () => setStatusFilter(statusFilter === 'rejected' ? '' : 'rejected') },
        ].map(k => (
          <div key={k.label} className="kpi-card" onClick={k.onClick}
            style={{ cursor: 'pointer', borderColor: statusFilter === k.label.toLowerCase() ? 'rgba(99,102,241,0.4)' : undefined }}>
            <div className="kpi-card-value" style={{ color: k.color }}>{k.value}</div>
            <div className="kpi-card-label">{k.label}</div>
            {pending > 0 && k.label === 'Pending' && (
              <div className="kpi-card-trend" style={{ color: '#fbbf24' }}>
                ⚠ Needs review
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Filter bar ───────────────────────────────────── */}
      <div className="filter-bar" style={{ marginBottom: '16px' }}>
        {[
          { val: '',         label: `All (${total})` },
          { val: 'pending',  label: `⏳ Pending (${pending})` },
          { val: 'approved', label: `✅ Approved (${approved})` },
          { val: 'rejected', label: `❌ Rejected (${rejected})` },
        ].map(f => (
          <button key={f.val} onClick={() => setStatusFilter(f.val)}
            className="btn"
            style={{
              fontSize: '12px', padding: '5px 12px',
              background: statusFilter === f.val ? 'var(--brand-subtle)' : 'var(--bg-elevated)',
              border: `1px solid ${statusFilter === f.val ? 'rgba(99,102,241,0.3)' : 'var(--border-default)'}`,
              color: statusFilter === f.val ? '#a5b4fc' : 'var(--text-secondary)',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Leave list ───────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : leaves.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="empty-state-title">No leave applications</p>
            <p className="empty-state-desc">
              {statusFilter ? `No ${statusFilter} leave applications found.` : 'No leave applications have been submitted yet.'}
            </p>
            {!statusFilter && (
              <button onClick={openApplyForm} className="btn btn-primary" style={{ marginTop: '8px' }}>
                + Apply First Leave
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {leaves.map(l => {
            const cfg = STATUS_CFG[l.status] || STATUS_CFG.pending;
            const days = daysBetween(l.from_date, l.to_date);
            return (
              <div key={l.id} className="card" style={{ position: 'relative', overflow: 'hidden', padding: '14px 16px' }}>
                {/* Status accent stripe */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px',
                  background: cfg.badgeColor,
                }} />
                <div style={{ paddingLeft: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>

                  {/* Student info + leave detail */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {l.student.firstName} {l.student.lastName}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-overlay)', padding: '1px 7px', borderRadius: '3px' }}>
                        {l.student.class.name} — {l.student.section.name}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>
                        #{l.student.admission_number}
                      </span>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                        padding: '2px 7px', borderRadius: '3px',
                        background: cfg.badgeBg, color: cfg.badgeColor,
                      }}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', lineHeight: 1.4 }}>
                      {l.reason}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-faint)', flexWrap: 'wrap' }}>
                      <span>📅 {formatDate(l.from_date)} → {formatDate(l.to_date)}</span>
                      <span>· {days} day{days !== 1 ? 's' : ''}</span>
                      {l.approvedBy && (
                        <span>· {l.status === 'approved' ? '✅' : '❌'} by {l.approvedBy.firstName} {l.approvedBy.lastName}</span>
                      )}
                      <span>· Applied {new Date(l.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                    </div>
                  </div>

                  {/* Action buttons for pending */}
                  {l.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleAction(l.id, 'approved')}
                        disabled={actioning === l.id + 'approved'}
                        style={{
                          padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 600,
                          background: 'rgba(34,197,94,0.12)', color: '#4ade80',
                          border: '1px solid rgba(34,197,94,0.2)', cursor: 'pointer',
                          opacity: actioning === l.id + 'approved' ? 0.5 : 1,
                          transition: 'all var(--transition-fast)',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.2)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.12)'}
                      >
                        {actioning === l.id + 'approved' ? '…' : '✓ Approve'}
                      </button>
                      <button
                        onClick={() => handleAction(l.id, 'rejected')}
                        disabled={actioning === l.id + 'rejected'}
                        style={{
                          padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 600,
                          background: 'rgba(239,68,68,0.1)', color: '#f87171',
                          border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer',
                          opacity: actioning === l.id + 'rejected' ? 0.5 : 1,
                          transition: 'all var(--transition-fast)',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.2)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'}
                      >
                        {actioning === l.id + 'rejected' ? '…' : '✕ Reject'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Apply Leave Modal ────────────────────────────── */}
      {showApply && (
        <div className="modal-backdrop" onClick={() => setShowApply(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Apply for Leave
              </h2>
              <button onClick={() => setShowApply(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px' }}>
                ✕
              </button>
            </div>

            {applyError && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{applyError}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Class</label>
                  <select value={applyForm.class_id}
                    onChange={e => { setApplyForm({ ...applyForm, class_id: e.target.value, section_id: '', student_id: '' }); setStudents([]); }}
                    className="input">
                    <option value="">Select Class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {selectedClass && (
                  <div>
                    <label className="form-label">Section</label>
                    <select value={applyForm.section_id}
                      onChange={e => { setApplyForm({ ...applyForm, section_id: e.target.value, student_id: '' }); if (e.target.value) loadStudents(applyForm.class_id, e.target.value); }}
                      className="input">
                      <option value="">Select Section</option>
                      {selectedClass.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {students.length > 0 && (
                <div>
                  <label className="form-label">Student *</label>
                  <select value={applyForm.student_id}
                    onChange={e => setApplyForm({ ...applyForm, student_id: e.target.value })}
                    className="input">
                    <option value="">Select Student</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admission_number})</option>)}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">From Date *</label>
                  <input type="date" value={applyForm.from_date}
                    onChange={e => setApplyForm({ ...applyForm, from_date: e.target.value })}
                    className="input" style={{ colorScheme: 'dark' }} />
                </div>
                <div>
                  <label className="form-label">To Date *</label>
                  <input type="date" value={applyForm.to_date}
                    onChange={e => setApplyForm({ ...applyForm, to_date: e.target.value })}
                    className="input" style={{ colorScheme: 'dark' }}
                    min={applyForm.from_date} />
                </div>
              </div>

              {/* Duration preview */}
              {applyForm.from_date && applyForm.to_date && new Date(applyForm.to_date) >= new Date(applyForm.from_date) && (
                <div className="alert alert-info" style={{ fontSize: '12px' }}>
                  📅 Duration: <strong>{daysBetween(applyForm.from_date, applyForm.to_date)} day{daysBetween(applyForm.from_date, applyForm.to_date) !== 1 ? 's' : ''}</strong>
                  &nbsp;({formatDate(applyForm.from_date)} → {formatDate(applyForm.to_date)})
                </div>
              )}

              <div>
                <label className="form-label">Reason *</label>
                <textarea value={applyForm.reason}
                  onChange={e => setApplyForm({ ...applyForm, reason: e.target.value })}
                  rows={3} className="input" style={{ resize: 'vertical' }}
                  placeholder="Reason for leave application…" />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button onClick={() => setShowApply(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={handleApply} disabled={applyLoading} className="btn btn-primary">
                {applyLoading ? 'Submitting…' : 'Submit Application'}
              </button>
            </div>
          </div>
        </div>
      )}

    </AppLayout>
  );
}
