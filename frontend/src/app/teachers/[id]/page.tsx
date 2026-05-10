'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface TeacherProfile {
  id: string; employee_id: string; firstName: string; lastName: string;
  phone: string | null; joining_date: string | null; qualification: string | null;
  experience_years: number | null; specialization: string | null;
  designation: string | null; status: string;
  user: { email: string; status: string; createdAt: string };
  teacherSubjects: { subject: { id: string; name: string; code: string | null } }[];
  classSubjectTeachers: { class: { id: string; name: string }; section: { id: string; name: string }; subject: { id: string; name: string; code: string | null } }[];
  classTeacherSections: { id: string; name: string; class: { id: string; name: string } }[];
  timetableSlots: { start_time: string; end_time: string; subject: { name: string }; timetable: { day_of_week: string; class: { name: string }; section: { name: string } } }[];
  workload: { totalPeriodsPerWeek: number; subjectsHandled: { name: string; count: number }[]; classesAssigned: { className: string; section: string; count: number }[]; periodsPerDay: Record<string, number> };
}

interface ClassData { id: string; name: string; sections: { id: string; name: string }[] }
interface SubjectData { id: string; name: string; code: string | null }

export default function TeacherProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'timetable' | 'assignments'>('overview');

  // Assignment modal state
  const [showClassModal, setShowClassModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [assignForm, setAssignForm] = useState({ class_id: '', section_id: '', subject_id: '' });
  const [assignError, setAssignError] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [editLoading, setEditLoading] = useState(false);

  const loadTeacher = async () => {
    try {
      const data = await fetchApi(`/teachers/${id}`);
      setTeacher(data.teacher);
      setEditForm({
        firstName: data.teacher.firstName, lastName: data.teacher.lastName,
        phone: data.teacher.phone || '', qualification: data.teacher.qualification || '',
        experience_years: data.teacher.experience_years ?? '', specialization: data.teacher.specialization || '',
        designation: data.teacher.designation || '', status: data.teacher.status,
      });
    } catch (err: any) {
      if (err.message?.includes('Unauthorized')) router.push('/login');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadTeacher(); }, [id]);

  const loadOptions = async () => {
    const [c, s] = await Promise.all([fetchApi('/classes').catch(() => ({ classes: [] })), fetchApi('/subjects').catch(() => ({ subjects: [] }))]);
    setClasses(c.classes || []); setSubjects(s.subjects || []);
  };

  const handleAssignClass = async () => {
    if (!assignForm.class_id || !assignForm.section_id) { setAssignError('Select class and section'); return; }
    setAssignLoading(true); setAssignError('');
    try {
      await fetchApi('/teachers/assign-class', { method: 'POST', data: { teacher_id: id, class_id: assignForm.class_id, section_id: assignForm.section_id } });
      setShowClassModal(false); setAssignForm({ class_id: '', section_id: '', subject_id: '' }); loadTeacher();
    } catch (err: any) { setAssignError(err.message); } finally { setAssignLoading(false); }
  };

  const handleAssignSubject = async () => {
    if (!assignForm.subject_id) { setAssignError('Select a subject'); return; }
    setAssignLoading(true); setAssignError('');
    try {
      await fetchApi('/teachers/assign-subject', { method: 'POST', data: { teacher_id: id, subject_id: assignForm.subject_id } });
      setShowSubjectModal(false); setAssignForm({ class_id: '', section_id: '', subject_id: '' }); loadTeacher();
    } catch (err: any) { setAssignError(err.message); } finally { setAssignLoading(false); }
  };

  const handleEdit = async () => {
    setEditLoading(true);
    try {
      const payload = { ...editForm, experience_years: editForm.experience_years ? parseInt(editForm.experience_years) : undefined };
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = undefined; });
      await fetchApi(`/teachers/${id}`, { method: 'PATCH', data: payload });
      setShowEdit(false); loadTeacher();
    } catch (err: any) { alert(err.message); } finally { setEditLoading(false); }
  };

  const statusColor = (s: string) => s === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : s === 'on_leave' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30';
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const selectedClass = classes.find(c => c.id === assignForm.class_id);

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!teacher) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white"><p>Teacher not found.</p></div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/teachers" className="text-blue-400 font-medium">Teachers</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button onClick={() => router.push('/teachers')} className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          All Teachers
        </button>

        {/* Profile Header */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 animate-fade-in-up">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl font-bold shadow-lg shadow-blue-500/20">
                {teacher.firstName[0]}{teacher.lastName[0]}
              </div>
              <div>
                <h1 className="text-2xl font-bold">{teacher.firstName} {teacher.lastName}</h1>
                <p className="text-gray-400 text-sm">{teacher.designation || 'Teacher'} · {teacher.employee_id}</p>
                <div className="flex gap-2 mt-2">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${statusColor(teacher.status)}`}>{teacher.status.replace('_', ' ')}</span>
                  {teacher.classTeacherSections.map((s, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">Class Teacher: {s.class.name}-{s.name}</span>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={() => setShowEdit(true)} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm hover:bg-white/10 transition-colors">Edit Profile</button>
          </div>
        </div>

        {/* Workload Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-fade-in-up delay-100">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <p className="text-3xl font-bold text-blue-400">{teacher.workload.totalPeriodsPerWeek}</p>
            <p className="text-xs text-gray-500 uppercase mt-1">Periods/Week</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <p className="text-3xl font-bold text-purple-400">{teacher.workload.subjectsHandled.length}</p>
            <p className="text-xs text-gray-500 uppercase mt-1">Subjects</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <p className="text-3xl font-bold text-emerald-400">{teacher.workload.classesAssigned.length}</p>
            <p className="text-xs text-gray-500 uppercase mt-1">Classes</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <p className="text-3xl font-bold text-amber-400">{teacher.experience_years ?? '—'}</p>
            <p className="text-xs text-gray-500 uppercase mt-1">Yrs Experience</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white/5 border border-white/10 rounded-xl p-1 w-fit animate-fade-in-up delay-100">
          {(['overview', 'timetable', 'assignments'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up delay-200">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-sm text-gray-400 uppercase font-semibold mb-4">Personal Info</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Email</dt><dd>{teacher.user.email}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Phone</dt><dd>{teacher.phone || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Joining Date</dt><dd>{teacher.joining_date ? new Date(teacher.joining_date).toLocaleDateString() : '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Qualification</dt><dd>{teacher.qualification || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Specialization</dt><dd>{teacher.specialization || '—'}</dd></div>
              </dl>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-sm text-gray-400 uppercase font-semibold mb-4">Workload Breakdown</h3>
              {teacher.workload.subjectsHandled.length > 0 ? (
                <div className="space-y-3">
                  {teacher.workload.subjectsHandled.map((s, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm">{s.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" style={{ width: `${Math.min((s.count / teacher.workload.totalPeriodsPerWeek) * 100, 100)}%` }}></div>
                        </div>
                        <span className="text-xs text-gray-400 w-16 text-right">{s.count} periods</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-600 text-sm">No timetable slots assigned yet</p>}
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm text-gray-400 uppercase font-semibold">Subjects</h3>
                <button onClick={() => { loadOptions(); setShowSubjectModal(true); setAssignError(''); }} className="text-xs text-blue-400 hover:text-blue-300">+ Assign</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {teacher.teacherSubjects.length > 0 ? teacher.teacherSubjects.map((ts, i) => (
                  <span key={i} className="px-3 py-1.5 bg-purple-500/15 border border-purple-500/20 text-purple-300 rounded-xl text-sm">{ts.subject.name}</span>
                )) : <p className="text-gray-600 text-sm">No subjects assigned</p>}
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-sm text-gray-400 uppercase font-semibold mb-4">Periods Per Day</h3>
              {Object.keys(teacher.workload.periodsPerDay).length > 0 ? (
                <div className="space-y-2">
                  {days.map(d => (
                    <div key={d} className="flex items-center justify-between text-sm">
                      <span className="text-gray-400 w-20">{d.slice(0, 3)}</span>
                      <div className="flex-1 mx-3 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all" style={{ width: `${((teacher.workload.periodsPerDay[d] || 0) / 8) * 100}%` }}></div>
                      </div>
                      <span className="text-gray-300 w-6 text-right">{teacher.workload.periodsPerDay[d] || 0}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-600 text-sm">No periods scheduled</p>}
            </div>
          </div>
        )}

        {/* Timetable Tab */}
        {tab === 'timetable' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden animate-fade-in-up delay-200">
            {teacher.timetableSlots.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-white/10">
                  <th className="px-5 py-4 text-xs text-gray-400 uppercase font-semibold">Day</th>
                  <th className="px-5 py-4 text-xs text-gray-400 uppercase font-semibold">Time</th>
                  <th className="px-5 py-4 text-xs text-gray-400 uppercase font-semibold">Subject</th>
                  <th className="px-5 py-4 text-xs text-gray-400 uppercase font-semibold">Class</th>
                </tr></thead>
                <tbody>{teacher.timetableSlots.map((slot, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3 text-gray-300">{slot.timetable.day_of_week}</td>
                    <td className="px-5 py-3 font-mono text-blue-400">{slot.start_time} - {slot.end_time}</td>
                    <td className="px-5 py-3"><span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">{slot.subject.name}</span></td>
                    <td className="px-5 py-3 text-gray-300">{slot.timetable.class.name}-{slot.timetable.section.name}</td>
                  </tr>
                ))}</tbody>
              </table>
            ) : <div className="p-12 text-center text-gray-600">No timetable slots assigned</div>}
          </div>
        )}

        {/* Assignments Tab */}
        {tab === 'assignments' && (
          <div className="space-y-6 animate-fade-in-up delay-200">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Class-Subject Assignments</h3>
                <button onClick={() => { loadOptions(); setShowClassModal(true); setAssignError(''); }} className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-xs hover:bg-blue-500/30 transition-colors">+ Assign Class Teacher</button>
              </div>
              {teacher.classSubjectTeachers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {teacher.classSubjectTeachers.map((cst, i) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                      <div><span className="font-medium text-sm">{cst.class.name}-{cst.section.name}</span></div>
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">{cst.subject.name}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-600 text-sm">No class-subject assignments</p>}
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="font-semibold mb-4">Class Teacher Of</h3>
              {teacher.classTeacherSections.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {teacher.classTeacherSections.map((s, i) => (
                    <div key={i} className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 px-4">
                      <span className="text-cyan-300 font-medium">{s.class.name} - Section {s.name}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-600 text-sm">Not assigned as class teacher</p>}
            </div>
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowEdit(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Edit Teacher Profile</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[['firstName', 'First Name'], ['lastName', 'Last Name'], ['phone', 'Phone'], ['qualification', 'Qualification'], ['experience_years', 'Experience (Yrs)'], ['specialization', 'Specialization'], ['designation', 'Designation']].map(([k, l]) => (
                <div key={k}><label className="text-xs text-gray-500 mb-1 block">{l}</label>
                  <input value={editForm[k] || ''} onChange={e => setEditForm({ ...editForm, [k]: e.target.value })} className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
              ))}
              <div><label className="text-xs text-gray-500 mb-1 block">Status</label>
                <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                  <option value="active">Active</option><option value="inactive">Inactive</option><option value="on_leave">On Leave</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowEdit(false)} className="px-4 py-2 bg-white/5 rounded-lg text-sm">Cancel</button>
              <button onClick={handleEdit} disabled={editLoading} className="px-4 py-2 bg-blue-600 rounded-lg text-sm disabled:opacity-50">{editLoading ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Class Teacher Modal */}
      {showClassModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowClassModal(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Assign as Class Teacher</h2>
            {assignError && <p className="text-red-400 text-sm mb-3 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">{assignError}</p>}
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500 mb-1 block">Class</label>
                <select value={assignForm.class_id} onChange={e => setAssignForm({ ...assignForm, class_id: e.target.value, section_id: '' })} className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="">Select Class</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {selectedClass && <div><label className="text-xs text-gray-500 mb-1 block">Section</label>
                <select value={assignForm.section_id} onChange={e => setAssignForm({ ...assignForm, section_id: e.target.value })} className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="">Select Section</option>{selectedClass.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowClassModal(false)} className="px-4 py-2 bg-white/5 rounded-lg text-sm">Cancel</button>
              <button onClick={handleAssignClass} disabled={assignLoading} className="px-4 py-2 bg-blue-600 rounded-lg text-sm disabled:opacity-50">{assignLoading ? 'Assigning...' : 'Assign'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Subject Modal */}
      {showSubjectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSubjectModal(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Assign Subject</h2>
            {assignError && <p className="text-red-400 text-sm mb-3 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">{assignError}</p>}
            <select value={assignForm.subject_id} onChange={e => setAssignForm({ ...assignForm, subject_id: e.target.value })} className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
              <option value="">Select Subject</option>{subjects.filter(s => !teacher?.teacherSubjects.some(ts => ts.subject.id === s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowSubjectModal(false)} className="px-4 py-2 bg-white/5 rounded-lg text-sm">Cancel</button>
              <button onClick={handleAssignSubject} disabled={assignLoading} className="px-4 py-2 bg-blue-600 rounded-lg text-sm disabled:opacity-50">{assignLoading ? 'Assigning...' : 'Assign'}</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; opacity: 0; }
        .delay-100 { animation-delay: 100ms; } .delay-200 { animation-delay: 200ms; }
      `}</style>
    </div>
  );
}
