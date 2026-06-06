'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

interface ClassData { id: string; name: string; sections: { id: string; name: string }[]; }

/* ── Form field helpers ── */
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
      {children}{required && <span style={{ color: '#f87171', marginLeft: '3px' }}>*</span>}
    </label>
  );
}

function FormSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <svg width="14" height="14" fill="none" stroke="var(--brand-primary)" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d={icon}/></svg>
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function AdmitStudentPage() {
  const [classes,    setClasses]    = useState<ClassData[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');
  const [successId,  setSuccessId]  = useState('');
  const router = useRouter();

  const [f, setF] = useState({
    firstName: '', lastName: '', dateOfBirth: '', gender: '', blood_group: '',
    classId: '', sectionId: '', roll_number: '', admission_number: '',
    fatherName: '', motherName: '', guardianContact: '', guardianEmail: '',
    addressLine: '', city: '', state: '', postalCode: '',
    allergies: '', chronicConditions: '', emergencyNotes: '', transportRequired: false,
  });

  const set = (key: string, val: any) => setF(p => ({ ...p, [key]: val }));
  const selectedClass = classes.find(c => c.id === f.classId);

  useEffect(() => {
    fetchApi('/classes')
      .then(d => setClasses(d.classes))
      .catch(e => { if (e.message?.includes('Unauthorized')) router.push('/login'); })
      .finally(() => setLoading(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSuccess(''); setSubmitting(true);
    try {
      const res = await fetchApi('/students', { method: 'POST', data: {
        firstName: f.firstName, lastName: f.lastName, dateOfBirth: f.dateOfBirth || null,
        gender: f.gender || null, blood_group: f.blood_group || null,
        class_id: f.classId, section_id: f.sectionId,
        roll_number: f.roll_number || null, admission_number: f.admission_number || undefined,
        fatherName: f.fatherName || null, motherName: f.motherName || null,
        guardianContact: f.guardianContact || null, guardianEmail: f.guardianEmail || null,
        addressLine: f.addressLine || null, city: f.city || null, state: f.state || null, postalCode: f.postalCode || null,
        allergies: f.allergies || null, chronicConditions: f.chronicConditions || null,
        emergencyNotes: f.emergencyNotes || null, transportRequired: f.transportRequired,
      }});
      setSuccess(`${res.student.firstName} ${res.student.lastName} admitted — Adm# ${res.student.admission_number}`);
      setSuccessId(res.student.id);
      setF({ firstName:'',lastName:'',dateOfBirth:'',gender:'',blood_group:'',classId:'',sectionId:'',roll_number:'',admission_number:'',fatherName:'',motherName:'',guardianContact:'',guardianEmail:'',addressLine:'',city:'',state:'',postalCode:'',allergies:'',chronicConditions:'',emergencyNotes:'',transportRequired:false });
    } catch (err: any) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="page-loading"><div className="spinner spinner-lg"/></div>;

  return (
    <AppLayout>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">New Admission</h1>
          <p className="page-subtitle">Admission number is auto-generated if left blank</p>
        </div>
        <a href="/students" className="btn btn-secondary">← Back to Students</a>
      </div>

      {/* Feedback */}
      {error   && <div className="alert alert-error"   style={{ marginBottom: '16px' }}>{error}</div>}
      {success && (
        <div className="alert alert-success" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{success}</span>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <a href={`/students/${successId}`} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }}>View Profile</a>
            <button onClick={() => setSuccess('')} className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }}>+ Admit Another</button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Personal */}
        <FormSection title="Personal Information" icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <FieldLabel required>First Name</FieldLabel>
              <input value={f.firstName} onChange={e => set('firstName', e.target.value)} required placeholder="Rahul" className="input"/>
            </div>
            <div>
              <FieldLabel required>Last Name</FieldLabel>
              <input value={f.lastName} onChange={e => set('lastName', e.target.value)} required placeholder="Sharma" className="input"/>
            </div>
            <div>
              <FieldLabel>Date of Birth</FieldLabel>
              <input type="date" value={f.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} className="input"/>
            </div>
            <div>
              <FieldLabel>Gender</FieldLabel>
              <select value={f.gender} onChange={e => set('gender', e.target.value)} className="input">
                <option value="">Select</option>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
            <div>
              <FieldLabel>Blood Group</FieldLabel>
              <select value={f.blood_group} onChange={e => set('blood_group', e.target.value)} className="input">
                <option value="">Select</option>
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Admission # <span style={{ fontWeight: 400, color: 'var(--text-faint)', textTransform: 'none', letterSpacing: 0 }}>(auto)</span></FieldLabel>
              <input value={f.admission_number} onChange={e => set('admission_number', e.target.value)} placeholder="Leave blank for auto" className="input"/>
            </div>
          </div>
        </FormSection>

        {/* Academic */}
        <FormSection title="Academic Placement" icon="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <FieldLabel required>Class</FieldLabel>
              <select value={f.classId} onChange={e => { set('classId', e.target.value); set('sectionId', ''); }} required className="input">
                <option value="">Select class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel required>Section</FieldLabel>
              <select value={f.sectionId} onChange={e => set('sectionId', e.target.value)} required className="input" disabled={!f.classId}>
                <option value="">Select section</option>
                {selectedClass?.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Roll Number</FieldLabel>
              <input value={f.roll_number} onChange={e => set('roll_number', e.target.value)} placeholder="01" className="input"/>
            </div>
          </div>
          {f.classId && selectedClass?.sections.length === 0 && (
            <div className="alert alert-warning" style={{ marginTop: '12px' }}>
              ⚠️ This class has no sections yet.{' '}
              <a href="/classes" style={{ color: 'var(--brand-primary)' }}>Create sections first →</a>
            </div>
          )}
        </FormSection>

        {/* Guardian */}
        <FormSection title="Parent / Guardian" icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            <div><FieldLabel>Father&apos;s Name</FieldLabel><input value={f.fatherName} onChange={e => set('fatherName', e.target.value)} className="input"/></div>
            <div><FieldLabel>Mother&apos;s Name</FieldLabel><input value={f.motherName} onChange={e => set('motherName', e.target.value)} className="input"/></div>
            <div><FieldLabel>Contact</FieldLabel><input type="tel" value={f.guardianContact} onChange={e => set('guardianContact', e.target.value)} placeholder="+91 98765 43210" className="input"/></div>
            <div><FieldLabel>Email</FieldLabel><input type="email" value={f.guardianEmail} onChange={e => set('guardianEmail', e.target.value)} className="input"/></div>
          </div>
        </FormSection>

        {/* Address */}
        <FormSection title="Address" icon="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            <div style={{ gridColumn: '1 / -1' }}><FieldLabel>Street Address</FieldLabel><input value={f.addressLine} onChange={e => set('addressLine', e.target.value)} placeholder="123 Main Street" className="input"/></div>
            <div><FieldLabel>City</FieldLabel><input value={f.city} onChange={e => set('city', e.target.value)} className="input"/></div>
            <div><FieldLabel>State</FieldLabel><input value={f.state} onChange={e => set('state', e.target.value)} className="input"/></div>
            <div><FieldLabel>Postal Code</FieldLabel><input value={f.postalCode} onChange={e => set('postalCode', e.target.value)} className="input"/></div>
          </div>
        </FormSection>

        {/* Medical */}
        <FormSection title="Medical & Transport" icon="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            <div><FieldLabel>Allergies</FieldLabel><input value={f.allergies} onChange={e => set('allergies', e.target.value)} placeholder="None" className="input"/></div>
            <div><FieldLabel>Chronic Conditions</FieldLabel><input value={f.chronicConditions} onChange={e => set('chronicConditions', e.target.value)} placeholder="None" className="input"/></div>
            <div><FieldLabel>Emergency Notes</FieldLabel><input value={f.emergencyNotes} onChange={e => set('emergencyNotes', e.target.value)} className="input"/></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '24px' }}>
              <input type="checkbox" id="transport" checked={f.transportRequired} onChange={e => set('transportRequired', e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--brand-primary)', cursor: 'pointer' }}/>
              <label htmlFor="transport" style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>Transport Required</label>
            </div>
          </div>
        </FormSection>

        {/* Submit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '8px' }}>
          <button type="submit" disabled={submitting} className="btn btn-primary" style={{ padding: '9px 22px' }}>
            {submitting ? (
              <><div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}/> Admitting…</>
            ) : 'Admit Student'}
          </button>
          <a href="/students" className="btn btn-ghost">Cancel</a>
        </div>

      </form>
    </AppLayout>
  );
}
