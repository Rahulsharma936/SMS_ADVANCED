'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface SubjectData {
  id: string;
  name: string;
  code: string | null;
}

export default function AddTeacherPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [form, setForm] = useState({
    employee_id: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    joining_date: '',
    qualification: '',
    experience_years: '',
    specialization: '',
    designation: '',
  });

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  useEffect(() => {
    fetchApi('/subjects')
      .then((d) => setSubjects(d.subjects || []))
      .catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const toggleSubject = (id: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.employee_id || !form.firstName || !form.lastName || !form.email) {
      setError('Employee ID, First Name, Last Name, and Email are required.');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        ...form,
        experience_years: form.experience_years ? parseInt(form.experience_years) : undefined,
      };

      // Remove empty optional fields
      Object.keys(payload).forEach((key) => {
        if (payload[key] === '' || payload[key] === undefined) delete payload[key];
      });

      const result = await fetchApi('/teachers', { method: 'POST', data: payload });

      // Assign selected subjects
      if (selectedSubjects.length > 0 && result.teacher?.id) {
        for (const subjectId of selectedSubjects) {
          try {
            await fetchApi('/teachers/assign-subject', {
              method: 'POST',
              data: { teacher_id: result.teacher.id, subject_id: subjectId },
            });
          } catch {
            // Ignore duplicate assignment errors
          }
        }
      }

      setSuccess('Teacher created successfully!');
      setTimeout(() => router.push('/teachers'), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to create teacher');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            SMS Portal
          </a>
          <div className="flex gap-4 text-sm">
            <a href="/teachers" className="text-blue-400 font-medium">Teachers</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8 animate-fade-in-up">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm mb-4 flex items-center gap-1 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Teachers
          </button>
          <h1 className="text-3xl font-bold">Add New Teacher</h1>
          <p className="text-gray-500 mt-1">Create a teacher profile with an associated user account</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm animate-fade-in-up">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl mb-6 text-sm animate-fade-in-up">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Identity Section */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-fade-in-up delay-100">
            <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs">1</div>
              Basic Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase font-semibold mb-2">Employee ID *</label>
                <input name="employee_id" value={form.employee_id} onChange={handleChange} required
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                  placeholder="e.g. EMP001" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-semibold mb-2">Designation</label>
                <select name="designation" value={form.designation} onChange={handleChange}
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500">
                  <option value="">Select Designation</option>
                  <option value="PRT">PRT (Primary Teacher)</option>
                  <option value="TGT">TGT (Trained Graduate Teacher)</option>
                  <option value="PGT">PGT (Post Graduate Teacher)</option>
                  <option value="HOD">HOD (Head of Department)</option>
                  <option value="Senior Teacher">Senior Teacher</option>
                  <option value="Vice Principal">Vice Principal</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-semibold mb-2">First Name *</label>
                <input name="firstName" value={form.firstName} onChange={handleChange} required
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                  placeholder="First name" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-semibold mb-2">Last Name *</label>
                <input name="lastName" value={form.lastName} onChange={handleChange} required
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                  placeholder="Last name" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-semibold mb-2">Phone</label>
                <input name="phone" value={form.phone} onChange={handleChange}
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                  placeholder="e.g. +91 98765 43210" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-semibold mb-2">Joining Date</label>
                <input name="joining_date" type="date" value={form.joining_date} onChange={handleChange}
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors" />
              </div>
            </div>
          </div>

          {/* Account Section */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-fade-in-up delay-100">
            <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">2</div>
              Login Account
            </h2>
            <p className="text-gray-500 text-sm mb-4">A user account will be created automatically if one doesn&apos;t exist for this email.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase font-semibold mb-2">Email *</label>
                <input name="email" type="email" value={form.email} onChange={handleChange} required
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                  placeholder="teacher@school.com" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-semibold mb-2">Password</label>
                <input name="password" type="password" value={form.password} onChange={handleChange}
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                  placeholder="Leave blank for default (Teacher@123)" />
              </div>
            </div>
          </div>

          {/* Professional Section */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-fade-in-up delay-200">
            <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs">3</div>
              Professional Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase font-semibold mb-2">Qualification</label>
                <input name="qualification" value={form.qualification} onChange={handleChange}
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                  placeholder="e.g. M.Sc, B.Ed" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-semibold mb-2">Experience (Years)</label>
                <input name="experience_years" type="number" min="0" value={form.experience_years} onChange={handleChange}
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                  placeholder="e.g. 5" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-400 uppercase font-semibold mb-2">Specialization</label>
                <input name="specialization" value={form.specialization} onChange={handleChange}
                  className="w-full bg-black/30 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                  placeholder="e.g. Mathematics, Algebra" />
              </div>
            </div>
          </div>

          {/* Subject Assignment */}
          {subjects.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-fade-in-up delay-200">
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs">4</div>
                Assign Subjects
              </h2>
              <p className="text-gray-500 text-sm mb-4">Select the subjects this teacher can teach.</p>
              <div className="flex flex-wrap gap-2">
                {subjects.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => toggleSubject(s.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      selectedSubjects.includes(s.id)
                        ? 'bg-blue-500/30 border border-blue-500/50 text-blue-300 shadow-lg shadow-blue-500/10'
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                    }`}
                  >
                    {selectedSubjects.includes(s.id) && (
                      <svg className="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    )}
                    {s.name}
                    {s.code && <span className="text-gray-500 ml-1">({s.code})</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3 justify-end animate-fade-in-up delay-200">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-sm font-medium shadow-lg hover:shadow-blue-500/25 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Creating...
                </span>
              ) : (
                'Create Teacher'
              )}
            </button>
          </div>
        </form>
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
