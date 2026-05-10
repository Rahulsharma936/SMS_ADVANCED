'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface Summary {
  total_students_assigned: number;
  total_billed:  number;
  total_discount: number;
  total_final:   number;
  by_status: { pending: number; partial: number; paid: number; overdue: number };
}
interface FeeDiscount { id: string; name: string; type: string; value: number; is_active: boolean; }

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function FeesOverviewPage() {
  const router = useRouter();
  const [summary, setSummary]       = useState<Summary | null>(null);
  const [discounts, setDiscounts]   = useState<FeeDiscount[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discForm, setDiscForm]     = useState({ name: '', type: 'percentage', value: '', is_active: true });
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const load = async () => {
    try {
      const [sum, disc] = await Promise.all([
        fetchApi('/fees/summary'),
        fetchApi('/fees/discounts'),
      ]);
      setSummary(sum.summary);
      setDiscounts(disc.discounts || []);
    } catch (e: any) {
      if (e.message?.includes('Unauthorized')) router.push('/login');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSaveDiscount = async () => {
    if (!discForm.name || !discForm.value) { setError('Name and value are required'); return; }
    setSaving(true); setError('');
    try {
      await fetchApi('/fees/discounts', {
        method: 'POST',
        data: { ...discForm, value: parseFloat(discForm.value) },
      });
      setShowDiscountModal(false);
      setDiscForm({ name: '', type: 'percentage', value: '', is_active: true });
      load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const modules = [
    { href: '/fees/structures',  label: 'Fee Structures',  desc: 'Create & manage fee templates',  color: 'from-emerald-500 to-cyan-600', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
    { href: '/fees/assignments', label: 'Assign Fees',     desc: 'Link fee structures to students', color: 'from-indigo-500 to-purple-600', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { href: '/fees/installments',label: 'Installments',    desc: 'Track payment schedules',        color: 'from-rose-500 to-orange-600',   icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/fees" className="text-emerald-400 font-medium">Fee Overview</a>
            <a href="/fees/structures" className="text-gray-400 hover:text-white transition-colors">Structures</a>
            <a href="/fees/assignments" className="text-gray-400 hover:text-white transition-colors">Assignments</a>
            <a href="/fees/installments" className="text-gray-400 hover:text-white transition-colors">Installments</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-bold mb-1">
            Fee Management <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">System</span>
          </h1>
          <p className="text-gray-500">Define fee structures, assign to students, and plan installment schedules</p>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { label: 'Total Billed',   value: fmt(summary.total_billed),  color: 'text-white' },
              { label: 'Total Discount', value: fmt(summary.total_discount), color: 'text-purple-400' },
              { label: 'Net Receivable', value: fmt(summary.total_final),    color: 'text-emerald-400' },
              { label: 'Students with Fees', value: summary.total_students_assigned.toString(), color: 'text-cyan-400' },
            ].map(c => (
              <div key={c.label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">{c.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Status breakdown */}
        {summary && (
          <div className="grid grid-cols-4 gap-3 mb-10">
            {[
              { label: 'Pending',  value: summary.by_status.pending,  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
              { label: 'Partial',  value: summary.by_status.partial,  color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
              { label: 'Paid',     value: summary.by_status.paid,     color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
              { label: 'Overdue',  value: summary.by_status.overdue,  color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
            ].map(c => (
              <div key={c.label} className={`border rounded-2xl p-4 text-center ${c.bg}`}>
                <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-xs text-gray-500 mt-1 uppercase">{c.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Module Quick-Links */}
        <h2 className="text-sm text-gray-500 uppercase tracking-wider font-semibold mb-4">Fee Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {modules.map(m => (
            <a key={m.href} href={m.href}
              className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 hover:bg-white/[0.07] transition-all">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={m.icon} />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-1">{m.label}</h3>
              <p className="text-gray-500 text-sm">{m.desc}</p>
            </a>
          ))}
        </div>

        {/* Discount Management */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold">Discount Library</h2>
              <p className="text-gray-500 text-sm mt-0.5">Reusable discount definitions applied during fee assignment</p>
            </div>
            <button onClick={() => setShowDiscountModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl text-sm font-medium hover:scale-105 transition-all">
              + New Discount
            </button>
          </div>

          {discounts.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-6">No discounts created yet</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {discounts.map(d => (
                <div key={d.id} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-gray-500 capitalize mt-0.5">{d.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-purple-400">
                      {d.type === 'percentage' ? `${d.value}%` : fmt(d.value)}
                    </p>
                    <span className={`text-xs ${d.is_active ? 'text-emerald-400' : 'text-gray-500'}`}>
                      {d.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Discount Modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowDiscountModal(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">New Discount</h2>
              <button onClick={() => setShowDiscountModal(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            {error && <p className="text-red-400 text-sm mb-3 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">{error}</p>}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Discount Name *</label>
                <input value={discForm.name} onChange={e => setDiscForm({ ...discForm, name: e.target.value })}
                  placeholder="e.g. Sibling Discount"
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Type *</label>
                  <select value={discForm.type} onChange={e => setDiscForm({ ...discForm, type: e.target.value })}
                    className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm">
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Value *</label>
                  <input type="number" value={discForm.value} onChange={e => setDiscForm({ ...discForm, value: e.target.value })}
                    placeholder={discForm.type === 'percentage' ? '10' : '5000'}
                    className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-white/10">
              <button onClick={() => setShowDiscountModal(false)} className="px-4 py-2 bg-white/5 rounded-xl text-sm">Cancel</button>
              <button onClick={handleSaveDiscount} disabled={saving}
                className="px-5 py-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? 'Saving…' : 'Create Discount'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
