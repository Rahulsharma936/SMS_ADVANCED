'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { BACKEND_URL } from '@/lib/api';

export default function ImportStudentsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError(''); setResult(null); setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = Cookies.get('token');
      const tenantId = Cookies.get('tenant_id');

      const res = await fetch(`${BACKEND_URL}/api/students/bulk-import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-tenant-id': tenantId || '',
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/students" className="text-blue-400 font-medium">Students</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Import Students</h1>
            <p className="text-gray-400 mt-1 text-sm">Upload an Excel file (.xlsx) to bulk-import students</p>
          </div>
          <a href="/students" className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg">← Back</a>
        </div>

        {/* Template Info */}
        <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl mb-8">
          <h3 className="text-sm font-semibold text-blue-300 mb-2">Excel Format Required:</h3>
          <p className="text-xs text-gray-300 mb-2">Your Excel file must have these column headers in the first row:</p>
          <code className="text-xs text-blue-400 block bg-black/30 p-3 rounded-lg overflow-x-auto">
            firstName | lastName | className | sectionName | roll_number | gender | dateOfBirth | fatherName | guardianContact | addressLine | city | state | admission_number (optional)
          </code>
          <p className="text-xs text-gray-400 mt-2">Note: <code className="text-blue-400">className</code> and <code className="text-blue-400">sectionName</code> must match existing classes/sections exactly.</p>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-medium mb-2">Select Excel File (.xlsx)</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
            />
          </div>
          <button type="submit" disabled={!file || loading} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
            {loading ? 'Importing...' : 'Import Students'}
          </button>
        </form>

        {/* Results */}
        {result && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">Import Results</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl text-center">
                <div className="text-3xl font-bold text-emerald-400">{result.inserted}</div>
                <div className="text-xs text-gray-400 uppercase">Inserted</div>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-center">
                <div className="text-3xl font-bold text-red-400">{result.failed}</div>
                <div className="text-xs text-gray-400 uppercase">Failed</div>
              </div>
            </div>
            {result.failures?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-400 mb-2">Failed Rows:</h4>
                <div className="bg-black/30 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {result.failures.map((f: any, i: number) => (
                    <div key={i} className="text-xs text-gray-300 py-1 border-b border-white/5">
                      Row {f.row}: <span className="text-red-400">{f.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
