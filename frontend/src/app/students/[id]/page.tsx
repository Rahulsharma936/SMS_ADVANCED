'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

/* ── Helpers ── */
function Avatar({ name, size = 56 }: { name: string; size?: number }) {
  const initials = name.trim().split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b'];
  const bg = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, color: 'white', flexShrink: 0, boxShadow: `0 0 0 3px ${bg}30` }}>
      {initials}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid var(--border-subtle)', gap: '12px' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0, paddingTop: '1px' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 500, color: value ? 'var(--text-primary)' : 'var(--text-faint)', textAlign: 'right' }}>{value ?? '—'}</span>
    </div>
  );
}

function Section({ title, icon, children, accent = 'var(--brand-primary)' }: { title: string; icon: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="widget">
      <div className="widget-head">
        <span className="widget-title" style={{ color: accent }}>
          <svg width="13" height="13" fill="none" stroke={accent} viewBox="0 0 24 24" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d={icon}/>
          </svg>
          {title}
        </span>
      </div>
      <div style={{ padding: '4px 16px 8px' }}>
        {children}
      </div>
    </div>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = { ACTIVE: 'badge-green', GRADUATED: 'badge-blue', TRANSFERRED: 'badge-amber', INACTIVE: 'badge-red' };
  return `badge ${map[status] ?? 'badge-gray'}`;
}

/* ── Workflow link ───────────────────────────────────────────────────────────── */
function WorkflowLink({ href, icon, label, desc, color = 'var(--brand-primary)' }: {
  href: string; icon: string; label: string; desc: string; color?: string;
}) {
  return (
    <a href={href} style={{ textDecoration: 'none', display: 'block', marginBottom: '6px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 12px', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)',
        transition: 'all var(--transition-fast)', cursor: 'pointer',
      }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = `${color}40`; el.style.background = 'var(--bg-overlay)'; }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border-subtle)'; el.style.background = 'var(--bg-elevated)'; }}
      >
        <div style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-md)', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px' }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{desc}</div>
        </div>
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} style={{ color: 'var(--text-faint)', flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </a>
  );
}

export default function StudentDetailPage() {
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    fetchApi(`/students/${id}`)
      .then(d => setStudent(d.student))
      .catch(e => {
        if (e.message?.includes('not found')) setError('Student not found');
        else router.push('/login');
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) return <div className="page-loading"><div className="spinner spinner-lg"/></div>;

  if (error) return (
    <AppLayout>
      <div className="empty-state" style={{ minHeight: '50vh' }}>
        <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        <p className="empty-state-title">{error}</p>
        <a href="/students" className="btn btn-secondary">Back to Students</a>
      </div>
    </AppLayout>
  );

  const s = student;
  const name = `${s.firstName} ${s.lastName}`;

  return (
    <AppLayout>

      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px', fontSize: '12px' }}>
        <a href="/students" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
        >Students</a>
        <span style={{ color: 'var(--text-faint)' }}>›</span>
        <span style={{ color: 'var(--text-secondary)' }}>{name}</span>
        {s.class && <>
          <span style={{ color: 'var(--text-faint)' }}>·</span>
          <span style={{ color: 'var(--text-faint)' }}>{s.class.name}{s.section ? ` / ${s.section.name}` : ''}</span>
        </>}
      </div>

      {/* ── Profile header ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Avatar name={name} size={56}/>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '2px 8px', borderRadius: '4px' }}>
                {s.admission_number}
              </span>
              <span className={statusBadge(s.status)}>{s.status}</span>
              {s.class && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.class.name}{s.section ? ` — ${s.section.name}` : ''}</span>}
              {s.roll_number && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Roll #{s.roll_number}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a href="/students" className="btn btn-ghost" style={{ fontSize: '12px' }}>← Students</a>
          <a href={`/students/${id}/edit`} className="btn btn-secondary" style={{ fontSize: '12px' }}>Edit Profile</a>
        </div>
      </div>

      {/* ── Two-column layout: Info + Workflow Panel ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 256px', gap: '16px', alignItems: 'start' }}>

        {/* ── Left: Info cards ──────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px', marginBottom: '12px' }}>

            <Section title="Personal Information" icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" accent="#818cf8">
              <InfoRow label="Date of Birth" value={s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null}/>
              <InfoRow label="Gender"        value={s.gender}/>
              <InfoRow label="Blood Group"   value={s.blood_group}/>
              <InfoRow label="Admission Date" value={s.admissionDate ? new Date(s.admissionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null}/>
            </Section>

            <Section title="Academic Placement" icon="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" accent="#34d399">
              <InfoRow label="Class"         value={s.class?.name}/>
              <InfoRow label="Section"       value={s.section?.name}/>
              <InfoRow label="Roll Number"   value={s.roll_number}/>
              <InfoRow label="Academic Year" value={s.academic_year}/>
            </Section>

            <Section title="Parent / Guardian" icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" accent="#fbbf24">
              <InfoRow label="Father"  value={s.fatherName}/>
              <InfoRow label="Mother"  value={s.motherName}/>
              <InfoRow label="Contact" value={s.guardianContact}/>
              <InfoRow label="Email"   value={s.guardianEmail}/>
              {s.studentParents?.length > 0 && (
                <div style={{ paddingTop: '8px', marginTop: '4px', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '6px' }}>Linked Accounts</div>
                  {s.studentParents.map((sp: any) => (
                    <div key={sp.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{sp.parent.name} <span style={{ color: 'var(--text-faint)' }}>({sp.relation})</span></span>
                      {sp.is_emergency_contact && <span className="badge badge-red" style={{ fontSize: '10px' }}>Emergency</span>}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Address" icon="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" accent="#f87171">
              <InfoRow label="Address"     value={s.addressLine}/>
              <InfoRow label="City"        value={s.city}/>
              <InfoRow label="State"       value={s.state}/>
              <InfoRow label="Postal Code" value={s.postalCode}/>
            </Section>

            <Section title="Medical & Transport" icon="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" accent="#f87171">
              <InfoRow label="Allergies"          value={s.allergies}/>
              <InfoRow label="Chronic Conditions" value={s.chronicConditions}/>
              <InfoRow label="Emergency Notes"    value={s.emergencyNotes}/>
              <InfoRow label="Transport Required" value={s.transportRequired ? 'Yes' : 'No'}/>
            </Section>

            {s.documents?.length > 0 && (
              <Section title="Documents" icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" accent="#60a5fa">
                {s.documents.map((d: any) => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{d.name}</span>
                    <a href={d.url} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '11px' }}>View →</a>
                  </div>
                ))}
              </Section>
            )}
          </div>

          {/* Transfer history */}
          {s.transfersFrom?.length > 0 && (
            <div className="widget" style={{ marginTop: '12px' }}>
              <div className="widget-head">
                <span className="widget-title">
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                  Transfer History
                </span>
              </div>
              <div style={{ padding: '0 16px 8px' }}>
                {s.transfersFrom.map((t: any) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-faint)', flexShrink: 0 }}>{new Date(t.transferDate).toLocaleDateString('en-IN')}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{t.old_class?.name} {t.old_section?.name}</span>
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} style={{ color: 'var(--text-faint)', flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                    <span style={{ color: 'var(--brand-primary)' }}>{t.new_class?.name} {t.new_section?.name}</span>
                    {t.reason && <span style={{ color: 'var(--text-faint)', marginLeft: 'auto' }}>({t.reason})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Contextual Workflow Panel ─────────────────────────── */}
        <div style={{ position: 'sticky', top: '72px' }}>

          {/* Quick actions */}
          <div className="card" style={{ padding: '16px', marginBottom: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Related Workflows
            </div>
            <WorkflowLink href="/attendance"        icon="📋" label="Attendance"     desc="Mark or view class attendance" color="#4ade80" />
            <WorkflowLink href="/results"           icon="🏆" label="Results"        desc="Exam results & grade summary"   color="#a5b4fc" />
            <WorkflowLink href="/fees/assignments"  icon="💰" label="Fee Status"     desc="Fee structure & payment status" color="#34d399" />
            <WorkflowLink href="/marks-entry"       icon="✏️" label="Marks Entry"    desc="Enter or review exam marks"     color="#f59e0b" />
            <WorkflowLink href="/report-card"       icon="📄" label="Report Card"    desc="Generate academic report"       color="#60a5fa" />
            <WorkflowLink href="/leave"             icon="🗓" label="Leave"          desc="Leave applications"             color="#f87171" />
          </div>

          {/* Placement summary */}
          {(s.class || s.section) && (
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '10px' }}>
                Academic Context
              </div>
              {[
                { label: 'Class',    value: s.class?.name },
                { label: 'Section',  value: s.section?.name },
                { label: 'Roll',     value: s.roll_number ? `#${s.roll_number}` : null },
                { label: 'Year',     value: s.academic_year },
                { label: 'Status',   value: s.status },
              ].filter(r => r.value).map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </AppLayout>
  );
}
