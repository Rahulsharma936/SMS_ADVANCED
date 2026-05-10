'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { fetchApi } from '@/lib/api';

interface UserData {
  id: string;
  email: string;
  status: string;
  createdAt: string;
  role: { name: string };
}

interface QuickStat { label: string; value: string | number; color: string }

const modules = [
  { href: '/classes',       label: 'Classes & Sections', desc: 'Manage grades and divisions',      color: 'blue',   icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { href: '/students',      label: 'Students',            desc: 'Admit and manage students',         color: 'emerald',icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { href: '/teachers',      label: 'Teachers',            desc: 'Manage staff & workloads',          color: 'indigo', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { href: '/subjects',      label: 'Subjects',            desc: 'Configure curriculum subjects',      color: 'violet', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { href: '/attendance',    label: 'Attendance',          desc: 'Mark & track daily attendance',     color: 'amber',  icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { href: '/leave',         label: 'Leave Management',    desc: 'Apply & approve student leaves',    color: 'orange', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/timetable',     label: 'Timetable',           desc: 'View & manage class schedules',     color: 'purple', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/syllabus',      label: 'Syllabus',            desc: 'Map and track curriculum',          color: 'cyan',   icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { href: '/calendar',      label: 'Academic Calendar',   desc: 'Events, exams & holidays',          color: 'pink',   icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/exams',         label: 'Examinations',        desc: 'Create & manage exams',             color: 'rose',   icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { href: '/marks-entry',   label: 'Marks Entry',         desc: 'Enter subject-wise marks',          color: 'yellow', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { href: '/results',       label: 'Results Dashboard',   desc: 'Calculate ranks & view results',    color: 'teal',   icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { href: '/report-card',   label: 'Report Cards',        desc: 'Generate & print report cards',     color: 'sky',    icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { href: '/grade-scales',  label: 'Grade Scales',        desc: 'Configure CBSE/ICSE grading',       color: 'fuchsia',icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
  { href: '/attendance/biometric', label: 'Biometric Sync', desc: 'Sync device attendance logs',  color: 'lime',   icon: 'M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4' },
  { href: '/fees',              label: 'Fee Management',    desc: 'Structures, billing & installments',   color: 'green',   icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/payments',          label: 'Payments',          desc: 'Record & reconcile fee payments',       color: 'wisteria', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { href: '/fees/analytics',    label: 'Fee Analytics',     desc: 'Revenue, trends & collection stats',   color: 'teal',    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { href: '/fees/defaulters',   label: 'Defaulters',        desc: 'Overdue fees & bulk reminders',        color: 'rose',    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
  { href: '/fees/ledger',       label: 'Fee Ledger',        desc: 'Student chronological fee history',    color: 'slate',   icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { href: '/receipts',          label: 'Receipts',          desc: 'Generate & view payment receipts',     color: 'amber',   icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { href: '/invoices',          label: 'Invoices',          desc: 'Generate fee due notices',             color: 'sky',     icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { href: '/announcements',     label: 'Announcements',     desc: 'Broadcast to school, class, section',  color: 'blue',    icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' },
  { href: '/notice-board',      label: 'Notice Board',      desc: 'Pinned notices with priority levels',   color: 'cyan',    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { href: '/notifications',     label: 'Notifications',     desc: 'In-app inbox & notification center',    color: 'indigo',  icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  { href: '/chat',              label: 'Messages',          desc: 'Realtime Parent ↔ Teacher chat',         color: 'violet',  icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
];


const colorMap: Record<string, string> = {
  blue: 'hover:bg-blue-500/10 hover:border-blue-500/30 bg-blue-500/20 text-blue-400',
  emerald: 'hover:bg-emerald-500/10 hover:border-emerald-500/30 bg-emerald-500/20 text-emerald-400',
  indigo: 'hover:bg-indigo-500/10 hover:border-indigo-500/30 bg-indigo-500/20 text-indigo-400',
  cyan:   'hover:bg-cyan-500/10 hover:border-cyan-500/30 bg-cyan-500/20 text-cyan-400',
  violet: 'hover:bg-violet-500/10 hover:border-violet-500/30 bg-violet-500/20 text-violet-400',
  amber: 'hover:bg-amber-500/10 hover:border-amber-500/30 bg-amber-500/20 text-amber-400',
  orange: 'hover:bg-orange-500/10 hover:border-orange-500/30 bg-orange-500/20 text-orange-400',
  purple: 'hover:bg-purple-500/10 hover:border-purple-500/30 bg-purple-500/20 text-purple-400',
  cyan: 'hover:bg-cyan-500/10 hover:border-cyan-500/30 bg-cyan-500/20 text-cyan-400',
  pink: 'hover:bg-pink-500/10 hover:border-pink-500/30 bg-pink-500/20 text-pink-400',
  rose: 'hover:bg-rose-500/10 hover:border-rose-500/30 bg-rose-500/20 text-rose-400',
  yellow: 'hover:bg-yellow-500/10 hover:border-yellow-500/30 bg-yellow-500/20 text-yellow-400',
  teal: 'hover:bg-teal-500/10 hover:border-teal-500/30 bg-teal-500/20 text-teal-400',
  sky: 'hover:bg-sky-500/10 hover:border-sky-500/30 bg-sky-500/20 text-sky-400',
  fuchsia: 'hover:bg-fuchsia-500/10 hover:border-fuchsia-500/30 bg-fuchsia-500/20 text-fuchsia-400',
  green: 'hover:bg-green-500/10 hover:border-green-500/30 bg-green-500/20 text-green-400',
  lime: 'hover:bg-lime-500/10 hover:border-lime-500/30 bg-lime-500/20 text-lime-400',
  wisteria: 'hover:bg-violet-500/10 hover:border-violet-500/30 bg-violet-500/20 text-violet-400',
  slate:    'hover:bg-slate-500/10 hover:border-slate-500/30 bg-slate-500/20 text-slate-400',
};

export default function DashboardPage() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [tenantId, setTenantInfo] = useState<string>('');
  const [stats, setStats] = useState<QuickStat[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const data = await fetchApi('/users/me');
        setUserData(data.user);
        setTenantInfo(data.tenant_id);

        // Load quick stats in parallel
        const [studentRes, teacherRes, examRes] = await Promise.allSettled([
          fetchApi('/students/stats'),
          fetchApi('/teachers'),
          fetchApi('/exams'),
        ]);
        const quickStats: QuickStat[] = [];
        if (studentRes.status === 'fulfilled') quickStats.push({ label: 'Total Students', value: studentRes.value?.stats?.total ?? '—', color: 'text-emerald-400' });
        if (teacherRes.status === 'fulfilled') quickStats.push({ label: 'Teachers', value: teacherRes.value?.teachers?.length ?? '—', color: 'text-indigo-400' });
        if (examRes.status === 'fulfilled') quickStats.push({ label: 'Active Exams', value: examRes.value?.exams?.filter((e: any) => e.status === 'published').length ?? '—', color: 'text-rose-400' });
        setStats(quickStats);
      } catch (err) {
        console.error('Failed to load user', err);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [router]);

  const handleLogout = () => {
    Cookies.remove('token');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans selection:bg-blue-500/30">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex-shrink-0 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg">S</div>
              <span className="font-bold text-xl tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">SMS Portal</span>
            </div>
            <div className="flex items-center gap-3 text-sm flex-wrap justify-end">
              <a href="/students" className="text-gray-400 hover:text-white transition-colors">Students</a>
              <a href="/teachers" className="text-gray-400 hover:text-white transition-colors">Teachers</a>
              <a href="/attendance" className="text-gray-400 hover:text-white transition-colors">Attendance</a>
              <a href="/exams" className="text-gray-400 hover:text-white transition-colors">Exams</a>
              <a href="/results" className="text-gray-400 hover:text-white transition-colors">Results</a>
              <a href="/timetable" className="text-gray-400 hover:text-white transition-colors">Timetable</a>
              <button onClick={handleLogout} className="text-gray-300 hover:text-white px-4 py-1.5 rounded-lg font-medium transition-colors hover:bg-white/5 border border-white/10 ml-2">Logout</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold mb-1">
            Welcome back, <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">{userData?.email?.split('@')[0]}</span>
          </h1>
          <p className="text-gray-400">
            <span className="text-xs bg-white/10 px-2 py-0.5 rounded font-mono">{userData?.role?.name}</span>
            <span className="mx-2 text-gray-600">•</span>
            <span className="text-sm text-gray-500">Tenant: <span className="font-mono text-gray-400">{tenantId.slice(0,16)}…</span></span>
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {stats.map((s, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 uppercase mt-1">{s.label}</p>
            </div>
          ))}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <p className="text-3xl font-bold text-emerald-400 capitalize">{userData?.status}</p>
            <p className="text-xs text-gray-500 uppercase mt-1">Account Status</p>
          </div>
        </div>

        {/* Module Grid */}
        <h2 className="text-sm text-gray-400 uppercase font-semibold tracking-wider mb-4">All Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {modules.map((mod) => {
            const colors = colorMap[mod.color] || colorMap.blue;
            const [hoverBg, , iconBg, iconText] = colors.split(' ');
            return (
              <a key={mod.href} href={mod.href}
                className={`group bg-white/5 border border-white/10 rounded-2xl p-4 ${hoverBg} hover:border-current transition-all duration-200`}>
                <div className={`w-10 h-10 rounded-xl ${iconBg} ${iconText} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mod.icon} />
                  </svg>
                </div>
                <h3 className="font-semibold text-white text-sm mb-0.5 leading-tight">{mod.label}</h3>
                <p className="text-gray-500 text-xs leading-snug">{mod.desc}</p>
              </a>
            );
          })}
        </div>

        
      </main>

      <style jsx global>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; opacity: 0; }
        .delay-100 { animation-delay: 100ms; }
      `}</style>
    </div>
  );
}
