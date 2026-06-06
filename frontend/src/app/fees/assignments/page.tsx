'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

interface Student { id: string; firstName: string; lastName: string; admission_number: string; }
interface FeeStructure { id: string; name: string; academic_year: string; currency: string; is_active: boolean; components: { amount: number; is_optional: boolean }[]; }
interface FeeDiscount { id: string; name: string; type: string; value: number; is_active: boolean; }
interface StudentFee {
  id: string; status: string; total_amount: number; discount_amount: number; final_amount: number; assigned_at: string;
  student: { firstName: string; lastName: string; admission_number: string };
  feeStructure: { name: string; academic_year: string; currency: string };
  discounts: { applied_value: number; feeDiscount: { name: string } }[];
  installments: { id: string; installment_name: string; due_date: string; amount: number; status: string }[];
}

const statusClass = (s: string) => ({ pending: 'badge-amber', partial: 'badge-blue', paid: 'badge-green', overdue: 'badge-red' }[s] ?? 'badge-gray');
const fmt = (n: number, cur = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '5px' }}>{children}</label>;
}

export default function FeeAssignmentsPage() {
  const router = useRouter();
  const [allFees,     setAllFees]     = useState<StudentFee[]>([]);
  const [structures,  setStructures]  = useState<FeeStructure[]>([]);
  const [discounts,   setDiscounts]   = useState<FeeDiscount[]>([]);
  const [students,    setStudents]    = useState<Student[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showAssign,  setShowAssign]  = useState(false);
  const [assigning,   setAssigning]   = useState(false);
  const [error,       setError]       = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  const [form, setForm] = useState({ student_id: '', fee_structure_id: '', discount_ids: [] as string[] });
  const [installmentMode, setInstallmentMode] = useState<'none' | 'monthly' | 'quarterly' | 'custom'>('none');
  const [customInstallments, setCustomInstallments] = useState<{ installment_name: string; due_date: string; amount: string }[]>(
    [{ installment_name: '', due_date: '', amount: '' }]
  );

  const load = async () => {
    try {
      const [st, str, disc] = await Promise.all([fetchApi('/students'), fetchApi('/fees/structures'), fetchApi('/fees/discounts')]);
      setStudents(st.students || []); setStructures(str.structures || []); setDiscounts(disc.discounts || []);
    } catch (e: any) { if (e.message?.includes('Unauthorized')) router.push('/login'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const selectedStructure = structures.find(s => s.id === form.fee_structure_id);
  const mandatoryTotal = selectedStructure ? selectedStructure.components.filter(c => !c.is_optional).reduce((s, c) => s + c.amount, 0) : 0;
  const totalDiscount = form.discount_ids.reduce((sum, did) => {
    const d = discounts.find(x => x.id === did); if (!d) return sum;
    return sum + (d.type === 'percentage' ? (mandatoryTotal * d.value) / 100 : d.value);
  }, 0);
  const finalAmount = Math.max(0, mandatoryTotal - totalDiscount);

  const generateInstallments = () => {
    if (installmentMode === 'none' || finalAmount === 0) return [];
    if (installmentMode === 'custom') return customInstallments.filter(i => i.installment_name && i.due_date && parseFloat(i.amount) > 0).map(i => ({ installment_name: i.installment_name, due_date: i.due_date, amount: parseFloat(i.amount) }));
    const count = installmentMode === 'monthly' ? 12 : 4;
    const labels = installmentMode === 'monthly' ? ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'] : ['Q1 (Apr-Jun)','Q2 (Jul-Sep)','Q3 (Oct-Dec)','Q4 (Jan-Mar)'];
    const base = Math.floor((finalAmount / count) * 100) / 100;
    const remainder = +(finalAmount - base * (count - 1)).toFixed(2);
    const start = new Date(); start.setDate(1);
    return labels.map((name, i) => { const d = new Date(start); d.setMonth(d.getMonth() + (installmentMode === 'monthly' ? i : i * 3)); return { installment_name: name, due_date: d.toISOString().split('T')[0], amount: i === count - 1 ? remainder : base }; });
  };

  const handleAssign = async () => {
    if (!form.student_id || !form.fee_structure_id) { setError('Student and fee structure are required'); return; }
    const installments = generateInstallments();
    if (installmentMode !== 'none' && installments.length === 0) { setError('Please configure installments'); return; }
    if (installmentMode === 'custom') { const total = installments.reduce((s, i) => s + i.amount, 0); if (Math.abs(total - finalAmount) > 0.01) { setError(`Installment total (${fmt(total)}) must equal final amount (${fmt(finalAmount)})`); return; } }
    setAssigning(true); setError('');
    try {
      await fetchApi('/fees/assign', { method: 'POST', data: { student_id: form.student_id, fee_structure_id: form.fee_structure_id, discount_ids: form.discount_ids.length ? form.discount_ids : undefined, installments: installments.length ? installments : undefined } });
      setShowAssign(false);
      setForm({ student_id: '', fee_structure_id: '', discount_ids: [] }); setInstallmentMode('none');
      load();
    } catch (e: any) { setError(e.message); }
    finally { setAssigning(false); }
  };

  const loadStudentFees = async (id: string) => {
    setSelectedStudentId(id); setAllFees([]);
    if (!id) return;
    try { const d = await fetchApi(`/fees/student/${id}`); setAllFees(d.fees || []); } catch {}
  };

  if (loading) return <div className="page-loading"><div className="spinner spinner-lg"/></div>;

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fee Assignments</h1>
          <p className="page-subtitle">Assign fee structures to students and configure installment plans</p>
        </div>
        <button onClick={() => { setShowAssign(true); setError(''); }} className="btn btn-primary">
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          Assign Fee
        </button>
      </div>

      {/* Student lookup */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '16px', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <FieldLabel>Search Student</FieldLabel>
          <select value={selectedStudentId} onChange={e => loadStudentFees(e.target.value)} className="input" style={{ width: '100%' }}>
            <option value="">— Select a student to view their assignments —</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admission_number})</option>)}
          </select>
        </div>
      </div>

      {/* Fee cards */}
      {selectedStudentId && allFees.length === 0 && (
        <div className="empty-state" style={{ minHeight: '28vh' }}>
          <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/>
          </svg>
          <p className="empty-state-title">No fee assignments yet</p>
          <p className="empty-state-desc">Assign a fee structure to this student to get started.</p>
          <button onClick={() => setShowAssign(true)} className="btn btn-primary">Assign Fee</button>
        </div>
      )}

      {allFees.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {allFees.map(fee => (
            <div key={fee.id} className="widget">
              <div className="widget-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="widget-title">{fee.feeStructure.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-faint)', fontFamily: 'var(--font-geist-mono)' }}>{fee.feeStructure.academic_year}</span>
                </div>
                <span className={`badge ${statusClass(fee.status)}`} style={{ textTransform: 'capitalize' }}>{fee.status}</span>
              </div>
              <div style={{ padding: '12px 16px 14px' }}>
                {/* Amount strip */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: fee.discounts.length > 0 || fee.installments.length > 0 ? '12px' : '0' }}>
                  {[
                    { label: 'Billed', val: fmt(fee.total_amount, fee.feeStructure.currency), color: 'var(--text-secondary)' },
                    { label: 'Discount', val: fee.discount_amount > 0 ? `-${fmt(fee.discount_amount, fee.feeStructure.currency)}` : '—', color: fee.discount_amount > 0 ? '#f87171' : 'var(--text-faint)' },
                    { label: 'Final Due', val: fmt(fee.final_amount, fee.feeStructure.currency), color: '#4ade80' },
                  ].map(c => (
                    <div key={c.label} style={{ background: 'var(--bg-overlay)', borderRadius: 'var(--radius-md)', padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: c.color, letterSpacing: '-0.01em' }}>{c.val}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>{c.label}</div>
                    </div>
                  ))}
                </div>

                {/* Discount tags */}
                {fee.discounts.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {fee.discounts.map((d, i) => (
                      <span key={i} className="badge badge-blue" style={{ fontSize: '11px' }}>{d.feeDiscount.name}: -{fmt(d.applied_value, fee.feeStructure.currency)}</span>
                    ))}
                  </div>
                )}

                {/* Installment schedule */}
                {fee.installments.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', marginBottom: '8px' }}>Installment Schedule</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '6px' }}>
                      {fee.installments.map(inst => (
                        <div key={inst.id} style={{ background: 'var(--bg-overlay)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.installment_name}</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(inst.amount, fee.feeStructure.currency)}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-faint)', margin: '2px 0' }}>{new Date(inst.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                          <span className={`badge ${statusClass(inst.status)}`} style={{ fontSize: '9px', textTransform: 'capitalize' }}>{inst.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign Modal */}
      {showAssign && (
        <div className="modal-backdrop" onClick={() => setShowAssign(false)}>
          <div className="modal-box" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Assign Fee to Student</h2>
              <button onClick={() => setShowAssign(false)} className="btn btn-ghost" style={{ padding: '4px 8px' }}>✕</button>
            </div>
            {error && <div className="alert alert-error" style={{ marginBottom: '14px' }}>{error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <FieldLabel>Student *</FieldLabel>
                <select value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })} className="input" style={{ width: '100%' }}>
                  <option value="">— Select student —</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admission_number})</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Fee Structure *</FieldLabel>
                <select value={form.fee_structure_id} onChange={e => setForm({ ...form, fee_structure_id: e.target.value })} className="input" style={{ width: '100%' }}>
                  <option value="">— Select structure —</option>
                  {structures.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name} ({s.academic_year})</option>)}
                </select>
              </div>

              {selectedStructure && (
                <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                  {[['Mandatory Total', fmt(mandatoryTotal, selectedStructure.currency), 'var(--text-primary)'], ...(totalDiscount > 0 ? [['Discount', `-${fmt(totalDiscount, selectedStructure.currency)}`, '#f87171']] : []), ['Final Amount', fmt(finalAmount, selectedStructure.currency), '#4ade80']].map(([l, v, c]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0', borderBottom: l === 'Final Amount' ? 'none' : '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{l}</span>
                      <span style={{ fontWeight: 700, color: c as string }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <FieldLabel>Discounts (optional)</FieldLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '130px', overflowY: 'auto' }}>
                  {discounts.filter(d => d.is_active).map(d => (
                    <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-overlay)', padding: '7px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '12px' }}>
                      <input type="checkbox" style={{ accentColor: 'var(--brand-primary)' }} checked={form.discount_ids.includes(d.id)}
                        onChange={e => setForm({ ...form, discount_ids: e.target.checked ? [...form.discount_ids, d.id] : form.discount_ids.filter(x => x !== d.id) })}/>
                      <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{d.name}</span>
                      <span style={{ color: '#a5b4fc', fontSize: '11px' }}>{d.type === 'percentage' ? `${d.value}%` : fmt(d.value)}</span>
                    </label>
                  ))}
                  {discounts.filter(d => d.is_active).length === 0 && <p style={{ fontSize: '11px', color: 'var(--text-faint)', padding: '6px 0' }}>No active discounts — <a href="/fees" style={{ color: 'var(--brand-primary)' }}>create one first</a></p>}
                </div>
              </div>

              <div>
                <FieldLabel>Installment Plan</FieldLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {(['none', 'monthly', 'quarterly', 'custom'] as const).map(mode => (
                    <button key={mode} onClick={() => setInstallmentMode(mode)}
                      style={{ padding: '7px', borderRadius: 'var(--radius-md)', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize', background: installmentMode === mode ? 'var(--brand-subtle)' : 'var(--bg-overlay)', color: installmentMode === mode ? '#a5b4fc' : 'var(--text-muted)', border: installmentMode === mode ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {installmentMode === 'custom' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {customInstallments.map((inst, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 2fr auto', gap: '6px', alignItems: 'center' }}>
                      <input value={inst.installment_name} onChange={e => setCustomInstallments(p => p.map((x, idx) => idx === i ? { ...x, installment_name: e.target.value } : x))} placeholder="Name" className="input" style={{ fontSize: '12px', padding: '6px 8px' }}/>
                      <input type="date" value={inst.due_date} onChange={e => setCustomInstallments(p => p.map((x, idx) => idx === i ? { ...x, due_date: e.target.value } : x))} className="input" style={{ fontSize: '12px', padding: '6px 8px', colorScheme: 'dark' }}/>
                      <input type="number" value={inst.amount} onChange={e => setCustomInstallments(p => p.map((x, idx) => idx === i ? { ...x, amount: e.target.value } : x))} placeholder="₹" className="input" style={{ fontSize: '12px', padding: '6px 8px' }}/>
                      <button onClick={() => setCustomInstallments(p => p.filter((_, idx) => idx !== i))} className="btn btn-ghost" style={{ padding: '4px 6px', color: '#f87171', fontSize: '13px' }}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => setCustomInstallments(p => [...p, { installment_name: '', due_date: '', amount: '' }])} className="btn btn-ghost" style={{ fontSize: '11px', alignSelf: 'flex-start' }}>+ Add row</button>
                </div>
              )}

              {installmentMode !== 'none' && installmentMode !== 'custom' && finalAmount > 0 && (
                <div style={{ background: 'var(--bg-overlay)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-faint)', marginBottom: '8px', textTransform: 'uppercase' }}>Preview ({installmentMode === 'monthly' ? '12 installments' : '4 quarters'})</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {generateInstallments().slice(0, 6).map((inst, i) => (
                      <div key={i} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.installment_name}</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>{fmt(inst.amount)}</div>
                      </div>
                    ))}
                    {generateInstallments().length > 6 && <p style={{ fontSize: '10px', color: 'var(--text-faint)', gridColumn: '1/-1' }}>+{generateInstallments().length - 6} more…</p>}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '14px', marginTop: '4px', borderTop: '1px solid var(--border-subtle)' }}>
              <button onClick={() => setShowAssign(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={handleAssign} disabled={assigning} className="btn btn-primary">
                {assigning ? <><div className="spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }}/> Assigning…</> : 'Assign Fee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
