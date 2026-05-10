'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface Defaulter {
  student: { id: string; firstName: string; lastName: string; admission_number: string; class: { name: string }; section: { name: string } };
  overdue_count:  number;
  overdue_amount: number;
  earliest_due:   string;
  installments:   { installment_name: string; due_date: string; amount: number; status: string; fee_structure: { name: string } }[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const daysOverdue = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

export default function DefaultersPage() {
  const router = useRouter();
  const [classes, setClasses]       = useState<{ id: string; name: string }[]>([]);
  const [classFilter, setClassFilter] = useState('');
  const [defaulters, setDefaulters] = useState<Defaulter[]>([]);
  const [summary, setSummary]       = useState<{ total_defaulters: number; total_overdue_amount: number } | null>(null);
  const [loading, setLoading]       = useState(true);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [sending, setSending]       = useState<string | null>(null);
  const [reminderType, setReminderType] = useState('email');

  const load = async (cid?: string) => {
    setLoading(true);
    try {
      const [d, cl] = await Promise.all([
        fetchApi(`/fees/defaulters${cid ? `?class_id=${cid}` : ''}`),
        fetchApi('/classes'),
      ]);
      setDefaulters(d.defaulters || []);
      setSummary({ total_defaulters: d.total_defaulters, total_overdue_amount: d.total_overdue_amount });
      setClasses(cl.classes || []);
    } catch (e: any) {
      if (e.message?.includes('Unauthorized')) router.push('/login');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const sendBulkReminder = async () => {
    setSending('bulk');
    try {
      const result = await fetchApi('/fees/reminders/bulk', {
        method: 'POST',
        data: { type: reminderType, class_id: classFilter || undefined },
      });
      alert(`Reminders sent: ${result.sent}, skipped (recent): ${result.skipped}`);
    } catch (e: any) { alert(e.message); }
    finally { setSending(null); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/fees/analytics" className="text-gray-400 hover:text-white transition-colors">Analytics</a>
            <a href="/fees/defaulters" className="text-red-400 font-medium">Defaulters</a>
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
            <h1 className="text-3xl font-bold">Defaulter Tracking</h1>
            <p className="text-gray-500 mt-1">Students with overdue fee installments</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <select value={classFilter} onChange={e => { setClassFilter(e.target.value); load(e.target.value || undefined); }}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500">
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={reminderType} onChange={e => setReminderType(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm">
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
            <button onClick={sendBulkReminder} disabled={sending === 'bulk' || defaulters.length === 0}
              className="px-4 py-2 bg-gradient-to-r from-red-500 to-orange-600 rounded-xl text-sm font-medium disabled:opacity-40 hover:scale-105 transition-all">
              {sending === 'bulk' ? 'Sending…' : `Send ${reminderType} to All`}
            </button>
          </div>
        </div>

        {/* Summary banners */}
        {summary && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold text-red-400">{summary.total_defaulters}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase">Total Defaulters</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold text-red-400">{fmt(summary.total_overdue_amount)}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase">Total Overdue Amount</p>
            </div>
          </div>
        )}

        {/* Defaulter list */}
        {defaulters.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>No defaulters found{classFilter ? ' in this class' : ''} 🎉</p>
          </div>
        ) : (
          <div className="space-y-3">
            {defaulters.map((d, i) => (
              <div key={d.student.id} className="bg-white/5 border border-red-500/20 rounded-2xl overflow-hidden">
                <button className="w-full flex items-center justify-between p-5 hover:bg-white/[0.03] transition-colors"
                  onClick={() => setExpanded(expanded === d.student.id ? null : d.student.id)}>
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-xs font-bold text-red-400">
                      {i + 1}
                    </div>
                    <div className="text-left">
                      <p className="font-semibold">{d.student.firstName} {d.student.lastName}</p>
                      <p className="text-xs text-gray-500">{d.student.admission_number} · {d.student.class?.name} {d.student.section?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-500">{d.overdue_count} overdue</p>
                      <p className="text-xs text-gray-600">since {new Date(d.earliest_due).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-400">{fmt(d.overdue_amount)}</p>
                      <p className="text-xs text-red-600">{daysOverdue(d.earliest_due)}d overdue</p>
                    </div>
                    <svg className={`w-4 h-4 text-gray-500 transition-transform ${expanded === d.student.id ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {expanded === d.student.id && (
                  <div className="border-t border-white/10 px-5 pb-5 pt-4">
                    <div className="grid gap-2">
                      {d.installments.map((inst, j) => (
                        <div key={j} className="flex justify-between items-center bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3">
                          <div>
                            <p className="text-sm font-medium">{inst.installment_name}</p>
                            <p className="text-xs text-gray-500">{inst.fee_structure.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-red-400">{fmt(inst.amount)}</p>
                            <p className="text-xs text-gray-500">due {new Date(inst.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                          </div>
                          <p className="text-xs text-red-500 ml-4">{daysOverdue(inst.due_date)}d ago</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                      <a href={`/fees/ledger?student=${d.student.id}`}
                        className="px-3 py-1.5 bg-white/5 rounded-lg text-xs text-gray-400 hover:text-white transition-colors">
                        View Ledger
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
