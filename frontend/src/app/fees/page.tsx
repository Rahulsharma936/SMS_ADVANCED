'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

interface Summary {
  total_students_assigned: number;
  total_billed:  number;
  total_discount: number;
  total_final:   number;
  by_status: { pending: number; partial: number; paid: number; overdue: number };
}
interface FeeDiscount { id: string; name: string; type: string; value: number; is_active: boolean; }

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function FeesOverviewPage() {
  const router = useRouter();
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [discounts, setDiscounts] = useState<FeeDiscount[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [discForm, setDiscForm]   = useState({ name: '', type: 'percentage', value: '', is_active: true });
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const load = async () => {
    try {
      const [sum, disc] = await Promise.all([
        fetchApi('/fees/summary'),
        fetchApi('/fees/discounts'),
      ]);
      setSummary(sum.summary);
      setDiscounts(disc.discounts || []);
    } catch (e: any) {
      if (e.message?.includes('Unauthorized')) router.push('/login');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!discForm.name || !discForm.value) { setError('Name and value are required'); return; }
    setSaving(true); setError('');
    try {
      await fetchApi('/fees/discounts', { method: 'POST', data: { ...discForm, value: parseFloat(discForm.value) } });
      setShowModal(false);
      setDiscForm({ name: '', type: 'percentage', value: '', is_active: true });
      load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="page-loading"><div className="spinner spinner-lg"/></div>;

  const modules = [
    { href: '/fees/structures',   label: 'Fee Structures',  desc: 'Create & manage fee templates',   icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',  accent: '#34d399' },
    { href: '/fees/assignments',  label: 'Assign Fees',     desc: 'Link fee structures to students',  icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', accent: '#818cf8' },
    { href: '/fees/installments', label: 'Installments',    desc: 'Track payment schedules',          icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',               accent: '#f87171' },
  ];

  const statusCards = [
    { label: 'Pending',  value: summary?.by_status.pending ?? 0,  color: '#fbbf24' },
    { label: 'Partial',  value: summary?.by_status.partial ?? 0,  color: '#818cf8' },
    { label: 'Paid',     value: summary?.by_status.paid    ?? 0,  color: '#34d399' },
    { label: 'Overdue',  value: summary?.by_status.overdue ?? 0,  color: '#f87171' },
  ];

  return (
    <AppLayout>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Fee Management</h1>
          <p className="page-subtitle">Structures, assignments, installments and discount library</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a href="/payments" className="btn btn-secondary">Payments</a>
          <a href="/fees/structures" className="btn btn-primary">+ New Structure</a>
        </div>
      </div>

      {/* Summary stats */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total Billed',      value: fmt(summary.total_billed),   color: 'var(--text-primary)' },
            { label: 'Discount Applied',  value: fmt(summary.total_discount), color: '#a78bfa' },
            { label: 'Net Receivable',    value: fmt(summary.total_final),    color: '#34d399' },
            { label: 'Fee-Assigned Students', value: summary.total_students_assigned, color: '#60a5fa' },
          ].map(c => (
            <div key={c.label} className="card" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: c.color, letterSpacing: '-0.02em' }}>{c.value}</div>
              <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginTop: '5px' }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Status breakdown */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '24px' }}>
          {statusCards.map(c => (
            <div key={c.label} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color, flexShrink: 0 }}/>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: c.color }}>{c.value}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Workflow continuity chips */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'20px', alignItems:'center' }}>
        <span style={{ fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-faint)' }}>Jump to</span>
        <a href="/payments" className="module-chip" style={{ fontSize:'11px' }}>💳 Payments</a>
        <a href="/fees/assignments" className="module-chip" style={{ fontSize:'11px' }}>📎 Assign Fees</a>
        <a href="/fees/installments" className="module-chip" style={{ fontSize:'11px' }}>📅 Installments</a>
        <a href="/students" className="module-chip" style={{ fontSize:'11px' }}>👥 Students</a>
        <a href="/fees/defaulters" className="module-chip" style={{ fontSize:'11px' }}>⚠️ Defaulters</a>
      </div>

      {/* Module cards */}
      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>Fee Modules</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '24px' }}>
        {modules.map(m => (
          <a key={m.href} href={m.href} className="card" style={{
            padding: '20px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '14px',
            transition: 'background var(--transition-fast), border-color var(--transition-fast)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-overlay)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.background = ''; }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-lg)', background: `${m.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" fill="none" stroke={m.accent} viewBox="0 0 24 24" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d={m.icon}/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{m.label}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{m.desc}</div>
            </div>
          </a>
        ))}
      </div>

      {/* Discount Library */}
      <div className="widget">
        <div className="widget-head">
          <span className="widget-title">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M17 17h.01M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/></svg>
            Discount Library
          </span>
          <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ padding: '5px 12px', fontSize: '12px' }}>+ New Discount</button>
        </div>
        {discounts.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M17 17h.01M9 14l6-6"/>
            </svg>
            <p className="empty-state-title">No discounts created yet</p>
            <p className="empty-state-desc">Create reusable discount templates to apply during fee assignment.</p>
            <button onClick={() => setShowModal(true)} className="btn btn-secondary">Create first discount</button>
          </div>
        ) : (
          <div className="widget-body" style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
            {discounts.map(d => (
              <div key={d.id} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 'var(--radius-lg)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{d.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: '2px' }}>{d.type}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#a78bfa' }}>
                    {d.type === 'percentage' ? `${d.value}%` : fmt(d.value)}
                  </div>
                  <span className={`badge ${d.is_active ? 'badge-green' : 'badge-gray'}`} style={{ fontSize: '10px' }}>
                    {d.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discount Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600 }}>New Discount</h2>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost" style={{ padding: '4px 8px' }}>✕</button>
            </div>
            {error && <div className="alert alert-error" style={{ marginBottom: '14px' }}>{error}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Discount Name *</label>
                <input value={discForm.name} onChange={e => setDiscForm({ ...discForm, name: e.target.value })}
                  placeholder="e.g. Sibling Discount" className="input"/>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Type *</label>
                  <select value={discForm.type} onChange={e => setDiscForm({ ...discForm, type: e.target.value })} className="input">
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Value *</label>
                  <input type="number" value={discForm.value} onChange={e => setDiscForm({ ...discForm, value: e.target.value })}
                    placeholder={discForm.type === 'percentage' ? '10' : '5000'} className="input"/>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? 'Saving…' : 'Create Discount'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
