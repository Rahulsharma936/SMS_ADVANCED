'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';

interface SubjectData { id: string; name: string; code: string | null; type: string; }

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', type: 'core' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const d = await fetchApi('/subjects');
      setSubjects(d.subjects);
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      await fetchApi('/subjects', { method: 'POST', data: form });
      setForm({ name: '', code: '', type: 'core' }); setShowForm(false);
      load();
    } catch (err: any) { setError(err.message); }
  };

  const inp = "w-full bg-black/30 border border-gray-700/50 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-all";

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/classes" className="text-gray-400 hover:text-white">Classes</a>
            <a href="/students" className="text-gray-400 hover:text-white">Students</a>
            <a href="/subjects" className="text-blue-400 font-medium">Subjects</a>
            <a href="/syllabus" className="text-gray-400 hover:text-white">Syllabus</a>
            <a href="/timetable" className="text-gray-400 hover:text-white">Timetable</a>
            <a href="/calendar" className="text-gray-400 hover:text-white">Calendar</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white">Dashboard</a>
          </div>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Subjects <span className="text-gray-500 text-lg font-normal">({subjects.length})</span></h1>
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium">+ New Subject</button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white/5 border border-white/10 p-6 rounded-2xl mb-8 space-y-4">
            {error && <div className="text-red-400 text-sm">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input placeholder="Subject Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inp} />
              <input placeholder="Code (e.g. MATH101)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inp} />
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inp}>
                <option value="core">Core</option><option value="elective">Elective</option>
              </select>
            </div>
            <button type="submit" className="px-6 py-2 bg-blue-600 rounded-lg text-sm font-medium">Create Subject</button>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.length === 0 ? (
            <p className="text-gray-500 col-span-full text-center py-12">No subjects yet.</p>
          ) : subjects.map((s) => (
            <div key={s.id} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/8 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{s.name}</h3>
                  {s.code && <p className="text-gray-400 font-mono text-xs mt-0.5">{s.code}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.type === 'core' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}>{s.type}</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
