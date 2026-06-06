'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

interface Student { id: string; firstName: string; lastName: string; admission_number: string; }
interface Receipt {
  id: string; receipt_number: string; generated_at: string; pdf_url: string | null;
  payment: {
    id: string; amount_paid: number; payment_method: string; payment_date: string;
    student: { firstName: string; lastName: string; admission_number: string };
    studentFee: { feeStructure: { name: string; academic_year: string; currency: string } };
    allocations: { amount_allocated: number; installment: { installment_name: string; amount: number } }[];
  };
  generatedBy: { email: string };
}

const fmt = (n: number, cur = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '5px' }}>{children}</label>;
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: mono ? 'var(--font-geist-mono)' : undefined }}>{value}</span>
    </div>
  );
}

export default function ReceiptsPage() {
  const router = useRouter();
  const [students,    setStudents]    = useState<Student[]>([]);
  const [selected,    setSelected]    = useState('');
  const [paymentId,   setPaymentId]   = useState('');
  const [receipt,     setReceipt]     = useState<Receipt | null>(null);
  const [generating,  setGenerating]  = useState(false);
  const [error,       setError]       = useState('');
  const [payments,    setPayments]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    fetchApi('/students')
      .then(d => setStudents(d.students || []))
      .catch(e => { if (e.message?.includes('Unauthorized')) router.push('/login'); })
      .finally(() => setLoading(false));
  }, [router]);

  const onStudentChange = async (id: string) => {
    setSelected(id); setPayments([]); setPaymentId(''); setReceipt(null);
    if (!id) return;
    try { const d = await fetchApi(`/fees/payments/student/${id}`); setPayments((d.payments || []).filter((p: any) => p.status === 'success')); } catch {}
  };

  const generate = async () => {
    if (!paymentId) { setError('Select a payment'); return; }
    setGenerating(true); setError(''); setReceipt(null);
    try {
      const d = await fetchApi('/fees/receipts/generate', { method: 'POST', data: { payment_id: paymentId } });
      const r = await fetchApi(`/fees/receipts/${d.receipt.id}`);
      setReceipt(r.receipt);
    } catch (e: any) { setError(e.message); }
    finally { setGenerating(false); }
  };

  if (loading) return <div className="page-loading"><div className="spinner spinner-lg"/></div>;

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Payment Receipts</h1>
          <p className="page-subtitle">Generate and view payment receipts by student</p>
        </div>
        <a href="/payments" className="btn btn-secondary" style={{ fontSize: '12px' }}>Record Payment</a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {/* Generate card */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '14px' }}>Generate Receipt</div>

          {error && <div className="alert alert-error" style={{ marginBottom: '12px' }}>{error}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <FieldLabel>Student</FieldLabel>
              <select value={selected} onChange={e => onStudentChange(e.target.value)} className="input" style={{ width: '100%' }}>
                <option value="">— Select student —</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admission_number})</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Successful Payment</FieldLabel>
              <select value={paymentId} onChange={e => setPaymentId(e.target.value)} disabled={payments.length === 0} className="input" style={{ width: '100%' }}>
                <option value="">— Select payment —</option>
                {payments.map(p => (
                  <option key={p.id} value={p.id}>
                    {fmt(p.amount_paid)} · {new Date(p.payment_date).toLocaleDateString('en-IN')} · {p.payment_method}
                  </option>
                ))}
              </select>
              {selected && payments.length === 0 && <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '4px' }}>No successful payments found for this student.</p>}
            </div>
            <button onClick={generate} disabled={generating || !paymentId} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              {generating
                ? <><div className="spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }}/> Generating…</>
                : <>
                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    Generate Receipt
                  </>}
            </button>
            <p style={{ fontSize: '10px', color: 'var(--text-faint)', lineHeight: 1.4 }}>Receipts are idempotent — generating twice returns the same receipt.</p>
          </div>
        </div>

        {/* Receipt preview card */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '14px' }}>Receipt Preview</div>
          {!receipt ? (
            <div className="empty-state" style={{ minHeight: '220px', padding: '24px' }}>
              <svg className="empty-state-icon" style={{ width: '32px', height: '32px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <p className="empty-state-title" style={{ fontSize: '13px' }}>No receipt yet</p>
              <p className="empty-state-desc">Generate a receipt to preview it here.</p>
            </div>
          ) : (
            <div>
              {/* Receipt number header */}
              <div style={{ background: 'var(--brand-subtle)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Receipt No.</span>
                <span style={{ fontFamily: 'var(--font-geist-mono)', fontWeight: 700, color: '#a5b4fc', fontSize: '14px' }}>{receipt.receipt_number}</span>
              </div>

              <InfoRow label="Student" value={`${receipt.payment.student.firstName} ${receipt.payment.student.lastName}`}/>
              <InfoRow label="Fee Structure" value={receipt.payment.studentFee.feeStructure.name}/>
              <InfoRow label="Amount Paid" value={fmt(receipt.payment.amount_paid, receipt.payment.studentFee.feeStructure.currency)}/>
              <InfoRow label="Method" value={receipt.payment.payment_method.replace('_', ' ')} mono/>
              <InfoRow label="Payment Date" value={new Date(receipt.payment.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}/>
              <InfoRow label="Generated by" value={receipt.generatedBy.email}/>

              {receipt.payment.allocations.length > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-default)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', marginBottom: '6px' }}>Allocation</div>
                  {receipt.payment.allocations.map((a, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{a.installment.installment_name}</span>
                      <span style={{ color: '#4ade80', fontWeight: 600 }}>{fmt(a.amount_allocated, receipt.payment.studentFee.feeStructure.currency)}</span>
                    </div>
                  ))}
                </div>
              )}

              {receipt.pdf_url && (
                <a href={receipt.pdf_url} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: '14px' }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  Download PDF
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
