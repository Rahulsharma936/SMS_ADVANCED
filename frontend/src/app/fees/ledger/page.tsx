'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface LedgerEntry {
  fee_id: string; structure: { name: string; academic_year: string; currency: string };
  assigned_at: string; total_amount: number; discount: number;
  final_amount: number; paid_total: number; balance: number; status: string;
  installments: { id: string; installment_name: string; due_date: string; amount: number; paid: number; status: string; allocations: any[] }[];
  payments: { id: string; amount_paid: number; payment_method: string; payment_date: string; status: string; receipt: { receipt_number: string } | null }[];
}
interface StudentInfo { id: string; firstName: string; lastName: string; admission_number: string; class: { name: string }; section: { name: string }; }
interface Student { id: string; firstName: string; lastName: string; admission_number: string; }

const fmt = (n: number, cur = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);

const statusColor = (s: string) => ({
  paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  partial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
}[s] || 'bg-gray-500/20 text-gray-400 border-gray-500/30');

function LedgerInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [students, setStudents]     = useState<Student[]>([]);
  const [selected, setSelected]     = useState(params.get('student') || '');
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [ledger, setLedger]         = useState<LedgerEntry[]>([]);
  const [totals, setTotals]         = useState<{ total_due: number; total_paid: number; total_balance: number } | null>(null);
  const [loading, setLoading]       = useState(true);
  const [fetching, setFetching]     = useState(false);
  const [expanded, setExpanded]     = useState<string | null>(null);

  useEffect(() => {
    fetchApi('/students')
      .then(d => setStudents(d.students || []))
      .catch(e => { if (e.message?.includes('Unauthorized')) router.push('/login'); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selected) loadLedger(selected);
  }, [selected]);

  const loadLedger = async (id: string) => {
    setFetching(true);
    try {
      const d = await fetchApi(`/fees/ledger/${id}`);
      setStudentInfo(d.student);
      setLedger(d.ledger || []);
      setTotals(d.totals);
    } catch {}
    finally { setFetching(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
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
            <a href="/fees/ledger" className="text-cyan-400 font-medium">Ledger</a>
            <a href="/receipts" className="text-gray-400 hover:text-white transition-colors">Receipts</a>
            <a href="/fees" className="text-gray-400 hover:text-white transition-colors">Fees</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Student Fee Ledger</h1>
          <p className="text-gray-500 mt-1">Chronological record of invoices, payments, and balances</p>
        </div>

        <div className="mb-6">
          <select value={selected} onChange={e => setSelected(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm w-full max-w-sm focus:outline-none focus:border-cyan-500">
            <option value="">— Select a student —</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admission_number})</option>)}
          </select>
        </div>

        {studentInfo && totals && (
          <>
            {/* Student header */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 flex flex-wrap justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">{studentInfo.firstName} {studentInfo.lastName}</h2>
                <p className="text-gray-500 text-sm">{studentInfo.admission_number} · {studentInfo.class?.name} {studentInfo.section?.name}</p>
              </div>
              <div className="flex gap-6">
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase">Total Due</p>
                  <p className="text-xl font-bold text-cyan-400">{fmt(totals.total_due)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase">Paid</p>
                  <p className="text-xl font-bold text-emerald-400">{fmt(totals.total_paid)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase">Balance</p>
                  <p className={`text-xl font-bold ${totals.total_balance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(totals.total_balance)}</p>
                </div>
              </div>
            </div>

            {/* Fee entries */}
            <div className="space-y-4">
              {ledger.map(entry => (
                <div key={entry.fee_id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <button onClick={() => setExpanded(expanded === entry.fee_id ? null : entry.fee_id)}
                    className="w-full flex items-center justify-between p-5 hover:bg-white/[0.03] transition-colors">
                    <div className="text-left">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold">{entry.structure.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-lg border capitalize ${statusColor(entry.status)}`}>{entry.status}</span>
                      </div>
                      <p className="text-xs text-gray-500">{entry.structure.academic_year} · Assigned {new Date(entry.assigned_at).toLocaleDateString('en-IN')}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-gray-400">Due: <span className="text-white font-semibold">{fmt(entry.final_amount, entry.structure.currency)}</span></p>
                        <p className="text-sm text-gray-400">Paid: <span className="text-emerald-400 font-semibold">{fmt(entry.paid_total, entry.structure.currency)}</span></p>
                      </div>
                      <svg className={`w-4 h-4 text-gray-500 transition-transform ${expanded === entry.fee_id ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {expanded === entry.fee_id && (
                    <div className="border-t border-white/10 p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Installments */}
                      <div>
                        <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Installments</h3>
                        <div className="space-y-2">
                          {entry.installments.map(inst => (
                            <div key={inst.id} className="bg-black/20 rounded-xl px-3 py-2.5">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-sm font-medium">{inst.installment_name}</p>
                                  <p className="text-xs text-gray-600">{new Date(inst.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-400">
                                    <span className="text-emerald-400 font-semibold">{fmt(inst.paid, entry.structure.currency)}</span>
                                    &nbsp;/ {fmt(inst.amount, entry.structure.currency)}
                                  </p>
                                  <span className={`text-xs capitalize ${statusColor(inst.status)} px-2 py-0.5 rounded-lg border`}>{inst.status}</span>
                                </div>
                              </div>
                              {inst.paid > 0 && inst.paid < inst.amount && (
                                <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(inst.paid / inst.amount) * 100}%` }} />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Payments */}
                      <div>
                        <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Payments</h3>
                        {entry.payments.length === 0 ? (
                          <p className="text-gray-600 text-sm">No payments yet</p>
                        ) : (
                          <div className="space-y-2">
                            {entry.payments.map(p => (
                              <div key={p.id} className="bg-black/20 rounded-xl px-3 py-2.5 flex justify-between items-center">
                                <div>
                                  <p className="text-sm font-medium text-emerald-400">{fmt(p.amount_paid, entry.structure.currency)}</p>
                                  <p className="text-xs text-gray-500 capitalize">{p.payment_method.replace('_', ' ')} · {new Date(p.payment_date).toLocaleDateString('en-IN')}</p>
                                </div>
                                {p.receipt && (
                                  <a href={`/receipts/${p.id}`} className="text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded-lg">
                                    {p.receipt.receipt_number}
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {fetching && <div className="text-center py-12"><div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>}
        {!selected && !fetching && (
          <div className="text-center py-20 text-gray-600">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>Select a student to view their complete fee ledger</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function LedgerPage() {
  return <Suspense><LedgerInner /></Suspense>;
}
