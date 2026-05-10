'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface Student { id: string; firstName: string; lastName: string; admission_number: string; }
interface Invoice {
  id: string; invoice_number: string; total_due: number; generated_at: string; due_date: string; status: string;
  studentFee: { id: string; final_amount: number; status: string; feeStructure: { name: string; academic_year: string; currency: string } };
}

const fmt = (n: number, cur = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);

const statusBadge = (s: string) => ({
  paid:    'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  partial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
}[s] || 'bg-gray-500/20 text-gray-400 border-gray-500/30');

export default function InvoicesPage() {
  const router = useRouter();
  const [students, setStudents]     = useState<Student[]>([]);
  const [selected, setSelected]     = useState('');
  const [feeOptions, setFeeOptions] = useState<any[]>([]);
  const [selectedFee, setSelectedFee] = useState('');
  const [invoices, setInvoices]     = useState<Invoice[]>([]);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  useEffect(() => {
    fetchApi('/students')
      .then(d => setStudents(d.students || []))
      .catch(e => { if (e.message?.includes('Unauthorized')) router.push('/login'); })
      .finally(() => setLoading(false));
  }, []);

  const onStudentChange = async (id: string) => {
    setSelected(id); setFeeOptions([]); setSelectedFee(''); setInvoices([]);
    if (!id) return;
    const [feesRes, invRes] = await Promise.allSettled([
      fetchApi(`/fees/student/${id}`),
      fetchApi(`/fees/invoices/student/${id}`),
    ]);
    if (feesRes.status === 'fulfilled') setFeeOptions(feesRes.value.fees || []);
    if (invRes.status === 'fulfilled')  setInvoices(invRes.value.invoices || []);
  };

  const generateInvoice = async () => {
    if (!selectedFee) { setError('Select a fee assignment'); return; }
    setGenerating(true); setError(''); setSuccess('');
    try {
      const d = await fetchApi('/fees/invoices/generate', { method: 'POST', data: { student_fee_id: selectedFee } });
      setSuccess(`Invoice ${d.invoice.invoice_number} generated`);
      const invRes = await fetchApi(`/fees/invoices/student/${selected}`);
      setInvoices(invRes.invoices || []);
    } catch (e: any) { setError(e.message); }
    finally { setGenerating(false); }
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
            <a href="/fees/ledger" className="text-gray-400 hover:text-white transition-colors">Ledger</a>
            <a href="/receipts" className="text-gray-400 hover:text-white transition-colors">Receipts</a>
            <a href="/invoices" className="text-cyan-400 font-medium">Invoices</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Fee Invoices</h1>
          <p className="text-gray-500 mt-1">Generate due notices and view invoice history</p>
        </div>

        {/* Generate panel */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-4">Generate Invoice</h2>
          {error   && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-3">{error}</p>}
          {success && <p className="text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-3">✓ {success}</p>}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Student</label>
              <select value={selected} onChange={e => onStudentChange(e.target.value)}
                className="bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm w-56 focus:outline-none focus:border-cyan-500">
                <option value="">— Select —</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fee Assignment</label>
              <select value={selectedFee} onChange={e => setSelectedFee(e.target.value)}
                disabled={feeOptions.length === 0}
                className="bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm w-56 focus:outline-none focus:border-cyan-500 disabled:opacity-40">
                <option value="">— Select fee —</option>
                {feeOptions.map(f => (
                  <option key={f.id} value={f.id}>{f.feeStructure.name}</option>
                ))}
              </select>
            </div>
            <button onClick={generateInvoice} disabled={generating || !selectedFee}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl text-sm font-medium disabled:opacity-40 hover:shadow-cyan-500/25 hover:shadow-lg transition-all">
              {generating ? 'Generating…' : 'Generate Invoice'}
            </button>
          </div>
        </div>

        {/* Invoice history */}
        {selected && invoices.length === 0 && (
          <p className="text-gray-600 text-center py-8">No invoices generated yet for this student.</p>
        )}

        {invoices.length > 0 && (
          <div className="space-y-3">
            {invoices.map(inv => (
              <div key={inv.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-cyan-400">{inv.invoice_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-lg border capitalize ${statusBadge(inv.status)}`}>{inv.status}</span>
                  </div>
                  <p className="text-sm text-gray-300">{inv.studentFee.feeStructure.name} · {inv.studentFee.feeStructure.academic_year}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Generated: {new Date(inv.generated_at).toLocaleDateString('en-IN')}
                    &nbsp;· Due by: {new Date(inv.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-white">{fmt(inv.total_due, inv.studentFee.feeStructure.currency)}</p>
                  <p className="text-xs text-gray-500">Amount due at generation</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!selected && (
          <div className="text-center py-16 text-gray-600">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>Select a student to generate or view invoices</p>
          </div>
        )}
      </main>
    </div>
  );
}
