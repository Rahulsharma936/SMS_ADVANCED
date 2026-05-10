'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

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

const fmt = (n: number, cur = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);

export default function ReceiptsPage() {
  const router = useRouter();
  const [students, setStudents]     = useState<Student[]>([]);
  const [selected, setSelected]     = useState('');
  const [paymentId, setPaymentId]   = useState('');
  const [receipt, setReceipt]       = useState<Receipt | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError]           = useState('');
  const [payments, setPayments]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    fetchApi('/students')
      .then(d => setStudents(d.students || []))
      .catch(e => { if (e.message?.includes('Unauthorized')) router.push('/login'); })
      .finally(() => setLoading(false));
  }, []);

  const onStudentChange = async (id: string) => {
    setSelected(id); setPayments([]); setPaymentId(''); setReceipt(null);
    if (!id) return;
    try {
      const d = await fetchApi(`/fees/payments/student/${id}`);
      setPayments((d.payments || []).filter((p: any) => p.status === 'success'));
    } catch {}
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

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/fees/analytics" className="text-gray-400 hover:text-white transition-colors">Analytics</a>
            <a href="/fees/defaulters" className="text-gray-400 hover:text-white transition-colors">Defaulters</a>
            <a href="/fees/ledger" className="text-gray-400 hover:text-white transition-colors">Ledger</a>
            <a href="/receipts" className="text-violet-400 font-medium">Receipts</a>
            <a href="/invoices" className="text-gray-400 hover:text-white transition-colors">Invoices</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Payment Receipts</h1>
          <p className="text-gray-500 mt-1">Generate and view payment receipts</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase">Generate Receipt</h2>
            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</p>}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Student</label>
              <select value={selected} onChange={e => onStudentChange(e.target.value)}
                className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500">
                <option value="">— Select student —</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admission_number})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Successful Payment</label>
              <select value={paymentId} onChange={e => setPaymentId(e.target.value)}
                disabled={payments.length === 0}
                className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 disabled:opacity-40">
                <option value="">— Select payment —</option>
                {payments.map(p => (
                  <option key={p.id} value={p.id}>
                    {fmt(p.amount_paid)} · {new Date(p.payment_date).toLocaleDateString('en-IN')} · {p.payment_method}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={generate} disabled={generating || !paymentId}
              className="w-full py-2.5 bg-gradient-to-r from-violet-500 to-pink-600 rounded-xl text-sm font-medium disabled:opacity-40 hover:shadow-violet-500/25 hover:shadow-lg transition-all">
              {generating ? 'Generating…' : 'Generate Receipt'}
            </button>
            <p className="text-xs text-gray-600">Receipts are idempotent — generating twice returns the same receipt.</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Receipt Status</h2>
            {!receipt ? (
              <div className="text-center text-gray-600 py-8">
                <svg className="w-10 h-10 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>Generate a receipt to preview it here</p>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-gray-500">Receipt No.</span>
                  <span className="font-bold text-violet-400">{receipt.receipt_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Student</span>
                  <span>{receipt.payment.student.firstName} {receipt.payment.student.lastName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Fee Structure</span>
                  <span>{receipt.payment.studentFee.feeStructure.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-bold text-emerald-400">{fmt(receipt.payment.amount_paid, receipt.payment.studentFee.feeStructure.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Method</span>
                  <span className="capitalize">{receipt.payment.payment_method.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span>{new Date(receipt.payment.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Generated by</span>
                  <span className="text-gray-400 text-xs">{receipt.generatedBy.email}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-xs text-gray-500 mb-2 uppercase">Allocation</p>
                  {receipt.payment.allocations.map((a, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-gray-400">{a.installment.installment_name}</span>
                      <span className="text-emerald-400">{fmt(a.amount_allocated, receipt.payment.studentFee.feeStructure.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
