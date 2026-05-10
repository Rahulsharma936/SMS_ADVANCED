'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface Student { id: string; firstName: string; lastName: string; admission_number: string; }
interface Installment { id: string; installment_name: string; due_date: string; amount: number; status: string; }
interface Summary { total: number; pending: number; overdue: number; paid: number; }
interface StudentFeeOption { id: string; feeStructure: { name: string; academic_year: string; currency: string }; final_amount: number; }

const statusBadge = (s: string) => ({
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  partial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  paid:    'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
}[s] || 'bg-gray-500/20 text-gray-400 border-gray-500/30');

const fmt = (n: number, cur = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);

export default function InstallmentsPage() {
  const router = useRouter();
  const [students, setStudents]         = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [feeOptions, setFeeOptions]     = useState<StudentFeeOption[]>([]);
  const [selectedFeeId, setSelectedFeeId] = useState('');
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [summary, setSummary]           = useState<Summary | null>(null);
  const [loading, setLoading]           = useState(true);
  const [fetching, setFetching]         = useState(false);

  useEffect(() => {
    fetchApi('/students')
      .then(d => setStudents(d.students || []))
      .catch(e => { if (e.message?.includes('Unauthorized')) router.push('/login'); })
      .finally(() => setLoading(false));
  }, []);

  const onStudentChange = async (studentId: string) => {
    setSelectedStudent(studentId);
    setFeeOptions([]); setInstallments([]); setSummary(null); setSelectedFeeId('');
    if (!studentId) return;
    try {
      const d = await fetchApi(`/fees/student/${studentId}`);
      setFeeOptions(d.fees || []);
    } catch {}
  };

  const onFeeChange = async (feeId: string) => {
    setSelectedFeeId(feeId);
    setInstallments([]); setSummary(null);
    if (!feeId) return;
    setFetching(true);
    try {
      const d = await fetchApi(`/fees/installments/${feeId}`);
      setInstallments(d.installments || []);
      setSummary(d.summary || null);
    } catch {}
    finally { setFetching(false); }
  };

  const selectedFee = feeOptions.find(f => f.id === selectedFeeId);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
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
            <a href="/fees/assignments" className="text-gray-400 hover:text-white transition-colors">Assignments</a>
            <a href="/fees/installments" className="text-rose-400 font-medium">Installments</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold mb-2">Installment Tracker</h1>
        <p className="text-gray-500 mb-8">View payment schedules and due dates per student</p>

        {/* Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Select Student</label>
            <select value={selectedStudent} onChange={e => onStudentChange(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors">
              <option value="">— Select a student —</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admission_number})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Fee Assignment</label>
            <select value={selectedFeeId} onChange={e => onFeeChange(e.target.value)}
              disabled={feeOptions.length === 0}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500 disabled:opacity-40 transition-colors">
              <option value="">— Select fee assignment —</option>
              {feeOptions.map(f => (
                <option key={f.id} value={f.id}>{f.feeStructure.name} ({f.feeStructure.academic_year})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary */}
        {summary && selectedFee && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Due',  value: summary.total,   color: 'text-white' },
              { label: 'Pending',    value: summary.pending,  color: 'text-amber-400' },
              { label: 'Overdue',    value: summary.overdue,  color: 'text-red-400' },
              { label: 'Paid',       value: summary.paid,     color: 'text-emerald-400' },
            ].map(card => (
              <div key={card.label} className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
                <p className={`text-2xl font-bold ${card.color}`}>{fmt(card.value, selectedFee.feeStructure.currency)}</p>
                <p className="text-xs text-gray-500 mt-1 uppercase">{card.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Installment table */}
        {fetching && (
          <div className="text-center py-12"><div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        )}

        {!fetching && installments.length > 0 && selectedFee && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-5 py-3.5 text-xs text-gray-500 uppercase tracking-wider">Installment</th>
                  <th className="text-left px-5 py-3.5 text-xs text-gray-500 uppercase tracking-wider">Due Date</th>
                  <th className="text-right px-5 py-3.5 text-xs text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="text-center px-5 py-3.5 text-xs text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((inst, i) => {
                  const isOverdue = inst.status === 'pending' && new Date(inst.due_date) < new Date();
                  return (
                    <tr key={inst.id} className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors ${isOverdue ? 'bg-red-500/5' : ''}`}>
                      <td className="px-5 py-3.5 font-medium">{inst.installment_name}</td>
                      <td className={`px-5 py-3.5 ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                        {new Date(inst.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {isOverdue && <span className="ml-2 text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">OVERDUE</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold">{fmt(inst.amount, selectedFee.feeStructure.currency)}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border capitalize ${statusBadge(inst.status)}`}>{inst.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!fetching && selectedFeeId && installments.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-base mb-1">No installments configured</p>
            <p className="text-sm">Installments are set during fee assignment.</p>
          </div>
        )}

        {!selectedStudent && (
          <div className="text-center py-20 text-gray-600">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p>Select a student to view their installment schedule</p>
          </div>
        )}
      </main>
    </div>
  );
}
