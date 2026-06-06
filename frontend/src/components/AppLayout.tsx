'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Cookies from 'js-cookie';
import { fetchApi } from '@/lib/api';

/* ─────────────────────────────────────────
   NAV STRUCTURE
   ───────────────────────────────────────── */
const NAV_GROUPS = [
  {
    label: 'Overview',
    defaultOpen: true,
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      },
    ],
  },
  {
    label: 'People',
    defaultOpen: true,
    items: [
      {
        href: '/students',
        label: 'Students',
        icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      },
      {
        href: '/teachers',
        label: 'Teachers',
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      },
    ],
  },
  {
    label: 'Academics',
    defaultOpen: true,
    items: [
      {
        href: '/classes',
        label: 'Classes',
        icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      },
      {
        href: '/subjects',
        label: 'Subjects',
        icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      },
      {
        href: '/timetable',
        label: 'Timetable',
        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      },
      {
        href: '/syllabus',
        label: 'Syllabus',
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      },
      {
        href: '/calendar',
        label: 'Calendar',
        icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      },
    ],
  },
  {
    label: 'Attendance',
    defaultOpen: false,
    items: [
      {
        href: '/attendance',
        label: 'Mark Attendance',
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      },
      {
        href: '/leave',
        label: 'Leave',
        icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      },
    ],
  },
  {
    label: 'Examinations',
    defaultOpen: false,
    items: [
      {
        href: '/exams',
        label: 'Exams',
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
      },
      {
        href: '/marks-entry',
        label: 'Marks Entry',
        icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
      },
      {
        href: '/results',
        label: 'Results',
        icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      },
      {
        href: '/report-card',
        label: 'Report Cards',
        icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
      },
      {
        href: '/grade-scales',
        label: 'Grade Scales',
        icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
      },
    ],
  },
  {
    label: 'Finance',
    defaultOpen: false,
    items: [
      {
        href: '/fees',
        label: 'Fee Overview',
        icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      },
      {
        href: '/payments',
        label: 'Payments',
        icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
      },
      {
        href: '/receipts',
        label: 'Receipts',
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      },
      {
        href: '/invoices',
        label: 'Invoices',
        icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
      },
    ],
  },
  {
    label: 'Communication',
    defaultOpen: false,
    items: [
      {
        href: '/announcements',
        label: 'Announcements',
        icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
      },
      {
        href: '/notice-board',
        label: 'Notice Board',
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
      },
      {
        href: '/chat',
        label: 'Messages',
        icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      },
      {
        href: '/notifications',
        label: 'Notifications',
        icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
      },
    ],
  },
  {
    label: 'Administration',
    defaultOpen: false,
    items: [
      {
        href: '/settings',
        label: 'Settings',
        icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      },
      {
        href: '/settings/users',
        label: 'User Management',
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      },
      {
        href: '/settings/profile',
        label: 'My Profile',
        icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      },
    ],
  },
];

/* ── Flat searchable index ──────────────── */
export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap(g =>
  g.items.map(item => ({ ...item, group: g.label }))
);

/* ── Quick Actions for command palette ─── */
const QUICK_ACTIONS = [
  { label: 'New Admission',        desc: 'Admit a new student',            href: '/students/admit',     icon: '➕', group: 'Actions',    shortcut: '' },
  { label: 'Mark Attendance',      desc: 'Record today\'s attendance',     href: '/attendance',         icon: '📋', group: 'Actions',    shortcut: 'G A' },
  { label: 'Enter Marks',          desc: 'Enter exam marks for a class',   href: '/marks-entry',        icon: '✏️', group: 'Actions',    shortcut: 'G M' },
  { label: 'Record Payment',       desc: 'Log a fee payment',              href: '/payments',           icon: '💰', group: 'Actions',    shortcut: '' },
  { label: 'Post Announcement',    desc: 'Broadcast to school or class',   href: '/announcements',      icon: '📢', group: 'Actions',    shortcut: '' },
  { label: 'Post Notice',          desc: 'Pin a notice on notice board',   href: '/notice-board',       icon: '📌', group: 'Actions',    shortcut: '' },
  { label: 'Apply Leave',          desc: 'Submit a student leave request', href: '/leave',              icon: '🗓️', group: 'Actions',    shortcut: '' },
  { label: 'Attendance Report',    desc: 'View attendance analytics',      href: '/attendance/report',  icon: '📊', group: 'Reports',    shortcut: '' },
  { label: 'Fee Defaulters',       desc: 'Students with overdue fees',     href: '/fees/defaulters',    icon: '⚠️', group: 'Reports',    shortcut: '' },
  { label: 'Results Overview',     desc: 'Exam results and performance',   href: '/results',            icon: '🏆', group: 'Reports',    shortcut: '' },
  { label: 'Report Cards',         desc: 'Generate student report cards',  href: '/report-card',        icon: '📄', group: 'Reports',    shortcut: '' },
  { label: 'Fee Analytics',        desc: 'Revenue and collection trends',  href: '/fees/analytics',     icon: '📈', group: 'Reports',    shortcut: '' },
  { label: 'Settings',             desc: 'School configuration and admin', href: '/settings',           icon: '⚙️', group: 'Settings',   shortcut: 'G ,' },
  { label: 'User Management',      desc: 'View and manage tenant users',   href: '/settings/users',     icon: '👥', group: 'Settings',   shortcut: '' },
  { label: 'My Profile',           desc: 'Your account and role details',  href: '/settings/profile',   icon: '👤', group: 'Settings',   shortcut: '' },
  { label: 'Grade Scales',         desc: 'Configure grading thresholds',   href: '/grade-scales',       icon: '⭐', group: 'Settings',   shortcut: '' },
];

/* ── G+letter navigation shortcuts ──────── */
const G_SHORTCUTS: Record<string, string> = {
  'd': '/dashboard',
  's': '/students',
  't': '/teachers',
  'a': '/attendance',
  'f': '/fees',
  'e': '/exams',
  'n': '/notifications',
  'm': '/marks-entry',
  'r': '/results',
  'l': '/leave',
  'c': '/chat',
  'p': '/payments',
  'x': '/announcements',
  ',': '/settings',   // G+, = settings
};

/* Keyboard shortcut reference (shown in "?" panel) */
const SHORTCUT_REFS = [
  { keys: ['⌘', 'K'],   desc: 'Open command palette' },
  { keys: ['G', 'D'],   desc: 'Go to Dashboard' },
  { keys: ['G', 'S'],   desc: 'Go to Students' },
  { keys: ['G', 'T'],   desc: 'Go to Teachers' },
  { keys: ['G', 'A'],   desc: 'Go to Attendance' },
  { keys: ['G', 'F'],   desc: 'Go to Fees' },
  { keys: ['G', 'E'],   desc: 'Go to Exams' },
  { keys: ['G', 'M'],   desc: 'Go to Marks Entry' },
  { keys: ['G', 'R'],   desc: 'Go to Results' },
  { keys: ['G', 'N'],   desc: 'Go to Notifications' },
  { keys: ['G', 'P'],   desc: 'Go to Payments' },
  { keys: ['G', 'C'],   desc: 'Go to Chat' },
  { keys: ['G', 'L'],   desc: 'Go to Leave' },
  { keys: ['G', ','],   desc: 'Go to Settings' },
  { keys: ['?'],        desc: 'Show this keyboard shortcut reference' },
  { keys: ['Esc'],      desc: 'Close panels / cancel' },
];

const RECENT_KEY = 'sms_recent_modules';
function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function pushRecent(href: string) {
  if (href === '/dashboard') return;
  try {
    const prev = getRecent().filter(h => h !== href);
    localStorage.setItem(RECENT_KEY, JSON.stringify([href, ...prev].slice(0, 6)));
  } catch {}
}

/* ── Breadcrumb map ─────────────────────── */
const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard':    'Dashboard',
  '/students':     'Students',
  '/teachers':     'Teachers',
  '/classes':      'Classes',
  '/subjects':     'Subjects',
  '/timetable':    'Timetable',
  '/syllabus':     'Syllabus',
  '/calendar':     'Calendar',
  '/attendance':   'Attendance',
  '/leave':        'Leave',
  '/exams':        'Examinations',
  '/marks-entry':  'Marks Entry',
  '/results':      'Results',
  '/report-card':  'Report Cards',
  '/grade-scales': 'Grade Scales',
  '/fees':         'Fees',
  '/payments':     'Payments',
  '/receipts':     'Receipts',
  '/invoices':     'Invoices',
  '/announcements':'Announcements',
  '/notice-board': 'Notice Board',
  '/chat':         'Messages',
  '/notifications':'Notifications',
  '/settings':          'Settings',
  '/settings/users':    'User Management',
  '/settings/profile':  'My Profile',
};

/* ── Nav Icon ───────────────────────────── */
function NavIcon({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg
      width={size} height={size}
      fill="none" stroke="currentColor"
      viewBox="0 0 24 24" strokeWidth={1.75}
      style={{ flexShrink: 0 }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

/* ── Chevron Icon ───────────────────────── */
function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className={`sidebar-group-chevron ${collapsed ? 'collapsed' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

/* ═══════════════════════════════════════════
   APP LAYOUT COMPONENT
   ═══════════════════════════════════════════ */
interface AppLayoutProps {
  children: React.ReactNode;
  userEmail?: string;
  userRole?: string;
  schoolName?: string;
}

export default function AppLayout({
  children,
  userEmail,
  userRole,
  schoolName,
}: AppLayoutProps) {
  const pathname = usePathname();
  const router   = useRouter();

  /* ── Sidebar open (mobile) ──────────────── */
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* ── Live notification bell ─────────────── */
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [notifOpen,     setNotifOpen]     = useState(false);
  const [recentNotifs,  setRecentNotifs]  = useState<Array<{ id: string; type: string; title: string; message: string; is_read: boolean; created_at: string }>>([]);
  const [notifLoading,  setNotifLoading]  = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const d = await fetchApi('/communication/notifications?unread=true');
      setUnreadCount(d.unread_count ?? 0);
      setRecentNotifs((d.notifications || []).slice(0, 5));
    } catch {}
  }, []);

  /* Poll every 60 seconds */
  useEffect(() => {
    fetchUnreadCount();
    const timer = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(timer);
  }, [fetchUnreadCount]);

  /* Close dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* Close dropdown on route change */
  useEffect(() => { setNotifOpen(false); }, [pathname]);

  const openNotifPanel = async () => {
    setNotifOpen(o => !o);
    if (!notifOpen) {
      setNotifLoading(true);
      try {
        const d = await fetchApi('/communication/notifications');
        setRecentNotifs((d.notifications || []).slice(0, 5));
        setUnreadCount(d.unread_count ?? 0);
      } catch {} finally { setNotifLoading(false); }
    }
  };

  const markAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetchApi('/communication/notifications/read-all', { method: 'PATCH' });
      setUnreadCount(0);
      setRecentNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {}
  };

  const NOTIF_TYPE_ICON: Record<string, string> = {
    announcement: '📢', fee_due: '💰', result: '📊',
    attendance: '📋', notice: '📌', general: '🔔',
  };
  function relTime(d: string) {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  /* ── Spotlight ───────────────────────────── */
  const [spotOpen,       setSpotOpen]       = useState(false);
  const [spotQuery,      setSpotQuery]      = useState('');
  const [spotIdx,        setSpotIdx]        = useState(0);
  const [shortcutPanel,  setShortcutPanel]  = useState(false);
  const spotInputRef  = useRef<HTMLInputElement>(null);
  const gPressedRef   = useRef(false);            // for G+letter chords
  const gTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openSpotlight = useCallback(() => {
    setSpotQuery(''); setSpotIdx(0); setSpotOpen(true); setShortcutPanel(false);
    setTimeout(() => spotInputRef.current?.focus(), 30);
  }, []);

  /* Cmd/Ctrl+K, G+letter, ? shortcuts */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      /* Don't fire if user is in an input/textarea */
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); openSpotlight(); return;
      }
      if (e.key === 'Escape') {
        setSpotOpen(false); setShortcutPanel(false); return;
      }
      if (inInput || spotOpen) return;

      /* "?" → shortcut reference panel */
      if (e.key === '?') {
        e.preventDefault();
        setShortcutPanel(p => !p);
        return;
      }

      /* G+letter navigation chord */
      if (e.key === 'g' || e.key === 'G') {
        gPressedRef.current = true;
        if (gTimerRef.current) clearTimeout(gTimerRef.current);
        gTimerRef.current = setTimeout(() => { gPressedRef.current = false; }, 700);
        return;
      }
      if (gPressedRef.current) {
        const dest = G_SHORTCUTS[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          gPressedRef.current = false;
          if (gTimerRef.current) clearTimeout(gTimerRef.current);
          router.push(dest);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openSpotlight, router, spotOpen]);

  /* Track recent modules */
  useEffect(() => { pushRecent(pathname); }, [pathname]);

  /* ── Collapsible group state ────────────── */
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    NAV_GROUPS.forEach((g) => { init[g.label] = g.defaultOpen; });
    return init;
  });

  /* ── Auto-expand group containing current route ─ */
  useEffect(() => {
    NAV_GROUPS.forEach((group) => {
      const hasActive = group.items.some((item) =>
        item.href === '/dashboard'
          ? pathname === '/dashboard'
          : pathname.startsWith(item.href)
      );
      if (hasActive) {
        setOpenGroups((prev) => ({ ...prev, [group.label]: true }));
      }
    });
  }, [pathname]);

  /* ── Close mobile sidebar on route change ── */
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  /* ── Breadcrumb ─────────────────────────── */
  const currentLabel = (() => {
    if (BREADCRUMB_MAP[pathname]) return BREADCRUMB_MAP[pathname];
    const match = Object.entries(BREADCRUMB_MAP)
      .filter(([k]) => k !== '/dashboard')
      .find(([k]) => pathname.startsWith(k));
    return match ? match[1] : 'Portal';
  })();

  /* ── Auth ───────────────────────────────── */
  const handleLogout = () => {
    Cookies.remove('token');
    Cookies.remove('tenant_id');
    router.push('/login');
  };

  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : 'U';
  const displayName = userEmail?.split('@')[0] ?? 'User';

  /* ── Spotlight filtered results ─────────── */
  const q = spotQuery.toLowerCase();
  const filteredModules = ALL_NAV_ITEMS.filter(item =>
    item.label.toLowerCase().includes(q) ||
    item.group.toLowerCase().includes(q)
  );
  const filteredActions = QUICK_ACTIONS.filter(a =>
    a.label.toLowerCase().includes(q) ||
    a.desc.toLowerCase().includes(q) ||
    a.group.toLowerCase().includes(q)
  );
  const recentItems = getRecent()
    .map(h => ALL_NAV_ITEMS.find(i => i.href === h))
    .filter(Boolean) as typeof ALL_NAV_ITEMS;

  const showRecent      = spotQuery === '' && recentItems.length > 0;
  const showActions     = filteredActions.length > 0;
  const showModules     = filteredModules.length > 0;

  /* Flat ordered list for keyboard navigation */
  const flatList: Array<{ href: string }> = [
    ...(showRecent && spotQuery === '' ? recentItems : []),
    ...(spotQuery === '' ? [] : filteredActions),   // actions only on search
    ...(spotQuery === '' ? ALL_NAV_ITEMS : filteredModules),
  ];

  const handleSpotKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSpotIdx(i => Math.min(i+1, flatList.length-1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSpotIdx(i => Math.max(i-1, 0)); }
    if (e.key === 'Enter' && flatList[spotIdx]) {
      router.push(flatList[spotIdx].href);
      setSpotOpen(false);
    }
  };


  return (
    <div className="app-shell">

      {/* ── Skip-to-content (accessibility) ─────────────── */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* ── Keyboard Shortcut Reference Panel ── */}
      {shortcutPanel && (
        <div
          className="spotlight-backdrop"
          onClick={() => setShortcutPanel(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts reference"
        >
          <div className="spotlight-box" style={{ maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
            <div className="spotlight-input-row" style={{ cursor: 'default', gap: '10px' }}>
              <span style={{ fontSize: '16px' }}>⌨️</span>
              <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Keyboard Shortcuts</span>
              <button onClick={() => setShortcutPanel(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', lineHeight: 1 }}>✕</button>
            </div>
            <div className="spotlight-results" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {SHORTCUT_REFS.map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderBottom: i < SHORTCUT_REFS.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{s.desc}</span>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {s.keys.map((k, ki) => (
                      <kbd key={ki} style={{
                        background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)',
                        borderRadius: '4px', padding: '2px 7px', fontSize: '11px',
                        fontFamily: 'var(--font-geist-mono)', color: 'var(--text-primary)',
                        boxShadow: '0 1px 0 var(--border-strong)', fontWeight: 600,
                      }}>{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="spotlight-footer">
              <span className="spotlight-key">Press <kbd>?</kbd> anytime to toggle</span>
              <span className="spotlight-key"><kbd>esc</kbd> close</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Command Palette / Spotlight ───────── */}
      {spotOpen && (
        <div
          className="spotlight-backdrop"
          onClick={() => setSpotOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Search modules and actions"
        >
          <div className="spotlight-box" onClick={e => e.stopPropagation()}>

            {/* Input */}
            <div className="spotlight-input-row">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} style={{color:'var(--text-faint)',flexShrink:0}}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                ref={spotInputRef}
                className="spotlight-input"
                value={spotQuery}
                onChange={e => { setSpotQuery(e.target.value); setSpotIdx(0); }}
                onKeyDown={handleSpotKey}
                placeholder="Search modules & actions… (⌘K)"
                autoComplete="off"
              />
              <span className="spotlight-hint"><kbd>esc</kbd> to close</span>
            </div>

            {/* Results */}
            <div className="spotlight-results">

              {/* Recent section (empty query only) */}
              {spotQuery === '' && showRecent && (
                <>
                  <div className="spotlight-section-label">Recent</div>
                  {recentItems.map((item, i) => (
                    <Link key={item.href} href={item.href}
                      className={`spotlight-item ${i === spotIdx ? 'active' : ''}`}
                      onClick={() => setSpotOpen(false)}>
                      <div className="spotlight-item-icon">
                        <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={item.icon}/>
                        </svg>
                      </div>
                      <span className="spotlight-item-label">{item.label}</span>
                      <span className="spotlight-item-group">{item.group}</span>
                    </Link>
                  ))}
                </>
              )}

              {/* Actions section (only visible when searching) */}
              {spotQuery !== '' && showActions && (
                <>
                  <div className="spotlight-section-label">Actions</div>
                  {filteredActions.map((action, i) => {
                    const ki = flatList.findIndex(f => f.href === action.href);
                    return (
                      <Link key={action.href} href={action.href}
                        className={`spotlight-item ${ki === spotIdx ? 'active' : ''}`}
                        onClick={() => setSpotOpen(false)}>
                        <div className="spotlight-item-icon" style={{ background: 'rgba(99,102,241,0.1)', borderRadius: '6px' }}>
                          <span style={{ fontSize: '12px' }}>{action.icon}</span>
                        </div>
                        <span className="spotlight-item-label">{action.label}</span>
                        <span className="spotlight-item-group" style={{ flex: 1, marginLeft: '4px', fontSize: '11px' }}>{action.desc}</span>
                        {action.shortcut && (
                          <span style={{
                            fontSize: '10px', color: 'var(--text-faint)', fontFamily: 'var(--font-geist-mono)',
                            background: 'var(--bg-overlay)', padding: '1px 5px', borderRadius: '3px',
                            border: '1px solid var(--border-subtle)', flexShrink: 0,
                          }}>{action.shortcut}</span>
                        )}
                      </Link>
                    );
                  })}
                </>
              )}

              {/* Module section */}
              {showModules && (
                <>
                  <div className="spotlight-section-label">
                    {spotQuery !== '' ? 'Modules' : 'All Modules'}
                  </div>
                  {filteredModules.map((item, i) => {
                    const ki = spotQuery === '' ? (showRecent ? recentItems.length + i : i) : flatList.findIndex(f => f.href === item.href);
                    return (
                      <Link key={item.href} href={item.href}
                        className={`spotlight-item ${ki === spotIdx ? 'active' : ''}`}
                        onClick={() => setSpotOpen(false)}>
                        <div className="spotlight-item-icon">
                          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={item.icon}/>
                          </svg>
                        </div>
                        <span className="spotlight-item-label">{item.label}</span>
                        <span className="spotlight-item-group">{item.group}</span>
                      </Link>
                    );
                  })}
                </>
              )}

              {/* Empty state with suggestions */}
              {spotQuery !== '' && !showActions && !showModules && (
                <div style={{ padding: '20px 16px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '16px' }}>
                    No results for "{spotQuery}"
                  </p>
                  <div className="spotlight-section-label" style={{ marginBottom: '4px' }}>Try these</div>
                  {[QUICK_ACTIONS[0], QUICK_ACTIONS[1], QUICK_ACTIONS[2]].map(a => (
                    <Link key={a.href} href={a.href}
                      className="spotlight-item"
                      onClick={() => setSpotOpen(false)}>
                      <div className="spotlight-item-icon" style={{ background: 'rgba(99,102,241,0.1)', borderRadius: '6px' }}>
                        <span style={{ fontSize: '12px' }}>{a.icon}</span>
                      </div>
                      <span className="spotlight-item-label">{a.label}</span>
                      <span className="spotlight-item-group">{a.desc}</span>
                    </Link>
                  ))}
                </div>
              )}

            </div>{/* /spotlight-results */}

            {/* Footer */}
            <div className="spotlight-footer">
              <span className="spotlight-key"><kbd>↑↓</kbd> navigate</span>
              <span className="spotlight-key"><kbd>↵</kbd> open</span>
              <span className="spotlight-key"><kbd>esc</kbd> close</span>
              <span className="spotlight-key" style={{ marginLeft: 'auto' }}>
                <kbd>G</kbd>+<kbd>S/A/F…</kbd> quick nav
              </span>
              <span className="spotlight-key">
                <kbd>?</kbd> shortcuts
              </span>
            </div>

          </div>
        </div>
      )}

      {/* ── Mobile overlay ──────────────────── */}
      <div
        className={`sidebar-mobile-overlay ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ════════════════════════════════════════
          SIDEBAR
          ════════════════════════════════════════ */}
      <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>

        {/* Logo area */}
        <Link href="/dashboard" className="sidebar-logo">
          <div className="sidebar-logo-mark">S</div>
          <div style={{ minWidth: 0 }}>
            <div className="sidebar-logo-text">SMS Portal</div>
            {schoolName && (
              <div style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: '1px',
              }}>
                {schoolName}
              </div>
            )}
          </div>
          <span className="sidebar-logo-badge">SaaS</span>
        </Link>

        {/* Navigation */}
        <nav className="sidebar-nav" aria-label="Main navigation">
          {NAV_GROUPS.map((group) => {
            const isOpen = openGroups[group.label] ?? group.defaultOpen;
            const hasActive = group.items.some((item) => isActive(item.href));

            return (
              <div key={group.label}>
                {/* Group header — clickable and keyboard-accessible to collapse */}
                <div
                  className="sidebar-group-header"
                  onClick={() => toggleGroup(group.label)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleGroup(group.label);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  aria-controls={`nav-group-${group.label}`}
                >
                  <span
                    className="sidebar-section-label"
                    style={{
                      padding: 0,
                      color: hasActive ? 'var(--text-secondary)' : undefined,
                    }}
                  >
                    {group.label}
                  </span>
                  <ChevronIcon collapsed={!isOpen} />
                </div>

                {/* Group items */}
                <div
                  id={`nav-group-${group.label}`}
                  className={`sidebar-group-items ${isOpen ? '' : 'collapsed'}`}
                  aria-hidden={!isOpen}
                >
                  {group.items.map((item) => {
                    /* Find G+letter shortcut for this nav item */
                    const gKey = Object.entries(G_SHORTCUTS).find(([, href]) => href === item.href)?.[0]?.toUpperCase();
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                        title={gKey ? `${item.label} — Shortcut: G+${gKey}` : item.label}
                        aria-current={isActive(item.href) ? 'page' : undefined}
                      >
                        <NavIcon d={item.icon} />
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {gKey && (
                          <span style={{
                            fontSize: '9px', fontFamily: 'var(--font-geist-mono)',
                            color: 'var(--text-faint)', background: 'var(--bg-overlay)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '3px', padding: '1px 4px', flexShrink: 0,
                            opacity: isActive(item.href) ? 0 : 0.7,
                          }}>
                            G+{gKey}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer — user context */}
        <div className="sidebar-footer">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 10px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '4px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
          }}>
            <div className="header-avatar" style={{ flexShrink: 0, width: '26px', height: '26px', fontSize: '10px' }}>
              {initials}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {displayName}
              </p>
              {userRole && (
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  {userRole}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="nav-item"
            style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--text-muted)' }}
          >
            <NavIcon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════════
          HEADER
          ════════════════════════════════════════ */}
      <header className="app-header">
        {/* Mobile hamburger */}
        <button
          className="hamburger-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle navigation"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            {sidebarOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>

        {/* Breadcrumb */}
        <div className="header-breadcrumb">
          <span className="header-breadcrumb-sep" style={{ color: 'var(--text-faint)' }}>
            SMS
          </span>
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
            style={{ color: 'var(--text-faint)', flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="header-breadcrumb-current">{currentLabel}</span>
        </div>

        {/* Search */}
        <div className="header-search">
          <svg className="header-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="header-search-input"
            type="text"
            placeholder="Search modules & actions… (⌘K)"
            readOnly
            onClick={openSpotlight}
          />
          <span style={{
            fontSize: '10px', color: 'var(--text-faint)', fontFamily: 'var(--font-geist-mono)',
            background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)',
            borderRadius: '3px', padding: '1px 5px', flexShrink: 0, marginRight: '4px',
          }}>?
          </span>
        </div>

        {/* Right side actions */}
        <div className="header-actions">
          {/* School context chip */}
          {schoolName && (
            <div className="header-school-ctx">
              <div className="header-school-dot" />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{schoolName}</span>
            </div>
          )}

          {/* ── Live Notification Bell ── */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              onClick={openNotifPanel}
              className="header-icon-btn"
              aria-label={unreadCount > 0 ? `Notifications — ${unreadCount} unread` : 'Notifications'}
              aria-expanded={notifOpen}
              aria-haspopup="true"
              style={{ position: 'relative' }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: '-4px', right: '-4px',
                  minWidth: '16px', height: '16px', borderRadius: '100px',
                  background: '#6366f1', color: 'white',
                  fontSize: '9px', fontWeight: 700, lineHeight: '16px',
                  textAlign: 'center', padding: '0 3px',
                  border: '1.5px solid var(--bg-surface)',
                  animation: 'pulse-dot 2s ease-in-out infinite',
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* ── Notification Dropdown Panel ── */}
            {notifOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                width: '340px', background: 'var(--bg-elevated)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-lg)', zIndex: 100,
                animation: 'fadeInUp 0.15s ease-out',
                overflow: 'hidden',
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Notifications</span>
                    {unreadCount > 0 && (
                      <span style={{
                        background: 'var(--brand-subtle)', color: '#a5b4fc',
                        fontSize: '10px', fontWeight: 700, padding: '1px 6px',
                        borderRadius: '100px',
                      }}>
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead}
                        style={{
                          fontSize: '11px', background: 'none', border: 'none',
                          color: 'var(--brand-primary)', cursor: 'pointer', padding: 0,
                        }}>
                        Mark all read
                      </button>
                    )}
                    <Link href="/notifications"
                      style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'none' }}
                      onClick={() => setNotifOpen(false)}>
                      View all →
                    </Link>
                  </div>
                </div>

                {/* Body */}
                <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                  {notifLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                      <div className="spinner" />
                    </div>
                  ) : recentNotifs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 16px' }}>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔔</div>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>All caught up!</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '4px' }}>No new notifications</p>
                    </div>
                  ) : recentNotifs.map((n, idx) => (
                    <div key={n.id}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                        padding: '10px 14px',
                        borderBottom: idx < recentNotifs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        background: !n.is_read ? 'rgba(99,102,241,0.04)' : 'transparent',
                        position: 'relative',
                      }}>
                      {!n.is_read && (
                        <div style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0,
                          width: '2px', background: 'var(--brand-primary)',
                        }} />
                      )}
                      <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>
                        {NOTIF_TYPE_ICON[n.type] || '🔔'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: '12px', fontWeight: n.is_read ? 400 : 600,
                          color: n.is_read ? 'var(--text-secondary)' : 'var(--text-primary)',
                          margin: 0, lineHeight: 1.4,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {n.title}
                        </p>
                        <p style={{
                          fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {n.message}
                        </p>
                        <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>{relTime(n.created_at)}</span>
                      </div>
                      {!n.is_read && (
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', flexShrink: 0, marginTop: '5px' }} />
                      )}
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div style={{
                  borderTop: '1px solid var(--border-subtle)',
                  padding: '8px 14px', background: 'var(--bg-surface)',
                }}>
                  <Link href="/notifications"
                    onClick={() => setNotifOpen(false)}
                    style={{
                      display: 'block', textAlign: 'center',
                      fontSize: '12px', color: 'var(--brand-primary)',
                      textDecoration: 'none', fontWeight: 500,
                    }}>
                    View all notifications
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Separator */}
          <div style={{ width: '1px', height: '20px', background: 'var(--border-subtle)' }} />

          {/* User avatar */}
          <div
            className="header-avatar"
            title={userEmail ?? 'User'}
            style={{ cursor: 'default' }}
          >
            {initials}
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════
          MAIN CONTENT
          ════════════════════════════════════════ */}
      <main id="main-content" className="app-main" tabIndex={-1}>
        <div className="app-content animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
