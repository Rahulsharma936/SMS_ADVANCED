'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface FeeComponent {
  id: string; name: string; amount: number; tax_percentage: number | null; is_optional: boolean;
}
interface FeeStructure {
  id: string; name: string; academic_year: string; currency: string;
  is_active: boolean; class: { id: string; name: string } | null;
  components: FeeComponent[];
  _count: { studentFees: number };
  created_at: string;
}

const fmt = (n: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

const totalOf = (components: FeeComponent[]) =>
  components.filter(c => !c.is_optional).reduce((s, c) => s + c.amount, 0);

export default function FeeStructuresPage() {
  const router = useRouter();
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating]     = useState(false);
  const [error, setError]           = useState('');
  const [classes, setClasses]       = useState<{ id: string; name: string }[]>([]);

  // Form: structure
  const [form, setForm] = useState({
    name: '', academic_year: '2025-2026', class_id: '', currency: 'INR',
  });

  // Dynamic components
  const [comps, setComps] = useState<Array<{
    name: string; amount: string; tax_percentage: string; is_optional: boolean;
  }>>([{ name: '', amount: '', tax_percentage: '', is_optional: false }]);

  const load = async () => {
    try {
      const [sd, cl] = await Promise.all([fetchApi('/fees/structures'), fetchApi('/classes')]);
      setStructures(sd.structures);
      setClasses(cl.classes || []);
    } catch (e: any) {
      if (e.message?.includes('Unauthorized')) router.push('/login');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const addComp = () =>
    setComps([...comps, { name: '', amount: '', tax_percentage: '', is_optional: false }]);

  const removeComp = (i: number) => setComps(comps.filter((_, idx) => idx !== i));

  const updateComp = (i: number, field: string, value: any) =>
    setComps(comps.map((c, idx) => idx === i ? { ...c, [field]: value } : c));

  const previewTotal = comps
    .filter(c => !c.is_optional && c.amount)
    .reduce((s, c) => s + parseFloat(c.amount || '0'), 0);

  const handleCreate = async () => {
    if (!form.name || !form.academic_year) { setError('Name and Academic Year are required'); return; }
    const validComps = comps.filter(c => c.name && c.amount && parseFloat(c.amount) > 0);
    if (validComps.length === 0) { setError('Add at least one fee component with a valid amount'); return; }
    setCreating(true); setError('');
    try {
      // 1. Create structure
      const { structure } = await fetchApi('/fees/structures', {
        method: 'POST',
        data: {
          name: form.name,
          academic_year: form.academic_year,
          class_id: form.class_id || null,
          currency: form.currency,
        },
      });
      // 2. Add components
      await fetchApi('/fees/components', {
        method: 'POST',
        data: {
          fee_structure_id: structure.id,
          components: validComps.map(c => ({
            name: c.name,
            amount: parseFloat(c.amount),
            tax_percentage: c.tax_percentage ? parseFloat(c.tax_percentage) : null,
            is_optional: c.is_optional,
          })),
        },
      });
      setShowCreate(false);
      setForm({ name: '', academic_year: '2025-2026', class_id: '', currency: 'INR' });
      setComps([{ name: '', amount: '', tax_percentage: '', is_optional: false }]);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
            SMS Portal
          </a>
          <div className="flex gap-4 text-sm">
            <a href="/fees" className="text-gray-400 hover:text-white transition-colors">Overview</a>
            <a href="/fees/structures" className="text-emerald-400 font-medium">Structures</a>
            <a href="/fees/assignments" className="text-gray-400 hover:text-white transition-colors">Assignments</a>
            <a href="/fees/installments" className="text-gray-400 hover:text-white transition-colors">Installments</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Fee Structures</h1>
            <p className="text-gray-500 mt-1">{structures.length} structure{structures.length !== 1 ? 's' : ''} configured</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-600 rounded-xl text-sm font-medium shadow-lg hover:shadow-emerald-500/25 transition-all hover:scale-105">
            + New Structure
          </button>
        </div>

        {/* Structure Cards */}
        {structures.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            </div>
            <p className="text-lg mb-2">No fee structures yet</p>
            <button onClick={() => setShowCreate(true)} className="text-emerald-400 hover:underline text-sm">
              Create your first structure
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {structures.map(s => {
              const total = totalOf(s.components);
              return (
                <div key={s.id}
                  className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] hover:border-emerald-500/30 transition-all group cursor-pointer"
                  onClick={() => router.push(`/fees/structures`)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 mr-2">
                      <h3 className="font-semibold text-white text-base leading-tight group-hover:text-emerald-400 transition-colors truncate">{s.name}</h3>
                      <p className="text-gray-500 text-sm mt-0.5">{s.academic_year}</p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                      s.is_active
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    }`}>{s.is_active ? 'Active' : 'Inactive'}</span>
                  </div>

                  {s.class && (
                    <p className="text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-2 py-1 inline-block mb-3">
                      {s.class.name}
                    </p>
                  )}

                  {/* Amount breakdown */}
                  <div className="space-y-1.5 mb-4">
                    {s.components.slice(0, 4).map(c => (
                      <div key={c.id} className="flex justify-between text-xs">
                        <span className={`text-gray-400 ${c.is_optional ? 'italic' : ''}`}>
                          {c.name}{c.is_optional ? ' (opt)' : ''}
                        </span>
                        <span className="text-gray-300">{fmt(c.amount, s.currency)}</span>
                      </div>
                    ))}
                    {s.components.length > 4 && (
                      <p className="text-xs text-gray-600">+{s.components.length - 4} more components</p>
                    )}
                  </div>

                  <div className="border-t border-white/10 pt-3 flex justify-between items-center">
                    <div>
                      <p className="text-2xl font-bold text-emerald-400">{fmt(total, s.currency)}</p>
                      <p className="text-xs text-gray-500">mandatory total</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-300">{s._count.studentFees}</p>
                      <p className="text-xs text-gray-500">students</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowCreate(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-2xl my-8"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">New Fee Structure</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white transition-colors text-xl leading-none">✕</button>
            </div>

            {error && <p className="text-red-400 text-sm mb-4 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">{error}</p>}

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Structure Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Class 10 Annual Fee 2025-26"
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Academic Year *</label>
                <input value={form.academic_year} onChange={e => setForm({ ...form, academic_year: e.target.value })}
                  placeholder="2025-2026"
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Currency</label>
                <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm">
                  <option value="INR">INR ₹</option>
                  <option value="USD">USD $</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Class (optional — leave blank for school-wide)</label>
                <select value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })}
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm">
                  <option value="">— School-wide (no specific class) —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Fee Components Builder */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-300">Fee Components</h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    Mandatory total: <span className="text-emerald-400 font-semibold">{fmt(previewTotal, form.currency)}</span>
                  </span>
                  <button onClick={addComp}
                    className="text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg transition-colors">
                    + Add
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {comps.map((c, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center bg-white/5 rounded-xl p-3">
                    <div className="col-span-4">
                      <input value={c.name} onChange={e => updateComp(i, 'name', e.target.value)}
                        placeholder="Component name"
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-emerald-500" />
                    </div>
                    <div className="col-span-3">
                      <input type="number" value={c.amount} onChange={e => updateComp(i, 'amount', e.target.value)}
                        placeholder="Amount ₹"
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-emerald-500" />
                    </div>
                    <div className="col-span-2">
                      <input type="number" value={c.tax_percentage} onChange={e => updateComp(i, 'tax_percentage', e.target.value)}
                        placeholder="Tax %"
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-emerald-500" />
                    </div>
                    <div className="col-span-2 flex items-center gap-1">
                      <input type="checkbox" id={`opt-${i}`} checked={c.is_optional} onChange={e => updateComp(i, 'is_optional', e.target.checked)}
                        className="accent-emerald-500" />
                      <label htmlFor={`opt-${i}`} className="text-xs text-gray-500">Opt</label>
                    </div>
                    <div className="col-span-1">
                      {comps.length > 1 && (
                        <button onClick={() => removeComp(i)}
                          className="text-red-400 hover:text-red-300 transition-colors text-lg leading-none w-full text-center">✕</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-2">"Opt" = Optional fee (excluded from mandatory total)</p>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-white/5 rounded-xl text-sm">Cancel</button>
              <button onClick={handleCreate} disabled={creating}
                className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-cyan-600 rounded-xl text-sm font-medium disabled:opacity-50">
                {creating ? 'Creating…' : 'Create Structure'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
