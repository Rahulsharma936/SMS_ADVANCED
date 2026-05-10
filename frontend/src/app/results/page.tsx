'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface ExamData { id: string; name: string; academic_year: string }
interface ClassData { id: string; name: string; sections: { id: string; name: string }[] }
interface ResultEntry {
  id: string;
  student: { id: string; firstName: string; lastName: string; roll_number: string | null; admission_number: string };
  section: { name: string };
  resultSummary: { total_marks: string; max_total: string; percentage: string; grade: string | null; rank_section: number | null; is_pass: boolean } | null;
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preExamId = searchParams.get('exam_id') || '';

  const [exams, setExams] = useState<ExamData[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [examId, setExamId] = useState(preExamId);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
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

  const loadResults = async () => {
    if (!examId || !classId) return;
    try {
      const url = sectionId ? `/exams/${examId}/results?class_id=${classId}&section_id=${sectionId}` : `/exams/${examId}/results?class_id=${classId}`;
      const data = await fetchApi(url);
      setResults(data.results);
    } catch (e: any) { setError(e.message); }
  };

  useEffect(() => { loadResults(); }, [examId, classId, sectionId]);

  const calculateResults = async () => {
    if (!examId || !classId || !sectionId) { setError('Select exam, class, and section to calculate'); return; }
    setCalculating(true); setError(''); setMsg('');
    try {
      const res = await fetchApi(`/exams/${examId}/results/calculate`, { method: 'POST', data: { class_id: classId, section_id: sectionId } });
      setMsg(`Results calculated for ${res.calculated} students`);
      loadResults();
    } catch (e: any) { setError(e.message); } finally { setCalculating(false); }
  };

  const passCount = results.filter(r => r.resultSummary?.is_pass).length;
  const failCount = results.filter(r => r.resultSummary && !r.resultSummary.is_pass).length;
  const pendingCount = results.filter(r => !r.resultSummary).length;
  const avgPercent = results.length > 0 && results.some(r => r.resultSummary)
    ? Math.round(results.filter(r => r.resultSummary).reduce((s, r) => s + Number(r.resultSummary!.percentage), 0) / results.filter(r => r.resultSummary).length) : 0;

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/exams" className="text-gray-400 hover:text-white transition-colors">Exams</a>
            <a href="/marks-entry" className="text-gray-400 hover:text-white transition-colors">Marks Entry</a>
            <a href="/results" className="text-blue-400 font-medium">Results</a>
            <a href="/report-card" className="text-gray-400 hover:text-white transition-colors">Report Card</a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Results Dashboard</h1>
          {examId && classId && sectionId && (
            <button onClick={calculateResults} disabled={calculating} className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl text-sm font-medium disabled:opacity-50 hover:shadow-lg transition-all">
              {calculating ? 'Calculating...' : '⚡ Calculate Results'}
            </button>
          )}
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3 rounded-xl mb-4 text-sm">{error}</div>}
        {msg && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3 rounded-xl mb-4 text-sm">{msg}</div>}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8">
          <div><label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Exam</label>
            <select value={examId} onChange={e => setExamId(e.target.value)} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm w-52">
              <option value="">Select</option>{exams.map(e => <option key={e.id} value={e.id}>{e.name} ({e.academic_year})</option>)}
            </select></div>
          <div><label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Class</label>
            <select value={classId} onChange={e => { setClassId(e.target.value); setSectionId(''); }} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm w-44">
              <option value="">Select</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          {selectedClass && <div><label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Section</label>
            <select value={sectionId} onChange={e => setSectionId(e.target.value)} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm w-36">
              <option value="">All Sections</option>{selectedClass.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></div>}
        </div>

        {results.length > 0 && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center"><p className="text-2xl font-bold text-blue-400">{results.length}</p><p className="text-xs text-gray-500 uppercase mt-1">Total Students</p></div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center"><p className="text-2xl font-bold text-emerald-400">{passCount}</p><p className="text-xs text-gray-500 uppercase mt-1">Passed</p></div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center"><p className="text-2xl font-bold text-red-400">{failCount}</p><p className="text-xs text-gray-500 uppercase mt-1">Failed</p></div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center"><p className="text-2xl font-bold text-purple-400">{avgPercent}%</p><p className="text-xs text-gray-500 uppercase mt-1">Avg %</p></div>
            </div>

            {/* Results Table */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-5 py-4 text-left text-xs text-gray-400 uppercase">Rank</th>
                    <th className="px-5 py-4 text-left text-xs text-gray-400 uppercase">Roll</th>
                    <th className="px-5 py-4 text-left text-xs text-gray-400 uppercase">Name</th>
                    <th className="px-5 py-4 text-center text-xs text-gray-400 uppercase">Marks</th>
                    <th className="px-5 py-4 text-center text-xs text-gray-400 uppercase">%</th>
                    <th className="px-5 py-4 text-center text-xs text-gray-400 uppercase">Grade</th>
                    <th className="px-5 py-4 text-center text-xs text-gray-400 uppercase">Status</th>
                    <th className="px-5 py-4 text-center text-xs text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(r => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.04] transition-colors">
                      <td className="px-5 py-3 text-amber-400 font-bold">{r.resultSummary?.rank_section ? `#${r.resultSummary.rank_section}` : '—'}</td>
                      <td className="px-5 py-3 text-gray-400 font-mono text-xs">{r.student.roll_number || r.student.admission_number}</td>
                      <td className="px-5 py-3 font-medium">{r.student.firstName} {r.student.lastName}</td>
                      <td className="px-5 py-3 text-center">{r.resultSummary ? `${Number(r.resultSummary.total_marks)}/${Number(r.resultSummary.max_total)}` : '—'}</td>
                      <td className="px-5 py-3 text-center">
                        {r.resultSummary ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-12 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${Number(r.resultSummary.percentage) >= 33 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, Number(r.resultSummary.percentage))}%` }} />
                            </div>
                            <span className={Number(r.resultSummary.percentage) >= 33 ? 'text-emerald-400' : 'text-red-400'}>{Number(r.resultSummary.percentage)}%</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {r.resultSummary?.grade ? <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs font-medium">{r.resultSummary.grade}</span> : '—'}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {r.resultSummary ? (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.resultSummary.is_pass ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {r.resultSummary.is_pass ? 'PASS' : 'FAIL'}
                          </span>
                        ) : <span className="text-gray-600 text-xs">Pending</span>}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button onClick={() => router.push(`/report-card?exam_id=${examId}&student_id=${r.student.id}`)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">View Card</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pendingCount > 0 && (
              <p className="text-amber-400 text-sm mt-3 text-center">{pendingCount} students have no results yet — click "Calculate Results" above.</p>
            )}
          </>
        )}

        {!results.length && examId && classId && (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-3">No results found. Enter marks first, then calculate results.</p>
            <button onClick={() => router.push(`/marks-entry?exam_id=${examId}`)} className="text-blue-400 text-sm hover:underline">Go to Marks Entry →</button>
          </div>
        )}
        {!examId && <p className="text-gray-500 text-center py-16">Select an exam to view results.</p>}
      </main>
    </div>
  );
}

export default function ResultsPage() {
  return <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
    <ResultsContent />
  </Suspense>;
}
