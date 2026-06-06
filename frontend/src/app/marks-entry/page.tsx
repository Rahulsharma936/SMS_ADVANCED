'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

interface ExamData { id: string; name: string; academic_year: string; examSubjects: { id: string; max_marks: string; passing_marks: string; subject: { name: string } }[] }
interface ClassData { id: string; name: string; sections: { id: string; name: string }[] }
interface StudentRow { student_id: string; name: string; roll: string | null; marks: Record<string, { value: string; is_absent: boolean }> }

function FL({ c }: { c: string }) {
  return <label style={{ display:'block', fontSize:'10px', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-faint)', marginBottom:'5px' }}>{c}</label>;
}

function MarksEntryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [exams,    setExams]    = useState<ExamData[]>([]);
  const [classes,  setClasses]  = useState<ClassData[]>([]);
  const [examId,   setExamId]   = useState(searchParams.get('exam_id')||'');
  const [classId,  setClassId]  = useState('');
  const [sectionId,setSectionId]= useState('');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [msg,      setMsg]      = useState('');
  const [savedSnap, setSavedSnap] = useState('');
  const [registeredCount, setRegisteredCount] = useState(0);
  const [isRegistering, setIsRegistering] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const selectedExam  = exams.find(e=>e.id===examId);
  const selectedClass = classes.find(c=>c.id===classId);
  const currentSnap   = JSON.stringify(students.map(s=>({id:s.student_id,m:s.marks})));
  const hasUnsaved    = students.length>0 && savedSnap!=='' && currentSnap!==savedSnap;
  const unregisteredCount = students.length - registeredCount;

  useEffect(()=>{
    Promise.all([fetchApi('/exams'),fetchApi('/classes')])
      .then(([ed,cd])=>{ setExams(ed.exams); setClasses(cd.classes); })
      .catch(e=>{ if(e.message?.includes('Unauthorized')) router.push('/login'); })
      .finally(()=>setLoading(false));
  },[router]);

  useEffect(()=>{
    if (!examId||!classId||!sectionId||!selectedExam) return;
    setLoadingStudents(true); setSavedSnap(''); setError(''); setRegisteredCount(0);
    (async()=>{
      try {
        const data = await fetchApi(`/students?class_id=${classId}&section_id=${sectionId}`);
        const subjects = selectedExam.examSubjects;
        const rows: StudentRow[] = [];
        let regCount = 0;
        for (const s of data.students) {
          const m: Record<string,{value:string;is_absent:boolean}> = {};
          subjects.forEach(es=>{ m[es.id]={value:'',is_absent:false}; });
          try {
            const ex = await fetchApi(`/exams/${examId}/marks/student/${s.id}`);
            ex.data?.marksEntries?.forEach((me:any)=>{ m[me.exam_subject_id]={value:me.is_absent?'':String(Number(me.marks_obtained)),is_absent:me.is_absent}; });
            regCount++;
          } catch {}
          rows.push({student_id:s.id,name:`${s.firstName} ${s.lastName}`,roll:s.roll_number,marks:m});
        }
        setStudents(rows);
        setRegisteredCount(regCount);
        setSavedSnap(JSON.stringify(rows.map(s=>({id:s.student_id,m:s.marks}))));
      } catch(e:any){ setError(e.message); }
      finally { setLoadingStudents(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[examId,classId,sectionId,reloadTrigger]);

  const registerForExam = async () => {
    if (!examId||!classId||!sectionId) return;
    setIsRegistering(true); setError(''); setMsg('');
    try {
      const res = await fetchApi(`/exams/${examId}/register`,{ method:'POST', data:{ class_id:classId, section_id:sectionId }});
      setMsg(`✓ ${res.registered} students registered for this exam. Loading marks grid…`);
      setTimeout(()=>setMsg(''),5000);
      setReloadTrigger(prev=>prev+1);
    } catch(e:any){ setError(e.message); } finally { setIsRegistering(false); }
  };

  const updateMarks = (sid:string,esId:string,val:string) =>
    setStudents(p=>p.map(s=>s.student_id===sid?{...s,marks:{...s.marks,[esId]:{...s.marks[esId],value:val}}}:s));

  const toggleAbsent = (sid:string,esId:string) =>
    setStudents(p=>p.map(s=>s.student_id===sid?{...s,marks:{...s.marks,[esId]:{value:'',is_absent:!s.marks[esId].is_absent}}}:s));

  const handleSave = async () => {
    if (!selectedExam) return;
    if (registeredCount===0 && students.length>0) {
      setError('Cannot save — students are not registered for this exam. Click "Register Students for Exam" first.');
      return;
    }
    setError(''); setMsg(''); setSaving(true);
    try {
      const entries:any[]=[];
      students.forEach(s=>{ Object.entries(s.marks).forEach(([esId,m])=>{ entries.push({student_id:s.student_id,exam_subject_id:esId,marks_obtained:m.is_absent?0:parseFloat(m.value)||0,is_absent:m.is_absent}); }); });
      const res = await fetchApi(`/exams/${examId}/marks`,{method:'POST',data:{entries}});
      if (res.count===0) {
        setError('No marks were saved. Students may not be registered for this exam. Please register them first.');
      } else {
        setMsg(`✓ ${res.count} marks entries saved successfully!`);
        setSavedSnap(currentSnap);
        setTimeout(()=>setMsg(''),4000);
      }
    } catch(e:any){ setError(e.message); } finally { setSaving(false); }
  };

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{ if((e.ctrlKey||e.metaKey)&&e.key==='s'){ e.preventDefault(); handleSave(); }};
    window.addEventListener('keydown',h);
    return()=>window.removeEventListener('keydown',h);
  },[students,examId]);

  if (loading) return <div className="page-loading"><div className="spinner spinner-lg"/></div>;
  const ctx = examId&&classId&&sectionId;

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          {/* Breadcrumb */}
          <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'11px',color:'var(--text-muted)',marginBottom:'4px'}}>
            <a href="/exams" style={{color:'var(--text-muted)',textDecoration:'none'}}>Examinations</a>
            <span style={{color:'var(--text-faint)'}}>›</span>
            <span>Marks Entry</span>
          </div>
          <h1 className="page-title">Marks Entry</h1>
          <p className="page-subtitle">
            {ctx&&selectedExam?<><span style={{color:'var(--text-primary)',fontWeight:500}}>{selectedExam.name}</span> · {selectedClass?.name} · {selectedClass?.sections.find(s=>s.id===sectionId)?.name}</>:'Select exam, class and section to begin'}
          </p>
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          <a href="/exams" className="btn btn-ghost" style={{fontSize:'12px'}}>← Exams</a>
          {examId && <a href={`/results?exam_id=${examId}`} className="btn btn-secondary" style={{fontSize:'12px'}}>View Results</a>}
        </div>
      </div>

      {error && <div className="alert alert-error" style={{marginBottom:'12px'}}>{error}</div>}
      {msg   && <div className="alert alert-success" style={{marginBottom:'12px'}}>{msg}</div>}

      <div className="card" style={{padding:'14px 18px',marginBottom:'14px',display:'flex',flexWrap:'wrap',gap:'14px',alignItems:'flex-end'}}>
        <div style={{minWidth:'200px'}}>
          <FL c="Exam"/>
          <select value={examId} onChange={e=>setExamId(e.target.value)} className="input" style={{width:'100%'}}>
            <option value="">Select exam</option>
            {exams.map(e=><option key={e.id} value={e.id}>{e.name} ({e.academic_year})</option>)}
          </select>
        </div>
        <div style={{minWidth:'140px'}}>
          <FL c="Class"/>
          <select value={classId} onChange={e=>{setClassId(e.target.value);setSectionId('');}} className="input" style={{width:'100%'}}>
            <option value="">Select class</option>
            {classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {selectedClass && (
          <div style={{minWidth:'120px'}}>
            <FL c="Section"/>
            <select value={sectionId} onChange={e=>setSectionId(e.target.value)} className="input" style={{width:'100%'}}>
              <option value="">Select</option>
              {selectedClass.sections.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {!ctx && (
        <div className="empty-state" style={{minHeight:'36vh'}}>
          <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          <p className="empty-state-title">Select context to begin</p>
          <p className="empty-state-desc">Choose an exam, class and section to load the marks grid.</p>
        </div>
      )}

      {ctx && loadingStudents && (
        <div className="data-table-wrap" style={{padding:'40px',display:'flex',flexDirection:'column',alignItems:'center',gap:'10px'}}>
          <div className="spinner"/>
          <span style={{fontSize:'12px',color:'var(--text-muted)'}}>Loading students and existing marks…</span>
        </div>
      )}

      {ctx && !loadingStudents && students.length===0 && (
        <div className="empty-state" style={{minHeight:'26vh'}}>
          <p className="empty-state-title">No students in this section</p>
          <p className="empty-state-desc">Register students for this exam first.</p>
          {examId && <a href={`/exams/${examId}`} className="btn btn-secondary" style={{fontSize:'12px'}}>Register Students →</a>}
        </div>
      )}

      {ctx && !loadingStudents && students.length>0 && selectedExam && (
        <>
          {/* Registration status warning */}
          {unregisteredCount>0 && (
            <div style={{padding:'14px 18px',marginBottom:'12px',borderRadius:'var(--radius-lg)',background:registeredCount===0?'rgba(239,68,68,0.08)':'rgba(245,158,11,0.08)',border:`1px solid ${registeredCount===0?'rgba(239,68,68,0.25)':'rgba(245,158,11,0.25)'}`,display:'flex',alignItems:'flex-start',gap:'12px',flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:'200px'}}>
                <div style={{fontWeight:600,fontSize:'13px',color:registeredCount===0?'#f87171':'#fbbf24',marginBottom:'4px',display:'flex',alignItems:'center',gap:'6px'}}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                  {registeredCount===0?'Students Not Registered for This Exam':`${unregisteredCount} of ${students.length} Students Not Registered`}
                </div>
                <p style={{fontSize:'12px',color:'var(--text-muted)',margin:0,lineHeight:'1.5'}}>
                  {registeredCount===0
                    ? 'None of these students have been registered for this exam. You must register them before marks can be entered or saved.'
                    : `${registeredCount} student${registeredCount!==1?'s are':' is'} registered. ${unregisteredCount} student${unregisteredCount!==1?'s need':' needs'} registration before their marks can be saved.`}
                </p>
              </div>
              <button onClick={registerForExam} disabled={isRegistering} className="btn btn-primary" style={{flexShrink:0,whiteSpace:'nowrap'}}>
                {isRegistering?<><div className="spinner" style={{width:'13px',height:'13px',borderWidth:'2px'}}/> Registering…</>:'Register Students for Exam'}
              </button>
            </div>
          )}
          <div style={{overflowX:'auto',borderRadius:'var(--radius-lg)',border:'1px solid var(--border-default)',marginBottom:'12px',background:'var(--bg-elevated)'}}>
            <table style={{minWidth:'100%',fontSize:'13px',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'1px solid var(--border-default)',background:'var(--bg-overlay)'}}>
                  <th style={{padding:'10px 12px',textAlign:'left',fontSize:'10px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--text-faint)',position:'sticky',left:0,background:'var(--bg-overlay)',zIndex:10,minWidth:'48px'}}>Roll</th>
                  <th style={{padding:'10px 14px',textAlign:'left',fontSize:'10px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--text-faint)',position:'sticky',left:'48px',background:'var(--bg-overlay)',zIndex:10,minWidth:'150px'}}>Student</th>
                  {selectedExam.examSubjects.map(es=>(
                    <th key={es.id} style={{padding:'10px 12px',textAlign:'center',fontSize:'10px',fontWeight:700,color:'var(--text-faint)',minWidth:'120px',whiteSpace:'nowrap'}}>
                      <div style={{color:'var(--text-secondary)'}}>{es.subject.name}</div>
                      <div style={{fontWeight:500,marginTop:'1px'}}>/{Number(es.max_marks)}</div>
                    </th>
                  ))}
                  <th style={{padding:'10px 12px',textAlign:'center',fontSize:'10px',fontWeight:700,textTransform:'uppercase',color:'var(--text-faint)',minWidth:'80px'}}>Total</th>
                </tr>
              </thead>
              <tbody>
                {students.map(student=>{
                  const total = selectedExam.examSubjects.reduce((sum,es)=>{ const m=student.marks[es.id]; return sum+(!m?.is_absent&&m?.value?parseFloat(m.value)||0:0); },0);
                  const maxTotal = selectedExam.examSubjects.reduce((s,es)=>s+Number(es.max_marks),0);
                  const pct = maxTotal>0?Math.round((total/maxTotal)*100):0;
                  return (
                    <tr key={student.student_id} style={{borderBottom:'1px solid var(--border-subtle)'}}>
                      <td style={{padding:'8px 12px',color:'var(--text-faint)',fontFamily:'var(--font-geist-mono)',fontSize:'11px',position:'sticky',left:0,background:'var(--bg-elevated)',zIndex:5}}>{student.roll||'—'}</td>
                      <td style={{padding:'8px 14px',fontWeight:500,position:'sticky',left:'48px',background:'var(--bg-elevated)',zIndex:5,minWidth:'150px'}}>
                        <a href={`/students/${student.student_id}`}
                          style={{color:'var(--text-primary)',textDecoration:'none',fontWeight:500}}
                          onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color='var(--brand-primary)'}
                          onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color='var(--text-primary)'}
                          title="View student profile"
                        >{student.name}</a>
                      </td>
                      {selectedExam.examSubjects.map(es=>{
                        const m=student.marks[es.id];
                        const maxM=Number(es.max_marks);
                        const val=parseFloat(m?.value)||0;
                        const isOver=!m?.is_absent&&m?.value!==''&&val>maxM;
                        return (
                          <td key={es.id} style={{padding:'6px 8px',textAlign:'center'}}>
                            {m?.is_absent?(
                              <button onClick={()=>toggleAbsent(student.student_id,es.id)} style={{padding:'4px 10px',background:'rgba(239,68,68,0.12)',color:'#f87171',border:'1px solid rgba(239,68,68,0.25)',borderRadius:'var(--radius-sm)',fontSize:'11px',fontWeight:700,cursor:'pointer',width:'100%'}}>ABS</button>
                            ):(
                              <div style={{display:'flex',gap:'4px',justifyContent:'center'}}>
                                <input type="number" min="0" max={maxM} step="0.5" value={m?.value||''} onChange={e=>updateMarks(student.student_id,es.id,e.target.value)}
                                  style={{width:'56px',textAlign:'center',background:'var(--bg-overlay)',border:`1px solid ${isOver?'#f87171':'var(--border-default)'}`,borderRadius:'var(--radius-sm)',padding:'4px 6px',color:isOver?'#f87171':'var(--text-primary)',fontSize:'13px',outline:'none'}}
                                  placeholder="—" title={isOver?`Max is ${maxM}`:''}/>
                                <button onClick={()=>toggleAbsent(student.student_id,es.id)} title="Mark Absent"
                                  style={{padding:'4px 7px',background:'var(--bg-overlay)',color:'var(--text-faint)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',fontSize:'11px',cursor:'pointer',fontWeight:700}}>A</button>
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td style={{padding:'8px 12px',textAlign:'center'}}>
                        <span style={{fontWeight:700,fontFamily:'var(--font-geist-mono)',color:pct>=33?'#4ade80':'#f87171',fontSize:'12px'}}>{total}/{maxTotal}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px 16px',background:'var(--bg-elevated)',border:`1px solid ${hasUnsaved?'rgba(245,158,11,0.3)':'var(--border-default)'}`,borderRadius:'var(--radius-lg)',transition:'border-color var(--transition-fast)'}}>
            {hasUnsaved && <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'#fbbf24'}}><div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#fbbf24'}}/>Unsaved changes</div>}
            <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{padding:'8px 20px'}}>
              {saving?<><div className="spinner" style={{width:'13px',height:'13px',borderWidth:'2px'}}/> Saving…</>:<><svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>Save Marks</>}
            </button>
            <span style={{fontSize:'11px',color:'var(--text-faint)'}}>{students.length} students · Ctrl+S · A = absent</span>
            <a href={`/results?exam_id=${examId}`} className="btn btn-ghost" style={{marginLeft:'auto',fontSize:'11px'}}>View Results →</a>
          </div>
        </>
      )}
    </AppLayout>
  );
}

export default function MarksEntryPage() {
  return (
    <Suspense fallback={<div className="page-loading"><div className="spinner spinner-lg"/></div>}>
      <MarksEntryContent/>
    </Suspense>
  );
}
