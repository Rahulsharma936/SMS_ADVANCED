'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

interface SubjectData { id: string; name: string; code: string | null; type: string; }

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', type: 'core' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  const load = async () => {
    try {
      const d = await fetchApi('/subjects');
      setSubjects(d.subjects);
    } catch (e: any) {
      if (e.message?.includes('Unauthorized')) router.push('/login');
    } finally { setLoading(false); }
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

  if (loading) return <div className="page-loading"><div className="spinner spinner-lg" /></div>;

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Subjects
            <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '2px 8px', borderRadius: '100px' }}>
              {subjects.length}
            </span>
          </h1>
          <p className="page-subtitle">Manage the subjects taught in your school</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">+ New Subject</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="widget" style={{ marginBottom: '16px' }}>
          <div className="widget-head">
            <span className="widget-title">Create Subject</span>
            <button type="button" onClick={() => setShowForm(false)} className="widget-link">Cancel</button>
          </div>
          <div style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {error && <div className="alert alert-error" style={{ width: '100%' }}>{error}</div>}
            <div style={{ flex: 1, minWidth: '160px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Subject Name</label>
              <input placeholder="e.g. Mathematics" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="input" />
            </div>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Code</label>
              <input placeholder="e.g. MATH101" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="input" />
            </div>
            <div style={{ minWidth: '120px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="input">
                <option value="core">Core</option>
                <option value="elective">Elective</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary">Create</button>
          </div>
        </form>
      )}

      {subjects.length === 0 ? (
        <div className="empty-state" style={{ minHeight: '40vh' }}>
          <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="empty-state-title">No subjects added yet</p>
          <p className="empty-state-desc">Subjects define what is taught. Add subjects first, then assign them to teachers and classes.</p>
          <button onClick={() => setShowForm(true)} className="btn btn-primary">Add your first subject</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }} className="animate-fade-in-up">
          {subjects.map(s => (
            <div key={s.id} className="widget" style={{ cursor: 'default' }}>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                  {s.code && <div style={{ fontSize: '11px', fontFamily: 'var(--font-geist-mono)', color: 'var(--text-muted)', marginTop: '2px' }}>{s.code}</div>}
                </div>
                <span className={`badge ${s.type === 'core' ? 'badge-blue' : 'badge-purple'}`} style={{ fontSize: '10px' }}>{s.type}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
