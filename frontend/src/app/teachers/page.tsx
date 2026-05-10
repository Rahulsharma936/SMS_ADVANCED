'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface TeacherData {
  id: string;
  employee_id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  designation: string | null;
  specialization: string | null;
  status: string;
  user: { email: string; status: string };
  teacherSubjects: { subject: { id: string; name: string; code: string | null } }[];
  classSubjectTeachers: {
    class: { name: string };
    section: { name: string };
    subject: { name: string };
  }[];
  classTeacherSections: { name: string; class: { name: string } }[];
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const router = useRouter();

  const loadTeachers = async () => {
    try {
      setLoading(true);
      const params: string[] = [];
      if (search) params.push(`search=${encodeURIComponent(search)}`);
      if (statusFilter) params.push(`status=${statusFilter}`);
      const qs = params.length > 0 ? `?${params.join('&')}` : '';
      const data = await fetchApi(`/teachers${qs}`);
      setTeachers(data.teachers);
    } catch (err: any) {
      if (err.message?.includes('Unauthorized')) router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeachers();
  }, [search, statusFilter]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/20 text-emerald-400';
      case 'inactive': return 'bg-red-500/20 text-red-400';
      case 'on_leave': return 'bg-amber-500/20 text-amber-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            SMS Portal
          </a>
          <div className="flex gap-4 text-sm">
            <a href="/classes" className="text-gray-400 hover:text-white transition-colors">Classes</a>
            <a href="/students" className="text-gray-400 hover:text-white transition-colors">Students</a>
            <a href="/teachers" className="text-blue-400 font-medium">Teachers</a>
            <a href="/subjects" className="text-gray-400 hover:text-white transition-colors">Subjects</a>
            <a href="/attendance" className="text-gray-400 hover:text-white transition-colors">Attendance</a>
            <a href="/timetable" className="text-gray-400 hover:text-white transition-colors">Timetable</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in-up">
          <div>
            <h1 className="text-3xl font-bold">Teachers</h1>
            <p className="text-gray-500 mt-1">{teachers.length} teachers registered</p>
          </div>
          <a
            href="/teachers/add"
            className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-sm font-medium shadow-lg hover:shadow-blue-500/25 transition-all hover:scale-105"
          >
            + Add Teacher
          </a>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8 animate-fade-in-up delay-100">
          <input
            type="text"
            placeholder="Search name, employee ID, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-black/30 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 w-80 transition-colors"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-black/30 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="on_leave">On Leave</option>
          </select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-fade-in-up delay-100">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Active</p>
                <p className="text-2xl font-bold text-emerald-400">{teachers.filter(t => t.status === 'active').length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">On Leave</p>
                <p className="text-2xl font-bold text-amber-400">{teachers.filter(t => t.status === 'on_leave').length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Total Subjects</p>
                <p className="text-2xl font-bold text-purple-400">
                  {new Set(teachers.flatMap(t => t.teacherSubjects.map(ts => ts.subject.name))).size}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Teacher Table */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden animate-fade-in-up delay-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-5 py-4 text-xs text-gray-400 uppercase font-semibold">Employee ID</th>
                  <th className="px-5 py-4 text-xs text-gray-400 uppercase font-semibold">Name</th>
                  <th className="px-5 py-4 text-xs text-gray-400 uppercase font-semibold">Email</th>
                  <th className="px-5 py-4 text-xs text-gray-400 uppercase font-semibold">Designation</th>
                  <th className="px-5 py-4 text-xs text-gray-400 uppercase font-semibold">Subjects</th>
                  <th className="px-5 py-4 text-xs text-gray-400 uppercase font-semibold">Class Teacher</th>
                  <th className="px-5 py-4 text-xs text-gray-400 uppercase font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {teachers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-3">
                        <svg className="w-12 h-12 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        <p>No teachers found</p>
                        <a href="/teachers/add" className="text-blue-400 hover:underline text-sm">Add your first teacher</a>
                      </div>
                    </td>
                  </tr>
                ) : (
                  teachers.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => router.push(`/teachers/${t.id}`)}
                    >
                      <td className="px-5 py-4 font-mono text-sm text-blue-400">{t.employee_id}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                            {t.firstName[0]}{t.lastName[0]}
                          </div>
                          <span className="font-medium">{t.firstName} {t.lastName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-400 text-sm">{t.user?.email}</td>
                      <td className="px-5 py-4 text-gray-300 text-sm">{t.designation || '—'}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {t.teacherSubjects.length > 0 ? (
                            t.teacherSubjects.slice(0, 3).map((ts, i) => (
                              <span key={i} className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">
                                {ts.subject.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-600 text-xs">None</span>
                          )}
                          {t.teacherSubjects.length > 3 && (
                            <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded text-xs">
                              +{t.teacherSubjects.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm">
                        {t.classTeacherSections.length > 0 ? (
                          t.classTeacherSections.map((s, i) => (
                            <span key={i} className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded text-xs mr-1">
                              {s.class.name}-{s.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${statusColor(t.status)}`}>
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.5s ease-out forwards;
          opacity: 0;
        }
        .delay-100 { animation-delay: 100ms; }
        .delay-200 { animation-delay: 200ms; }
      `}</style>
    </div>
  );
}
