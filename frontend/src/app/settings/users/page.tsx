'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import Cookies from 'js-cookie';

interface SystemUser {
  id: string; email: string; status: string; createdAt: string;
  role: { name: string };
}

interface Me { id: string; email: string; role: { name: string } }

const ROLE_COLORS: Record<string, string> = {
  Admin:   '#6366f1',
  Teacher: '#3b82f6',
  Parent:  '#10b981',
  Student: '#f59e0b',
};

function roleColor(r: string) { return ROLE_COLORS[r] ?? '#71717a'; }
function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

/* ═══════════════════════════════════════════
   USER MANAGEMENT PAGE
   ═══════════════════════════════════════════ */
export default function UsersSettingsPage() {
  const router = useRouter();
  const [me,      setMe]      = useState<Me | null>(null);
  const [tenantId, setTenantId] = useState('');
  const [users,   setUsers]   = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [invite, setInvite] = useState({ email: '', password: '', roleName: 'Teacher' });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError]   = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [copiedId, setCopiedId] = useState('');

  /* ── Load current user + all users ─────── */
  const loadData = useCallback(async () => {
    try {
      const meData = await fetchApi('/users/me');
      setMe(meData.user);
      setTenantId(meData.tenant_id);
      // Use /users endpoint (available via chat module)
      const usersData = await fetchApi('/users');
      setUsers(usersData.users || []);
    } catch (e: any) {
      if (e.message?.includes('Unauthorized')) router.push('/login');
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Invite / create user ───────────────── */
  const handleInvite = async () => {
    if (!invite.email || !invite.password) { setInviteError('Email and password are required'); return; }
    if (!tenantId) { setInviteError('Tenant ID unavailable'); return; }
    setInviteLoading(true); setInviteError('');
    try {
      await fetchApi('/auth/register', {
        method: 'POST',
        data: { email: invite.email, password: invite.password, roleName: invite.roleName, tenant_id: tenantId },
      });
      setInviteSuccess(`User "${invite.email}" created as ${invite.roleName}`);
      setShowInvite(false);
      setInvite({ email: '', password: '', roleName: 'Teacher' });
      await loadData();
      setTimeout(() => setInviteSuccess(''), 5000);
    } catch (err: any) { setInviteError(err.message); }
    finally { setInviteLoading(false); }
  };

  /* ── Copy to clipboard ──────────────────── */
  const copyId = (id: string) => {
    navigator.clipboard.writeText(id).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  /* ── Derived values ─────────────────────── */
  const filtered = users.filter(u => {
    const matchesSearch = !search || u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole   = !roleFilter || u.role?.name === roleFilter;
    return matchesSearch && matchesRole;
  });

  const roles       = [...new Set(users.map(u => u.role?.name).filter(Boolean))];
  const isAdmin     = me?.role?.name === 'Admin';

  if (loading) return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <div className="spinner spinner-lg" />
      </div>
    </AppLayout>
  );

  if (!isAdmin) return (
    <AppLayout>
      <div className="card">
        <div className="empty-state">
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔒</div>
          <p className="empty-state-title">Admin Access Required</p>
          <p className="empty-state-desc">Only administrators can view and manage users.</p>
          <a href="/settings" className="btn btn-primary" style={{ marginTop: '12px' }}>← Back to Settings</a>
        </div>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>

      {/* ── Page header ──────────────────────────── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <a href="/settings" style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}>Settings</a>
              <span style={{ color: 'var(--text-faint)', fontSize: '12px' }}>›</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>User Management</span>
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              User Management
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              {users.length} user{users.length !== 1 ? 's' : ''} in your tenant · manage accounts and roles
            </p>
          </div>
          <button onClick={() => setShowInvite(true)} className="btn btn-primary">
            + Add User
          </button>
        </div>
      </div>

      {/* ── Success toast ────────────────────────── */}
      {inviteSuccess && <div className="alert alert-success" style={{ marginBottom: '16px' }}>{inviteSuccess}</div>}

      {/* ── KPI strip ────────────────────────────── */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: '20px' }}>
        {[
          { label: 'Total',    value: users.length,                              color: 'var(--text-primary)' },
          { label: 'Active',   value: users.filter(u => u.status === 'ACTIVE').length,  color: '#4ade80' },
          { label: 'Admins',   value: users.filter(u => u.role?.name === 'Admin').length, color: '#a5b4fc' },
          { label: 'Teachers', value: users.filter(u => u.role?.name === 'Teacher').length, color: '#60a5fa' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-card-value" style={{ color: k.color }}>{k.value}</div>
            <div className="kpi-card-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text-faint)' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input" placeholder="Search users by email…"
            style={{ paddingLeft: '32px' }} />
        </div>
        {/* Role filter */}
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="input" style={{ width: 'auto', minWidth: '140px' }}>
          <option value="">All Roles</option>
          {roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {(search || roleFilter) && (
          <button onClick={() => { setSearch(''); setRoleFilter(''); }} className="btn btn-ghost" style={{ fontSize: '12px' }}>
            Clear
          </button>
        )}
      </div>

      {/* ── Users table / list ───────────────────── */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="empty-state-title">{search || roleFilter ? 'No users match filters' : 'No users yet'}</p>
            <p className="empty-state-desc">{search || roleFilter ? 'Try clearing the filters.' : 'Add the first user to your tenant.'}</p>
            {!search && !roleFilter && (
              <button onClick={() => setShowInvite(true)} className="btn btn-primary" style={{ marginTop: '12px' }}>
                + Add First User
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 120px 100px 120px 80px',
            padding: '10px 16px', borderBottom: '1px solid var(--border-default)',
            fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            color: 'var(--text-muted)',
          }}>
            <span>User</span>
            <span>Role</span>
            <span>Status</span>
            <span>Joined</span>
            <span>ID</span>
          </div>

          {filtered.map((u, idx) => {
            const rc = roleColor(u.role?.name);
            const isMe = u.id === me?.id;
            return (
              <div key={u.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 120px 100px 120px 80px',
                padding: '12px 16px', alignItems: 'center',
                borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                background: isMe ? 'rgba(99,102,241,0.04)' : 'transparent',
                transition: 'background var(--transition-fast)',
              }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isMe ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = isMe ? 'rgba(99,102,241,0.04)' : 'transparent'}
              >
                {/* User */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: `linear-gradient(135deg,${rc}33,${rc}66)`,
                    border: `1px solid ${rc}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700, color: rc,
                  }}>
                    {u.email.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                      {u.email}
                      {isMe && (
                        <span style={{
                          fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
                          padding: '1px 5px', borderRadius: '3px',
                          background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', flexShrink: 0,
                        }}>You</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Role */}
                <div>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px',
                    background: `${rc}18`, color: rc, border: `1px solid ${rc}30`,
                  }}>
                    {u.role?.name ?? '—'}
                  </span>
                </div>

                {/* Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: u.status === 'ACTIVE' ? '#22c55e' : '#71717a',
                    flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: '11px', color: u.status === 'ACTIVE' ? '#4ade80' : 'var(--text-muted)',
                    textTransform: 'capitalize',
                  }}>
                    {u.status?.toLowerCase()}
                  </span>
                </div>

                {/* Joined */}
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {timeAgo(u.createdAt)}
                </div>

                {/* ID copy */}
                <button onClick={() => copyId(u.id)} title="Copy user ID"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                    color: copiedId === u.id ? '#4ade80' : 'var(--text-faint)',
                    fontSize: '11px', fontFamily: 'var(--font-geist-mono)',
                    transition: 'color var(--transition-fast)',
                  }}>
                  {copiedId === u.id ? '✓' : '⎘'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Results footer ───────────────────────── */}
      {filtered.length > 0 && (
        <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '8px', textAlign: 'right' }}>
          Showing {filtered.length} of {users.length} users
        </div>
      )}

      {/* ── Add User Modal ───────────────────────── */}
      {showInvite && (
        <div className="modal-backdrop" onClick={() => setShowInvite(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Add New User
              </h2>
              <button onClick={() => setShowInvite(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px' }}>
                ✕
              </button>
            </div>

            {inviteError && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{inviteError}</div>}

            {/* Tenant context hint */}
            <div className="alert alert-info" style={{ marginBottom: '16px', fontSize: '12px' }}>
              <strong>Tenant:</strong>&nbsp;
              <code style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px' }}>
                {tenantId?.slice(0, 20)}…
              </code>
              <br />
              The user will be added to your school tenant automatically.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Email Address *</label>
                <input type="email" value={invite.email}
                  onChange={e => setInvite({ ...invite, email: e.target.value })}
                  className="input" placeholder="teacher@school.com" />
              </div>
              <div>
                <label className="form-label">Temporary Password *</label>
                <input type="password" value={invite.password}
                  onChange={e => setInvite({ ...invite, password: e.target.value })}
                  className="input" placeholder="••••••••" />
                <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '4px' }}>
                  Share with the user — they should change it after first login.
                </p>
              </div>
              <div>
                <label className="form-label">Role *</label>
                <select value={invite.roleName}
                  onChange={e => setInvite({ ...invite, roleName: e.target.value })}
                  className="input">
                  <option value="Teacher">Teacher</option>
                  <option value="Parent">Parent</option>
                  <option value="Student">Student</option>
                  <option value="Admin">Admin</option>
                </select>
                <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '4px' }}>
                  Roles control what modules and data this user can access.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button onClick={() => { setShowInvite(false); setInviteError(''); }} className="btn btn-ghost">
                Cancel
              </button>
              <button onClick={handleInvite} disabled={inviteLoading} className="btn btn-primary">
                {inviteLoading ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

    </AppLayout>
  );
}
