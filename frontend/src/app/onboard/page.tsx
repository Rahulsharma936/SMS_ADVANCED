'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { fetchApi } from '@/lib/api';

export default function OnboardPage() {
  // School info
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');

  // Admin info
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [error, setError] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Step 1: Create the tenant (school)
      const tenantRes = await fetchApi('/tenants', {
        method: 'POST',
        data: { name, domain },
      });

      const newTenantId = tenantRes.tenant.id;

      // Step 2: Register the admin user inside that tenant
      const authRes = await fetchApi('/auth/register', {
        method: 'POST',
        data: {
          email: adminEmail,
          password: adminPassword,
          tenant_id: newTenantId,
          roleName: 'Admin',
        },
      });

      // Step 3: Save token and tenant_id so the user is already logged in
      Cookies.set('token', authRes.token, { expires: 7 });
      Cookies.set('tenant_id', newTenantId, { expires: 7 });

      setTenantId(newTenantId);
    } catch (err: any) {
      setError(err.message || 'Failed to create school');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(tenantId);
    alert('Copied to clipboard!');
  };

  // Success screen
  if (tenantId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl w-full max-w-md text-center">
          <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">School Created!</h2>
          <p className="text-gray-300 text-sm mb-6">Your school and admin account are ready. You are already logged in!</p>
          
          <div className="bg-black/30 border border-white/10 p-4 rounded-xl mb-6">
            <p className="text-xs text-gray-400 uppercase font-semibold mb-2 text-left">Tenant ID (save this)</p>
            <code className="text-emerald-400 font-mono break-all text-sm block text-left">{tenantId}</code>
            <button 
              onClick={copyToClipboard}
              className="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 text-white text-xs rounded-lg border border-white/10 transition-all"
            >
              Copy ID
            </button>
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-gradient-to-r from-blue-500 to-emerald-500 text-white font-semibold py-3 rounded-xl shadow-lg hover:from-blue-600 hover:to-emerald-600 transition-all"
          >
            Go to Dashboard →
          </button>
        </div>
      </div>
    );
  }

  // Onboard form
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl w-full max-w-md transition-all duration-300 hover:shadow-indigo-500/20">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            Create School
          </h1>
          <p className="text-gray-300 mt-2 text-sm">Set up your school and admin account in one step</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-100 p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleOnboard} className="space-y-5">
          {/* School Details */}
          <div className="space-y-4">
            <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider">School Details</p>
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">School Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-500"
                placeholder="e.g. Springfield High"
                required
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">Domain (Optional)</label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-500"
                placeholder="e.g. springfield.sms.com"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10"></div>

          {/* Admin Account */}
          <div className="space-y-4">
            <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider">Admin Account</p>
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">Admin Email</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-500"
                placeholder="admin@school.com"
                required
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">Admin Password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-500"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white font-semibold py-3 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? 'Creating School...' : 'Create School & Admin'}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-400 text-sm">
          Already have an account?{' '}
          <a href="/login" className="text-blue-400 hover:text-blue-300 hover:underline transition-colors">
            Login here
          </a>
        </p>
      </div>
    </div>
  );
}
