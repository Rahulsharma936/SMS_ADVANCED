'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';

interface ClassData { id: string; name: string; sections: { id: string; name: string }[]; }
interface SubjectData { id: string; name: string; }
interface TeacherData { id: string; firstName: string; lastName: string; }
interface SlotData {
  id: string; start_time: string; end_time: string; period_number: number | null;
  subject: { name: string; code?: string }; teacher: { firstName: string; lastName: string };
}
interface TimetableData { id: string; day_of_week: string; slots: SlotData[]; class: { name: string }; section: { name: string }; }

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_COLORS: Record<string, string> = {
  Monday: 'border-l-blue-500', Tuesday: 'border-l-emerald-500', Wednesday: 'border-l-purple-500',
  Thursday: 'border-l-amber-500', Friday: 'border-l-rose-500', Saturday: 'border-l-cyan-500',
};

export default function TimetablePage() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [timetables, setTimetables] = useState<TimetableData[]>([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [slotForm, setSlotForm] = useState({ day: '', subject_id: '', teacher_id: '', start_time: '', end_time: '' });
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState('');
  const [loading, setLoading] = useState(true);

  const selectedClass = classes.find((c) => c.id === classId);

  useEffect(() => {
    Promise.all([fetchApi('/classes'), fetchApi('/subjects'), fetchApi('/teachers')])
      .then(([c, s, t]) => { setClasses(c.classes); setSubjects(s.subjects); setTeachers(t.teachers); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const loadTimetable = async () => {
    if (!classId || !sectionId) return;
    try {
      const d = await fetchApi(`/timetable/${classId}/${sectionId}`);
      setTimetables(d.timetables);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { if (classId && sectionId) loadTimetable(); }, [classId, sectionId]);

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setConflict('');

    // Find or create timetable for this day
    let timetable = timetables.find((t) => t.day_of_week === slotForm.day);
    if (!timetable) {
      try {
        const res = await fetchApi('/timetable', { method: 'POST', data: { class_id: classId, section_id: sectionId, day_of_week: slotForm.day } });
        await loadTimetable();
        timetable = res.timetable;
      } catch (err: any) {
        // If already exists, fetch it
        await loadTimetable();
        timetable = timetables.find((t) => t.day_of_week === slotForm.day);
        if (!timetable) { setError('Failed to create timetable'); return; }
      }
    }

    try {
      await fetchApi('/timetable/slots', { method: 'POST', data: {
        timetable_id: timetable!.id,
        subject_id: slotForm.subject_id,
        teacher_id: slotForm.teacher_id,
        start_time: slotForm.start_time,
        end_time: slotForm.end_time,
      }});
      setShowSlotForm(false);
      setSlotForm({ day: '', subject_id: '', teacher_id: '', start_time: '', end_time: '' });
      loadTimetable();
    } catch (err: any) {
      if (err.message?.includes('conflict') || err.message?.includes('Conflict') || err.message?.includes('overlap') || err.message?.includes('already')) {
        setConflict(err.message);
      } else {
        setError(err.message);
      }
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    try {
      await fetchApi(`/timetable/slots/${slotId}`, { method: 'DELETE' });
      loadTimetable();
    } catch (e: any) { alert(e.message); }
  };

  const inp = "w-full bg-black/30 border border-gray-700/50 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-all";

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/classes" className="text-gray-400 hover:text-white">Classes</a>
            <a href="/students" className="text-gray-400 hover:text-white">Students</a>
            <a href="/subjects" className="text-gray-400 hover:text-white">Subjects</a>
            <a href="/timetable" className="text-blue-400 font-medium">Timetable</a>
            <a href="/syllabus" className="text-gray-400 hover:text-white">Syllabus</a>
            <a href="/calendar" className="text-gray-400 hover:text-white">Calendar</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white">Dashboard</a>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Timetable Builder</h1>
        </div>

        {/* Class/Section Selector */}
        <div className="flex gap-4 mb-6">
          <select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(''); setTimetables([]); }} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm w-48">
            <option value="">Select Class</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {selectedClass && (
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm w-48">
              <option value="">Select Section</option>
              {selectedClass.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {classId && sectionId && (
            <button onClick={() => setShowSlotForm(!showSlotForm)} className="px-4 py-2 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-lg text-sm font-medium">+ Add Period</button>
          )}
        </div>

        {/* Add Slot Form */}
        {showSlotForm && (
          <form onSubmit={handleAddSlot} className="bg-white/5 border border-white/10 p-6 rounded-2xl mb-8 space-y-4">
            {error && <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm">{error}</div>}
            {conflict && <div className="bg-amber-500/10 border border-amber-500/50 text-amber-200 p-3 rounded-lg text-sm">⚠️ {conflict}</div>}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Day</label>
                <select value={slotForm.day} onChange={(e) => setSlotForm({ ...slotForm, day: e.target.value })} required className={inp}>
                  <option value="">Select Day</option>{DAYS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Subject</label>
                <select value={slotForm.subject_id} onChange={(e) => setSlotForm({ ...slotForm, subject_id: e.target.value })} required className={inp}>
                  <option value="">Select Subject</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Teacher</label>
                <select value={slotForm.teacher_id} onChange={(e) => setSlotForm({ ...slotForm, teacher_id: e.target.value })} required className={inp}>
                  <option value="">Select Teacher</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Start Time</label>
                <input type="time" value={slotForm.start_time} onChange={(e) => setSlotForm({ ...slotForm, start_time: e.target.value })} required className={inp} style={{ colorScheme: 'dark' }} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">End Time</label>
                <input type="time" value={slotForm.end_time} onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })} required className={inp} style={{ colorScheme: 'dark' }} />
              </div>
            </div>
            <button type="submit" className="px-6 py-2 bg-blue-600 rounded-lg text-sm font-medium">Add Period</button>
          </form>
        )}

        {/* Timetable Grid */}
        {classId && sectionId && (
          <div className="space-y-4">
            {DAYS.map((day) => {
              const tt = timetables.find((t) => t.day_of_week === day);
              return (
                <div key={day} className={`bg-white/5 border border-white/10 rounded-xl p-4 border-l-4 ${DAY_COLORS[day]}`}>
                  <h3 className="font-semibold text-sm mb-3">{day}</h3>
                  {!tt || tt.slots.length === 0 ? (
                    <p className="text-gray-600 text-xs">No periods</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {tt.slots.map((s) => (
                        <div key={s.id} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm group relative">
                          <div className="font-medium text-blue-300">{s.subject.name}</div>
                          <div className="text-xs text-gray-400">{s.start_time} – {s.end_time}</div>
                          <div className="text-xs text-gray-500">{s.teacher.firstName} {s.teacher.lastName}</div>
                          <button onClick={() => handleDeleteSlot(s.id)} className="absolute -top-1 -right-1 hidden group-hover:flex w-5 h-5 bg-red-500 rounded-full items-center justify-center text-white text-xs">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!classId && <p className="text-gray-500 text-center py-20">Select a class and section to view/build the timetable</p>}
      </main>
    </div>
  );
}
