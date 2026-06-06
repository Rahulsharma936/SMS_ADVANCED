'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

interface FeeComponent { id: string; name: string; amount: number; tax_percentage: number | null; is_optional: boolean; }
interface FeeStructure {
  id: string; name: string; academic_year: string; currency: string;
  is_active: boolean; class: { id: string; name: string } | null;
  components: FeeComponent[]; _count: { studentFees: number }; created_at: string;
}

const fmt = (n: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
const totalOf = (components: FeeComponent[]) =>
  components.filter(c => !c.is_optional).reduce((s, c) => s + c.amount, 0);

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '5px' }}>{children}</label>;
}

const INP = { className: 'input', style: { width: '100%' } };

export default function FeeStructuresPage() {
  const router = useRouter();
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating,   setCreating]   = useState(false);
  const [error,      setError]      = useState('');
  const [classes,    setClasses]    = useState<{ id: string; name: string }[]>([]);

  const [form, setForm] = useState({ name: '', academic_year: '2025-2026', class_id: '', currency: 'INR' });
  const [comps, setComps] = useState<{ name: string; amount: string; tax_percentage: string; is_optional: boolean }[]>(
    [{ name: '', amount: '', tax_percentage: '', is_optional: false }]
  );

  const load = async () => {
    try {
      const [sd, cl] = await Promise.all([fetchApi('/fees/structures'), fetchApi('/classes')]);
      setStructures(sd.structures); setClasses(cl.classes || []);
    } catch (e: any) { if (e.message?.includes('Unauthorized')) router.push('/login'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const addComp = () => setComps([...comps, { name: '', amount: '', tax_percentage: '', is_optional: false }]);
  const removeComp = (i: number) => setComps(comps.filter((_, idx) => idx !== i));
  const updateComp = (i: number, field: string, value: any) =>
    setComps(comps.map((c, idx) => idx === i ? { ...c, [field]: value } : c));

  const previewTotal = comps.filter(c => !c.is_optional && c.amount).reduce((s, c) => s + parseFloat(c.amount || '0'), 0);

  const handleCreate = async () => {
    if (!form.name || !form.academic_year) { setError('Name and Academic Year are required'); return; }
    const validComps = comps.filter(c => c.name && c.amount && parseFloat(c.amount) > 0);
    if (validComps.length === 0) { setError('Add at least one fee component with a valid amount'); return; }
    setCreating(true); setError('');
    try {
      const { structure } = await fetchApi('/fees/structures', {
        method: 'POST',
        data: { name: form.name, academic_year: form.academic_year, class_id: form.class_id || null, currency: form.currency },
      });
      await fetchApi('/fees/components', {
        method: 'POST',
        data: { fee_structure_id: structure.id, components: validComps.map(c => ({ name: c.name, amount: parseFloat(c.amount), tax_percentage: c.tax_percentage ? parseFloat(c.tax_percentage) : null, is_optional: c.is_optional })) },
      });
      setShowCreate(false);
      setForm({ name: '', academic_year: '2025-2026', class_id: '', currency: 'INR' });
      setComps([{ name: '', amount: '', tax_percentage: '', is_optional: false }]);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  };

  if (loading) return <div className="page-loading"><div className="spinner spinner-lg"/></div>;

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fee Structures</h1>
          <p className="page-subtitle">{structures.length} structure{structures.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          New Structure
        </button>
      </div>

      {structures.length === 0 ? (
        <div className="empty-state" style={{ minHeight: '40vh' }}>
          <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/>
          </svg>
          <p className="empty-state-title">No fee structures yet</p>
          <p className="empty-state-desc">Create your first fee structure to start assigning fees to students.</p>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary">Create Structure</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
          {structures.map(s => {
            const total = totalOf(s.components);
            return (
              <div key={s.id} className="card" style={{ padding: '18px 20px', cursor: 'default' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: '10px' }}>
                    <h3 style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '2px' }}>{s.name}</h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-geist-mono)' }}>{s.academic_year}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {s.class && <span className="badge badge-blue" style={{ fontSize: '10px' }}>{s.class.name}</span>}
                    <span className={`badge ${s.is_active ? 'badge-green' : 'badge-gray'}`} style={{ fontSize: '10px' }}>{s.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  {s.components.slice(0, 4).map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '12px' }}>
                      <span style={{ color: c.is_optional ? 'var(--text-faint)' : 'var(--text-secondary)', fontStyle: c.is_optional ? 'italic' : 'normal' }}>
                        {c.name}{c.is_optional ? ' (opt)' : ''}
                      </span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{fmt(c.amount, s.currency)}</span>
                    </div>
                  ))}
                  {s.components.length > 4 && <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '4px' }}>+{s.components.length - 4} more</p>}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-default)' }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#4ade80', letterSpacing: '-0.02em' }}>{fmt(total, s.currency)}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>mandatory total</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>{s._count.studentFees}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>students</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal-box" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700 }}>New Fee Structure</h2>
              <button onClick={() => setShowCreate(false)} className="btn btn-ghost" style={{ padding: '4px 8px' }}>✕</button>
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: '14px' }}>{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <FieldLabel>Structure Name *</FieldLabel>
                <input {...INP} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Class 10 Annual Fee 2025-26"/>
              </div>
              <div>
                <FieldLabel>Academic Year *</FieldLabel>
                <input {...INP} value={form.academic_year} onChange={e => setForm({ ...form, academic_year: e.target.value })} placeholder="2025-2026"/>
              </div>
              <div>
                <FieldLabel>Currency</FieldLabel>
                <select {...INP} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                  <option value="INR">INR ₹</option><option value="USD">USD $</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <FieldLabel>Class (optional — school-wide if blank)</FieldLabel>
                <select {...INP} value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })}>
                  <option value="">— School-wide —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Components */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Fee Components</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>Mandatory: <span style={{ color: '#4ade80', fontWeight: 600 }}>{fmt(previewTotal, form.currency)}</span></span>
                  <button onClick={addComp} className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: '11px' }}>+ Add</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
                {comps.map((c, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 1.5fr auto auto', gap: '6px', alignItems: 'center', background: 'var(--bg-overlay)', borderRadius: 'var(--radius-md)', padding: '8px 10px' }}>
                    <input value={c.name} onChange={e => updateComp(i, 'name', e.target.value)} placeholder="Component name" className="input" style={{ fontSize: '12px', padding: '6px 10px' }}/>
                    <input type="number" value={c.amount} onChange={e => updateComp(i, 'amount', e.target.value)} placeholder="₹ Amount" className="input" style={{ fontSize: '12px', padding: '6px 10px' }}/>
                    <input type="number" value={c.tax_percentage} onChange={e => updateComp(i, 'tax_percentage', e.target.value)} placeholder="Tax %" className="input" style={{ fontSize: '12px', padding: '6px 10px' }}/>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                      <input type="checkbox" checked={c.is_optional} onChange={e => updateComp(i, 'is_optional', e.target.checked)} style={{ accentColor: 'var(--brand-primary)' }}/> Opt
                    </label>
                    {comps.length > 1 && (
                      <button onClick={() => removeComp(i)} className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: '14px', color: '#f87171' }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '4px' }}>Opt = Optional (excluded from mandatory total)</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
              <button onClick={() => setShowCreate(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={handleCreate} disabled={creating} className="btn btn-primary">
                {creating ? <><div className="spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }}/> Creating…</> : 'Create Structure'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
