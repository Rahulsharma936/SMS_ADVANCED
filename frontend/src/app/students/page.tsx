'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi, BACKEND_URL } from '@/lib/api';
import Cookies from 'js-cookie';
import AppLayout from '@/components/AppLayout';

interface StudentData {
  id: string; firstName: string; lastName: string; admission_number: string;
  roll_number: string | null; gender: string | null; fatherName: string | null;
  guardianContact: string | null; status: string;
  class: { id: string; name: string } | null;
  section: { id: string; name: string } | null;
}
interface ClassData { id: string; name: string; sections: { id: string; name: string }[]; }

/* ── Helpers ── */
function statusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: 'badge-green', GRADUATED: 'badge-blue',
    TRANSFERRED: 'badge-amber', INACTIVE: 'badge-red',
  };
  return `badge ${map[status] ?? 'badge-gray'}`;
}

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444'];
  const bg = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, color: 'white', flexShrink: 0 }}>
      {initials}
    </div>
  );
}

export default function StudentsPage() {
  const [students, setStudents]   = useState<StudentData[]>([]);
  const [classes,  setClasses]    = useState<ClassData[]>([]);
  const [total,    setTotal]      = useState(0);
  const [page,     setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,  setLoading]    = useState(true);
  const [filterClassId,   setFilterClassId]   = useState('');
  const [filterSectionId, setFilterSectionId] = useState('');
  const [filterStatus,    setFilterStatus]    = useState('');
  const [search,   setSearch]     = useState('');
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const selectedFilterClass = classes.find(c => c.id === filterClassId);
  const hasFilters = !!(filterClassId || filterSectionId || filterStatus || search);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params: string[] = [`page=${page}`, `limit=25`];
      if (filterClassId)   params.push(`class_id=${filterClassId}`);
      if (filterSectionId) params.push(`section_id=${filterSectionId}`);
      if (filterStatus)    params.push(`status=${filterStatus}`);
      if (search)          params.push(`search=${encodeURIComponent(search)}`);
      const data = await fetchApi(`/students?${params.join('&')}`);
      setStudents(data.students);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setSelected(new Set());
    } catch (err: any) {
      if (err.message?.includes('Unauthorized')) router.push('/login');
    } finally { setLoading(false); }
  }, [filterClassId, filterSectionId, filterStatus, search, page, router]);

  useEffect(() => { fetchApi('/classes').then(d => setClasses(d.classes)).catch(() => {}); }, []);
  useEffect(() => { loadStudents(); }, [loadStudents]);

  /* Keyboard shortcut: / to focus search */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const selectAll = () => selected.size === students.length ? setSelected(new Set()) : setSelected(new Set(students.map(s => s.id)));

  const handleBulkAction = async () => {
    if (!bulkAction || selected.size === 0) return;
    setBulkLoading(true);
    try {
      await fetchApi('/students/bulk-status', { method: 'POST', data: { student_ids: Array.from(selected), status: bulkAction } });
      setSelected(new Set()); setBulkAction('');
      loadStudents();
    } catch (err: any) { alert(err.message); }
    finally { setBulkLoading(false); }
  };

  const handleExport = () => {
    const params = [];
    if (filterClassId)   params.push(`class_id=${filterClassId}`);
    if (filterSectionId) params.push(`section_id=${filterSectionId}`);
    window.open(`${BACKEND_URL}/api/students/export?${params.join('&')}`, '_blank');
  };

  const clearFilters = () => {
    setFilterClassId(''); setFilterSectionId(''); setFilterStatus(''); setSearch(''); setPage(1);
  };

  return (
    <AppLayout>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Students
            <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '2px 8px', borderRadius: '100px' }}>
              {total}
            </span>
          </h1>
          <p className="page-subtitle">Manage student records, admissions, and class assignments</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={handleExport} className="btn btn-secondary">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Export
          </button>
          <a href="/students/import" className="btn btn-secondary">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12"/></svg>
            Import
          </a>
          <a href="/students/admit" className="btn btn-primary">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            New Admission
          </a>
        </div>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '320px' }}>
          <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input ref={searchRef} type="text" placeholder="Search name, adm#, phone… ( / )" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input" style={{ paddingLeft: '34px' }}/>
        </div>
        <select value={filterClassId} onChange={e => { setFilterClassId(e.target.value); setFilterSectionId(''); setPage(1); }} className="input" style={{ width: 'auto' }}>
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selectedFilterClass && (
          <select value={filterSectionId} onChange={e => { setFilterSectionId(e.target.value); setPage(1); }} className="input" style={{ width: 'auto' }}>
            <option value="">All Sections</option>
            {selectedFilterClass.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="input" style={{ width: 'auto' }}>
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="GRADUATED">Graduated</option>
          <option value="INACTIVE">Inactive</option>
          <option value="TRANSFERRED">Transferred</option>
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="btn btn-ghost" style={{ padding: '7px 10px', fontSize: '12px' }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            Clear
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--brand-subtle)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 'var(--radius-lg)', marginBottom: '14px', animation: 'fadeInUp 0.15s ease-out' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--brand-primary)', flexShrink: 0 }}/>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#a5b4fc' }}>{selected.size} student{selected.size !== 1 ? 's' : ''} selected</span>
          <select value={bulkAction} onChange={e => setBulkAction(e.target.value)} className="input" style={{ width: 'auto', fontSize: '12px', padding: '5px 10px' }}>
            <option value="">Change status…</option>
            <option value="GRADUATED">Graduate</option>
            <option value="INACTIVE">Deactivate</option>
            <option value="TRANSFERRED">Mark Transferred</option>
          </select>
          <button onClick={handleBulkAction} disabled={!bulkAction || bulkLoading} className="btn btn-primary" style={{ padding: '5px 12px', fontSize: '12px' }}>
            {bulkLoading ? 'Applying…' : 'Apply'}
          </button>
          <button onClick={() => setSelected(new Set())} className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '5px 8px', fontSize: '12px' }}>
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="data-table-wrap animate-fade-in-up">
        {loading ? (
          <div style={{ padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div className="spinner"/>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading students…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', padding: '10px 14px' }}>
                    <input type="checkbox" checked={selected.size === students.length && students.length > 0} onChange={selectAll}
                      aria-label="Select all students"
                      style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: 'var(--brand-primary)' }}/>
                  </th>
                  <th>Student</th>
                  <th>Adm. #</th>
                  <th>Class / Section</th>
                  <th className="col-hide-mobile">Roll</th>
                  <th className="col-hide-mobile">Guardian</th>
                  <th className="col-hide-mobile">Contact</th>
                  <th>Status</th>
                  <th style={{ width: '40px' }}/>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="empty-state">
                        <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
                        </svg>
                        <p className="empty-state-title">{hasFilters ? 'No students match your filters' : 'No students enrolled yet'}</p>
                        <p className="empty-state-desc">{hasFilters ? 'Try adjusting your search or filter criteria.' : 'Get started by admitting your first student.'}</p>
                        {hasFilters
                          ? <button onClick={clearFilters} className="btn btn-secondary">Clear filters</button>
                          : <a href="/students/admit" className="btn btn-primary">Admit first student</a>
                        }
                      </div>
                    </td>
                  </tr>
                ) : students.map(s => (
                  <tr
                  key={s.id}
                  onClick={() => router.push(`/students/${s.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/students/${s.id}`); }}
                  tabIndex={0}
                  aria-label={`${s.firstName} ${s.lastName}`}
                  style={{ cursor: 'pointer' }}
                >
                    <td onClick={e => e.stopPropagation()} style={{ padding: '10px 14px' }}>
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)}
                        aria-label={`Select ${s.firstName} ${s.lastName}`}
                        style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: 'var(--brand-primary)' }}/>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar name={`${s.firstName} ${s.lastName}`} size={30}/>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{s.firstName} {s.lastName}</div>
                          {s.gender && <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '1px' }}>{s.gender}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '12px', color: 'var(--brand-primary)' }}>
                      {s.admission_number}
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{s.class?.name ?? '—'}</div>
                      {s.section && <span className="badge badge-blue" style={{ marginTop: '3px', fontSize: '10px' }}>{s.section.name}</span>}
                    </td>
                    <td style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {s.roll_number ?? '—'}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.fatherName ?? '—'}</td>
                    <td style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>{s.guardianContact ?? '—'}</td>
                    <td><span className={statusBadge(s.status)}>{s.status}</span></td>
                    <td style={{ padding: '10px 12px' }}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75} style={{ color: 'var(--text-faint)', display: 'block' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                      </svg>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} of {total} students
          </span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '12px' }}>← Prev</button>
            <span style={{ padding: '5px 12px', fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              {page} / {totalPages}
            </span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '12px' }}>Next →</button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
