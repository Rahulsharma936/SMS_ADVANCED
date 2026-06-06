'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

interface ExamData { id: string; name: string; academic_year: string }
interface ClassData { id: string; name: string; sections: { id: string; name: string }[] }
interface ResultEntry {
  id: string;
  student: { id: string; firstName: string; lastName: string; roll_number: string | null; admission_number: string };
  section: { name: string };
  resultSummary: { total_marks: string; max_total: string; percentage: string; grade: string | null; rank_section: number | null; is_pass: boolean } | null;
}

function FL({ c }: { c: string }) {
  return <label style={{ display:'block', fontSize:'10px', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-faint)', marginBottom:'5px' }}>{c}</label>;
}

function PctBar({ pct }: { pct: number }) {
  const color = pct >= 75 ? '#4ade80' : pct >= 33 ? '#fbbf24' : '#f87171';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
      <div style={{ width:'52px', height:'4px', background:'var(--bg-overlay)', borderRadius:'2px', overflow:'hidden', flexShrink:0 }}>
        <div style={{ width:`${Math.min(100,pct)}%`, height:'100%', background:color, borderRadius:'2px' }}/>
      </div>
      <span style={{ fontSize:'12px', fontWeight:600, color, minWidth:'36px', fontFamily:'var(--font-geist-mono)' }}>{pct}%</span>
    </div>
  );
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [exams,      setExams]      = useState<ExamData[]>([]);
  const [classes,    setClasses]    = useState<ClassData[]>([]);
  const [examId,     setExamId]     = useState(searchParams.get('exam_id')||'');
  const [classId,    setClassId]    = useState('');
  const [sectionId,  setSectionId]  = useState('');
  const [results,    setResults]    = useState<ResultEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [calculating,setCalculating]= useState(false);
  const [error,      setError]      = useState('');
  const [msg,        setMsg]        = useState('');

  const selectedClass = classes.find(c=>c.id===classId);

  useEffect(()=>{
    Promise.all([fetchApi('/exams'),fetchApi('/classes')])
      .then(([ed,cd])=>{ setExams(ed.exams); setClasses(cd.classes); })
      .catch(e=>{ if(e.message?.includes('Unauthorized')) router.push('/login'); })
      .finally(()=>setLoading(false));
  },[router]);

  const loadResults = async () => {
    if (!examId||!classId) return;
    try {
      const url = sectionId ? `/exams/${examId}/results?class_id=${classId}&section_id=${sectionId}` : `/exams/${examId}/results?class_id=${classId}`;
      const data = await fetchApi(url);
      setResults(data.results);
    } catch (e: any) { setError(e.message); }
  };
  useEffect(()=>{ loadResults(); },[examId,classId,sectionId]);

  const calculateResults = async () => {
    if (!examId||!classId||!sectionId) { setError('Select exam, class, and section to calculate'); return; }
    setCalculating(true); setError(''); setMsg('');
    try {
      const res = await fetchApi(`/exams/${examId}/results/calculate`,{ method:'POST', data:{ class_id:classId, section_id:sectionId }});
      setMsg(`Results calculated for ${res.calculated} students`);
      loadResults();
      setTimeout(()=>setMsg(''),5000);
    } catch(e:any){ setError(e.message); } finally { setCalculating(false); }
  };

  const passCount    = results.filter(r=>r.resultSummary?.is_pass).length;
  const failCount    = results.filter(r=>r.resultSummary&&!r.resultSummary.is_pass).length;
  const pendingCount = results.filter(r=>!r.resultSummary).length;
  const avgPercent   = results.length>0&&results.some(r=>r.resultSummary)
    ? Math.round(results.filter(r=>r.resultSummary).reduce((s,r)=>s+Number(r.resultSummary!.percentage),0)/results.filter(r=>r.resultSummary).length) : 0;

  if (loading) return <div className="page-loading"><div className="spinner spinner-lg"/></div>;

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          {/* Breadcrumb */}
          <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', color:'var(--text-muted)', marginBottom:'4px' }}>
            <a href="/exams" style={{ color:'var(--text-muted)', textDecoration:'none' }}>
              Examinations
            </a>
            <span style={{ color:'var(--text-faint)' }}>›</span>
            <span>Results</span>
          </div>
          <h1 className="page-title">Results</h1>
          <p className="page-subtitle">Exam result summaries and grade reports</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <a href="/marks-entry" className="btn btn-secondary" style={{fontSize:'12px'}}>Marks Entry</a>
          <a href="/report-card" className="btn btn-secondary" style={{fontSize:'12px'}}>Report Cards</a>
          {examId&&classId&&sectionId && (
            <button onClick={calculateResults} disabled={calculating} className="btn btn-primary" style={{fontSize:'12px'}}>
              {calculating?<><div className="spinner" style={{width:'13px',height:'13px',borderWidth:'2px'}}/> Calculating…</>:<>⚡ Calculate Results</>}
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error" style={{marginBottom:'12px'}}>{error}</div>}
      {msg   && <div className="alert alert-success" style={{marginBottom:'12px'}}>{msg}</div>}

      {/* Filters */}
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
              <option value="">All Sections</option>
              {selectedClass.sections.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {!examId && (
        <div className="empty-state" style={{minHeight:'36vh'}}>
          <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          <p className="empty-state-title">Select an exam to view results</p>
          <p className="empty-state-desc">Choose an exam and class above to load result summaries.</p>
        </div>
      )}

      {examId&&classId&&results.length===0 && (
        <div className="empty-state" style={{minHeight:'28vh'}}>
          <p className="empty-state-title">No results yet</p>
          <p className="empty-state-desc">Enter marks first, then use the Calculate Results button to generate results.</p>
          <a href={`/marks-entry?exam_id=${examId}`} className="btn btn-secondary" style={{fontSize:'12px'}}>Go to Marks Entry →</a>
        </div>
      )}

      {results.length>0 && (
        <>
          <div className="kpi-grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',marginBottom:'14px'}}>
            {[
              {label:'Total Students', value:results.length,  color:'#60a5fa'},
              {label:'Passed',         value:passCount,        color:'#4ade80'},
              {label:'Failed',         value:failCount,        color:'#f87171'},
              {label:'Avg Score',      value:`${avgPercent}%`, color:avgPercent>=50?'#4ade80':'#fbbf24'},
            ].map(c=>(
              <div key={c.label} className="kpi-card">
                <div className="kpi-card-value" style={{color:c.color}}>{c.value}</div>
                <div className="kpi-card-label">{c.label}</div>
              </div>
            ))}
          </div>

          {pendingCount>0 && (
            <div className="alert alert-warning" style={{marginBottom:'12px'}}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75} style={{flexShrink:0}}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              <span><strong>{pendingCount} students</strong> have no results — click "Calculate Results" to process them.</span>
            </div>
          )}

          <div className="data-table-wrap">
            <div style={{overflowX:'auto'}}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{width:'52px'}}>Rank</th>
                    <th style={{width:'72px'}}>Roll</th>
                    <th>Student</th>
                    <th style={{textAlign:'center'}}>Marks</th>
                    <th style={{minWidth:'120px'}}>Score %</th>
                    <th style={{textAlign:'center'}}>Grade</th>
                    <th style={{textAlign:'center'}}>Status</th>
                    <th style={{textAlign:'center',width:'90px'}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(r=>(
                    <tr key={r.id} style={{background:r.resultSummary&&!r.resultSummary.is_pass?'rgba(239,68,68,0.03)':undefined}}>
                      <td style={{fontWeight:700,color:'#fbbf24',fontFamily:'var(--font-geist-mono)'}}>{r.resultSummary?.rank_section?`#${r.resultSummary.rank_section}`:'—'}</td>
                      <td style={{fontFamily:'var(--font-geist-mono)',fontSize:'11px',color:'var(--text-faint)'}}>{r.student.roll_number||r.student.admission_number.slice(-5)}</td>
                      <td style={{fontWeight:500}}>
                        <a href={`/students/${r.student.id}`}
                          style={{ color:'var(--text-primary)', textDecoration:'none', fontWeight:500 }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--brand-primary)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
                        >
                          {r.student.firstName} {r.student.lastName}
                        </a>
                      </td>
                      <td style={{textAlign:'center',fontFamily:'var(--font-geist-mono)',fontWeight:600}}>
                        {r.resultSummary?`${Number(r.resultSummary.total_marks)}/${Number(r.resultSummary.max_total)}`:'—'}
                      </td>
                      <td>{r.resultSummary?<PctBar pct={Number(r.resultSummary.percentage)}/>:'—'}</td>
                      <td style={{textAlign:'center'}}>
                        {r.resultSummary?.grade?<span className="badge badge-blue" style={{fontWeight:700}}>{r.resultSummary.grade}</span>:'—'}
                      </td>
                      <td style={{textAlign:'center'}}>
                        {r.resultSummary?(
                          <span className={`badge ${r.resultSummary.is_pass?'badge-green':'badge-red'}`} style={{fontWeight:700}}>
                            {r.resultSummary.is_pass?'PASS':'FAIL'}
                          </span>
                        ):<span style={{fontSize:'11px',color:'var(--text-faint)'}}>Pending</span>}
                      </td>
                      <td style={{textAlign:'center'}}>
                        <a href={`/report-card?exam_id=${examId}&student_id=${r.student.id}`} className="btn btn-ghost" style={{fontSize:'11px',padding:'3px 8px'}}>Report</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="page-loading"><div className="spinner spinner-lg"/></div>}>
      <ResultsContent/>
    </Suspense>
  );
}
