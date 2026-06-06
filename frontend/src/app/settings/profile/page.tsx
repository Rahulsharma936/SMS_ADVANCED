'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import Cookies from 'js-cookie';

interface UserData {
  id: string; email: string; status: string; createdAt: string;
  role: { name: string };
}

const ROLE_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  Admin:   { bg: 'rgba(99,102,241,0.15)', text: '#a5b4fc', icon: '👑' },
  Teacher: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', icon: '🎓' },
  Parent:  { bg: 'rgba(16,185,129,0.15)', text: '#34d399', icon: '👨‍👧' },
  Student: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', icon: '📚' },
};

/* ═══════════════════════════════════════════
   PROFILE PAGE
   ═══════════════════════════════════════════ */
export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [tenantId, setTenantId] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const d = await fetchApi('/users/me');
        setUser(d.user);
        setTenantId(d.tenant_id);
      } catch (e: any) { if (e.message?.includes('Unauthorized') || e.message?.includes('Session expired')) router.push('/login'); }
      finally { setLoading(false); }
    })();
  }, [router]);

  const copy = (val: string, key: string) => {
    navigator.clipboard.writeText(val).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  if (loading) return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <div className="spinner spinner-lg" />
      </div>
    </AppLayout>
  );

  const roleCfg = ROLE_COLORS[user?.role?.name ?? ''] ?? { bg: 'rgba(113,113,122,0.15)', text: '#71717a', icon: '👤' };
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'U';
  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  return (
    <AppLayout>

      {/* ── Page header ──────────────────────────── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <a href="/settings" style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}>Settings</a>
          <span style={{ color: 'var(--text-faint)', fontSize: '12px' }}>›</span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>My Profile</span>
        </div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          My Profile
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
          Your account details, role, and session information
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', alignItems: 'start' }}>

        {/* ── Left: Profile card ───────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Identity card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 700, fontSize: '22px', flexShrink: 0,
                boxShadow: '0 0 0 3px rgba(99,102,241,0.2)',
              }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {user?.email}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '100px',
                    background: roleCfg.bg, color: roleCfg.text,
                  }}>
                    {roleCfg.icon} {user?.role?.name}
                  </span>
                  <span style={{ fontSize: '11px', color: user?.status === 'ACTIVE' ? '#4ade80' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: user?.status === 'ACTIVE' ? '#22c55e' : '#71717a' }} />
                    {user?.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Info rows */}
            {[
              { label: 'Email Address',   value: user?.email ?? '—',    key: 'email',    mono: false },
              { label: 'Account Status',  value: user?.status ?? '—',   key: 'status',   mono: false },
              { label: 'Role',            value: user?.role?.name ?? '—', key: 'role',   mono: false },
              { label: 'Member Since',    value: joinedDate,             key: 'joined',   mono: false },
              { label: 'User ID',         value: user?.id ?? '—',        key: 'uid',     mono: true  },
              { label: 'Tenant ID',       value: tenantId,               key: 'tid',     mono: true  },
            ].map((row, i, arr) => (
              <div key={row.key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', gap: '12px',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0, minWidth: '110px' }}>{row.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span style={{
                    fontSize: row.mono ? '11px' : '13px',
                    fontFamily: row.mono ? 'var(--font-geist-mono)' : undefined,
                    color: 'var(--text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: '260px',
                  }}>
                    {row.value}
                  </span>
                  {row.mono && row.value !== '—' && (
                    <button onClick={() => copy(row.value, row.key)} title="Copy to clipboard"
                      style={{
                        border: 'none', cursor: 'pointer', padding: '2px 6px',
                        fontSize: '11px', color: copied === row.key ? '#4ade80' : 'var(--text-faint)',
                        borderRadius: '3px', background: 'var(--bg-overlay)', flexShrink: 0,
                        transition: 'color var(--transition-fast)',
                      }}>
                      {copied === row.key ? '✓ Copied' : '⎘ Copy'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Tenant Login Hint */}
          <div className="alert alert-info" style={{ fontSize: '12px', lineHeight: 1.6 }}>
            <strong>Need to share login access?</strong><br />
            Other users need both your <strong>Tenant ID</strong> and their own credentials to log in.
            Share the Tenant ID securely — never share passwords.
          </div>
        </div>

        {/* ── Right: Quick actions + Role perms ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Quick actions */}
          <div className="card">
            <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Quick Actions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                { href: '/dashboard',    label: 'Go to Dashboard',    icon: '🏠' },
                { href: '/settings',     label: 'Back to Settings',   icon: '⚙️' },
                { href: '/notifications', label: 'My Notifications',  icon: '🔔' },
                { href: '/settings/users', label: 'Manage Users',     icon: '👥', adminOnly: true },
                { href: '/login',        label: 'Sign Out & Re-Login', icon: '🔐' },
              ].filter(a => !a.adminOnly || user?.role?.name === 'Admin').map(a => (
                <a key={a.href} href={a.href} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                  borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--text-secondary)',
                  textDecoration: 'none', transition: 'all var(--transition-fast)',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                >
                  <span style={{ fontSize: '14px' }}>{a.icon}</span>
                  {a.label}
                </a>
              ))}
            </div>
          </div>

          {/* Role permissions card */}
          <div className="card">
            <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Your Permissions
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '20px' }}>{roleCfg.icon}</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.role?.name} Role</span>
            </div>
            {user?.role?.name === 'Admin' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {['Full system access', 'User management', 'School configuration', 'All operational modules', 'Fee management', 'Reports & analytics'].map(p => (
                  <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />{p}
                  </div>
                ))}
              </div>
            )}
            {user?.role?.name === 'Teacher' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {['Mark student attendance', 'Enter exam marks', 'View assigned students', 'View timetable', 'Chat with parents'].map(p => (
                  <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />{p}
                  </div>
                ))}
              </div>
            )}
            {!['Admin', 'Teacher'].includes(user?.role?.name ?? '') && (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Contact your administrator for details about your role permissions.
              </p>
            )}
            <a href="/settings" style={{ fontSize: '11px', color: 'var(--brand-primary)', textDecoration: 'none', display: 'block', marginTop: '12px' }}>
              View all roles reference →
            </a>
          </div>
        </div>
      </div>

    </AppLayout>
  );
}
