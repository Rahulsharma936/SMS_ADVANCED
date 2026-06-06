'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

interface ExamDetail {
  id: string; name: string; academic_year: string;
  start_date: string | null; end_date: string | null; status: string;
  examSubjects: { id: string; max_marks: string; passing_marks: string; weightage: string; subject: { id: string; name: string; code: string | null } }[];
  _count: { studentExams: number };
}
interface SubjectData { id: string; name: string; code: string | null }
interface ClassData { id: string; name: string; sections: { id: string; name: string }[] }

const STATUS_CFG: Record<string, string> = { draft:'badge-amber', published:'badge-green', completed:'badge-blue' };

function FieldLabel({ c }: { c: React.ReactNode }) {
  return <label style={{ display:'block', fontSize:'11px', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'5px' }}>{c}</label>;
}

export default function ExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [exam,        setExam]        = useState<ExamDetail | null>(null);
  const [allSubjects, setAllSubjects] = useState<SubjectData[]>([]);
  const [classes,     setClasses]     = useState<ClassData[]>([]);
  const [tab,         setTab]         = useState<'overview'|'subjects'|'register'>('overview');
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [msg,         setMsg]         = useState('');
  const [subjectRows, setSubjectRows] = useState<{ subject_id:string; max_marks:string; passing_marks:string; weightage:string }[]>([]);
  const [savingSubjects, setSavingSubjects] = useState(false);
  const [regClassId,  setRegClassId]  = useState('');
  const [regSectionId,setRegSectionId]= useState('');
  const [registering, setRegistering] = useState(false);

  const selectedClass = classes.find(c=>c.id===regClassId);

  const loadExam = async () => {
    try {
      const [examData, subjectData, classData] = await Promise.all([fetchApi(`/exams/${id}`), fetchApi('/subjects'), fetchApi('/classes')]);
      setExam(examData.exam); setAllSubjects(subjectData.subjects||[]); setClasses(classData.classes||[]);
      if (examData.exam.examSubjects.length > 0) {
        setSubjectRows(examData.exam.examSubjects.map((es: any)=>({ subject_id:es.subject.id, max_marks:es.max_marks, passing_marks:es.passing_marks, weightage:es.weightage })));
      } else { setSubjectRows([{ subject_id:'', max_marks:'100', passing_marks:'33', weightage:'1' }]); }
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(()=>{ loadExam(); }, [id]);

  const addSubjectRow = () => setSubjectRows([...subjectRows,{ subject_id:'', max_marks:'100', passing_marks:'33', weightage:'1' }]);
  const removeSubjectRow = (i: number) => setSubjectRows(subjectRows.filter((_,idx)=>idx!==i));
  const updateSubjectRow = (i: number, field: string, value: string) => { const rows=[...subjectRows]; (rows[i] as any)[field]=value; setSubjectRows(rows); };

  const saveSubjects = async () => {
    const valid = subjectRows.filter(r=>r.subject_id&&r.max_marks&&r.passing_marks);
    if (valid.length===0) { setError('Add at least one subject with valid marks'); return; }
    setSavingSubjects(true); setError(''); setMsg('');
    try {
      await fetchApi(`/exams/${id}/subjects`,{ method:'POST', data:{ subjects: valid.map(r=>({ subject_id:r.subject_id, max_marks:parseFloat(r.max_marks), passing_marks:parseFloat(r.passing_marks), weightage:parseFloat(r.weightage) })) }});
      setMsg('Subjects saved successfully'); loadExam();
    } catch (e: any) { setError(e.message); } finally { setSavingSubjects(false); }
  };

  const registerStudents = async () => {
    if (!regClassId||!regSectionId) { setError('Select class and section'); return; }
    setRegistering(true); setError(''); setMsg('');
    try {
      const res = await fetchApi(`/exams/${id}/register`,{ method:'POST', data:{ class_id:regClassId, section_id:regSectionId }});
      setMsg(`${res.registered} students registered successfully`); loadExam();
    } catch (e: any) { setError(e.message); } finally { setRegistering(false); }
  };

  const updateStatus = async (status: string) => {
    try { await fetchApi(`/exams/${id}`,{ method:'PATCH', data:{ status }}); loadExam(); }
    catch (e: any) { setError((e as any).message); }
  };

  if (loading) return <div className="page-loading"><div className="spinner spinner-lg"/></div>;
  if (!exam) return <AppLayout><div style={{ textAlign:'center', padding:'80px', color:'#f87171' }}>Exam not found</div></AppLayout>;

  const maxTotal = exam.examSubjects.reduce((s,es)=>s+Number(es.max_marks),0);

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          {/* Breadcrumb */}
          <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', color:'var(--text-muted)', marginBottom:'6px' }}>
            <a href="/exams" style={{ color:'var(--text-muted)', textDecoration:'none' }}>Examinations</a>
            <span style={{ color:'var(--text-faint)' }}>›</span>
            <span style={{ color:'var(--text-secondary)' }}>{exam.name}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
            <span className={`badge ${STATUS_CFG[exam.status]??'badge-gray'}`} style={{ textTransform:'capitalize', fontSize:'11px' }}>{exam.status}</span>
          </div>
          <h1 className="page-title">{exam.name}</h1>
          <p className="page-subtitle">{exam.academic_year}{exam.start_date && ` · ${new Date(exam.start_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}`}{exam.end_date && ` → ${new Date(exam.end_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}`}</p>
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {exam.status==='draft' && <button onClick={()=>updateStatus('published')} className="btn btn-secondary" style={{ fontSize:'12px', color:'#4ade80', borderColor:'rgba(74,222,128,0.3)' }}>Publish</button>}
          {exam.status==='published' && <button onClick={()=>updateStatus('completed')} className="btn btn-secondary" style={{ fontSize:'12px', color:'#60a5fa', borderColor:'rgba(96,165,250,0.3)' }}>Mark Complete</button>}
          <a href={`/marks-entry?exam_id=${id}`} className="btn btn-primary" style={{ fontSize:'12px' }}>Enter Marks</a>
          <a href={`/results?exam_id=${id}`} className="btn btn-secondary" style={{ fontSize:'12px' }}>View Results</a>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom:'14px' }}>{error}</div>}
      {msg   && <div className="alert alert-success" style={{ marginBottom:'14px' }}>{msg}</div>}

      {/* KPI strip */}
      <div className="kpi-grid" style={{ gridTemplateColumns:'repeat(3,1fr)', marginBottom:'12px' }}>
        {[
          { label:'Subjects',   value:exam.examSubjects.length, color:'#a5b4fc' },
          { label:'Students',   value:exam._count.studentExams, color:'#67e8f9' },
          { label:'Total Marks',value:maxTotal,                 color:'var(--text-primary)' },
        ].map(c=>(
          <div key={c.label} className="kpi-card">
            <div className="kpi-card-value" style={{ color:c.color }}>{c.value}</div>
            <div className="kpi-card-label">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Workflow action chips */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'16px', padding:'10px 14px', background:'var(--bg-elevated)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border-subtle)' }}>
        <span style={{ fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-faint)', alignSelf:'center', marginRight:'4px' }}>Workflow</span>
        <a href={`/marks-entry?exam_id=${id}`} className="module-chip" style={{ fontSize:'12px' }}>✏️ Marks Entry</a>
        <a href={`/results?exam_id=${id}`} className="module-chip" style={{ fontSize:'12px' }}>🏆 Results</a>
        <a href={`/report-card?exam_id=${id}`} className="module-chip" style={{ fontSize:'12px' }}>📄 Report Cards</a>
        <a href="/students" className="module-chip" style={{ fontSize:'12px' }}>👥 Students</a>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'2px', background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'3px', width:'fit-content', marginBottom:'16px' }}>
        {(['overview','subjects','register'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{ padding:'6px 16px', borderRadius:'var(--radius-md)', fontSize:'12px', fontWeight:600, textTransform:'capitalize', background:tab===t?'var(--bg-overlay)':'transparent', color:tab===t?'var(--text-primary)':'var(--text-muted)', border:'none', cursor:'pointer', transition:'all var(--transition-fast)' }}>{t}</button>
        ))}
      </div>

      {/* Overview tab */}
      {tab==='overview' && (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th style={{ textAlign:'center', color:'#4ade80' }}>Max Marks</th>
                <th style={{ textAlign:'center', color:'#fbbf24' }}>Passing</th>
                <th style={{ textAlign:'center', color:'#60a5fa' }}>Weightage</th>
              </tr>
            </thead>
            <tbody>
              {exam.examSubjects.length===0 ? (
                <tr><td colSpan={4} style={{ textAlign:'center', color:'var(--text-faint)', padding:'32px' }}>No subjects configured. Go to the Subjects tab to add them.</td></tr>
              ) : exam.examSubjects.map(es=>(
                <tr key={es.id}>
                  <td style={{ fontWeight:500 }}>{es.subject.name}{es.subject.code && <span style={{ fontSize:'11px', color:'var(--text-faint)', marginLeft:'6px' }}>({es.subject.code})</span>}</td>
                  <td style={{ textAlign:'center', fontWeight:600, fontFamily:'var(--font-geist-mono)', color:'#4ade80' }}>{Number(es.max_marks)}</td>
                  <td style={{ textAlign:'center', fontWeight:600, fontFamily:'var(--font-geist-mono)', color:'#fbbf24' }}>{Number(es.passing_marks)}</td>
                  <td style={{ textAlign:'center', color:'#60a5fa' }}>{Number(es.weightage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Subjects tab */}
      {tab==='subjects' && (
        <div className="card" style={{ padding:'18px 20px' }}>
          <p style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'14px' }}>Configure subjects with their max marks and passing criteria.</p>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'14px', maxHeight:'360px', overflowY:'auto' }}>
            {subjectRows.map((row,i)=>(
              <div key={i} style={{ display:'grid', gridTemplateColumns:'3fr 2fr 2fr 1fr auto', gap:'8px', alignItems:'center', background:'var(--bg-overlay)', borderRadius:'var(--radius-md)', padding:'8px 10px' }}>
                <div>
                  {i===0 && <div style={{ fontSize:'10px', fontWeight:700, textTransform:'uppercase', color:'var(--text-faint)', marginBottom:'4px' }}>Subject</div>}
                  <select value={row.subject_id} onChange={e=>updateSubjectRow(i,'subject_id',e.target.value)} className="input" style={{ width:'100%', fontSize:'12px', padding:'6px 8px' }}>
                    <option value="">Select</option>
                    {allSubjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  {i===0 && <div style={{ fontSize:'10px', fontWeight:700, textTransform:'uppercase', color:'var(--text-faint)', marginBottom:'4px' }}>Max Marks</div>}
                  <input type="number" value={row.max_marks} onChange={e=>updateSubjectRow(i,'max_marks',e.target.value)} className="input" style={{ width:'100%', fontSize:'12px', padding:'6px 8px' }}/>
                </div>
                <div>
                  {i===0 && <div style={{ fontSize:'10px', fontWeight:700, textTransform:'uppercase', color:'var(--text-faint)', marginBottom:'4px' }}>Passing</div>}
                  <input type="number" value={row.passing_marks} onChange={e=>updateSubjectRow(i,'passing_marks',e.target.value)} className="input" style={{ width:'100%', fontSize:'12px', padding:'6px 8px' }}/>
                </div>
                <div>
                  {i===0 && <div style={{ fontSize:'10px', fontWeight:700, textTransform:'uppercase', color:'var(--text-faint)', marginBottom:'4px' }}>Wt.</div>}
                  <input type="number" value={row.weightage} onChange={e=>updateSubjectRow(i,'weightage',e.target.value)} className="input" style={{ width:'100%', fontSize:'12px', padding:'6px 8px' }}/>
                </div>
                <button onClick={()=>removeSubjectRow(i)} className="btn btn-ghost" style={{ padding:'4px 8px', color:'#f87171', marginTop: i===0?'18px':0 }}>✕</button>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <button onClick={addSubjectRow} className="btn btn-ghost" style={{ fontSize:'12px' }}>+ Add Subject</button>
            <button onClick={saveSubjects} disabled={savingSubjects} className="btn btn-primary">
              {savingSubjects?<><div className="spinner" style={{ width:'13px',height:'13px',borderWidth:'2px' }}/> Saving…</>:'Save Configuration'}
            </button>
          </div>
        </div>
      )}

      {/* Register tab */}
      {tab==='register' && (
        <div className="card" style={{ padding:'18px 20px' }}>
          <p style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'14px' }}>Register all active students from a class/section for this exam. Currently <strong style={{ color:'var(--text-primary)' }}>{exam._count.studentExams}</strong> students registered.</p>
          <div style={{ display:'flex', gap:'12px', alignItems:'flex-end', flexWrap:'wrap' }}>
            <div style={{ minWidth:'160px' }}>
              <FieldLabel c="Class"/>
              <select value={regClassId} onChange={e=>{ setRegClassId(e.target.value); setRegSectionId(''); }} className="input" style={{ width:'100%' }}>
                <option value="">Select</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {selectedClass && (
              <div style={{ minWidth:'130px' }}>
                <FieldLabel c="Section"/>
                <select value={regSectionId} onChange={e=>setRegSectionId(e.target.value)} className="input" style={{ width:'100%' }}>
                  <option value="">Select</option>{selectedClass.sections.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <button onClick={registerStudents} disabled={registering||!regClassId||!regSectionId} className="btn btn-primary">
              {registering?<><div className="spinner" style={{ width:'13px',height:'13px',borderWidth:'2px' }}/> Registering…</>:'Register Students'}
            </button>
          </div>
        </div>
      )}

      {/* Bottom shortcuts */}
      <div style={{ display:'flex', gap:'8px', marginTop:'20px' }}>
        <a href={`/report-card?exam_id=${id}`} className="btn btn-ghost" style={{ fontSize:'12px' }}>📄 Report Cards</a>
      </div>
    </AppLayout>
  );
}
