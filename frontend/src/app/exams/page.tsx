'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface ExamData {
  id: string; name: string; academic_year: string;
  start_date: string | null; end_date: string | null; status: string;
  examSubjects: { id: string; max_marks: number; subject: { name: string } }[];
  _count: { studentExams: number };
}

const statusColor = (s: string) =>
  s === 'published' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
  s === 'completed' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
  'bg-amber-500/20 text-amber-400 border-amber-500/30';

export default function ExamsPage() {
  const [exams, setExams] = useState<ExamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', academic_year: '', start_date: '', end_date: '', status: 'draft' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const loadExams = async () => {
    try { const d = await fetchApi('/exams'); setExams(d.exams); }
    catch (e: any) { if (e.message?.includes('Unauthorized')) router.push('/login'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadExams(); }, []);

  const handleCreate = async () => {
    if (!form.name || !form.academic_year) { setError('Name and academic year are required'); return; }
    setCreating(true); setError('');
    try {
      await fetchApi('/exams', { method: 'POST', data: form });
      setShowCreate(false);
      setForm({ name: '', academic_year: '', start_date: '', end_date: '', status: 'draft' });
      loadExams();
    } catch (e: any) { setError(e.message); } finally { setCreating(false); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/exams" className="text-blue-400 font-medium">Exams</a>
            <a href="/marks-entry" className="text-gray-400 hover:text-white transition-colors">Marks Entry</a>
            <a href="/results" className="text-gray-400 hover:text-white transition-colors">Results</a>
            <a href="/report-card" className="text-gray-400 hover:text-white transition-colors">Report Card</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Examinations</h1>
            <p className="text-gray-500 mt-1">{exams.length} exams configured</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-sm font-medium shadow-lg hover:shadow-blue-500/25 transition-all hover:scale-105">
            + Create Exam
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {['draft','published','completed'].map(s => (
            <div key={s} className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
              <p className={`text-3xl font-bold ${s==='published'?'text-emerald-400':s==='completed'?'text-blue-400':'text-amber-400'}`}>
                {exams.filter(e => e.status === s).length}
              </p>
              <p className="text-xs text-gray-500 uppercase mt-1 capitalize">{s}</p>
            </div>
          ))}
        </div>

        {/* Exam Cards */}
        {exams.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg mb-2">No exams yet</p>
            <button onClick={() => setShowCreate(true)} className="text-blue-400 hover:underline text-sm">Create your first exam</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {exams.map(exam => (
              <div key={exam.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] transition-colors cursor-pointer group"
                onClick={() => router.push(`/exams/${exam.id}`)}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg group-hover:text-blue-400 transition-colors">{exam.name}</h3>
                    <p className="text-gray-500 text-sm">{exam.academic_year}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${statusColor(exam.status)}`}>{exam.status}</span>
                </div>
                <div className="space-y-2 text-sm text-gray-400">
                  <div className="flex justify-between">
                    <span>Subjects</span>
                    <span className="text-purple-400 font-medium">{exam.examSubjects.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Students Registered</span>
                    <span className="text-cyan-400 font-medium">{exam._count.studentExams}</span>
                  </div>
                  {exam.start_date && (
                    <div className="flex justify-between">
                      <span>Start</span>
                      <span>{new Date(exam.start_date).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {exam.examSubjects.slice(0,3).map((es,i) => (
                    <span key={i} className="px-2 py-0.5 bg-purple-500/15 text-purple-300 rounded text-xs">{es.subject.name}</span>
                  ))}
                  {exam.examSubjects.length > 3 && <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded text-xs">+{exam.examSubjects.length-3}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-5">Create Exam</h2>
            {error && <p className="text-red-400 text-sm mb-3 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">{error}</p>}
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500 mb-1 block">Exam Name *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Midterm 2026" className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Academic Year *</label>
                <input value={form.academic_year} onChange={e => setForm({...form, academic_year: e.target.value})} placeholder="2025-2026" className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-gray-500 mb-1 block">Start Date</label>
                  <input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm" style={{colorScheme:'dark'}} /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">End Date</label>
                  <input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm" style={{colorScheme:'dark'}} /></div>
              </div>
              <div><label className="text-xs text-gray-500 mb-1 block">Status</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm">
                  <option value="draft">Draft</option><option value="published">Published</option>
                </select></div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-white/5 rounded-lg text-sm">Cancel</button>
              <button onClick={handleCreate} disabled={creating} className="px-4 py-2 bg-blue-600 rounded-lg text-sm disabled:opacity-50">{creating ? 'Creating...' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
