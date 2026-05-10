'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface ReportCardData {
  student: { firstName: string; lastName: string; admission_number: string; roll_number: string | null };
  class: { name: string }; section: { name: string };
  exam: { name: string; academic_year: string };
  subjects: { subject: string; code: string | null; max_marks: number; passing_marks: number; marks_obtained: number; is_absent: boolean; percentage: number }[];
  result: { total_marks: number; max_total: number; percentage: number; grade: string | null; grade_point: number | null; rank_class: number | null; rank_section: number | null; is_pass: boolean };
  reportCard: { generated_at: string };
}

interface ExamData { id: string; name: string; academic_year: string }
interface StudentData { id: string; firstName: string; lastName: string; admission_number: string }
interface ClassData { id: string; name: string; sections: { id: string; name: string }[] }

function ReportCardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preExamId = searchParams.get('exam_id') || '';
  const preStudentId = searchParams.get('student_id') || '';

  const [exams, setExams] = useState<ExamData[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [examId, setExamId] = useState(preExamId);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [studentId, setStudentId] = useState(preStudentId);
  const [reportCard, setReportCard] = useState<ReportCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const selectedClass = classes.find(c => c.id === classId);

  useEffect(() => {
    Promise.all([fetchApi('/exams'), fetchApi('/classes')])
      .then(([ed, cd]) => { setExams(ed.exams); setClasses(cd.classes); })
      .catch(e => { if (e.message?.includes('Unauthorized')) router.push('/login'); })
      .finally(() => setLoading(false));
  }, []);

  // Auto-generate when both exam_id and student_id are in URL
  useEffect(() => {
    if (preExamId && preStudentId && !loading) {
      generateCardById(preExamId, preStudentId);
    }
  }, [loading]);

  const loadStudents = async (cId: string, sId: string) => {
    try { const d = await fetchApi(`/students?class_id=${cId}&section_id=${sId}`); setStudents(d.students); } catch {}
  };

  const generateCardById = async (eId: string, sId: string) => {
    setGenerating(true); setError(''); setReportCard(null);
    try {
      const data = await fetchApi(`/exams/${eId}/report-card/${sId}`, { method: 'POST', data: {} });
      setReportCard(data as ReportCardData);
    } catch (e: any) { setError(e.message); } finally { setGenerating(false); }
  };

  const generateCard = async () => {
    if (!examId || !studentId) { setError('Select exam and student'); return; }
    generateCardById(examId, studentId);
  };

  const handlePrint = () => { window.print(); };

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/exams" className="text-gray-400 hover:text-white transition-colors">Exams</a>
            <a href="/marks-entry" className="text-gray-400 hover:text-white transition-colors">Marks Entry</a>
            <a href="/results" className="text-gray-400 hover:text-white transition-colors">Results</a>
            <a href="/report-card" className="text-blue-400 font-medium">Report Card</a>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Selectors */}
        <div className="print:hidden mb-8">
          <h1 className="text-3xl font-bold mb-6">Report Card</h1>
          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3 rounded-xl mb-4 text-sm">{error}</div>}
          <div className="flex flex-wrap gap-4 mb-4">
            <div><label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Exam</label>
              <select value={examId} onChange={e => setExamId(e.target.value)} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm w-52">
                <option value="">Select</option>{exams.map(e => <option key={e.id} value={e.id}>{e.name} ({e.academic_year})</option>)}
              </select></div>
            <div><label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Class</label>
              <select value={classId} onChange={e => { setClassId(e.target.value); setSectionId(''); setStudents([]); }} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm w-44">
                <option value="">Select</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            {selectedClass && <div><label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Section</label>
              <select value={sectionId} onChange={e => { setSectionId(e.target.value); if (e.target.value) loadStudents(classId, e.target.value); }} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm w-36">
                <option value="">Select</option>{selectedClass.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select></div>}
            {students.length > 0 && <div><label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Student</label>
              <select value={studentId} onChange={e => setStudentId(e.target.value)} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm w-52">
                <option value="">Select</option>{students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admission_number})</option>)}
              </select></div>}
          </div>
          <button onClick={generateCard} disabled={generating || !examId || !studentId} className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-sm font-medium disabled:opacity-50 hover:shadow-lg transition-all">
            {generating ? 'Generating...' : 'Generate Report Card'}
          </button>
        </div>

        {/* Report Card Preview */}
        {reportCard && (
          <div className="bg-white text-gray-900 rounded-2xl overflow-hidden shadow-2xl print:shadow-none print:rounded-none" id="report-card">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-700 to-blue-700 text-white p-6 text-center">
              <h2 className="text-2xl font-bold">Report Card</h2>
              <p className="text-indigo-200 mt-1">{reportCard.exam.name} — {reportCard.exam.academic_year}</p>
            </div>

            {/* Student Info */}
            <div className="p-6 border-b border-gray-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Student Name:</span> <span className="font-semibold">{reportCard.student.firstName} {reportCard.student.lastName}</span></div>
                <div><span className="text-gray-500">Admission No:</span> <span className="font-semibold">{reportCard.student.admission_number}</span></div>
                <div><span className="text-gray-500">Class:</span> <span className="font-semibold">{reportCard.class.name} - {reportCard.section.name}</span></div>
                <div><span className="text-gray-500">Roll Number:</span> <span className="font-semibold">{reportCard.student.roll_number || '—'}</span></div>
              </div>
            </div>

            {/* Subject Marks Table */}
            <div className="p-6 border-b border-gray-200">
              <h3 className="font-semibold text-gray-700 mb-3">Subject-wise Performance</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 text-gray-600 text-xs uppercase">
                    <th className="px-4 py-2 text-left">Subject</th>
                    <th className="px-4 py-2 text-center">Max Marks</th>
                    <th className="px-4 py-2 text-center">Passing</th>
                    <th className="px-4 py-2 text-center">Marks Obtained</th>
                    <th className="px-4 py-2 text-center">%</th>
                    <th className="px-4 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportCard.subjects.map((sub, i) => {
                    const pass = !sub.is_absent && sub.marks_obtained >= sub.passing_marks;
                    return (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="px-4 py-2.5 font-medium">{sub.subject}{sub.code && <span className="ml-1 text-gray-400 text-xs">({sub.code})</span>}</td>
                        <td className="px-4 py-2.5 text-center">{sub.max_marks}</td>
                        <td className="px-4 py-2.5 text-center text-gray-500">{sub.passing_marks}</td>
                        <td className="px-4 py-2.5 text-center font-semibold">{sub.is_absent ? <span className="text-red-500">Absent</span> : sub.marks_obtained}</td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{sub.is_absent ? '—' : `${sub.percentage}%`}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${pass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{pass ? 'P' : 'F'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Result Summary */}
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-indigo-700">{reportCard.result.total_marks}/{reportCard.result.max_total}</p>
                  <p className="text-xs text-gray-500 uppercase mt-1">Total Marks</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-700">{reportCard.result.percentage}%</p>
                  <p className="text-xs text-gray-500 uppercase mt-1">Percentage</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-700">{reportCard.result.grade || '—'}</p>
                  <p className="text-xs text-gray-500 uppercase mt-1">Grade</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-amber-600">#{reportCard.result.rank_section || '—'}</p>
                  <p className="text-xs text-gray-500 uppercase mt-1">Section Rank</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`px-4 py-2 rounded-lg font-semibold text-sm ${reportCard.result.is_pass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {reportCard.result.is_pass ? '✓ PROMOTED' : '✗ NOT PROMOTED'}
                </span>
                <p className="text-xs text-gray-400">Generated: {new Date(reportCard.reportCard.generated_at).toLocaleString()}</p>
              </div>
            </div>

            {/* Signature Area */}
            <div className="p-6 border-t border-gray-200 grid grid-cols-3 text-center text-xs text-gray-500">
              <div className="border-t border-gray-300 pt-2 mx-4">Class Teacher</div>
              <div className="border-t border-gray-300 pt-2 mx-4">Principal</div>
              <div className="border-t border-gray-300 pt-2 mx-4">Parent / Guardian</div>
            </div>
          </div>
        )}

        {reportCard && (
          <div className="mt-4 flex justify-center print:hidden">
            <button onClick={handlePrint} className="px-6 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm font-medium hover:bg-white/20 transition-all">
              🖨️ Print / Save as PDF
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ReportCardPage() {
  return <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
    <ReportCardContent />
  </Suspense>;
}
