'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface Student { id: string; firstName: string; lastName: string; admission_number: string; }
interface FeeStructure { id: string; name: string; academic_year: string; currency: string; is_active: boolean; components: { amount: number; is_optional: boolean }[]; }
interface FeeDiscount { id: string; name: string; type: string; value: number; is_active: boolean; }
interface StudentFee {
  id: string; status: string; total_amount: number; discount_amount: number; final_amount: number;
  assigned_at: string;
  student: { firstName: string; lastName: string; admission_number: string };
  feeStructure: { name: string; academic_year: string; currency: string };
  discounts: { applied_value: number; feeDiscount: { name: string } }[];
  installments: { id: string; installment_name: string; due_date: string; amount: number; status: string }[];
}

const statusBadge = (s: string) => ({
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  partial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  paid:    'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
}[s] || 'bg-gray-500/20 text-gray-400 border-gray-500/30');

const fmt = (n: number, cur = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);

export default function FeeAssignmentsPage() {
  const router = useRouter();
  const [allFees, setAllFees]       = useState<StudentFee[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [discounts, setDiscounts]   = useState<FeeDiscount[]>([]);
  const [students, setStudents]     = useState<Student[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [assigning, setAssigning]   = useState(false);
  const [error, setError]           = useState('');

  const [form, setForm] = useState({
    student_id: '', fee_structure_id: '', discount_ids: [] as string[],
  });
  const [installmentMode, setInstallmentMode] = useState<'none' | 'monthly' | 'quarterly' | 'custom'>('none');
  const [customInstallments, setCustomInstallments] = useState<
    { installment_name: string; due_date: string; amount: string }[]
  >([{ installment_name: '', due_date: '', amount: '' }]);

  const load = async () => {
    try {
      const [st, str, disc] = await Promise.all([
        fetchApi('/students'),
        fetchApi('/fees/structures'),
        fetchApi('/fees/discounts'),
      ]);
      setStudents(st.students || []);
      setStructures(str.structures || []);
      setDiscounts(disc.discounts || []);
    } catch (e: any) { if (e.message?.includes('Unauthorized')) router.push('/login'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const selectedStructure = structures.find(s => s.id === form.fee_structure_id);
  const mandatoryTotal = selectedStructure
    ? selectedStructure.components.filter(c => !c.is_optional).reduce((s, c) => s + c.amount, 0)
    : 0;

  const totalDiscount = form.discount_ids.reduce((sum, did) => {
    const d = discounts.find(x => x.id === did);
    if (!d) return sum;
    return sum + (d.type === 'percentage' ? (mandatoryTotal * d.value) / 100 : d.value);
  }, 0);
  const finalAmount = Math.max(0, mandatoryTotal - totalDiscount);

  const generateInstallments = () => {
    if (installmentMode === 'none' || finalAmount === 0) return [];
    if (installmentMode === 'custom') {
      return customInstallments.filter(i => i.installment_name && i.due_date && parseFloat(i.amount) > 0)
        .map(i => ({ installment_name: i.installment_name, due_date: i.due_date, amount: parseFloat(i.amount) }));
    }
    const count = installmentMode === 'monthly' ? 12 : 4;
    const labels = installmentMode === 'monthly'
      ? ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']
      : ['Q1 (Apr-Jun)','Q2 (Jul-Sep)','Q3 (Oct-Dec)','Q4 (Jan-Mar)'];
    const base = Math.floor((finalAmount / count) * 100) / 100;
    const remainder = +(finalAmount - base * (count - 1)).toFixed(2);
    const start = new Date(); start.setDate(1);
    return labels.map((name, i) => {
      const d = new Date(start); d.setMonth(d.getMonth() + (installmentMode === 'monthly' ? i : i * 3));
      return { installment_name: name, due_date: d.toISOString().split('T')[0], amount: i === count - 1 ? remainder : base };
    });
  };

  const handleAssign = async () => {
    if (!form.student_id || !form.fee_structure_id) { setError('Student and fee structure are required'); return; }
    const installments = generateInstallments();
    if (installmentMode !== 'none' && installments.length === 0) { setError('Please configure installments'); return; }
    if (installmentMode === 'custom') {
      const total = installments.reduce((s, i) => s + i.amount, 0);
      const diff  = Math.abs(total - finalAmount);
      if (diff > 0.01) { setError(`Installment total (${fmt(total)}) must equal final amount (${fmt(finalAmount)})`); return; }
    }
    setAssigning(true); setError('');
    try {
      await fetchApi('/fees/assign', {
        method: 'POST',
        data: {
          student_id: form.student_id,
          fee_structure_id: form.fee_structure_id,
          discount_ids: form.discount_ids.length ? form.discount_ids : undefined,
          installments: installments.length ? installments : undefined,
        },
      });
      setShowAssign(false);
      setForm({ student_id: '', fee_structure_id: '', discount_ids: [] });
      setInstallmentMode('none');
      load();
    } catch (e: any) { setError(e.message); }
    finally { setAssigning(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/fees" className="text-gray-400 hover:text-white transition-colors">Overview</a>
            <a href="/fees/structures" className="text-gray-400 hover:text-white transition-colors">Structures</a>
            <a href="/fees/assignments" className="text-indigo-400 font-medium">Assignments</a>
            <a href="/fees/installments" className="text-gray-400 hover:text-white transition-colors">Installments</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Fee Assignments</h1>
            <p className="text-gray-500 mt-1">Assign fee structures to students and configure installments</p>
          </div>
          <button onClick={() => setShowAssign(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-sm font-medium shadow-lg hover:shadow-indigo-500/25 transition-all hover:scale-105">
            + Assign Fee
          </button>
        </div>

        {/* Search by student */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-gray-500">
          <p className="text-sm mb-3">Search for a student to view their fee assignments</p>
          <select onChange={async (e) => {
            if (!e.target.value) { setAllFees([]); return; }
            try {
              const d = await fetchApi(`/fees/student/${e.target.value}`);
              setAllFees(d.fees || []);
            } catch {}
          }} className="bg-black/30 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm w-full max-w-sm mx-auto focus:outline-none focus:border-indigo-500">
            <option value="">— Select a student —</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admission_number})</option>
            ))}
          </select>
        </div>

        {allFees.length > 0 && (
          <div className="mt-6 space-y-4">
            {allFees.map(fee => (
              <div key={fee.id} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{fee.feeStructure.name}</h3>
                    <p className="text-gray-500 text-sm">{fee.feeStructure.academic_year}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-xs font-medium border capitalize ${statusBadge(fee.status)}`}>{fee.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-black/20 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-gray-300">{fmt(fee.total_amount, fee.feeStructure.currency)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Billed</p>
                  </div>
                  <div className="bg-black/20 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-red-400">-{fmt(fee.discount_amount, fee.feeStructure.currency)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Discount</p>
                  </div>
                  <div className="bg-black/20 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-emerald-400">{fmt(fee.final_amount, fee.feeStructure.currency)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Final Due</p>
                  </div>
                </div>
                {fee.discounts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {fee.discounts.map((d, i) => (
                      <span key={i} className="text-xs bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-lg px-2.5 py-1">
                        {d.feeDiscount.name}: -{fmt(d.applied_value, fee.feeStructure.currency)}
                      </span>
                    ))}
                  </div>
                )}
                {fee.installments.length > 0 && (
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Installment Schedule</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {fee.installments.map(inst => (
                        <div key={inst.id} className="bg-white/5 rounded-lg p-2 text-center">
                          <p className="text-xs text-gray-400 truncate">{inst.installment_name}</p>
                          <p className="text-sm font-semibold text-white mt-0.5">{fmt(inst.amount, fee.feeStructure.currency)}</p>
                          <p className="text-xs text-gray-600">{new Date(inst.due_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}</p>
                          <span className={`text-xs ${statusBadge(inst.status)} px-1.5 py-0.5 rounded mt-1 inline-block border`}>{inst.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Assign Modal */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowAssign(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-xl my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">Assign Fee to Student</h2>
              <button onClick={() => setShowAssign(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>

            {error && <p className="text-red-400 text-sm mb-4 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">{error}</p>}

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Student *</label>
                <select value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })}
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="">— Select student —</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admission_number})</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Fee Structure *</label>
                <select value={form.fee_structure_id} onChange={e => setForm({ ...form, fee_structure_id: e.target.value })}
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="">— Select structure —</option>
                  {structures.filter(s => s.is_active).map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.academic_year})</option>
                  ))}
                </select>
              </div>

              {/* Amount preview */}
              {selectedStructure && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Mandatory Total</span>
                    <span className="font-semibold">{fmt(mandatoryTotal, selectedStructure.currency)}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Discount</span>
                      <span className="text-red-400">-{fmt(totalDiscount, selectedStructure.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm border-t border-white/10 pt-1 mt-1">
                    <span className="font-medium">Final Amount</span>
                    <span className="font-bold text-emerald-400">{fmt(finalAmount, selectedStructure.currency)}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-500 mb-2 block">Discounts (optional)</label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {discounts.filter(d => d.is_active).map(d => (
                    <label key={d.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 cursor-pointer hover:bg-white/10 transition-colors">
                      <input type="checkbox" className="accent-indigo-500"
                        checked={form.discount_ids.includes(d.id)}
                        onChange={e => setForm({
                          ...form,
                          discount_ids: e.target.checked
                            ? [...form.discount_ids, d.id]
                            : form.discount_ids.filter(x => x !== d.id),
                        })} />
                      <span className="text-sm text-gray-300">{d.name}</span>
                      <span className="ml-auto text-xs text-purple-400">
                        {d.type === 'percentage' ? `${d.value}%` : fmt(d.value)}
                      </span>
                    </label>
                  ))}
                  {discounts.filter(d => d.is_active).length === 0 && (
                    <p className="text-xs text-gray-600 text-center py-2">No active discounts — <a href="/fees" className="text-indigo-400">create one first</a></p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-2 block">Installment Plan</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['none', 'monthly', 'quarterly', 'custom'] as const).map(mode => (
                    <button key={mode} onClick={() => setInstallmentMode(mode)}
                      className={`py-2 rounded-xl text-xs font-medium capitalize border transition-all ${
                        installmentMode === mode
                          ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}>{mode}</button>
                  ))}
                </div>
              </div>

              {installmentMode === 'custom' && (
                <div className="space-y-2">
                  {customInstallments.map((inst, i) => (
                    <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                      <input value={inst.installment_name}
                        onChange={e => setCustomInstallments(prev => prev.map((x, idx) => idx === i ? { ...x, installment_name: e.target.value } : x))}
                        placeholder="Name (e.g. Term 1)"
                        className="col-span-4 bg-black/30 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500" />
                      <input type="date" value={inst.due_date}
                        onChange={e => setCustomInstallments(prev => prev.map((x, idx) => idx === i ? { ...x, due_date: e.target.value } : x))}
                        className="col-span-4 bg-black/30 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs" style={{ colorScheme: 'dark' }} />
                      <input type="number" value={inst.amount}
                        onChange={e => setCustomInstallments(prev => prev.map((x, idx) => idx === i ? { ...x, amount: e.target.value } : x))}
                        placeholder="₹ Amount"
                        className="col-span-3 bg-black/30 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500" />
                      <button onClick={() => setCustomInstallments(prev => prev.filter((_, idx) => idx !== i))}
                        className="col-span-1 text-red-400 hover:text-red-300 text-lg leading-none text-center">✕</button>
                    </div>
                  ))}
                  <button onClick={() => setCustomInstallments(prev => [...prev, { installment_name: '', due_date: '', amount: '' }])}
                    className="text-xs text-indigo-400 hover:text-indigo-300">+ Add row</button>
                </div>
              )}

              {installmentMode !== 'none' && installmentMode !== 'custom' && finalAmount > 0 && (
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-2">Preview ({installmentMode === 'monthly' ? '12 installments' : '4 quarters'}):</p>
                  <div className="grid grid-cols-3 gap-2">
                    {generateInstallments().slice(0, 6).map((inst, i) => (
                      <div key={i} className="text-center">
                        <p className="text-xs text-gray-500 truncate">{inst.installment_name}</p>
                        <p className="text-xs font-semibold text-white">{fmt(inst.amount)}</p>
                      </div>
                    ))}
                    {generateInstallments().length > 6 && <p className="text-xs text-gray-600 col-span-3">+{generateInstallments().length - 6} more…</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-white/10">
              <button onClick={() => setShowAssign(false)} className="px-4 py-2 bg-white/5 rounded-xl text-sm">Cancel</button>
              <button onClick={handleAssign} disabled={assigning}
                className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-sm font-medium disabled:opacity-50">
                {assigning ? 'Assigning…' : 'Assign Fee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
