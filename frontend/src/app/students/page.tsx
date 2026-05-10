'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi, BACKEND_URL } from '@/lib/api';
import Cookies from 'js-cookie';

interface StudentData {
  id: string; firstName: string; lastName: string; admission_number: string;
  roll_number: string | null; gender: string | null; fatherName: string | null;
  guardianContact: string | null; status: string;
  class: { id: string; name: string }; section: { id: string; name: string };
}

interface ClassData { id: string; name: string; sections: { id: string; name: string }[]; }

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterClassId, setFilterClassId] = useState('');
  const [filterSectionId, setFilterSectionId] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const router = useRouter();

  const selectedFilterClass = classes.find((c) => c.id === filterClassId);

  const loadStudents = async () => {
    try {
      const params: string[] = [`page=${page}`, `limit=25`];
      if (filterClassId) params.push(`class_id=${filterClassId}`);
      if (filterSectionId) params.push(`section_id=${filterSectionId}`);
      if (search) params.push(`search=${encodeURIComponent(search)}`);
      const data = await fetchApi(`/students?${params.join('&')}`);
      setStudents(data.students);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      if (err.message?.includes('Unauthorized')) router.push('/login');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchApi('/classes').then((d) => setClasses(d.classes)).catch(() => {}); }, []);
  useEffect(() => { loadStudents(); }, [filterClassId, filterSectionId, search, page]);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const selectAll = () => {
    if (selected.size === students.length) setSelected(new Set());
    else setSelected(new Set(students.map((s) => s.id)));
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selected.size === 0) return;
    try {
      await fetchApi('/students/bulk-status', { method: 'POST', data: { student_ids: Array.from(selected), status: bulkAction } });
      setSelected(new Set());
      setBulkAction('');
      loadStudents();
    } catch (err: any) { alert(err.message); }
  };

  const handleExport = () => {
    const token = Cookies.get('token');
    const tenantId = Cookies.get('tenant_id');
    const params = [];
    if (filterClassId) params.push(`class_id=${filterClassId}`);
    if (filterSectionId) params.push(`section_id=${filterSectionId}`);
    window.open(`${BACKEND_URL}/api/students/export?${params.join('&')}`, '_blank');
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/classes" className="text-gray-400 hover:text-white transition-colors">Classes</a>
            <a href="/students" className="text-blue-400 font-medium">Students</a>
            <a href="/attendance" className="text-gray-400 hover:text-white transition-colors">Attendance</a>
            <a href="/timetable" className="text-gray-400 hover:text-white transition-colors">Timetable</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Students <span className="text-gray-500 text-lg font-normal">({total})</span></h1>
          <div className="flex gap-3">
            <a href="/students/import" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors">Import Excel</a>
            <a href="/students/admit" className="px-4 py-2 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-lg text-sm font-medium shadow-lg">+ New Admission</a>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input type="text" placeholder="Search name, admission#, phone..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500 w-72" />
          <select value={filterClassId} onChange={(e) => { setFilterClassId(e.target.value); setFilterSectionId(''); setPage(1); }} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm">
            <option value="">All Classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {selectedFilterClass && (
            <select value={filterSectionId} onChange={(e) => { setFilterSectionId(e.target.value); setPage(1); }} className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm">
              <option value="">All Sections</option>
              {selectedFilterClass.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>

        {/* Bulk Actions */}
        {selected.size > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg mb-4 flex items-center gap-4 text-sm">
            <span>{selected.size} selected</span>
            <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} className="bg-black/30 border border-gray-700 rounded px-3 py-1 text-white text-sm">
              <option value="">Action...</option>
              <option value="GRADUATED">Graduate</option>
              <option value="INACTIVE">Deactivate</option>
              <option value="TRANSFERRED">Mark Transferred</option>
            </select>
            <button onClick={handleBulkAction} disabled={!bulkAction} className="px-3 py-1 bg-blue-600 rounded text-sm disabled:opacity-50">Apply</button>
            <button onClick={() => setSelected(new Set())} className="text-gray-400 hover:text-white text-sm ml-auto">Clear</button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-4"><input type="checkbox" checked={selected.size === students.length && students.length > 0} onChange={selectAll} /></th>
                  <th className="px-4 py-4 text-xs text-gray-400 uppercase font-semibold">Adm. #</th>
                  <th className="px-4 py-4 text-xs text-gray-400 uppercase font-semibold">Name</th>
                  <th className="px-4 py-4 text-xs text-gray-400 uppercase font-semibold">Class</th>
                  <th className="px-4 py-4 text-xs text-gray-400 uppercase font-semibold">Sec</th>
                  <th className="px-4 py-4 text-xs text-gray-400 uppercase font-semibold">Roll</th>
                  <th className="px-4 py-4 text-xs text-gray-400 uppercase font-semibold">Father</th>
                  <th className="px-4 py-4 text-xs text-gray-400 uppercase font-semibold">Contact</th>
                  <th className="px-4 py-4 text-xs text-gray-400 uppercase font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr><td colSpan={9} className="px-6 py-12 text-center text-gray-500">No students found. <a href="/students/admit" className="text-blue-400 hover:underline">Admit one now</a></td></tr>
                ) : students.map((s) => (
                  <tr key={s.id} className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer" onClick={() => router.push(`/students/${s.id}`)}>
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} /></td>
                    <td className="px-4 py-4 font-mono text-sm text-blue-400">{s.admission_number}</td>
                    <td className="px-4 py-4 font-medium">{s.firstName} {s.lastName}</td>
                    <td className="px-4 py-4">{s.class?.name}</td>
                    <td className="px-4 py-4"><span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">{s.section?.name}</span></td>
                    <td className="px-4 py-4 text-gray-400">{s.roll_number || '—'}</td>
                    <td className="px-4 py-4 text-gray-400 text-sm">{s.fatherName || '—'}</td>
                    <td className="px-4 py-4 text-gray-400 text-sm">{s.guardianContact || '—'}</td>
                    <td className="px-4 py-4"><span className={`px-2 py-0.5 rounded text-xs font-medium ${s.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : s.status === 'GRADUATED' ? 'bg-blue-500/20 text-blue-400' : s.status === 'TRANSFERRED' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 bg-white/5 border border-white/10 rounded text-sm disabled:opacity-30">Prev</button>
            <span className="text-sm text-gray-400">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 bg-white/5 border border-white/10 rounded text-sm disabled:opacity-30">Next</button>
          </div>
        )}
      </main>
    </div>
  );
}
