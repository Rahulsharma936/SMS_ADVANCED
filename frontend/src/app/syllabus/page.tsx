'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';

interface ClassData { id: string; name: string; sections: { id: string; name: string }[]; }
interface SubjectData { id: string; name: string; code: string | null; type: string; }
interface SyllabusData {
  id: string; title: string; academic_year: string; file_url: string | null;
  subject: { name: string; code: string | null }; class: { name: string };
  topics: { id: string; topic_name: string; order_index: number }[];
}

export default function SyllabusPage() {
  const [syllabi, setSyllabi] = useState<SyllabusData[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filterClass, setFilterClass] = useState('');
  const [form, setForm] = useState({ subject_id: '', class_id: '', title: '', description: '', academic_year: '2025-2026', topicsText: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [s, c, sub] = await Promise.all([fetchApi('/syllabus'), fetchApi('/classes'), fetchApi('/subjects')]);
      setSyllabi(s.syllabi); setClasses(c.classes); setSubjects(sub.subjects);
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    const topics = form.topicsText.split('\n').filter((t) => t.trim());
    try {
      await fetchApi('/syllabus', { method: 'POST', data: { ...form, topics, topicsText: undefined } });
      setShowForm(false); setForm({ subject_id: '', class_id: '', title: '', description: '', academic_year: '2025-2026', topicsText: '' });
      load();
    } catch (err: any) { setError(err.message); }
  };

  const filtered = filterClass ? syllabi.filter((s) => s.class.name === filterClass) : syllabi;
  const inp = "w-full bg-black/30 border border-gray-700/50 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-all";

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/classes" className="text-gray-400 hover:text-white">Classes</a>
            <a href="/subjects" className="text-gray-400 hover:text-white">Subjects</a>
            <a href="/syllabus" className="text-blue-400 font-medium">Syllabus</a>
            <a href="/timetable" className="text-gray-400 hover:text-white">Timetable</a>
            <a href="/calendar" className="text-gray-400 hover:text-white">Calendar</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white">Dashboard</a>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Syllabus Management</h1>
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium">+ New Syllabus</button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white/5 border border-white/10 p-6 rounded-2xl mb-8 space-y-4">
            {error && <div className="text-red-400 text-sm">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} required className={inp}><option value="">Select Class</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} required className={inp}><option value="">Select Subject</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <input placeholder="Academic Year (2025-2026)" value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} className={inp} />
            </div>
            <input placeholder="Syllabus Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className={inp} />
            <input placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inp} />
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Topics (one per line)</label>
              <textarea value={form.topicsText} onChange={(e) => setForm({ ...form, topicsText: e.target.value })} rows={5} placeholder={"Chapter 1: Introduction\nChapter 2: Basics\nChapter 3: Advanced"} className={inp + ' resize-none'} />
            </div>
            <button type="submit" className="px-6 py-2 bg-blue-600 rounded-lg text-sm font-medium">Create Syllabus</button>
          </form>
        )}

        {/* Filter */}
        <div className="mb-6">
          <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm">
            <option value="">All Classes</option>
            {[...new Set(syllabi.map((s) => s.class.name))].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Syllabi List */}
        {filtered.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No syllabi yet. Create one to get started.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map((s) => (
              <div key={s.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/8 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold">{s.title}</h3>
                    <p className="text-sm text-gray-400">{s.subject.name} ({s.subject.code}) • {s.class.name}</p>
                  </div>
                  <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">{s.academic_year}</span>
                </div>
                {s.topics.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 uppercase mb-2">{s.topics.length} Topics</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {s.topics.map((t, i) => (
                        <div key={t.id} className="flex items-center gap-2 text-sm text-gray-300">
                          <span className="text-xs text-gray-600 w-5">{i + 1}.</span>
                          {t.topic_name}
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
    </div>
  );
}
