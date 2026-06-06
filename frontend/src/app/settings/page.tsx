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

/* ── Setting section card ───────────────── */
function SettingSection({
  icon, title, desc, href, badge, badgeColor,
  status, children,
}: {
  icon: string; title: string; desc: string; href?: string;
  badge?: string; badgeColor?: string; status?: string; children?: React.ReactNode;
}) {
  const inner = (
    <div className="card" style={{
      display: 'flex', flexDirection: 'column', gap: '12px',
      transition: 'border-color var(--transition-fast)',
      height: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
            background: 'var(--brand-subtle)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '18px', flexShrink: 0,
          }}>{icon}</div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
            {badge && (
              <span style={{
                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                padding: '1px 6px', borderRadius: '3px', marginTop: '2px', display: 'inline-block',
                background: badgeColor ? `${badgeColor}20` : 'var(--brand-subtle)',
                color: badgeColor ?? 'var(--brand-primary)',
              }}>{badge}</span>
            )}
          </div>
        </div>
        {href && (
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
            style={{ color: 'var(--text-faint)', flexShrink: 0, marginTop: '2px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, flex: 1 }}>{desc}</p>
      {status && (
        <div style={{
          fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px',
          paddingTop: '8px', borderTop: '1px solid var(--border-subtle)',
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
          {status}
        </div>
      )}
      {children}
    </div>
  );

  if (href) {
    return (
      <a href={href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column' }}
        onMouseEnter={e => (e.currentTarget.querySelector('.card') as HTMLElement)!.style.borderColor = 'rgba(99,102,241,0.25)'}
        onMouseLeave={e => (e.currentTarget.querySelector('.card') as HTMLElement)!.style.borderColor = ''}
      >{inner}</a>
    );
  }
  return <div style={{ display: 'flex', flexDirection: 'column' }}>{inner}</div>;
}

/* ── RBAC role reference ─────────────────── */
const ROLES_REFERENCE = [
  {
    name: 'Admin',
    color: '#6366f1',
    icon: '👑',
    perms: ['Full system access', 'User management', 'School configuration', 'All modules', 'Fee management', 'Reports'],
  },
  {
    name: 'Teacher',
    color: '#3b82f6',
    icon: '🎓',
    perms: ['Mark attendance', 'Enter marks', 'View students', 'View timetable', 'Chat with parents'],
  },
  {
    name: 'Parent',
    color: '#10b981',
    icon: '👨‍👧',
    perms: ['View child profile', 'View attendance', 'View results', 'Chat with teacher', 'View notices'],
  },
  {
    name: 'Student',
    color: '#f59e0b',
    icon: '📚',
    perms: ['View own profile', 'View results', 'View timetable', 'View announcements', 'View notices'],
  },
];

/* ═══════════════════════════════════════════
   SETTINGS HUB PAGE
   ═══════════════════════════════════════════ */
export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [tenantId, setTenantId] = useState('');
  const [loading, setLoading] = useState(true);

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

  if (loading) return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <div className="spinner spinner-lg" />
      </div>
    </AppLayout>
  );

  const isAdmin = user?.role?.name === 'Admin';

  return (
    <AppLayout>

      {/* ── Page header ──────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Settings & Administration
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Manage school configuration, users, roles, and preferences
          </p>
        </div>
      </div>

      {/* ── User context banner ──────────────────── */}
      <div className="card" style={{ marginBottom: '20px', background: 'var(--brand-subtle)', borderColor: 'rgba(99,102,241,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: '14px', flexShrink: 0,
          }}>
            {user?.email?.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.email}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                padding: '1px 7px', borderRadius: '3px',
                background: 'rgba(99,102,241,0.2)', color: '#a5b4fc',
              }}>{user?.role?.name}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-geist-mono)' }}>
                Tenant: {tenantId?.slice(0, 8)}…
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                · Status: <span style={{ color: '#4ade80' }}>{user?.status}</span>
              </span>
            </div>
          </div>
          <a href="/settings/profile" className="btn btn-ghost" style={{ fontSize: '12px', flexShrink: 0 }}>
            Edit Profile →
          </a>
        </div>
      </div>

      {/* ── Section: Account ─────────────────────── */}
      <div style={{ marginBottom: '24px' }}>
        <div className="section-divider" style={{ marginBottom: '12px' }}>
          <span className="section-divider-label">Account</span>
          <div className="section-divider-line" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '12px' }}>
          <SettingSection
            icon="👤" title="My Profile" href="/settings/profile"
            desc="View and update your account details, role information, and session status."
            status={`Signed in as ${user?.role?.name}`}
          />
          <SettingSection
            icon="🔐" title="Password & Security"
            desc="Update your password. Use the login page to change credentials via re-authentication."
            badge="Via Login" badgeColor="#6366f1"
          >
            <a href="/login" className="btn btn-ghost" style={{ fontSize: '12px', marginTop: '4px' }}>
              Go to Login →
            </a>
          </SettingSection>
        </div>
      </div>

      {/* ── Section: Administration (Admin only) ─── */}
      {isAdmin && (
        <div style={{ marginBottom: '24px' }}>
          <div className="section-divider" style={{ marginBottom: '12px' }}>
            <span className="section-divider-label">Administration</span>
            <div className="section-divider-line" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '12px' }}>
            <SettingSection
              icon="👥" title="User Management" href="/settings/users"
              badge="Admin" badgeColor="#6366f1"
              desc="View all users in your tenant, see their roles and status, and invite new team members."
              status="Manage your school's user accounts"
            />
            <SettingSection
              icon="🏫" title="School Information"
              desc="Your school tenant information including name, domain, and tenant identifier."
              badge="Read-only" badgeColor="#71717a"
            >
              <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Tenant ID</span>
                  <code style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-geist-mono)', fontSize: '11px' }}>
                    {tenantId?.slice(0, 16)}…
                  </code>
                </div>
              </div>
            </SettingSection>
            <SettingSection
              icon="📋" title="Grade Scales" href="/grade-scales"
              badge="Academic" badgeColor="#f59e0b"
              desc="Configure grading scales and grade thresholds used across all examinations."
              status="Affects all exam results"
            />
          </div>
        </div>
      )}

      {/* ── Section: Roles Reference ─────────────── */}
      <div style={{ marginBottom: '24px' }}>
        <div className="section-divider" style={{ marginBottom: '12px' }}>
          <span className="section-divider-label">Roles & Permissions Reference</span>
          <div className="section-divider-line" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '12px' }}>
          {ROLES_REFERENCE.map(role => (
            <div key={role.name} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
              {/* color accent stripe */}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: role.color }} />
              <div style={{ paddingLeft: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '20px' }}>{role.icon}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{role.name}</span>
                  {user?.role?.name === role.name && (
                    <span style={{
                      fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                      padding: '1px 5px', borderRadius: '3px',
                      background: `${role.color}20`, color: role.color,
                    }}>You</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {role.perms.map(p => (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: role.color, flexShrink: 0 }} />
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '8px' }}>
          ℹ Roles are assigned at registration. Contact your system administrator to change a role.
        </p>
      </div>

      {/* ── Section: Quick Navigation ────────────── */}
      <div>
        <div className="section-divider" style={{ marginBottom: '12px' }}>
          <span className="section-divider-label">Quick Navigation</span>
          <div className="section-divider-line" />
        </div>
        <div className="chip-row">
          {[
            { href: '/notifications', label: '🔔 Notifications' },
            { href: '/announcements', label: '📢 Announcements' },
            { href: '/notice-board',  label: '📌 Notice Board' },
            { href: '/grade-scales',  label: '⭐ Grade Scales' },
            { href: '/chat',          label: '💬 Messages' },
            { href: '/leave',         label: '🗓 Leave Mgmt' },
          ].map(l => (
            <a key={l.href} href={l.href} className="module-chip">{l.label}</a>
          ))}
        </div>
      </div>

    </AppLayout>
  );
}
