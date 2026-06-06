'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

interface Student { id: string; firstName: string; lastName: string; admission_number: string; }
interface Installment { id: string; installment_name: string; due_date: string; amount: number; status: string; }
interface Summary { total: number; pending: number; overdue: number; paid: number; }
interface StudentFeeOption { id: string; feeStructure: { name: string; academic_year: string; currency: string }; final_amount: number; }

const statusClass = (s: string) => ({ pending: 'badge-amber', partial: 'badge-blue', paid: 'badge-green', overdue: 'badge-red' }[s] ?? 'badge-gray');
const fmt = (n: number, cur = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '5px' }}>{children}</label>;
}

export default function InstallmentsPage() {
  const router = useRouter();
  const [students,       setStudents]       = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [feeOptions,     setFeeOptions]     = useState<StudentFeeOption[]>([]);
  const [selectedFeeId,  setSelectedFeeId]  = useState('');
  const [installments,   setInstallments]   = useState<Installment[]>([]);
  const [summary,        setSummary]        = useState<Summary | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [fetching,       setFetching]       = useState(false);

  useEffect(() => {
    fetchApi('/students')
      .then(d => setStudents(d.students || []))
      .catch(e => { if (e.message?.includes('Unauthorized')) router.push('/login'); })
      .finally(() => setLoading(false));
  }, [router]);

  const onStudentChange = async (studentId: string) => {
    setSelectedStudent(studentId); setFeeOptions([]); setInstallments([]); setSummary(null); setSelectedFeeId('');
    if (!studentId) return;
    try { const d = await fetchApi(`/fees/student/${studentId}`); setFeeOptions(d.fees || []); } catch {}
  };

  const onFeeChange = async (feeId: string) => {
    setSelectedFeeId(feeId); setInstallments([]); setSummary(null);
    if (!feeId) return;
    setFetching(true);
    try { const d = await fetchApi(`/fees/installments/${feeId}`); setInstallments(d.installments || []); setSummary(d.summary || null); }
    catch {} finally { setFetching(false); }
  };

  const selectedFee = feeOptions.find(f => f.id === selectedFeeId);

  if (loading) return <div className="page-loading"><div className="spinner spinner-lg"/></div>;

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Installment Tracker</h1>
          <p className="page-subtitle">View payment schedules and due dates per student</p>
        </div>
        <a href="/payments" className="btn btn-primary" style={{ fontSize: '12px' }}>
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
          Record Payment
        </a>
      </div>

      {/* Context selector */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '16px', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <FieldLabel>Student</FieldLabel>
          <select value={selectedStudent} onChange={e => onStudentChange(e.target.value)} className="input" style={{ width: '100%' }}>
            <option value="">— Select student —</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admission_number})</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <FieldLabel>Fee Assignment</FieldLabel>
          <select value={selectedFeeId} onChange={e => onFeeChange(e.target.value)} disabled={feeOptions.length === 0} className="input" style={{ width: '100%' }}>
            <option value="">— Select fee assignment —</option>
            {feeOptions.map(f => <option key={f.id} value={f.id}>{f.feeStructure.name} ({f.feeStructure.academic_year})</option>)}
          </select>
        </div>
      </div>

      {/* Empty / initial state */}
      {!selectedStudent && (
        <div className="empty-state" style={{ minHeight: '38vh' }}>
          <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <p className="empty-state-title">Select a student</p>
          <p className="empty-state-desc">Choose a student above to view their installment schedule.</p>
        </div>
      )}

      {/* Summary KPI cards */}
      {summary && selectedFee && (
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', marginBottom: '16px' }}>
          {[
            { label: 'Total Due',  value: fmt(summary.total,   selectedFee.feeStructure.currency), color: 'var(--text-primary)' },
            { label: 'Pending',    value: fmt(summary.pending,  selectedFee.feeStructure.currency), color: '#fbbf24' },
            { label: 'Overdue',    value: fmt(summary.overdue,  selectedFee.feeStructure.currency), color: '#f87171' },
            { label: 'Paid',       value: fmt(summary.paid,     selectedFee.feeStructure.currency), color: '#4ade80' },
          ].map(c => (
            <div key={c.label} className="kpi-card">
              <div className="kpi-card-value" style={{ color: c.color }}>{c.value}</div>
              <div className="kpi-card-label">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Loading installments */}
      {fetching && (
        <div className="data-table-wrap" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div className="spinner"/>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading schedule…</span>
        </div>
      )}

      {/* Installment table */}
      {!fetching && installments.length > 0 && selectedFee && (
        <div className="data-table-wrap">
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Installment</th>
                  <th>Due Date</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {installments.map(inst => {
                  const isOverdue = inst.status === 'pending' && new Date(inst.due_date) < new Date();
                  return (
                    <tr key={inst.id} style={{ background: isOverdue ? 'rgba(239,68,68,0.04)' : undefined }}>
                      <td style={{ fontWeight: 500 }}>{inst.installment_name}</td>
                      <td style={{ color: isOverdue ? '#f87171' : 'var(--text-secondary)' }}>
                        {new Date(inst.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {isOverdue && <span className="badge badge-red" style={{ marginLeft: '8px', fontSize: '9px' }}>OVERDUE</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-geist-mono)' }}>
                        {fmt(inst.amount, selectedFee.feeStructure.currency)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${statusClass(inst.status)}`} style={{ textTransform: 'capitalize' }}>{inst.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No installments */}
      {!fetching && selectedFeeId && installments.length === 0 && (
        <div className="empty-state" style={{ minHeight: '24vh' }}>
          <p className="empty-state-title">No installments configured</p>
          <p className="empty-state-desc">Installments are set during fee assignment.</p>
        </div>
      )}
    </AppLayout>
  );
}
