'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface ExamDetail {
  id: string; name: string; academic_year: string;
  start_date: string | null; end_date: string | null; status: string;
  examSubjects: { id: string; max_marks: string; passing_marks: string; weightage: string; subject: { id: string; name: string; code: string | null } }[];
  _count: { studentExams: number };
}
interface SubjectData { id: string; name: string; code: string | null }
interface ClassData { id: string; name: string; sections: { id: string; name: string }[] }

export default function ExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [allSubjects, setAllSubjects] = useState<SubjectData[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [tab, setTab] = useState<'overview' | 'subjects' | 'register'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // Subject config state
  const [subjectRows, setSubjectRows] = useState<{ subject_id: string; max_marks: string; passing_marks: string; weightage: string }[]>([]);
  const [savingSubjects, setSavingSubjects] = useState(false);

  // Register state
  const [regClassId, setRegClassId] = useState('');
  const [regSectionId, setRegSectionId] = useState('');
  const [registering, setRegistering] = useState(false);

  const selectedClass = classes.find(c => c.id === regClassId);

  const loadExam = async () => {
    try {
      const [examData, subjectData, classData] = await Promise.all([
        fetchApi(`/exams/${id}`),
        fetchApi('/subjects'),
        fetchApi('/classes'),
      ]);
      setExam(examData.exam);
      setAllSubjects(subjectData.subjects || []);
      setClasses(classData.classes || []);
      // Pre-fill subject rows from existing config
      if (examData.exam.examSubjects.length > 0) {
        setSubjectRows(examData.exam.examSubjects.map((es: any) => ({
          subject_id: es.subject.id, max_marks: es.max_marks, passing_marks: es.passing_marks, weightage: es.weightage,
        })));
      } else {
        setSubjectRows([{ subject_id: '', max_marks: '100', passing_marks: '33', weightage: '1' }]);
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadExam(); }, [id]);

  const addSubjectRow = () => setSubjectRows([...subjectRows, { subject_id: '', max_marks: '100', passing_marks: '33', weightage: '1' }]);
  const removeSubjectRow = (i: number) => setSubjectRows(subjectRows.filter((_, idx) => idx !== i));
  const updateSubjectRow = (i: number, field: string, value: string) => {
    const rows = [...subjectRows];
    (rows[i] as any)[field] = value;
    setSubjectRows(rows);
  };

  const saveSubjects = async () => {
    const valid = subjectRows.filter(r => r.subject_id && r.max_marks && r.passing_marks);
    if (valid.length === 0) { setError('Add at least one subject with valid marks'); return; }
    setSavingSubjects(true); setError(''); setMsg('');
    try {
      await fetchApi(`/exams/${id}/subjects`, {
        method: 'POST',
        data: { subjects: valid.map(r => ({ subject_id: r.subject_id, max_marks: parseFloat(r.max_marks), passing_marks: parseFloat(r.passing_marks), weightage: parseFloat(r.weightage) })) },
      });
      setMsg('Subjects saved successfully'); loadExam();
    } catch (e: any) { setError(e.message); } finally { setSavingSubjects(false); }
  };

  const registerStudents = async () => {
    if (!regClassId || !regSectionId) { setError('Select class and section'); return; }
    setRegistering(true); setError(''); setMsg('');
    try {
      const res = await fetchApi(`/exams/${id}/register`, { method: 'POST', data: { class_id: regClassId, section_id: regSectionId } });
      setMsg(`${res.registered} students registered successfully`); loadExam();
    } catch (e: any) { setError(e.message); } finally { setRegistering(false); }
  };

  const updateStatus = async (status: string) => {
    try { await fetchApi(`/exams/${id}`, { method: 'PATCH', data: { status } }); loadExam(); }
    catch (e: any) { setError((e as any).message); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!exam) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-red-400">Exam not found</div>;

  const statusColor = (s: string) => s === 'published' ? 'text-emerald-400' : s === 'completed' ? 'text-blue-400' : 'text-amber-400';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/exams" className="text-gray-400 hover:text-white transition-colors">← Exams</a>
            <a href="/marks-entry" className="text-gray-400 hover:text-white transition-colors">Marks Entry</a>
            <a href="/results" className="text-gray-400 hover:text-white transition-colors">Results</a>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">{exam.name}</h1>
            <p className="text-gray-500 mt-1">{exam.academic_year}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${statusColor(exam.status)} capitalize`}>{exam.status}</span>
            {exam.status === 'draft' && <button onClick={() => updateStatus('published')} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors">Publish</button>}
            {exam.status === 'published' && <button onClick={() => updateStatus('completed')} className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-xs border border-blue-500/30 hover:bg-blue-500/30 transition-colors">Mark Complete</button>}
          </div>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3 rounded-xl mb-4 text-sm">{error}</div>}
        {msg && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3 rounded-xl mb-4 text-sm">{msg}</div>}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-purple-400">{exam.examSubjects.length}</p>
            <p className="text-xs text-gray-500 uppercase mt-1">Subjects</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-cyan-400">{exam._count.studentExams}</p>
            <p className="text-xs text-gray-500 uppercase mt-1">Students</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{exam.examSubjects.reduce((s, es) => s + Number(es.max_marks), 0)}</p>
            <p className="text-xs text-gray-500 uppercase mt-1">Total Marks</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit mb-6">
          {(['overview','subjects','register'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${tab===t ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white'}`}>{t}</button>
          ))}
        </div>

        {/* Tab: Overview */}
        {tab === 'overview' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/10"><th className="px-5 py-4 text-left text-xs text-gray-400 uppercase">Subject</th><th className="px-5 py-4 text-center text-xs text-gray-400 uppercase">Max Marks</th><th className="px-5 py-4 text-center text-xs text-gray-400 uppercase">Passing</th><th className="px-5 py-4 text-center text-xs text-gray-400 uppercase">Weightage</th></tr></thead>
              <tbody>
                {exam.examSubjects.length === 0 ? (
                  <tr><td colSpan={4} className="text-center text-gray-500 py-8">No subjects configured. Go to Subjects tab.</td></tr>
                ) : exam.examSubjects.map(es => (
                  <tr key={es.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-5 py-3 font-medium">{es.subject.name}{es.subject.code && <span className="ml-2 text-xs text-gray-500">({es.subject.code})</span>}</td>
                    <td className="px-5 py-3 text-center text-emerald-400">{Number(es.max_marks)}</td>
                    <td className="px-5 py-3 text-center text-amber-400">{Number(es.passing_marks)}</td>
                    <td className="px-5 py-3 text-center text-blue-400">{Number(es.weightage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab: Subjects Config */}
        {tab === 'subjects' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <p className="text-gray-500 text-sm mb-4">Configure subjects with their max marks and passing criteria.</p>
            <div className="space-y-3 mb-4">
              {subjectRows.map((row, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    {i===0 && <label className="block text-xs text-gray-500 mb-1">Subject</label>}
                    <select value={row.subject_id} onChange={e => updateSubjectRow(i,'subject_id',e.target.value)} className="w-full bg-black/30 border border-gray-700 rounded-lg px-2 py-2 text-white text-sm">
                      <option value="">Select</option>
                      {allSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    {i===0 && <label className="block text-xs text-gray-500 mb-1">Max Marks</label>}
                    <input type="number" value={row.max_marks} onChange={e => updateSubjectRow(i,'max_marks',e.target.value)} className="w-full bg-black/30 border border-gray-700 rounded-lg px-2 py-2 text-white text-sm" />
                  </div>
                  <div className="col-span-3">
                    {i===0 && <label className="block text-xs text-gray-500 mb-1">Passing</label>}
                    <input type="number" value={row.passing_marks} onChange={e => updateSubjectRow(i,'passing_marks',e.target.value)} className="w-full bg-black/30 border border-gray-700 rounded-lg px-2 py-2 text-white text-sm" />
                  </div>
                  <div className="col-span-1">
                    {i===0 && <label className="block text-xs text-gray-500 mb-1">Wt.</label>}
                    <input type="number" value={row.weightage} onChange={e => updateSubjectRow(i,'weightage',e.target.value)} className="w-full bg-black/30 border border-gray-700 rounded-lg px-2 py-2 text-white text-sm" />
                  </div>
                  <div className="col-span-1">
                    <button onClick={() => removeSubjectRow(i)} className="w-full py-2 text-red-400 hover:bg-red-500/10 rounded-lg text-sm transition-colors">✕</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              <button onClick={addSubjectRow} className="text-blue-400 text-sm hover:text-blue-300 transition-colors">+ Add Subject</button>
              <button onClick={saveSubjects} disabled={savingSubjects} className="px-5 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg text-sm disabled:opacity-50">{savingSubjects?'Saving...':'Save Configuration'}</button>
            </div>
          </div>
        )}

        {/* Tab: Register Students */}
        {tab === 'register' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <p className="text-gray-500 text-sm mb-4">Register all active students from a class/section for this exam.</p>
            <div className="flex flex-wrap gap-3 mb-4">
              <div><label className="block text-xs text-gray-500 mb-1">Class</label>
                <select value={regClassId} onChange={e => { setRegClassId(e.target.value); setRegSectionId(''); }} className="bg-black/30 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm w-44">
                  <option value="">Select</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
              {selectedClass && <div><label className="block text-xs text-gray-500 mb-1">Section</label>
                <select value={regSectionId} onChange={e => setRegSectionId(e.target.value)} className="bg-black/30 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm w-36">
                  <option value="">Select</option>{selectedClass.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></div>}
              <div className="flex items-end">
                <button onClick={registerStudents} disabled={registering||!regClassId||!regSectionId} className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg text-sm disabled:opacity-50">{registering?'Registering...':'Register Students'}</button>
              </div>
            </div>
            <p className="text-xs text-gray-500">Currently {exam._count.studentExams} students registered for this exam.</p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-3 mt-8">
          <button onClick={() => router.push(`/marks-entry?exam_id=${id}`)} className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm hover:bg-white/10 transition-colors">📝 Enter Marks</button>
          <button onClick={() => router.push(`/results?exam_id=${id}`)} className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm hover:bg-white/10 transition-colors">📊 View Results</button>
          <button onClick={() => router.push(`/report-card?exam_id=${id}`)} className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm hover:bg-white/10 transition-colors">📄 Report Cards</button>
        </div>
      </main>
    </div>
  );
}
