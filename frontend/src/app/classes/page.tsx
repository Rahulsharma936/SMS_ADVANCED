'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

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

  if (loading) return <div className="page-loading"><div className="spinner spinner-lg" /></div>;

  return (
    <AppLayout>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Classes & Sections
            <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '2px 8px', borderRadius: '100px' }}>
              {classes.length}
            </span>
          </h1>
          <p className="page-subtitle">Organize your school structure with classes and sections</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowSectionForm(!showSectionForm)} className="btn btn-secondary">+ Section</button>
          <button onClick={() => setShowClassForm(!showClassForm)} className="btn btn-primary">+ New Class</button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '14px' }}>{error}</div>}

      {/* Create Class Form */}
      {showClassForm && (
        <form onSubmit={handleCreateClass} className="widget" style={{ marginBottom: '16px' }}>
          <div className="widget-head">
            <span className="widget-title">Create Class</span>
            <button type="button" onClick={() => setShowClassForm(false)} className="widget-link">Cancel</button>
          </div>
          <div style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Class Name</label>
              <input type="text" placeholder="e.g. Grade 10" value={className} onChange={e => setClassName(e.target.value)} required className="input" />
            </div>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Description (optional)</label>
              <input type="text" placeholder="e.g. Senior secondary" value={classDesc} onChange={e => setClassDesc(e.target.value)} className="input" />
            </div>
            <button type="submit" disabled={formLoading} className="btn btn-primary">{formLoading ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      )}

      {/* Create Section Form */}
      {showSectionForm && (
        <form onSubmit={handleCreateSection} className="widget" style={{ marginBottom: '16px' }}>
          <div className="widget-head">
            <span className="widget-title">Create Section</span>
            <button type="button" onClick={() => setShowSectionForm(false)} className="widget-link">Cancel</button>
          </div>
          <div style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Class</label>
              <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} required className="input">
                <option value="">Select Class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Section Name</label>
              <input type="text" placeholder="e.g. A" value={sectionName} onChange={e => setSectionName(e.target.value)} required className="input" />
            </div>
            <button type="submit" disabled={formLoading} className="btn btn-primary">{formLoading ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      )}

      {/* Classes Grid */}
      {classes.length === 0 ? (
        <div className="empty-state" style={{ minHeight: '40vh' }}>
          <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="empty-state-title">No classes created yet</p>
          <p className="empty-state-desc">Classes are the foundation of your school. Create classes first, then add sections, teachers, and students.</p>
          <button onClick={() => setShowClassForm(true)} className="btn btn-primary">Create your first class</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }} className="animate-fade-in-up">
          {classes.map(c => (
            <div key={c.id} className="widget" style={{ cursor: 'default' }}>
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</h3>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-geist-mono)', color: 'var(--text-muted)', background: 'var(--bg-overlay)', padding: '2px 8px', borderRadius: '99px' }}>
                    {c._count.students} student{c._count.students !== 1 ? 's' : ''}
                  </span>
                </div>
                {c.description && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>{c.description}</p>}
                {c.sections.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {c.sections.map(s => (
                      <span key={s.id} className="badge badge-blue" style={{ fontSize: '11px' }}>{s.name}</span>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '11px', color: 'var(--text-faint)' }}>No sections — add one to start enrolling students</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
