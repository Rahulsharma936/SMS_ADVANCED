'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface ClassData { id: string; name: string; sections: { id: string; name: string }[]; }
interface StudentForAttendance { id: string; firstName: string; lastName: string; roll_number: string | null; admission_number: string; }

export default function AttendancePage() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [period, setPeriod] = useState<string>('');
  const [students, setStudents] = useState<StudentForAttendance[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  useEffect(() => {
    fetchApi('/classes').then((d) => setClasses(d.classes)).catch((err: any) => {
      if (err.message?.includes('Unauthorized')) router.push('/login');
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedClassId || !selectedSectionId) { setStudents([]); return; }
    const loadStudents = async () => {
      try {
        const data = await fetchApi(`/students?class_id=${selectedClassId}&section_id=${selectedSectionId}`);
        const studentList = data.students.map((s: any) => ({
          id: s.id, firstName: s.firstName, lastName: s.lastName,
          roll_number: s.roll_number, admission_number: s.admission_number,
        }));
        setStudents(studentList);

        const initialAttendance: Record<string, string> = {};
        studentList.forEach((s: StudentForAttendance) => { initialAttendance[s.id] = 'PRESENT'; });

        // Check existing attendance
        try {
          const periodParam = period ? `&period=${period}` : '&period=null';
          const existing = await fetchApi(`/attendance/class?class_id=${selectedClassId}&section_id=${selectedSectionId}&date=${date}${periodParam}`);
          if (existing.sessions?.length > 0) {
            existing.sessions[0].records.forEach((r: any) => { initialAttendance[r.student.id] = r.status; });
          }
        } catch { /* no existing attendance */ }

        setAttendance(initialAttendance);
      } catch (err) { console.error(err); }
    };
    loadStudents();
  }, [selectedClassId, selectedSectionId, date, period]);

  const handleSubmit = async () => {
    setError(''); setMessage(''); setSubmitting(true);
    try {
      const records = Object.entries(attendance).map(([student_id, status]) => ({ student_id, status }));
      await fetchApi('/attendance/mark', {
        method: 'POST',
        data: { class_id: selectedClassId, section_id: selectedSectionId, date, period: period ? parseInt(period) : null, records },
      });
      setMessage(`Attendance marked for ${records.length} students!`);
    } catch (err: any) { setError(err.message); } finally { setSubmitting(false); }
  };

  const toggleStatus = (studentId: string) => {
    setAttendance((prev) => {
      const current = prev[studentId];
      const next = current === 'PRESENT' ? 'ABSENT' : current === 'ABSENT' ? 'LATE' : current === 'LATE' ? 'EXCUSED' : 'PRESENT';
      return { ...prev, [studentId]: next };
    });
  };

  const markAll = (status: string) => {
    const updated: Record<string, string> = {};
    students.forEach(s => { updated[s.id] = status; });
    setAttendance(updated);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'PRESENT': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'ABSENT': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'LATE': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'EXCUSED': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const counts = {
    present: Object.values(attendance).filter(s => s === 'PRESENT').length,
    absent: Object.values(attendance).filter(s => s === 'ABSENT').length,
    late: Object.values(attendance).filter(s => s === 'LATE').length,
    excused: Object.values(attendance).filter(s => s === 'EXCUSED').length,
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/classes" className="text-gray-400 hover:text-white transition-colors">Classes</a>
            <a href="/students" className="text-gray-400 hover:text-white transition-colors">Students</a>
            <a href="/teachers" className="text-gray-400 hover:text-white transition-colors">Teachers</a>
            <a href="/attendance" className="text-blue-400 font-medium">Attendance</a>
            <a href="/attendance/report" className="text-gray-400 hover:text-white transition-colors">Reports</a>
            <a href="/leave" className="text-gray-400 hover:text-white transition-colors">Leave</a>
            <a href="/attendance/biometric" className="text-gray-400 hover:text-white transition-colors">Biometric</a>
            <a href="/timetable" className="text-gray-400 hover:text-white transition-colors">Timetable</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold mb-8">Mark Attendance</h1>

        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm">{error}</div>}
        {message && <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-200 p-3 rounded-lg mb-6 text-sm">{message}</div>}

        {/* Selectors */}
        <div className="flex flex-wrap gap-4 mb-8">
          <div>
            <label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Class</label>
            <select value={selectedClassId} onChange={(e) => { setSelectedClassId(e.target.value); setSelectedSectionId(''); }} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 w-44">
              <option value="">Select Class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {selectedClass && (
            <div>
              <label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Section</label>
              <select value={selectedSectionId} onChange={(e) => setSelectedSectionId(e.target.value)} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 w-36">
                <option value="">Select</option>
                {selectedClass.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" style={{ colorScheme: 'dark' }} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Period</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 w-36">
              <option value="">Daily (Full Day)</option>
              {[1,2,3,4,5,6,7,8].map(p => <option key={p} value={p}>Period {p}</option>)}
            </select>
          </div>
        </div>

        {/* Quick Actions */}
        {students.length > 0 && (
          <div className="flex gap-2 mb-4">
            <button onClick={() => markAll('PRESENT')} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium hover:bg-emerald-500/30 transition-colors">All Present</button>
            <button onClick={() => markAll('ABSENT')} className="px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-colors">All Absent</button>
          </div>
        )}

        {/* Attendance Grid */}
        {students.length > 0 && (
          <>
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden mb-6">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-6 py-4 text-xs text-gray-400 uppercase font-semibold">Roll #</th>
                    <th className="px-6 py-4 text-xs text-gray-400 uppercase font-semibold">Name</th>
                    <th className="px-6 py-4 text-xs text-gray-400 uppercase font-semibold text-center">Status (Click to Toggle)</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-gray-400 font-mono text-sm">{s.roll_number || s.admission_number}</td>
                      <td className="px-6 py-4 font-medium">{s.firstName} {s.lastName}</td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => toggleStatus(s.id)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all min-w-[100px] ${statusColor(attendance[s.id])}`}>
                          {attendance[s.id]}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary + Submit */}
            <div className="flex items-center gap-6">
              <button onClick={handleSubmit} disabled={submitting} className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 hover:shadow-lg hover:shadow-blue-500/25">
                {submitting ? 'Saving...' : 'Save Attendance'}
              </button>
              <div className="flex gap-3 text-sm">
                <span className="text-emerald-400">{counts.present}P</span>
                <span className="text-red-400">{counts.absent}A</span>
                <span className="text-yellow-400">{counts.late}L</span>
                <span className="text-blue-400">{counts.excused}E</span>
              </div>
            </div>
          </>
        )}

        {selectedClassId && selectedSectionId && students.length === 0 && (
          <p className="text-gray-500 text-center py-12">No students enrolled in this class/section yet.</p>
        )}
      </main>
    </div>
  );
}
