'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';

interface ClassData { id: string; name: string; sections: { id: string; name: string }[]; }
interface ReportEntry { student_id: string; name: string; roll: string | null; present: number; absent: number; late: number; excused: number; total: number; percentage: number; }

export default function AttendanceReportPage() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]; });
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState<ReportEntry[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(false);

  const selectedClass = classes.find(c => c.id === classId);

  useEffect(() => { fetchApi('/classes').then(d => setClasses(d.classes)).catch(() => {}); }, []);

  const loadReport = async () => {
    if (!classId || !sectionId) return;
    setLoading(true);
    try {
      const data = await fetchApi(`/attendance/report/class?class_id=${classId}&section_id=${sectionId}&from_date=${fromDate}&to_date=${toDate}`);
      setReport(data.report); setTotalSessions(data.totalSessions);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const avgPercentage = report.length > 0 ? Math.round(report.reduce((a, r) => a + r.percentage, 0) / report.length) : 0;
  const below75 = report.filter(r => r.percentage < 75);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/attendance" className="text-gray-400 hover:text-white transition-colors">Mark</a>
            <a href="/attendance/report" className="text-blue-400 font-medium">Reports</a>
            <a href="/leave" className="text-gray-400 hover:text-white transition-colors">Leave</a>
            <a href="/attendance/biometric" className="text-gray-400 hover:text-white transition-colors">Biometric</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold mb-8">Attendance Report</h1>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8">
          <div>
            <label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Class</label>
            <select value={classId} onChange={e => { setClassId(e.target.value); setSectionId(''); }} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm w-44">
              <option value="">Select</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {selectedClass && <div>
            <label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Section</label>
            <select value={sectionId} onChange={e => setSectionId(e.target.value)} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm w-36">
              <option value="">Select</option>{selectedClass.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>}
          <div>
            <label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm" style={{ colorScheme: 'dark' }} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm" style={{ colorScheme: 'dark' }} />
          </div>
          <div className="flex items-end">
            <button onClick={loadReport} disabled={!classId || !sectionId || loading} className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg text-sm font-medium disabled:opacity-50 hover:shadow-lg hover:shadow-blue-500/25 transition-all">
              {loading ? 'Loading...' : 'Generate Report'}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {report.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
                <p className="text-3xl font-bold text-blue-400">{totalSessions}</p>
                <p className="text-xs text-gray-500 uppercase mt-1">Total Sessions</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
                <p className="text-3xl font-bold text-emerald-400">{avgPercentage}%</p>
                <p className="text-xs text-gray-500 uppercase mt-1">Avg Attendance</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
                <p className="text-3xl font-bold text-white">{report.length}</p>
                <p className="text-xs text-gray-500 uppercase mt-1">Students</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
                <p className="text-3xl font-bold text-red-400">{below75.length}</p>
                <p className="text-xs text-gray-500 uppercase mt-1">Below 75%</p>
              </div>
            </div>

            {/* Report Table */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-5 py-4 text-xs text-gray-400 uppercase font-semibold">Roll</th>
                    <th className="px-5 py-4 text-xs text-gray-400 uppercase font-semibold">Name</th>
                    <th className="px-5 py-4 text-xs text-gray-400 uppercase font-semibold text-center">P</th>
                    <th className="px-5 py-4 text-xs text-gray-400 uppercase font-semibold text-center">A</th>
                    <th className="px-5 py-4 text-xs text-gray-400 uppercase font-semibold text-center">L</th>
                    <th className="px-5 py-4 text-xs text-gray-400 uppercase font-semibold text-center">E</th>
                    <th className="px-5 py-4 text-xs text-gray-400 uppercase font-semibold text-center">%</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((r) => (
                    <tr key={r.student_id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3 font-mono text-gray-400">{r.roll || '—'}</td>
                      <td className="px-5 py-3 font-medium">{r.name}</td>
                      <td className="px-5 py-3 text-center text-emerald-400">{r.present}</td>
                      <td className="px-5 py-3 text-center text-red-400">{r.absent}</td>
                      <td className="px-5 py-3 text-center text-yellow-400">{r.late}</td>
                      <td className="px-5 py-3 text-center text-blue-400">{r.excused}</td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${r.percentage >= 75 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${r.percentage}%` }}></div>
                          </div>
                          <span className={`text-xs font-medium ${r.percentage >= 75 ? 'text-emerald-400' : 'text-red-400'}`}>{r.percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!report.length && !loading && (
          <p className="text-gray-500 text-center py-20">Select a class and date range, then click Generate Report.</p>
        )}
      </main>
    </div>
  );
}
