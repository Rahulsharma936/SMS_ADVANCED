'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface Allocation {
  id: string; amount_allocated: number;
  installment: { id: string; installment_name: string; amount: number; due_date: string };
}
interface Payment {
  id: string; amount_paid: number; payment_method: string;
  transaction_id: string | null; status: string; remarks: string | null;
  payment_date: string; created_at: string;
  student: { firstName: string; lastName: string; admission_number: string };
  studentFee: { feeStructure: { name: string; academic_year: string; currency: string } };
  allocations: Allocation[];
}
interface Student { id: string; firstName: string; lastName: string; admission_number: string; }

const statusBadge = (s: string) => ({
  success:  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  pending:  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  failed:   'bg-red-500/20 text-red-400 border-red-500/30',
  refunded: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}[s] || 'bg-gray-500/20 text-gray-400 border-gray-500/30');

const methodIcon: Record<string, string> = {
  cash: '💵', upi: '📱', razorpay: '🔗', cheque: '📝', dd: '🏦', bank_transfer: '🏧',
};

const fmt = (n: number, cur = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);

export default function PaymentHistoryPage() {
  const router = useRouter();
  const [students, setStudents]   = useState<Student[]>([]);
  const [selected, setSelected]   = useState('');
  const [payments, setPayments]   = useState<Payment[]>([]);
  const [summary, setSummary]     = useState<{ total_paid: number; pending_count: number; failed_count: number } | null>(null);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [fetching, setFetching]   = useState(false);

  useEffect(() => {
    fetchApi('/students')
      .then(d => setStudents(d.students || []))
      .catch(e => { if (e.message?.includes('Unauthorized')) router.push('/login'); })
      .finally(() => setLoading(false));
  }, []);

  const onStudentChange = async (id: string) => {
    setSelected(id); setPayments([]); setSummary(null);
    if (!id) return;
    setFetching(true);
    try {
      const d = await fetchApi(`/fees/payments/student/${id}`);
      setPayments(d.payments || []);
      setSummary(d.summary || null);
    } catch {}
    finally { setFetching(false); }
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
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-pink-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/payments" className="text-gray-400 hover:text-white transition-colors">Record Payment</a>
            <a href="/payments/history" className="text-violet-400 font-medium">History</a>
            <a href="/payments/reconcile" className="text-gray-400 hover:text-white transition-colors">Reconcile</a>
            <a href="/fees" className="text-gray-400 hover:text-white transition-colors">Fees</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Payment History</h1>
          <p className="text-gray-500 mt-1">Transaction log with allocation details per student</p>
        </div>

        {/* Student selector */}
        <div className="mb-6">
          <select value={selected} onChange={e => onStudentChange(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm w-full max-w-sm focus:outline-none focus:border-violet-500 transition-colors">
            <option value="">— Select a student —</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admission_number})</option>
            ))}
          </select>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 text-center">
              <p className="text-2xl font-bold text-emerald-400">{fmt(summary.total_paid)}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase">Total Collected</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 text-center">
              <p className="text-2xl font-bold text-amber-400">{summary.pending_count}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase">Pending Online</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-center">
              <p className="text-2xl font-bold text-red-400">{summary.failed_count}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase">Failed</p>
            </div>
          </div>
        )}

        {fetching && (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {/* Payment list */}
        {!fetching && payments.length > 0 && (
          <div className="space-y-3">
            {payments.map(p => (
              <div key={p.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                {/* Header row */}
                <button
                  onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                  className="w-full flex items-center justify-between p-5 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl">{methodIcon[p.payment_method] || '💳'}</div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{fmt(p.amount_paid, p.studentFee.feeStructure.currency)}</span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-lg border capitalize ${statusBadge(p.status)}`}>{p.status}</span>
                        <span className="text-xs text-gray-500 capitalize">{p.payment_method.replace('_', ' ')}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {p.transaction_id && <span className="ml-2 font-mono text-gray-600">• {p.transaction_id}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-gray-500">
                    <span className="text-sm">{p.allocations.length} installment{p.allocations.length !== 1 ? 's' : ''}</span>
                    <svg className={`w-4 h-4 transition-transform ${expanded === p.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded: allocation details */}
                {expanded === p.id && (
                  <div className="border-t border-white/10 px-5 pb-5 pt-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Allocation Breakdown</p>
                    <div className="space-y-2">
                      {p.allocations.map(a => (
                        <div key={a.id} className="flex justify-between items-center bg-black/20 rounded-xl px-4 py-3">
                          <div>
                            <span className="text-sm font-medium">{a.installment.installment_name}</span>
                            <span className="text-xs text-gray-500 ml-2">
                              (total: {fmt(a.installment.amount)})
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-violet-400">
                            {fmt(a.amount_allocated, p.studentFee.feeStructure.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {p.remarks && (
                      <p className="text-xs text-gray-500 mt-3 bg-white/5 rounded-lg px-3 py-2">
                        Remarks: {p.remarks}
                      </p>
                    )}
                    <div className="mt-3 text-xs text-gray-600">
                      Payment ID: <span className="font-mono text-gray-500">{p.id}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!fetching && selected && payments.length === 0 && (
          <div className="text-center py-16 text-gray-600">
            <p>No payments found for this student.</p>
          </div>
        )}

        {!selected && (
          <div className="text-center py-20 text-gray-600">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>Select a student to view payment history</p>
          </div>
        )}
      </main>
    </div>
  );
}
