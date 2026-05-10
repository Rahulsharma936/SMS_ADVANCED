'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface Notice {
  id: string; title: string; content: string; priority: string;
  published_at: string; expires_at: string | null;
  createdBy: { email: string };
}

const PRIORITY_CONFIG: Record<string, { label: string; badge: string; border: string; glow: string }> = {
  high:   { label: '🔴 High',   badge: 'bg-red-500/20 text-red-400 border-red-500/40',    border: 'border-red-500/30',    glow: 'shadow-red-500/10' },
  medium: { label: '🟡 Medium', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/40', border: 'border-amber-500/20', glow: 'shadow-amber-500/10' },
  low:    { label: '🟢 Low',    badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', border: 'border-emerald-500/20', glow: '' },
};

export default function NoticeBoardPage() {
  const router = useRouter();
  const [notices, setNotices]  = useState<Notice[]>([]);
  const [filter, setFilter]    = useState('');
  const [loading, setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError]       = useState('');
  const [form, setForm]         = useState({ title: '', content: '', priority: 'medium', expires_at: '' });

  const load = async (p?: string) => {
    setLoading(true);
    try {
      const d = await fetchApi(`/communication/notices${p ? `?priority=${p}` : ''}`);
      setNotices(d.notices || []);
    } catch (e: any) {
      if (e.message?.includes('Unauthorized')) router.push('/login');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setCreating(true);
    try {
      await fetchApi('/communication/notices', {
        method: 'POST',
        data: { title: form.title, content: form.content, priority: form.priority, expires_at: form.expires_at || undefined },
      });
      setForm({ title: '', content: '', priority: 'medium', expires_at: '' });
      setShowForm(false);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  };

  // Sort: high → medium → low, pinned always first
  const sorted = [...notices].sort((a, b) => {
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
  });

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/announcements" className="text-gray-400 hover:text-white transition-colors">Announcements</a>
            <a href="/notice-board" className="text-amber-400 font-medium">Notice Board</a>
            <a href="/notifications" className="text-gray-400 hover:text-white transition-colors">Notifications</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">📌 Notice Board</h1>
            <p className="text-gray-500 mt-1">Persistent pinned communications</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl text-sm font-medium hover:shadow-amber-500/25 hover:shadow-lg transition-all">
            {showForm ? 'Cancel' : '+ Post Notice'}
          </button>
        </div>

        {/* Priority filters */}
        <div className="flex gap-2 mb-6">
          {['', 'high', 'medium', 'low'].map(p => (
            <button key={p}
              onClick={() => { setFilter(p); load(p || undefined); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                filter === p
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
              }`}>
              {p === '' ? 'All' : PRIORITY_CONFIG[p].label}
            </button>
          ))}
        </div>

        {/* Create form */}
        {showForm && (
          <form onSubmit={submit} className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 space-y-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase">Post Notice</h2>
            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</p>}
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Notice title *" required
              className="w-full bg-black/30 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500" />
            <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Notice content *" required rows={5}
              className="w-full bg-black/30 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500 resize-none" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Priority</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-amber-500">
                  <option value="high">🔴 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">🟢 Low</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Expires At</label>
                <input type="datetime-local" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  style={{ colorScheme: 'dark' }}
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-amber-500" />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={creating}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl text-sm font-medium disabled:opacity-40 hover:shadow-amber-500/25 hover:shadow-lg transition-all">
                {creating ? 'Posting…' : 'Post Notice'}
              </button>
            </div>
          </form>
        )}

        {/* Notice cards */}
        <div className="space-y-4">
          {sorted.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p>No notices posted yet.</p>
            </div>
          ) : sorted.map(notice => {
            const cfg = PRIORITY_CONFIG[notice.priority] || PRIORITY_CONFIG.medium;
            const isExpired = notice.expires_at && new Date(notice.expires_at) < new Date();
            return (
              <div key={notice.id}
                className={`border rounded-2xl p-5 transition-all shadow-lg ${cfg.border} ${cfg.glow} ${isExpired ? 'opacity-50' : 'bg-white/5 hover:bg-white/[0.07]'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2.5 py-0.5 rounded-lg border font-medium ${cfg.badge}`}>{cfg.label}</span>
                      {notice.priority === 'high' && <span className="text-xs text-red-400 animate-pulse">● Urgent</span>}
                      {isExpired && <span className="text-xs text-gray-500 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded-lg">Expired</span>}
                    </div>
                    <h3 className="text-lg font-bold mb-2">{notice.title}</h3>
                    <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{notice.content}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/5 text-xs text-gray-600">
                  <span>Posted by {notice.createdBy.email}</span>
                  <span>·</span>
                  <span>{new Date(notice.published_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  {notice.expires_at && (
                    <>
                      <span>·</span>
                      <span className={isExpired ? 'text-red-600' : ''}>
                        {isExpired ? 'Expired' : 'Expires'} {new Date(notice.expires_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
