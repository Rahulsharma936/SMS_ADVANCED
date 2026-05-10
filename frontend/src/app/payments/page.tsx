'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface Student {
  id: string; firstName: string; lastName: string; admission_number: string;
}
interface Installment {
  id: string; installment_name: string; due_date: string;
  amount: number; status: string;
}
interface StudentFeeOption {
  id: string;
  final_amount: number;
  feeStructure: { name: string; academic_year: string; currency: string };
  installments: Installment[];
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', razorpay: 'Razorpay (Online)',
  cheque: 'Cheque', dd: 'Demand Draft', bank_transfer: 'Bank Transfer',
};

const statusColor = (s: string) => ({
  pending: 'text-amber-400', partial: 'text-blue-400',
  paid: 'text-emerald-400', overdue: 'text-red-400',
}[s] || 'text-gray-400');

const fmt = (n: number, cur = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);

export default function PaymentsPage() {
  const router = useRouter();
  const [students, setStudents]       = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [feeOptions, setFeeOptions]   = useState<StudentFeeOption[]>([]);
  const [selectedFee, setSelectedFee] = useState<StudentFeeOption | null>(null);
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  // Payment form
  const [method, setMethod]         = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [transactionId, setTransactionId] = useState('');
  const [remarks, setRemarks]       = useState('');

  // Allocation: installment_id -> amount string
  const [allocations, setAllocations] = useState<Record<string, string>>({});

  const totalAllocated = Object.values(allocations).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  const load = async () => {
    try {
      const d = await fetchApi('/students');
      setStudents(d.students || []);
    } catch (e: any) {
      if (e.message?.includes('Unauthorized')) router.push('/login');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const onStudentChange = async (id: string) => {
    setSelectedStudent(id); setFeeOptions([]); setSelectedFee(null); setAllocations({});
    if (!id) return;
    try {
      const d = await fetchApi(`/fees/student/${id}`);
      setFeeOptions(d.fees || []);
    } catch {}
  };

  const onFeeChange = async (feeId: string) => {
    const fee = feeOptions.find(f => f.id === feeId) || null;
    setSelectedFee(fee);
    setAllocations({});
  };

  // Auto-fill: distribute a lump sum across unpaid installments
  const autoFill = (lumpSum: number) => {
    if (!selectedFee) return;
    const unpaid = selectedFee.installments.filter(i => i.status !== 'paid');
    const newAlloc: Record<string, string> = {};
    let remaining = lumpSum;
    for (const inst of unpaid) {
      if (remaining <= 0) break;
      // Compute already-allocated amounts (from status only — approximate for UI)
      const fill = Math.min(remaining, inst.amount);
      newAlloc[inst.id] = fill.toFixed(2);
      remaining -= fill;
    }
    setAllocations(newAlloc);
  };

  const handleSubmit = async () => {
    if (!selectedFee || !selectedStudent) { setError('Select a student and fee'); return; }
    const validAllocs = Object.entries(allocations)
      .filter(([, v]) => parseFloat(v) > 0)
      .map(([installment_id, v]) => ({ installment_id, amount: parseFloat(v) }));
    if (validAllocs.length === 0) { setError('Allocate amount to at least one installment'); return; }

    setSubmitting(true); setError(''); setSuccess('');
    try {
      await fetchApi('/fees/payments', {
        method: 'POST',
        data: {
          student_fee_id:  selectedFee.id,
          payment_method:  method,
          amount_paid:     +totalAllocated.toFixed(2),
          allocations:     validAllocs,
          payment_date:    paymentDate,
          transaction_id:  transactionId || undefined,
          remarks:         remarks || undefined,
        },
      });
      setSuccess(`Payment of ${fmt(totalAllocated)} recorded successfully!`);
      setAllocations({});
      setTransactionId('');
      setRemarks('');
      // Refresh fee options
      const d = await fetchApi(`/fees/student/${selectedStudent}`);
      setFeeOptions(d.fees || []);
      const updated = d.fees?.find((f: StudentFeeOption) => f.id === selectedFee.id);
      setSelectedFee(updated || null);
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-pink-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/payments" className="text-violet-400 font-medium">Record Payment</a>
            <a href="/payments/history" className="text-gray-400 hover:text-white transition-colors">History</a>
            <a href="/payments/reconcile" className="text-gray-400 hover:text-white transition-colors">Reconcile</a>
            <a href="/fees" className="text-gray-400 hover:text-white transition-colors">Fees</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Record Payment</h1>
          <p className="text-gray-500 mt-1">Allocate payment amounts to specific installments</p>
        </div>

        {/* Alerts */}
        {error   && <div className="mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}
        {success && <div className="mb-5 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm">✓ {success}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Selectors + Method */}
          <div className="space-y-5">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Student & Fee</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Student *</label>
                  <select value={selectedStudent} onChange={e => onStudentChange(e.target.value)}
                    className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors">
                    <option value="">— Select student —</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admission_number})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Fee Assignment *</label>
                  <select value={selectedFee?.id || ''} onChange={e => onFeeChange(e.target.value)}
                    disabled={feeOptions.length === 0}
                    className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 disabled:opacity-40">
                    <option value="">— Select fee —</option>
                    {feeOptions.map(f => (
                      <option key={f.id} value={f.id}>{f.feeStructure.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Payment Details</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Method *</label>
                  <select value={method} onChange={e => setMethod(e.target.value)}
                    className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500">
                    {Object.entries(METHOD_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Payment Date *</label>
                  <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500" />
                </div>
                {['upi', 'razorpay', 'cheque', 'dd', 'bank_transfer'].includes(method) && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      {method === 'razorpay' ? 'Razorpay Order ID' : 'Transaction / Reference ID'}
                    </label>
                    <input value={transactionId} onChange={e => setTransactionId(e.target.value)}
                      placeholder="e.g. UPI123456789"
                      className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500" />
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Remarks</label>
                  <input value={remarks} onChange={e => setRemarks(e.target.value)}
                    placeholder="Optional notes"
                    className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Installment Allocation */}
          <div className="lg:col-span-2">
            {selectedFee ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Installment Allocation</h2>
                  <div className="flex gap-2">
                    <button onClick={() => autoFill(selectedFee.final_amount)}
                      className="text-xs text-violet-400 hover:text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-lg transition-colors">
                      Pay All Due
                    </button>
                    <button onClick={() => setAllocations({})}
                      className="text-xs text-gray-500 hover:text-gray-300 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg transition-colors">
                      Clear
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mb-5">
                  {selectedFee.installments.map(inst => {
                    const isPaid = inst.status === 'paid';
                    return (
                      <div key={inst.id} className={`rounded-xl p-3 border transition-colors ${
                        isPaid ? 'bg-emerald-500/5 border-emerald-500/20 opacity-60' : 'bg-white/5 border-white/10 hover:border-violet-500/30'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium truncate">{inst.installment_name}</span>
                              <span className={`text-xs capitalize ${statusColor(inst.status)}`}>• {inst.status}</span>
                            </div>
                            <div className="flex gap-3 text-xs text-gray-500">
                              <span>Due: {new Date(inst.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                              <span>Amount: <span className="text-gray-300 font-medium">{fmt(inst.amount, selectedFee.feeStructure.currency)}</span></span>
                            </div>
                          </div>
                          <div className="shrink-0 w-32">
                            {isPaid ? (
                              <div className="text-center text-xs text-emerald-400 font-medium bg-emerald-500/10 rounded-lg py-2">✓ Paid</div>
                            ) : (
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
                                <input
                                  type="number"
                                  value={allocations[inst.id] || ''}
                                  onChange={e => setAllocations(prev => ({ ...prev, [inst.id]: e.target.value }))}
                                  placeholder="0"
                                  max={inst.amount}
                                  className="w-full bg-black/30 border border-gray-700 rounded-lg pl-7 pr-2 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total */}
                <div className="border-t border-white/10 pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Allocated</span>
                    <span className={`font-bold text-lg ${totalAllocated > 0 ? 'text-violet-400' : 'text-gray-600'}`}>
                      {fmt(totalAllocated, selectedFee.feeStructure.currency)}
                    </span>
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || totalAllocated <= 0}
                    className="w-full py-3 bg-gradient-to-r from-violet-500 to-pink-600 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-violet-500/25 hover:shadow-lg transition-all">
                    {submitting ? 'Processing…' : `Record Payment — ${fmt(totalAllocated, selectedFee.feeStructure.currency)}`}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-gray-600 h-full flex flex-col items-center justify-center min-h-64">
                <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <p>Select a student and fee assignment to begin</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
