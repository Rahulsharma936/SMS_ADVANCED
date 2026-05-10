'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';

interface GradeScale { id: string; grade: string; name: string; min_percent: string; max_percent: string; grade_point: string | null; remark: string | null }

const CBSE_PRESET = [
  { grade: 'A1', name: 'Outstanding', min_percent: 91, max_percent: 101, grade_point: 10, remark: 'Outstanding' },
  { grade: 'A2', name: 'Excellent', min_percent: 81, max_percent: 91, grade_point: 9, remark: 'Excellent' },
  { grade: 'B1', name: 'Very Good', min_percent: 71, max_percent: 81, grade_point: 8, remark: 'Very Good' },
  { grade: 'B2', name: 'Good', min_percent: 61, max_percent: 71, grade_point: 7, remark: 'Good' },
  { grade: 'C1', name: 'Average', min_percent: 51, max_percent: 61, grade_point: 6, remark: 'Average' },
  { grade: 'C2', name: 'Below Average', min_percent: 41, max_percent: 51, grade_point: 5, remark: 'Below Average' },
  { grade: 'D',  name: 'Needs Improvement', min_percent: 33, max_percent: 41, grade_point: 4, remark: 'Needs Improvement' },
  { grade: 'E',  name: 'Fail', min_percent: 0, max_percent: 33, grade_point: 0, remark: 'Fail' },
];

const ICSE_PRESET = [
  { grade: 'A*', name: 'Distinction', min_percent: 85, max_percent: 101, grade_point: 4.0, remark: 'Distinction' },
  { grade: 'A',  name: 'Excellent', min_percent: 75, max_percent: 85, grade_point: 3.7, remark: 'Excellent' },
  { grade: 'B',  name: 'Good', min_percent: 60, max_percent: 75, grade_point: 3.0, remark: 'Good' },
  { grade: 'C',  name: 'Average', min_percent: 45, max_percent: 60, grade_point: 2.0, remark: 'Average' },
  { grade: 'D',  name: 'Below Average', min_percent: 35, max_percent: 45, grade_point: 1.0, remark: 'Below Average' },
  { grade: 'F',  name: 'Fail', min_percent: 0, max_percent: 35, grade_point: 0, remark: 'Fail' },
];

export default function GradeScalePage() {
  const [scales, setScales] = useState<GradeScale[]>([]);
  const [rows, setRows] = useState<{ grade: string; name: string; min_percent: string; max_percent: string; grade_point: string; remark: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    try { const d = await fetchApi('/grade-scales'); setScales(d.scales); mapToRows(d.scales); } catch {}
  };

  const mapToRows = (data: GradeScale[]) => {
    setRows(data.map(s => ({ grade: s.grade, name: s.name, min_percent: String(Number(s.min_percent)), max_percent: String(Number(s.max_percent)), grade_point: s.grade_point ? String(Number(s.grade_point)) : '', remark: s.remark || '' })));
  };

  useEffect(() => { load(); }, []);

  const applyPreset = (preset: typeof CBSE_PRESET) => {
    setRows(preset.map(p => ({ grade: p.grade, name: p.name, min_percent: String(p.min_percent), max_percent: String(p.max_percent), grade_point: String(p.grade_point), remark: p.remark })));
    setMsg('Preset loaded — click Save to apply');
  };

  const addRow = () => setRows([...rows, { grade: '', name: '', min_percent: '', max_percent: '', grade_point: '', remark: '' }]);
  const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: string, value: string) => {
    const r = [...rows]; (r[i] as any)[field] = value; setRows(r);
  };

  const save = async () => {
    const valid = rows.filter(r => r.grade && r.min_percent !== '' && r.max_percent !== '');
    if (valid.length === 0) { setError('Add at least one valid scale'); return; }
    setSaving(true); setError(''); setMsg('');
    try {
      await fetchApi('/grade-scales', {
        method: 'POST',
        data: { scales: valid.map(r => ({ grade: r.grade, name: r.name, min_percent: parseFloat(r.min_percent), max_percent: parseFloat(r.max_percent), grade_point: r.grade_point ? parseFloat(r.grade_point) : undefined, remark: r.remark || undefined })) },
      });
      setMsg('Grade scales saved successfully'); load();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/exams" className="text-gray-400 hover:text-white transition-colors">Exams</a>
            <a href="/grade-scales" className="text-blue-400 font-medium">Grade Scales</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Grade Scale Configuration</h1>
            <p className="text-gray-500 mt-1">Configure grading rules for your school (CBSE, ICSE, or custom)</p>
          </div>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3 rounded-xl mb-4 text-sm">{error}</div>}
        {msg && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3 rounded-xl mb-4 text-sm">{msg}</div>}

        {/* Presets */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => applyPreset(CBSE_PRESET)} className="px-4 py-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-sm hover:bg-indigo-500/30 transition-colors">Load CBSE Preset</button>
          <button onClick={() => applyPreset(ICSE_PRESET)} className="px-4 py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg text-sm hover:bg-purple-500/30 transition-colors">Load ICSE Preset</button>
          <button onClick={() => setRows([{ grade: '', name: '', min_percent: '', max_percent: '', grade_point: '', remark: '' }])} className="px-4 py-2 bg-gray-700/50 text-gray-400 rounded-lg text-sm hover:bg-gray-700 transition-colors">Clear</button>
        </div>

        {/* Grade Table Editor */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="grid grid-cols-12 gap-2 mb-2">
            <div className="col-span-1 text-xs text-gray-500 uppercase">Grade</div>
            <div className="col-span-2 text-xs text-gray-500 uppercase">Name</div>
            <div className="col-span-2 text-xs text-gray-500 uppercase">Min %</div>
            <div className="col-span-2 text-xs text-gray-500 uppercase">Max %</div>
            <div className="col-span-2 text-xs text-gray-500 uppercase">GPA</div>
            <div className="col-span-2 text-xs text-gray-500 uppercase">Remark</div>
            <div className="col-span-1" />
          </div>
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-1"><input value={row.grade} onChange={e => updateRow(i,'grade',e.target.value)} placeholder="A1" className="w-full bg-black/30 border border-gray-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500 text-center font-bold" /></div>
                <div className="col-span-2"><input value={row.name} onChange={e => updateRow(i,'name',e.target.value)} placeholder="Excellent" className="w-full bg-black/30 border border-gray-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500" /></div>
                <div className="col-span-2"><input type="number" value={row.min_percent} onChange={e => updateRow(i,'min_percent',e.target.value)} placeholder="0" className="w-full bg-black/30 border border-gray-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500" /></div>
                <div className="col-span-2"><input type="number" value={row.max_percent} onChange={e => updateRow(i,'max_percent',e.target.value)} placeholder="100" className="w-full bg-black/30 border border-gray-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500" /></div>
                <div className="col-span-2"><input type="number" value={row.grade_point} onChange={e => updateRow(i,'grade_point',e.target.value)} placeholder="10" className="w-full bg-black/30 border border-gray-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500" /></div>
                <div className="col-span-2"><input value={row.remark} onChange={e => updateRow(i,'remark',e.target.value)} placeholder="Remark" className="w-full bg-black/30 border border-gray-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500" /></div>
                <div className="col-span-1 text-center"><button onClick={() => removeRow(i)} className="text-red-400 hover:bg-red-500/10 rounded px-1.5 py-1.5 text-sm transition-colors">✕</button></div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4">
            <button onClick={addRow} className="text-blue-400 text-sm hover:text-blue-300 transition-colors">+ Add Grade</button>
            <button onClick={save} disabled={saving} className="px-5 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg text-sm disabled:opacity-50 hover:shadow-lg transition-all">{saving ? 'Saving...' : 'Save Grade Scale'}</button>
          </div>
        </div>

        {/* Current Scale Preview */}
        {scales.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm text-gray-400 uppercase font-semibold mb-3">Current Active Scale</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {scales.map(s => (
                <div key={s.id} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-purple-400">{s.grade}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{Number(s.min_percent)}–{Number(s.max_percent)}%</p>
                  {s.grade_point && <p className="text-xs text-blue-400">{Number(s.grade_point)} GPA</p>}
                  {s.remark && <p className="text-xs text-gray-500 mt-0.5">{s.remark}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
