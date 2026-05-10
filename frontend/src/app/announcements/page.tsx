'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface Announcement {
  id: string; title: string; message: string; target_type: string; target_id: string | null;
  created_at: string; expires_at: string | null;
  createdBy: { email: string };
}
interface ClassOption { id: string; name: string; }
interface SectionOption { id: string; name: string; class_id: string; }

const TARGET_COLORS: Record<string, string> = {
  school:  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  class:   'bg-blue-500/20 text-blue-400 border-blue-500/30',
  section: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

export default function AnnouncementsPage() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classes,  setClasses]   = useState<ClassOption[]>([]);
  const [sections, setSections]  = useState<SectionOption[]>([]);
  const [loading, setLoading]    = useState(true);
  const [creating, setCreating]  = useState(false);
  const [showForm, setShowForm]  = useState(false);
  const [error, setError]        = useState('');

  const [form, setForm] = useState({
    title: '', message: '', target_type: 'school', target_id: '', expires_at: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [a, cl, sc] = await Promise.all([
        fetchApi('/communication'),
        fetchApi('/classes'),
        fetchApi('/sections'),
      ]);
      setAnnouncements(a.announcements || []);
      setClasses(cl.classes || []);
      setSections(sc.sections || []);
    } catch (e: any) {
      if (e.message?.includes('Unauthorized')) router.push('/login');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setCreating(true);
    try {
      await fetchApi('/communication', {
        method: 'POST',
        data: {
          title:       form.title,
          message:     form.message,
          target_type: form.target_type,
          target_id:   form.target_id || undefined,
          expires_at:  form.expires_at || undefined,
        },
      });
      setForm({ title: '', message: '', target_type: 'school', target_id: '', expires_at: '' });
      setShowForm(false);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  };

  const filtered = sections.filter(s => s.class_id === form.target_id);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/announcements" className="text-blue-400 font-medium">Announcements</a>
            <a href="/notice-board" className="text-gray-400 hover:text-white transition-colors">Notice Board</a>
            <a href="/notifications" className="text-gray-400 hover:text-white transition-colors">Notifications</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Announcements</h1>
            <p className="text-gray-500 mt-1">Broadcast to school, class, or section</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-sm font-medium hover:shadow-blue-500/25 hover:shadow-lg transition-all">
            {showForm ? 'Cancel' : '+ New Announcement'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={submit} className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 space-y-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase">Create Announcement</h2>
            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</p>}

            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Announcement title *" required
              className="w-full bg-black/30 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500" />

            <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="Message *" required rows={4}
              className="w-full bg-black/30 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 resize-none" />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Target Audience *</label>
                <select value={form.target_type} onChange={e => setForm(f => ({ ...f, target_type: e.target.value, target_id: '' }))}
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-blue-500">
                  <option value="school">🏫 Whole School</option>
                  <option value="class">📚 Class</option>
                  <option value="section">🔷 Section</option>
                </select>
              </div>

              {form.target_type === 'class' && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Class *</label>
                  <select value={form.target_id} onChange={e => setForm(f => ({ ...f, target_id: e.target.value }))} required
                    className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-blue-500">
                    <option value="">— Select class —</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {form.target_type === 'section' && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Section *</label>
                  <select value={form.target_id} onChange={e => setForm(f => ({ ...f, target_id: e.target.value }))} required
                    className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-blue-500">
                    <option value="">— Select section —</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-500 block mb-1">Expires At</label>
                <input type="datetime-local" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  style={{ colorScheme: 'dark' }}
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-blue-500" />
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={creating}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-sm font-medium disabled:opacity-40 hover:shadow-blue-500/25 hover:shadow-lg transition-all">
                {creating ? 'Publishing…' : 'Publish Announcement'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-4">
          {announcements.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              <p>No announcements yet. Create the first one!</p>
            </div>
          ) : announcements.map(ann => (
            <div key={ann.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2.5 py-0.5 rounded-lg border capitalize font-medium ${TARGET_COLORS[ann.target_type]}`}>
                      {ann.target_type === 'school' ? '🏫 School-wide' : ann.target_type}
                    </span>
                    {ann.expires_at && new Date(ann.expires_at) < new Date() && (
                      <span className="text-xs px-2 py-0.5 rounded-lg border bg-gray-500/20 text-gray-500 border-gray-500/30">Expired</span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold mb-1">{ann.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{ann.message}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5 text-xs text-gray-600">
                <span>By {ann.createdBy.email}</span>
                <span>·</span>
                <span>{new Date(ann.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                {ann.expires_at && (
                  <>
                    <span>·</span>
                    <span>Expires {new Date(ann.expires_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
