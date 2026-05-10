'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface Analytics {
  total_collected: number; total_transactions: number;
  pending_amount: number; overdue_amount: number;
  paid_installments: number; pending_installments: number; overdue_installments: number;
  by_payment_method: { method: string; amount: number; count: number }[];
  monthly_trend: { month: string; amount: number; count: number }[];
}
interface Summary {
  total_billed: number; total_discount: number; net_due: number;
  total_collected: number; outstanding: number; collection_rate: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const METHOD_COLORS: Record<string, string> = {
  cash: 'bg-emerald-500', upi: 'bg-blue-500', razorpay: 'bg-indigo-500',
  cheque: 'bg-amber-500', dd: 'bg-orange-500', bank_transfer: 'bg-purple-500',
};

export default function FeeAnalyticsPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [classRevenue, setClassRevenue] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [from, setFrom]           = useState('');
  const [to, setTo]               = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to)   params.set('to', to);
      const [a, s, cr] = await Promise.all([
        fetchApi(`/fees/analytics${params.toString() ? '?' + params : ''}`),
        fetchApi('/fees/collection-summary'),
        fetchApi('/fees/class-revenue'),
      ]);
      setAnalytics(a.analytics);
      setSummary(s.summary);
      setClassRevenue(cr.class_revenue || []);
    } catch (e: any) {
      if (e.message?.includes('Unauthorized')) router.push('/login');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const maxMonthly = analytics ? Math.max(...analytics.monthly_trend.map(m => m.amount), 1) : 1;
  const maxClass   = classRevenue.length > 0 ? Math.max(...classRevenue.map(c => c.total_billed), 1) : 1;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/fees/analytics" className="text-emerald-400 font-medium">Analytics</a>
            <a href="/fees/defaulters" className="text-gray-400 hover:text-white transition-colors">Defaulters</a>
            <a href="/fees/ledger" className="text-gray-400 hover:text-white transition-colors">Ledger</a>
            <a href="/receipts" className="text-gray-400 hover:text-white transition-colors">Receipts</a>
            <a href="/fees" className="text-gray-400 hover:text-white transition-colors">Fees</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Fee Analytics</h1>
            <p className="text-gray-500 mt-1">Financial overview derived from real payment data</p>
          </div>
          <div className="flex gap-2 items-center">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ colorScheme: 'dark' }}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
            <span className="text-gray-500 text-sm">to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ colorScheme: 'dark' }}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
            <button onClick={load} className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm hover:bg-emerald-500/30 transition-colors">
              Filter
            </button>
          </div>
        </div>

        {/* Collection summary cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {[
              { label: 'Total Billed',   value: fmt(summary.total_billed),   color: 'text-white' },
              { label: 'Discounts',      value: fmt(summary.total_discount),  color: 'text-purple-400' },
              { label: 'Net Due',        value: fmt(summary.net_due),         color: 'text-cyan-400' },
              { label: 'Collected',      value: fmt(summary.total_collected), color: 'text-emerald-400' },
              { label: 'Outstanding',    value: fmt(summary.outstanding),     color: 'text-red-400' },
              { label: 'Collection %',   value: `${summary.collection_rate}%`,color: 'text-amber-400' },
            ].map(c => (
              <div key={c.label} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{c.label}</p>
              </div>
            ))}
          </div>
        )}

        {analytics && (
          <>
            {/* Installment status pills */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Paid Installments',    v: analytics.paid_installments,    color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
                { label: 'Pending Installments', v: analytics.pending_installments, color: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
                { label: 'Overdue Installments', v: analytics.overdue_installments, color: 'bg-red-500/10 border-red-500/20 text-red-400' },
              ].map(c => (
                <div key={c.label} className={`border rounded-2xl p-5 text-center ${c.color}`}>
                  <p className="text-3xl font-bold">{c.v}</p>
                  <p className="text-xs mt-1 opacity-80 uppercase">{c.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Monthly trend chart */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Monthly Collection Trend</h2>
                {analytics.monthly_trend.length === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-8">No data yet</p>
                ) : (
                  <div className="flex items-end gap-1 h-40">
                    {analytics.monthly_trend.map((m, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="relative w-full">
                          <div
                            className="w-full bg-emerald-500/20 rounded-t-md group-hover:bg-emerald-500/40 transition-colors"
                            style={{ height: `${(m.amount / maxMonthly) * 136}px` }}
                            title={`${m.month}: ${fmt(m.amount)}`}
                          />
                        </div>
                        <span className="text-xs text-gray-600 rotate-45 origin-left" style={{ fontSize: '9px' }}>{m.month.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment method breakdown */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Payment Method Breakdown</h2>
                <div className="space-y-3">
                  {analytics.by_payment_method.length === 0 ? (
                    <p className="text-gray-600 text-sm text-center py-8">No payments yet</p>
                  ) : analytics.by_payment_method.map(m => {
                    const totalAll = analytics.by_payment_method.reduce((s, x) => s + x.amount, 0);
                    const pct = totalAll > 0 ? (m.amount / totalAll) * 100 : 0;
                    return (
                      <div key={m.method}>
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span className="capitalize">{m.method.replace('_', ' ')} ({m.count} txns)</span>
                          <span className="font-semibold text-white">{fmt(m.amount)}</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${METHOD_COLORS[m.method] || 'bg-gray-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Class-wise revenue */}
        {classRevenue.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Class-wise Revenue</h2>
            <div className="space-y-3">
              {classRevenue.map((c, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-24 shrink-0">
                    <p className="text-sm font-medium text-white truncate">{c.class_name}</p>
                    <p className="text-xs text-gray-500">{c.student_count} students</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-2.5 bg-white/10 rounded-full overflow-hidden relative">
                      <div className="absolute inset-y-0 left-0 bg-emerald-500/40 rounded-full"
                        style={{ width: `${(c.total_billed / maxClass) * 100}%` }} />
                      <div className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full"
                        style={{ width: `${(c.total_paid / maxClass) * 100}%` }} />
                    </div>
                  </div>
                  <div className="w-40 shrink-0 text-right">
                    <p className="text-sm font-semibold text-emerald-400">{fmt(c.total_paid)}</p>
                    <p className="text-xs text-gray-500">of {fmt(c.total_billed)}</p>
                  </div>
                  <div className="w-20 text-right">
                    <span className="text-xs text-red-400">{fmt(c.outstanding)} due</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-3">■ Dark green = collected &nbsp; ■ Light green = billed</p>
          </div>
        )}
      </main>
    </div>
  );
}
