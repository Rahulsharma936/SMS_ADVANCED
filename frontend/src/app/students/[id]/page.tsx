'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { fetchApi } from '@/lib/api';

export default function StudentDetailPage() {
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    fetchApi(`/students/${id}`).then((d) => setStudent(d.student)).catch((e) => { if (e.message?.includes('not found')) setError('Student not found'); else router.push('/login'); }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
  if (error) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-red-400">{error}</div>;

  const s = student;
  const info = (label: string, val: any) => (
    <div className="flex justify-between py-2 border-b border-white/5">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-white text-sm font-medium">{val || '—'}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/students" className="text-blue-400 font-medium">Students</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">{s.firstName} {s.lastName}</h1>
            <p className="text-gray-400 font-mono text-sm mt-1">{s.admission_number}</p>
          </div>
          <div className="flex gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${s.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{s.status}</span>
            <a href="/students" className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg">← Back</a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-blue-400">Personal</h2>
            {info('Gender', s.gender)}
            {info('Date of Birth', s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString() : null)}
            {info('Blood Group', s.blood_group)}
            {info('Admission Date', new Date(s.admissionDate).toLocaleDateString())}
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-purple-400">Academic</h2>
            {info('Class', s.class?.name)}
            {info('Section', s.section?.name)}
            {info('Roll Number', s.roll_number)}
            {info('Academic Year', s.academic_year)}
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-emerald-400">Parent / Guardian</h2>
            {info('Father', s.fatherName)}
            {info('Mother', s.motherName)}
            {info('Contact', s.guardianContact)}
            {info('Email', s.guardianEmail)}
            {s.studentParents?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-xs text-gray-500 uppercase mb-2">Linked Parents</p>
                {s.studentParents.map((sp: any) => (
                  <div key={sp.id} className="text-sm text-gray-300">{sp.parent.name} ({sp.relation}) {sp.is_emergency_contact ? '🆘' : ''}</div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-amber-400">Address</h2>
            {info('Address', s.addressLine)}
            {info('City', s.city)}
            {info('State', s.state)}
            {info('Postal Code', s.postalCode)}
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-rose-400">Medical</h2>
            {info('Allergies', s.allergies)}
            {info('Chronic Conditions', s.chronicConditions)}
            {info('Emergency Notes', s.emergencyNotes)}
            {info('Transport Required', s.transportRequired ? 'Yes' : 'No')}
          </div>
          {s.documents?.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4 text-cyan-400">Documents</h2>
              {s.documents.map((d: any) => (
                <div key={d.id} className="flex justify-between py-2 border-b border-white/5">
                  <span className="text-sm">{d.name}</span>
                  <a href={d.url} target="_blank" className="text-blue-400 text-xs hover:underline">View</a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transfer History */}
        {s.transfersFrom?.length > 0 && (
          <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-orange-400">Transfer History</h2>
            {s.transfersFrom.map((t: any) => (
              <div key={t.id} className="flex items-center gap-4 py-2 border-b border-white/5 text-sm">
                <span className="text-gray-400">{new Date(t.transferDate).toLocaleDateString()}</span>
                <span>{t.old_class.name} {t.old_section.name}</span>
                <span className="text-gray-500">→</span>
                <span className="text-blue-400">{t.new_class.name} {t.new_section.name}</span>
                {t.reason && <span className="text-gray-500 ml-auto">({t.reason})</span>}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
