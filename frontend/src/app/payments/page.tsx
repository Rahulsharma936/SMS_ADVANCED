'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

interface Student { id: string; firstName: string; lastName: string; admission_number: string; }
interface Installment { id: string; installment_name: string; due_date: string; amount: number; status: string; }
interface StudentFeeOption {
  id: string; final_amount: number;
  feeStructure: { name: string; academic_year: string; currency: string };
  installments: Installment[];
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', razorpay: 'Razorpay (Online)',
  cheque: 'Cheque', dd: 'Demand Draft', bank_transfer: 'Bank Transfer',
};

const statusClass = (s: string) => ({ pending: 'badge-amber', partial: 'badge-blue', paid: 'badge-green', overdue: 'badge-red' }[s] ?? 'badge-gray');
const fmt = (n: number, cur = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '5px' }}>{children}</label>;
}

function SectionHead({ title }: { title: string }) {
  return <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>{title}</div>;
}

export default function PaymentsPage() {
  const router = useRouter();
  const [students,        setStudents]        = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [feeOptions,      setFeeOptions]      = useState<StudentFeeOption[]>([]);
  const [selectedFee,     setSelectedFee]     = useState<StudentFeeOption | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [submitting,      setSubmitting]       = useState(false);
  const [error,           setError]           = useState('');
  const [success,         setSuccess]         = useState('');

  const [method,          setMethod]          = useState('cash');
  const [paymentDate,     setPaymentDate]     = useState(new Date().toISOString().split('T')[0]);
  const [transactionId,   setTransactionId]   = useState('');
  const [remarks,         setRemarks]         = useState('');
  const [allocations,     setAllocations]     = useState<Record<string, string>>({});

  const totalAllocated = Object.values(allocations).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  const load = async () => {
    try { const d = await fetchApi('/students'); setStudents(d.students || []); }
    catch (e: any) { if (e.message?.includes('Unauthorized')) router.push('/login'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [router]);

  const onStudentChange = async (id: string) => {
    setSelectedStudent(id); setFeeOptions([]); setSelectedFee(null); setAllocations({});
    if (!id) return;
    try { const d = await fetchApi(`/fees/student/${id}`); setFeeOptions(d.fees || []); } catch {}
  };

  const onFeeChange = (feeId: string) => {
    const fee = feeOptions.find(f => f.id === feeId) || null;
    setSelectedFee(fee); setAllocations({});
  };

  const autoFill = (lumpSum: number) => {
    if (!selectedFee) return;
    const unpaid = selectedFee.installments.filter(i => i.status !== 'paid');
    const newAlloc: Record<string, string> = {}; let remaining = lumpSum;
    for (const inst of unpaid) {
      if (remaining <= 0) break;
      newAlloc[inst.id] = Math.min(remaining, inst.amount).toFixed(2);
      remaining -= Math.min(remaining, inst.amount);
    }
    setAllocations(newAlloc);
  };

  const handleSubmit = async () => {
    if (!selectedFee || !selectedStudent) { setError('Select a student and fee'); return; }
    const validAllocs = Object.entries(allocations).filter(([, v]) => parseFloat(v) > 0).map(([installment_id, v]) => ({ installment_id, amount: parseFloat(v) }));
    if (validAllocs.length === 0) { setError('Allocate amount to at least one installment'); return; }
    setSubmitting(true); setError(''); setSuccess('');
    try {
      await fetchApi('/fees/payments', {
        method: 'POST',
        data: { student_fee_id: selectedFee.id, payment_method: method, amount_paid: +totalAllocated.toFixed(2), allocations: validAllocs, payment_date: paymentDate, transaction_id: transactionId || undefined, remarks: remarks || undefined },
      });
      setSuccess(`Payment of ${fmt(totalAllocated)} recorded successfully!`);
      setAllocations({}); setTransactionId(''); setRemarks('');
      const d = await fetchApi(`/fees/student/${selectedStudent}`);
      setFeeOptions(d.fees || []);
      setSelectedFee(d.fees?.find((f: StudentFeeOption) => f.id === selectedFee.id) || null);
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="page-loading"><div className="spinner spinner-lg"/></div>;

  const needsRef = ['upi','razorpay','cheque','dd','bank_transfer'].includes(method);
  const totalDue = selectedFee ? selectedFee.installments.filter(i => i.status !== 'paid').reduce((s, i) => s + i.amount, 0) : 0;

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Record Payment</h1>
          <p className="page-subtitle">Allocate payment amounts to specific installments</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a href="/receipts" className="btn btn-secondary" style={{ fontSize: '12px' }}>Receipts</a>
          <a href="/fees/installments" className="btn btn-secondary" style={{ fontSize: '12px' }}>Installments</a>
        </div>
      </div>

      {error   && <div className="alert alert-error"   style={{ marginBottom: '14px' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{success}</span>
        <a href="/receipts" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px', flexShrink: 0 }}>Generate Receipt →</a>
      </div>}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '14px', alignItems: 'start' }}>
        {/* Left panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Student & Fee */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <SectionHead title="Student & Fee"/>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <FieldLabel>Student *</FieldLabel>
                <select value={selectedStudent} onChange={e => onStudentChange(e.target.value)} className="input" style={{ width: '100%' }}>
                  <option value="">— Select student —</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admission_number})</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Fee Assignment *</FieldLabel>
                <select value={selectedFee?.id || ''} onChange={e => onFeeChange(e.target.value)} disabled={feeOptions.length === 0} className="input" style={{ width: '100%' }}>
                  <option value="">— Select fee —</option>
                  {feeOptions.map(f => <option key={f.id} value={f.id}>{f.feeStructure.name} ({f.feeStructure.academic_year})</option>)}
                </select>
              </div>
              {selectedFee && totalDue > 0 && (
                <div style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 'var(--radius-md)', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Outstanding</span>
                  <span style={{ fontWeight: 700, color: '#fbbf24', fontFamily: 'var(--font-geist-mono)' }}>{fmt(totalDue, selectedFee.feeStructure.currency)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Details */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <SectionHead title="Payment Details"/>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <FieldLabel>Method *</FieldLabel>
                <select value={method} onChange={e => setMethod(e.target.value)} className="input" style={{ width: '100%' }}>
                  {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Payment Date *</FieldLabel>
                <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="input" style={{ width: '100%', colorScheme: 'dark' }}/>
              </div>
              {needsRef && (
                <div>
                  <FieldLabel>{method === 'razorpay' ? 'Razorpay Order ID' : 'Transaction / Reference ID'}</FieldLabel>
                  <input value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="e.g. UPI123456789" className="input" style={{ width: '100%' }}/>
                </div>
              )}
              <div>
                <FieldLabel>Remarks</FieldLabel>
                <input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional notes" className="input" style={{ width: '100%' }}/>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel: Installment allocation */}
        <div className="card" style={{ padding: '16px 18px' }}>
          {selectedFee ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)' }}>Installment Allocation</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => autoFill(totalDue)} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '11px', color: '#a5b4fc' }}>Pay All Due</button>
                  <button onClick={() => setAllocations({})} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '11px' }}>Clear</button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                {selectedFee.installments.map(inst => {
                  const isPaid = inst.status === 'paid';
                  const isOverdue = inst.status === 'pending' && new Date(inst.due_date) < new Date();
                  return (
                    <div key={inst.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'center', background: isPaid ? 'rgba(74,222,128,0.04)' : isOverdue ? 'rgba(239,68,68,0.04)' : 'var(--bg-overlay)', border: `1px solid ${isPaid ? 'rgba(74,222,128,0.15)' : 'var(--border-subtle)'}`, borderRadius: 'var(--radius-md)', padding: '10px 12px', opacity: isPaid ? 0.7 : 1 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{inst.installment_name}</span>
                          <span className={`badge ${statusClass(inst.status)}`} style={{ fontSize: '10px', textTransform: 'capitalize' }}>{inst.status}</span>
                          {isOverdue && <span className="badge badge-red" style={{ fontSize: '9px' }}>OVERDUE</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-faint)' }}>
                          <span>Due: {new Date(inst.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          <span>Amount: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{fmt(inst.amount, selectedFee.feeStructure.currency)}</span></span>
                        </div>
                      </div>
                      <div style={{ width: '120px', flexShrink: 0 }}>
                        {isPaid ? (
                          <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#4ade80', background: 'rgba(74,222,128,0.1)', borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}>✓ Paid</div>
                        ) : (
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', fontSize: '13px', pointerEvents: 'none' }}>₹</span>
                            <input type="number" value={allocations[inst.id] || ''} onChange={e => setAllocations(prev => ({ ...prev, [inst.id]: e.target.value }))} placeholder="0" max={inst.amount}
                              className="input" style={{ paddingLeft: '26px', textAlign: 'right', width: '100%' }}/>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total + Submit */}
              <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Total Allocated</span>
                  <span style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', color: totalAllocated > 0 ? '#a5b4fc' : 'var(--text-faint)', fontFamily: 'var(--font-geist-mono)' }}>
                    {fmt(totalAllocated, selectedFee.feeStructure.currency)}
                  </span>
                </div>
                <button onClick={handleSubmit} disabled={submitting || totalAllocated <= 0} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
                  {submitting
                    ? <><div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}/> Processing…</>
                    : `Record Payment — ${fmt(totalAllocated, selectedFee.feeStructure.currency)}`}
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ minHeight: '320px' }}>
              <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
              </svg>
              <p className="empty-state-title">Select student & fee</p>
              <p className="empty-state-desc">Choose a student and fee assignment on the left to load installments.</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
