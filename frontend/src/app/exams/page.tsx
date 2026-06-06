'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

interface ExamData {
  id: string; name: string; academic_year: string;
  start_date: string | null; end_date: string | null; status: string;
  examSubjects: { id: string; max_marks: number; subject: { name: string } }[];
  _count: { studentExams: number };
}

const STATUS_CFG: Record<string, string> = { draft: 'badge-amber', published: 'badge-green', completed: 'badge-blue' };

function FieldLabel({ c }: { c: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '5px' }}>{c}</label>;
}

export default function ExamsPage() {
  const [exams,      setExams]      = useState<ExamData[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form,       setForm]       = useState({ name: '', academic_year: '2025-2026', start_date: '', end_date: '', status: 'draft' });
  const [creating,   setCreating]   = useState(false);
  const [error,      setError]      = useState('');
  const router = useRouter();

  const loadExams = async () => {
    try { const d = await fetchApi('/exams'); setExams(d.exams); }
    catch (e: any) { if (e.message?.includes('Unauthorized')) router.push('/login'); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadExams(); }, [router]);

  const handleCreate = async () => {
    if (!form.name || !form.academic_year) { setError('Name and academic year are required'); return; }
    setCreating(true); setError('');
    try {
      await fetchApi('/exams', { method: 'POST', data: form });
      setShowCreate(false);
      setForm({ name: '', academic_year: '2025-2026', start_date: '', end_date: '', status: 'draft' });
      loadExams();
    } catch (e: any) { setError(e.message); } finally { setCreating(false); }
  };

  if (loading) return <div className="page-loading"><div className="spinner spinner-lg"/></div>;

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Examinations</h1>
          <p className="page-subtitle">{exams.length} exam{exams.length !== 1 ? 's' : ''} · <a href="/marks-entry" style={{ color: 'var(--brand-primary)' }}>Marks Entry</a> · <a href="/results" style={{ color: 'var(--brand-primary)' }}>Results</a></p>
        </div>
        <button onClick={() => { setShowCreate(true); setError(''); }} className="btn btn-primary">
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          Create Exam
        </button>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: '16px' }}>
        {[{ s:'draft',color:'#fbbf24',l:'Draft'},{s:'published',color:'#4ade80',l:'Published'},{s:'completed',color:'#60a5fa',l:'Completed'}].map(c=>(
          <div key={c.s} className="kpi-card">
            <div className="kpi-card-value" style={{ color: c.color }}>{exams.filter(e=>e.status===c.s).length}</div>
            <div className="kpi-card-label">{c.l}</div>
          </div>
        ))}
      </div>

      {exams.length === 0 ? (
        <div className="empty-state" style={{ minHeight:'40vh' }}>
          <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <p className="empty-state-title">No exams yet</p>
          <p className="empty-state-desc">Create your first exam to configure subjects and register students.</p>
          <button onClick={()=>setShowCreate(true)} className="btn btn-primary">Create Exam</button>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'12px' }}>
          {exams.map(exam => {
            const maxTotal = exam.examSubjects.reduce((s,es)=>s+Number(es.max_marks),0);
            return (
              <div key={exam.id} className="card" style={{ padding:'16px 18px', cursor:'pointer' }} onClick={()=>router.push(`/exams/${exam.id}`)}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'10px' }}>
                  <div style={{ flex:1, minWidth:0, marginRight:'8px' }}>
                    <h3 style={{ fontWeight:600, fontSize:'14px', color:'var(--text-primary)', marginBottom:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{exam.name}</h3>
                    <span style={{ fontSize:'11px', color:'var(--text-faint)', fontFamily:'var(--font-geist-mono)' }}>{exam.academic_year}</span>
                  </div>
                  <span className={`badge ${STATUS_CFG[exam.status]??'badge-gray'}`} style={{ fontSize:'10px', flexShrink:0, textTransform:'capitalize' }}>{exam.status}</span>
                </div>
                {exam.start_date && (
                  <div style={{ fontSize:'11px', color:'var(--text-faint)', marginBottom:'8px' }}>
                    {new Date(exam.start_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}
                    {exam.end_date && ` → ${new Date(exam.end_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}`}
                  </div>
                )}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:'var(--text-secondary)', marginBottom:'10px' }}>
                  <span><span style={{ color:'#a5b4fc', fontWeight:600 }}>{exam.examSubjects.length}</span> subjects · {maxTotal} marks</span>
                  <span><span style={{ color:'#67e8f9', fontWeight:600 }}>{exam._count.studentExams}</span> students</span>
                </div>
                {exam.examSubjects.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginBottom:'10px' }}>
                    {exam.examSubjects.slice(0,3).map((es,i)=><span key={i} className="badge badge-blue" style={{ fontSize:'10px' }}>{es.subject.name}</span>)}
                    {exam.examSubjects.length>3 && <span className="badge badge-gray" style={{ fontSize:'10px' }}>+{exam.examSubjects.length-3}</span>}
                  </div>
                )}
                <div style={{ display:'flex', gap:'6px', paddingTop:'10px', borderTop:'1px solid var(--border-subtle)' }}>
                  <a href={`/marks-entry?exam_id=${exam.id}`} onClick={e=>e.stopPropagation()} className="btn btn-ghost" style={{ flex:1, justifyContent:'center', fontSize:'11px', padding:'5px' }}>Enter Marks</a>
                  <a href={`/results?exam_id=${exam.id}`} onClick={e=>e.stopPropagation()} className="btn btn-ghost" style={{ flex:1, justifyContent:'center', fontSize:'11px', padding:'5px' }}>Results</a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="modal-backdrop" onClick={()=>setShowCreate(false)}>
          <div className="modal-box" style={{ maxWidth:'440px' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'18px' }}>
              <h2 style={{ fontSize:'15px', fontWeight:700 }}>Create Exam</h2>
              <button onClick={()=>setShowCreate(false)} className="btn btn-ghost" style={{ padding:'4px 8px' }}>✕</button>
            </div>
            {error && <div className="alert alert-error" style={{ marginBottom:'12px' }}>{error}</div>}
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <div><FieldLabel c="Exam Name *"/><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Midterm 2026" className="input" style={{ width:'100%' }}/></div>
              <div><FieldLabel c="Academic Year *"/><input value={form.academic_year} onChange={e=>setForm({...form,academic_year:e.target.value})} placeholder="2025-2026" className="input" style={{ width:'100%' }}/></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div><FieldLabel c="Start Date"/><input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})} className="input" style={{ width:'100%', colorScheme:'dark' }}/></div>
                <div><FieldLabel c="End Date"/><input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})} className="input" style={{ width:'100%', colorScheme:'dark' }}/></div>
              </div>
              <div><FieldLabel c="Status"/><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="input" style={{ width:'100%' }}><option value="draft">Draft</option><option value="published">Published</option></select></div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', marginTop:'18px', paddingTop:'14px', borderTop:'1px solid var(--border-subtle)' }}>
              <button onClick={()=>setShowCreate(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={handleCreate} disabled={creating} className="btn btn-primary">
                {creating?<><div className="spinner" style={{ width:'13px',height:'13px',borderWidth:'2px' }}/> Creating…</>:'Create Exam'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
