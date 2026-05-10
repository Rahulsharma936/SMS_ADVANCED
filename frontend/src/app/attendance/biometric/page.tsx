'use client';

import { useState } from 'react';
import { fetchApi } from '@/lib/api';

interface SyncResult {
  logsReceived: number;
  studentsProcessed: number;
}

export default function BiometricPage() {
  const [jsonInput, setJsonInput] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<SyncResult[]>([]);

  // Quick-add form for manual entry
  const [showManual, setShowManual] = useState(false);
  const [manualEntries, setManualEntries] = useState<{ student_id: string; timestamp: string; device_id: string }[]>([
    { student_id: '', timestamp: new Date().toISOString().slice(0, 16), device_id: '' },
  ]);

  const addManualEntry = () => {
    setManualEntries([...manualEntries, { student_id: '', timestamp: new Date().toISOString().slice(0, 16), device_id: '' }]);
  };

  const updateEntry = (index: number, field: string, value: string) => {
    const updated = [...manualEntries];
    (updated[index] as any)[field] = value;
    setManualEntries(updated);
  };

  const removeEntry = (index: number) => {
    setManualEntries(manualEntries.filter((_, i) => i !== index));
  };

  const handleSync = async (logs: any[]) => {
    setSyncing(true);
    setError('');
    setResult(null);
    try {
      const data = await fetchApi('/attendance/biometric-sync', {
        method: 'POST',
        data: { logs },
      });
      setResult({ logsReceived: data.logsReceived, studentsProcessed: data.studentsProcessed });
      setHistory((prev) => [{ logsReceived: data.logsReceived, studentsProcessed: data.studentsProcessed }, ...prev]);
    } catch (err: any) {
      setError(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleJsonSync = () => {
    try {
      const logs = JSON.parse(jsonInput);
      if (!Array.isArray(logs)) throw new Error('Input must be a JSON array');
      handleSync(logs);
    } catch (err: any) {
      setError(err.message || 'Invalid JSON');
    }
  };

  const handleManualSync = () => {
    const validEntries = manualEntries.filter((e) => e.student_id && e.timestamp);
    if (validEntries.length === 0) {
      setError('Add at least one entry with student ID and timestamp');
      return;
    }
    handleSync(validEntries.map((e) => ({
      student_id: e.student_id,
      timestamp: new Date(e.timestamp).toISOString(),
      device_id: e.device_id || undefined,
    })));
  };

  const sampleJson = JSON.stringify(
    [
      { student_id: '<student-uuid>', timestamp: '2026-05-03T08:30:00Z', device_id: 'BIO-GATE-01' },
      { student_id: '<student-uuid>', timestamp: '2026-05-03T08:31:00Z', device_id: 'BIO-GATE-01' },
    ],
    null,
    2
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            SMS Portal
          </a>
          <div className="flex gap-4 text-sm">
            <a href="/attendance" className="text-gray-400 hover:text-white transition-colors">Mark</a>
            <a href="/attendance/report" className="text-gray-400 hover:text-white transition-colors">Reports</a>
            <a href="/leave" className="text-gray-400 hover:text-white transition-colors">Leave</a>
            <a href="/attendance/biometric" className="text-blue-400 font-medium">Biometric</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Biometric Sync</h1>
          <p className="text-gray-500 mt-1">
            Import attendance logs from biometric devices. Logs are matched to students and converted into attendance records automatically.
          </p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-300 p-4 rounded-xl mb-6 text-sm flex items-start gap-2">
            <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{error}</span>
          </div>
        )}
        {result && (
          <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-300 p-4 rounded-xl mb-6 text-sm flex items-start gap-2">
            <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>
              Sync complete — <strong>{result.logsReceived}</strong> logs received, <strong>{result.studentsProcessed}</strong> students processed into attendance records.
            </span>
          </div>
        )}

        {/* How it works */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="text-sm text-gray-400 uppercase font-semibold mb-3">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold shrink-0">1</div>
              <div>
                <p className="font-medium text-sm">Receive Logs</p>
                <p className="text-xs text-gray-500 mt-0.5">Import raw biometric punch logs from your device or API</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-bold shrink-0">2</div>
              <div>
                <p className="font-medium text-sm">Map Students</p>
                <p className="text-xs text-gray-500 mt-0.5">System maps student IDs to their class &amp; section</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold shrink-0">3</div>
              <div>
                <p className="font-medium text-sm">Mark Present</p>
                <p className="text-xs text-gray-500 mt-0.5">Creates attendance sessions &amp; marks matched students as PRESENT</p>
              </div>
            </div>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit mb-6">
          <button
            onClick={() => setShowManual(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!showManual ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white'}`}
          >
            JSON / API Import
          </button>
          <button
            onClick={() => setShowManual(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showManual ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white'}`}
          >
            Manual Entry
          </button>
        </div>

        {/* JSON Import Mode */}
        {!showManual && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="font-semibold mb-2">Paste Biometric Logs (JSON)</h3>
            <p className="text-gray-500 text-xs mb-4">
              Paste an array of log objects from your biometric device. Each log needs: <code className="text-blue-400">student_id</code>, <code className="text-blue-400">timestamp</code>, and optionally <code className="text-blue-400">device_id</code>.
            </p>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              rows={10}
              placeholder={sampleJson}
              className="w-full bg-black/40 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 resize-none transition-colors"
            />
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setJsonInput(sampleJson)}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Load sample data
              </button>
              <button
                onClick={handleJsonSync}
                disabled={syncing || !jsonInput.trim()}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-sm font-medium disabled:opacity-50 hover:shadow-lg hover:shadow-blue-500/25 transition-all"
              >
                {syncing ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Syncing...
                  </span>
                ) : (
                  'Sync Logs'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Manual Entry Mode */}
        {showManual && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="font-semibold mb-4">Manual Biometric Entry</h3>
            <div className="space-y-3">
              {manualEntries.map((entry, i) => (
                <div key={i} className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-5">
                    {i === 0 && <label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Student ID</label>}
                    <input
                      value={entry.student_id}
                      onChange={(e) => updateEntry(i, 'student_id', e.target.value)}
                      placeholder="Student UUID"
                      className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div className="col-span-4">
                    {i === 0 && <label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Timestamp</label>}
                    <input
                      type="datetime-local"
                      value={entry.timestamp}
                      onChange={(e) => updateEntry(i, 'timestamp', e.target.value)}
                      className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">Device</label>}
                    <input
                      value={entry.device_id}
                      onChange={(e) => updateEntry(i, 'device_id', e.target.value)}
                      placeholder="BIO-01"
                      className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-1">
                    <button
                      onClick={() => removeEntry(i)}
                      className="w-full py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg text-sm transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={addManualEntry}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                + Add Entry
              </button>
              <button
                onClick={handleManualSync}
                disabled={syncing}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-sm font-medium disabled:opacity-50 hover:shadow-lg hover:shadow-blue-500/25 transition-all"
              >
                {syncing ? 'Syncing...' : `Sync ${manualEntries.filter((e) => e.student_id).length} Entries`}
              </button>
            </div>
          </div>
        )}

        {/* Sync History */}
        {history.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm text-gray-400 uppercase font-semibold mb-3">Sync History (This Session)</h3>
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between text-sm">
                  <span className="text-gray-300">
                    {h.logsReceived} logs → {h.studentsProcessed} students processed
                  </span>
                  <span className="text-xs text-gray-500">just now</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* API Integration Info */}
        <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-sm text-gray-400 uppercase font-semibold mb-3">API Integration</h3>
          <p className="text-gray-500 text-sm mb-3">
            For automated syncing from your biometric device, use this API endpoint:
          </p>
          <div className="bg-black/40 rounded-xl p-4 font-mono text-sm">
            <span className="text-emerald-400">POST</span>{' '}
            <span className="text-blue-300">/api/attendance/biometric-sync</span>
            <br />
            <span className="text-gray-500">Headers:</span>{' '}
            <span className="text-amber-300">Authorization: Bearer &lt;token&gt;</span>,{' '}
            <span className="text-amber-300">x-tenant-id: &lt;tenant_id&gt;</span>
            <br />
            <span className="text-gray-500">Body:</span>{' '}
            <span className="text-purple-300">{'{ "logs": [{ "student_id": "...", "timestamp": "...", "device_id": "..." }] }'}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
