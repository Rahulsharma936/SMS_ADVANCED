'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';

interface LeaveData {
  id: string; from_date: string; to_date: string; reason: string; status: string;
  created_at: string;
  student: { firstName: string; lastName: string; admission_number: string; class: { name: string }; section: { name: string } };
  approvedBy: { firstName: string; lastName: string } | null;
}

interface ClassData { id: string; name: string; sections: { id: string; name: string }[] }
interface StudentData { id: string; firstName: string; lastName: string; admission_number: string }

export default function LeavePage() {
  const [leaves, setLeaves] = useState<LeaveData[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showApply, setShowApply] = useState(false);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [applyForm, setApplyForm] = useState({ class_id: '', section_id: '', student_id: '', from_date: '', to_date: '', reason: '' });
  const [applyError, setApplyError] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);

  const selectedClass = classes.find(c => c.id === applyForm.class_id);

  const loadLeaves = async () => {
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const data = await fetchApi(`/attendance/leave${params}`);
      setLeaves(data.leaves);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadLeaves(); }, [statusFilter]);

  const openApplyForm = async () => {
    setShowApply(true);
    try { const data = await fetchApi('/classes'); setClasses(data.classes); } catch {}
  };

  const loadStudents = async (classId: string, sectionId: string) => {
    try {
      const data = await fetchApi(`/students?class_id=${classId}&section_id=${sectionId}`);
      setStudents(data.students.map((s: any) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, admission_number: s.admission_number })));
    } catch {}
  };

  const handleApply = async () => {
    if (!applyForm.student_id || !applyForm.from_date || !applyForm.to_date || !applyForm.reason) {
      setApplyError('All fields are required'); return;
    }
    setApplyLoading(true); setApplyError('');
    try {
      await fetchApi('/attendance/leave/apply', { method: 'POST', data: { student_id: applyForm.student_id, from_date: applyForm.from_date, to_date: applyForm.to_date, reason: applyForm.reason } });
      setShowApply(false); setApplyForm({ class_id: '', section_id: '', student_id: '', from_date: '', to_date: '', reason: '' });
      loadLeaves();
    } catch (err: any) { setApplyError(err.message); } finally { setApplyLoading(false); }
  };

  const handleAction = async (id: string, status: string) => {
    try {
      await fetchApi(`/attendance/leave/${id}`, { method: 'PATCH', data: { status } });
      loadLeaves();
    } catch (err: any) { alert(err.message); }
  };

  const statusColor = (s: string) => s === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : s === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400';

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/attendance" className="text-gray-400 hover:text-white transition-colors">Mark</a>
            <a href="/attendance/report" className="text-gray-400 hover:text-white transition-colors">Reports</a>
            <a href="/leave" className="text-blue-400 font-medium">Leave</a>
            <a href="/attendance/biometric" className="text-gray-400 hover:text-white transition-colors">Biometric</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Leave Applications</h1>
          <button onClick={openApplyForm} className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-sm font-medium shadow-lg hover:shadow-blue-500/25 transition-all">+ Apply Leave</button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center cursor-pointer hover:bg-amber-500/5 transition-colors" onClick={() => setStatusFilter('pending')}>
            <p className="text-3xl font-bold text-amber-400">{leaves.filter(l => l.status === 'pending').length}</p>
            <p className="text-xs text-gray-500 uppercase mt-1">Pending</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center cursor-pointer hover:bg-emerald-500/5 transition-colors" onClick={() => setStatusFilter('approved')}>
            <p className="text-3xl font-bold text-emerald-400">{leaves.filter(l => l.status === 'approved').length}</p>
            <p className="text-xs text-gray-500 uppercase mt-1">Approved</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center cursor-pointer hover:bg-red-500/5 transition-colors" onClick={() => setStatusFilter('rejected')}>
            <p className="text-3xl font-bold text-red-400">{leaves.filter(l => l.status === 'rejected').length}</p>
            <p className="text-xs text-gray-500 uppercase mt-1">Rejected</p>
          </div>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm">
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Leave List */}
        <div className="space-y-3">
          {leaves.length === 0 ? (
            <p className="text-gray-500 text-center py-16">No leave applications found.</p>
          ) : leaves.map(l => (
            <div key={l.id} className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-center justify-between hover:bg-white/[0.07] transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-medium">{l.student.firstName} {l.student.lastName}</span>
                  <span className="text-xs text-gray-500">{l.student.class.name} - {l.student.section.name}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(l.status)}`}>{l.status}</span>
                </div>
                <p className="text-sm text-gray-400 mb-1">{l.reason}</p>
                <p className="text-xs text-gray-500">
                  {new Date(l.from_date).toLocaleDateString()} → {new Date(l.to_date).toLocaleDateString()}
                  {l.approvedBy && <span className="ml-2">• {l.status} by {l.approvedBy.firstName} {l.approvedBy.lastName}</span>}
                </p>
              </div>
              {l.status === 'pending' && (
                <div className="flex gap-2 ml-4">
                  <button onClick={() => handleAction(l.id, 'approved')} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/30 transition-colors">Approve</button>
                  <button onClick={() => handleAction(l.id, 'rejected')} className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-colors">Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* Apply Leave Modal */}
      {showApply && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowApply(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-5">Apply for Leave</h2>
            {applyError && <p className="text-red-400 text-sm mb-3 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">{applyError}</p>}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Class</label>
                  <select value={applyForm.class_id} onChange={e => { setApplyForm({ ...applyForm, class_id: e.target.value, section_id: '', student_id: '' }); setStudents([]); }} className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                    <option value="">Select Class</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {selectedClass && <div>
                  <label className="text-xs text-gray-500 mb-1 block">Section</label>
                  <select value={applyForm.section_id} onChange={e => { setApplyForm({ ...applyForm, section_id: e.target.value, student_id: '' }); if (e.target.value) loadStudents(applyForm.class_id, e.target.value); }} className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                    <option value="">Select</option>{selectedClass.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>}
              </div>
              {students.length > 0 && <div>
                <label className="text-xs text-gray-500 mb-1 block">Student</label>
                <select value={applyForm.student_id} onChange={e => setApplyForm({ ...applyForm, student_id: e.target.value })} className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="">Select Student</option>{students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admission_number})</option>)}
                </select>
              </div>}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500 mb-1 block">From Date</label>
                  <input type="date" value={applyForm.from_date} onChange={e => setApplyForm({ ...applyForm, from_date: e.target.value })} className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" style={{ colorScheme: 'dark' }} /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">To Date</label>
                  <input type="date" value={applyForm.to_date} onChange={e => setApplyForm({ ...applyForm, to_date: e.target.value })} className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" style={{ colorScheme: 'dark' }} /></div>
              </div>
              <div><label className="text-xs text-gray-500 mb-1 block">Reason</label>
                <textarea value={applyForm.reason} onChange={e => setApplyForm({ ...applyForm, reason: e.target.value })} rows={3} className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none" placeholder="Reason for leave..." /></div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowApply(false)} className="px-4 py-2 bg-white/5 rounded-lg text-sm">Cancel</button>
              <button onClick={handleApply} disabled={applyLoading} className="px-4 py-2 bg-blue-600 rounded-lg text-sm disabled:opacity-50">{applyLoading ? 'Submitting...' : 'Submit'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
