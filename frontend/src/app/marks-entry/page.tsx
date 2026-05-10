'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface ExamData { id: string; name: string; academic_year: string; examSubjects: { id: string; max_marks: string; passing_marks: string; subject: { name: string } }[] }
interface ClassData { id: string; name: string; sections: { id: string; name: string }[] }
interface StudentRow { student_id: string; name: string; roll: string | null; marks: Record<string, { value: string; is_absent: boolean }> }

function MarksEntryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedExamId = searchParams.get('exam_id') || '';

  const [exams, setExams] = useState<ExamData[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [examId, setExamId] = useState(preselectedExamId);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const selectedExam = exams.find(e => e.id === examId);
  const selectedClass = classes.find(c => c.id === classId);

  useEffect(() => {
    Promise.all([fetchApi('/exams'), fetchApi('/classes')])
      .then(([ed, cd]) => { setExams(ed.exams); setClasses(cd.classes); })
      .catch(e => { if (e.message?.includes('Unauthorized')) router.push('/login'); })
      .finally(() => setLoading(false));
  }, []);

  const loadStudents = async () => {
    if (!examId || !classId || !sectionId || !selectedExam) return;
    setLoadingStudents(true);
    try {
      const data = await fetchApi(`/students?class_id=${classId}&section_id=${sectionId}`);
      const subjects = selectedExam.examSubjects;

      // Try to load existing marks
      const studentRows: StudentRow[] = [];
      for (const s of data.students) {
        const marksInit: Record<string, { value: string; is_absent: boolean }> = {};
        subjects.forEach(es => { marksInit[es.id] = { value: '', is_absent: false }; });
        try {
          const existing = await fetchApi(`/exams/${examId}/marks/student/${s.id}`);
          existing.data?.marksEntries?.forEach((me: any) => {
            marksInit[me.exam_subject_id] = { value: me.is_absent ? '' : String(Number(me.marks_obtained)), is_absent: me.is_absent };
          });
        } catch { /* no marks yet */ }
        studentRows.push({ student_id: s.id, name: `${s.firstName} ${s.lastName}`, roll: s.roll_number, marks: marksInit });
      }
      setStudents(studentRows);
    } catch (e: any) { setError(e.message); } finally { setLoadingStudents(false); }
  };

  useEffect(() => { loadStudents(); }, [examId, classId, sectionId]);

  const updateMarks = (studentId: string, examSubjectId: string, value: string) => {
    setStudents(prev => prev.map(s => s.student_id === studentId
      ? { ...s, marks: { ...s.marks, [examSubjectId]: { ...s.marks[examSubjectId], value } } }
      : s
    ));
  };

  const toggleAbsent = (studentId: string, examSubjectId: string) => {
    setStudents(prev => prev.map(s => s.student_id === studentId
      ? { ...s, marks: { ...s.marks, [examSubjectId]: { value: '', is_absent: !s.marks[examSubjectId].is_absent } } }
      : s
    ));
  };

  const handleSave = async () => {
    if (!selectedExam) return;
    setError(''); setMsg(''); setSaving(true);
    try {
      const entries: any[] = [];
      students.forEach(s => {
        Object.entries(s.marks).forEach(([examSubjectId, m]) => {
          entries.push({
            student_id: s.student_id,
            exam_subject_id: examSubjectId,
            marks_obtained: m.is_absent ? 0 : parseFloat(m.value) || 0,
            is_absent: m.is_absent,
          });
        });
      });
      const res = await fetchApi(`/exams/${examId}/marks`, { method: 'POST', data: { entries } });
      setMsg(`${res.count} marks entries saved successfully!`);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/exams" className="text-gray-400 hover:text-white transition-colors">Exams</a>
            <a href="/marks-entry" className="text-blue-400 font-medium">Marks Entry</a>
            <a href="/results" className="text-gray-400 hover:text-white transition-colors">Results</a>
            <a href="/report-card" className="text-gray-400 hover:text-white transition-colors">Report Card</a>
          </div>
        </div>
      </nav>

      <main className="max-w-full px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-bold mb-6">Marks Entry</h1>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3 rounded-xl mb-4 text-sm">{error}</div>}
        {msg && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3 rounded-xl mb-4 text-sm">{msg}</div>}

        {/* Selectors */}
        <div className="flex flex-wrap gap-4 mb-8">
          <div><label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Exam</label>
            <select value={examId} onChange={e => setExamId(e.target.value)} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm w-52">
              <option value="">Select Exam</option>{exams.map(e => <option key={e.id} value={e.id}>{e.name} ({e.academic_year})</option>)}
            </select></div>
          <div><label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Class</label>
            <select value={classId} onChange={e => { setClassId(e.target.value); setSectionId(''); }} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm w-44">
              <option value="">Select</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          {selectedClass && <div><label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Section</label>
            <select value={sectionId} onChange={e => setSectionId(e.target.value)} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm w-36">
              <option value="">Select</option>{selectedClass.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></div>}
        </div>

        {/* Marks Grid */}
        {loadingStudents ? (
          <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : students.length > 0 && selectedExam ? (
          <>
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase sticky left-0 bg-gray-900 z-10">Roll</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase sticky left-12 bg-gray-900 z-10 min-w-[140px]">Student</th>
                    {selectedExam.examSubjects.map(es => (
                      <th key={es.id} className="px-3 py-3 text-center text-xs text-gray-400 uppercase min-w-[130px]">
                        <div>{es.subject.name}</div>
                        <div className="text-gray-600 font-normal">/{Number(es.max_marks)}</div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center text-xs text-gray-400 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => {
                    const total = selectedExam.examSubjects.reduce((sum, es) => {
                      const m = student.marks[es.id];
                      return sum + (!m?.is_absent && m?.value ? parseFloat(m.value) || 0 : 0);
                    }, 0);
                    const maxTotal = selectedExam.examSubjects.reduce((s, es) => s + Number(es.max_marks), 0);
                    return (
                      <tr key={student.student_id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                        <td className="px-4 py-2 text-gray-500 font-mono text-xs sticky left-0 bg-gray-950">{student.roll || '—'}</td>
                        <td className="px-4 py-2 font-medium sticky left-12 bg-gray-950 min-w-[140px]">{student.name}</td>
                        {selectedExam.examSubjects.map(es => {
                          const m = student.marks[es.id];
                          const maxM = Number(es.max_marks);
                          const val = parseFloat(m?.value) || 0;
                          const isOver = !m?.is_absent && m?.value !== '' && val > maxM;
                          return (
                            <td key={es.id} className="px-2 py-2 text-center">
                              {m?.is_absent ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => toggleAbsent(student.student_id, es.id)} className="px-2 py-1.5 bg-red-500/20 text-red-400 rounded text-xs w-full border border-red-500/30">ABS</button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number" min="0" max={maxM} step="0.5"
                                    value={m?.value || ''} onChange={e => updateMarks(student.student_id, es.id, e.target.value)}
                                    className={`w-16 text-center bg-black/40 border rounded px-1 py-1.5 text-white text-xs focus:outline-none ${isOver ? 'border-red-500' : 'border-gray-700 focus:border-blue-500'}`}
                                    placeholder="—"
                                  />
                                  <button onClick={() => toggleAbsent(student.student_id, es.id)} title="Mark Absent" className="px-1.5 py-1.5 bg-gray-700/50 text-gray-400 rounded text-xs hover:bg-red-500/20 hover:text-red-400 transition-colors">A</button>
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2 text-center">
                          <span className={`font-semibold ${total >= maxTotal * 0.33 ? 'text-emerald-400' : 'text-red-400'}`}>{total}/{maxTotal}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-500">Click "A" to toggle absent. Marks exceeding max will show in red.</p>
              <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-sm font-medium disabled:opacity-50 hover:shadow-lg hover:shadow-blue-500/25 transition-all">
                {saving ? 'Saving...' : `Save Marks (${students.length} Students)`}
              </button>
            </div>
          </>
        ) : examId && classId && sectionId ? (
          <p className="text-gray-500 text-center py-16">No students found in this class/section.</p>
        ) : (
          <p className="text-gray-500 text-center py-16">Select exam, class, and section to load students.</p>
        )}
      </main>
    </div>
  );
}

export default function MarksEntryPage() {
  return <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
    <MarksEntryContent />
  </Suspense>;
}
