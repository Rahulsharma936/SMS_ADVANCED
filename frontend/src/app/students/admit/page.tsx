'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface ClassData { id: string; name: string; sections: { id: string; name: string }[]; }

export default function AdmitStudentPage() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  // Form
  const [f, setF] = useState({
    firstName: '', lastName: '', dateOfBirth: '', gender: '', blood_group: '',
    classId: '', sectionId: '', roll_number: '', admission_number: '',
    fatherName: '', motherName: '', guardianContact: '', guardianEmail: '',
    addressLine: '', city: '', state: '', postalCode: '',
    allergies: '', chronicConditions: '', emergencyNotes: '', transportRequired: false,
  });

  const set = (key: string, val: any) => setF((p) => ({ ...p, [key]: val }));
  const selectedClass = classes.find((c) => c.id === f.classId);

  useEffect(() => {
    fetchApi('/classes').then((d) => setClasses(d.classes)).catch((e) => { if (e.message?.includes('Unauthorized')) router.push('/login'); }).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSuccess(''); setSubmitting(true);
    try {
      const res = await fetchApi('/students', { method: 'POST', data: {
        firstName: f.firstName, lastName: f.lastName, dateOfBirth: f.dateOfBirth || null, gender: f.gender || null,
        blood_group: f.blood_group || null, class_id: f.classId, section_id: f.sectionId,
        roll_number: f.roll_number || null, admission_number: f.admission_number || undefined,
        fatherName: f.fatherName || null, motherName: f.motherName || null,
        guardianContact: f.guardianContact || null, guardianEmail: f.guardianEmail || null,
        addressLine: f.addressLine || null, city: f.city || null, state: f.state || null, postalCode: f.postalCode || null,
        allergies: f.allergies || null, chronicConditions: f.chronicConditions || null,
        emergencyNotes: f.emergencyNotes || null, transportRequired: f.transportRequired,
      }});
      setSuccess(`${res.student.firstName} ${res.student.lastName} admitted — Adm# ${res.student.admission_number}`);
      setF({ firstName: '', lastName: '', dateOfBirth: '', gender: '', blood_group: '', classId: '', sectionId: '', roll_number: '', admission_number: '', fatherName: '', motherName: '', guardianContact: '', guardianEmail: '', addressLine: '', city: '', state: '', postalCode: '', allergies: '', chronicConditions: '', emergencyNotes: '', transportRequired: false });
    } catch (err: any) { setError(err.message); } finally { setSubmitting(false); }
  };

  const inp = "w-full bg-black/30 border border-gray-700/50 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-600";
  const lbl = "block text-gray-300 text-xs font-semibold mb-1 uppercase tracking-wide";

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
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div><h1 className="text-3xl font-bold">New Admission</h1><p className="text-gray-400 mt-1 text-sm">Admission number auto-generated if left blank</p></div>
          <a href="/students" className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg">← Back</a>
        </div>
        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm">{error}</div>}
        {success && <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-200 p-3 rounded-lg mb-6 text-sm">{success}</div>}
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-blue-400">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className={lbl}>First Name *</label><input value={f.firstName} onChange={(e) => set('firstName', e.target.value)} required placeholder="John" className={inp} /></div>
              <div><label className={lbl}>Last Name *</label><input value={f.lastName} onChange={(e) => set('lastName', e.target.value)} required placeholder="Doe" className={inp} /></div>
              <div><label className={lbl}>Date of Birth</label><input type="date" value={f.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Gender</label><select value={f.gender} onChange={(e) => set('gender', e.target.value)} className={inp}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></div>
              <div><label className={lbl}>Blood Group</label><select value={f.blood_group} onChange={(e) => set('blood_group', e.target.value)} className={inp}><option value="">Select</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b=><option key={b}>{b}</option>)}</select></div>
              <div><label className={lbl}>Admission # (auto)</label><input value={f.admission_number} onChange={(e) => set('admission_number', e.target.value)} placeholder="Leave blank for auto" className={inp} /></div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-purple-400">Academic Placement</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className={lbl}>Class *</label><select value={f.classId} onChange={(e) => { set('classId', e.target.value); set('sectionId', ''); }} required className={inp}><option value="">Select</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label className={lbl}>Section *</label><select value={f.sectionId} onChange={(e) => set('sectionId', e.target.value)} required className={inp}><option value="">Select</option>{selectedClass?.sections.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label className={lbl}>Roll Number</label><input value={f.roll_number} onChange={(e) => set('roll_number', e.target.value)} placeholder="01" className={inp} /></div>
            </div>
            {f.classId && selectedClass && selectedClass.sections.length === 0 && (
              <div className="mt-3 bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg text-sm text-amber-200">
                ⚠️ This class has no sections yet. <a href="/classes" className="text-blue-400 hover:underline font-medium">Go to Classes page</a> to create sections first.
              </div>
            )}
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-emerald-400">Parent / Guardian</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={lbl}>Father&apos;s Name</label><input value={f.fatherName} onChange={(e) => set('fatherName', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Mother&apos;s Name</label><input value={f.motherName} onChange={(e) => set('motherName', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Contact</label><input type="tel" value={f.guardianContact} onChange={(e) => set('guardianContact', e.target.value)} placeholder="+91 98765 43210" className={inp} /></div>
              <div><label className={lbl}>Email</label><input type="email" value={f.guardianEmail} onChange={(e) => set('guardianEmail', e.target.value)} className={inp} /></div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-amber-400">Address</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><label className={lbl}>Address</label><input value={f.addressLine} onChange={(e) => set('addressLine', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>City</label><input value={f.city} onChange={(e) => set('city', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>State</label><input value={f.state} onChange={(e) => set('state', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Postal Code</label><input value={f.postalCode} onChange={(e) => set('postalCode', e.target.value)} className={inp} /></div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-rose-400">Medical & Transport</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={lbl}>Allergies</label><input value={f.allergies} onChange={(e) => set('allergies', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Chronic Conditions</label><input value={f.chronicConditions} onChange={(e) => set('chronicConditions', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Emergency Notes</label><input value={f.emergencyNotes} onChange={(e) => set('emergencyNotes', e.target.value)} className={inp} /></div>
              <div className="flex items-center gap-3 pt-6"><input type="checkbox" checked={f.transportRequired} onChange={(e) => set('transportRequired', e.target.checked)} className="w-4 h-4 rounded" /><label className="text-sm text-gray-300">Transport Required</label></div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button type="submit" disabled={submitting} className="px-8 py-3 bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white font-semibold rounded-xl shadow-lg disabled:opacity-50">{submitting ? 'Admitting...' : 'Admit Student'}</button>
            <a href="/students" className="px-6 py-3 text-gray-400 hover:text-white text-sm">Cancel</a>
          </div>
        </form>
      </main>
    </div>
  );
}
