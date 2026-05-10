'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { fetchApi } from '@/lib/api';

interface ClassData {
  id: string;
  name: string;
  description: string | null;
  sections: { id: string; name: string }[];
  _count: { students: number };
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClassForm, setShowClassForm] = useState(false);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [className, setClassName] = useState('');
  const [classDesc, setClassDesc] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const loadClasses = async () => {
    try {
      const data = await fetchApi('/classes');
      setClasses(data.classes);
    } catch (err: any) {
      if (err.message?.includes('Unauthorized')) router.push('/login');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadClasses(); }, []);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFormLoading(true);
    try {
      await fetchApi('/classes', { method: 'POST', data: { name: className, description: classDesc || null } });
      setClassName('');
      setClassDesc('');
      setShowClassForm(false);
      loadClasses();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFormLoading(true);
    try {
      await fetchApi('/classes/sections', { method: 'POST', data: { class_id: selectedClassId, name: sectionName } });
      setSectionName('');
      setShowSectionForm(false);
      loadClasses();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/classes" className="text-blue-400 font-medium">Classes</a>
            <a href="/students" className="text-gray-400 hover:text-white transition-colors">Students</a>
            <a href="/attendance" className="text-gray-400 hover:text-white transition-colors">Attendance</a>
            <a href="/timetable" className="text-gray-400 hover:text-white transition-colors">Timetable</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Classes & Sections</h1>
          <div className="flex gap-3">
            <button onClick={() => setShowClassForm(!showClassForm)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors">
              + New Class
            </button>
            <button onClick={() => setShowSectionForm(!showSectionForm)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors">
              + New Section
            </button>
          </div>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm">{error}</div>}

        {showClassForm && (
          <form onSubmit={handleCreateClass} className="bg-white/5 border border-white/10 p-6 rounded-2xl mb-8 space-y-4">
            <h3 className="text-lg font-semibold">Create Class</h3>
            <div className="grid grid-cols-2 gap-4">
              <input type="text" placeholder="Class Name (e.g. Grade 10)" value={className} onChange={(e) => setClassName(e.target.value)} required className="bg-black/30 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 placeholder-gray-500" />
              <input type="text" placeholder="Description (optional)" value={classDesc} onChange={(e) => setClassDesc(e.target.value)} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 placeholder-gray-500" />
            </div>
            <button type="submit" disabled={formLoading} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium disabled:opacity-50">
              {formLoading ? 'Creating...' : 'Create Class'}
            </button>
          </form>
        )}

        {showSectionForm && (
          <form onSubmit={handleCreateSection} className="bg-white/5 border border-white/10 p-6 rounded-2xl mb-8 space-y-4">
            <h3 className="text-lg font-semibold">Create Section</h3>
            <div className="grid grid-cols-2 gap-4">
              <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} required className="bg-black/30 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500">
                <option value="">Select Class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="text" placeholder="Section Name (e.g. A)" value={sectionName} onChange={(e) => setSectionName(e.target.value)} required className="bg-black/30 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 placeholder-gray-500" />
            </div>
            <button type="submit" disabled={formLoading} className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium disabled:opacity-50">
              {formLoading ? 'Creating...' : 'Create Section'}
            </button>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.length === 0 ? (
            <p className="text-gray-500 col-span-full text-center py-12">No classes created yet. Click "+ New Class" to get started.</p>
          ) : (
            classes.map((c) => (
              <div key={c.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                <h3 className="text-xl font-semibold mb-1">{c.name}</h3>
                {c.description && <p className="text-gray-400 text-sm mb-4">{c.description}</p>}
                <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                  <span>{c.sections.length} section{c.sections.length !== 1 ? 's' : ''}</span>
                  <span>{c._count.students} student{c._count.students !== 1 ? 's' : ''}</span>
                </div>
                {c.sections.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {c.sections.map((s) => (
                      <span key={s.id} className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-medium">{s.name}</span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
