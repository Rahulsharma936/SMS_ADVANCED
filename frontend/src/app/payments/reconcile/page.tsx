'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

interface PaymentRow {
  id: string; amount_paid: number; payment_method: string;
  transaction_id: string | null; gateway_reference: string | null;
  status: string; payment_date: string; created_at: string; remarks: string | null;
  student: { firstName: string; lastName: string; admission_number: string };
}
interface ReconcileData {
  pending_payments: PaymentRow[];
  failed_payments:  PaymentRow[];
  recent_payments:  PaymentRow[];
  summary: { pending_count: number; failed_count: number; pending_amount: number };
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const dtFmt = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

type Tab = 'pending' | 'failed' | 'recent';

export default function ReconcilePage() {
  const router = useRouter();
  const [data, setData]       = useState<ReconcileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<Tab>('pending');
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<Record<string, any>>({});
  const [webhookForm, setWebhookForm] = useState({ transaction_id: '', gateway_reference: '', status: 'success', amount: '' });
  const [webhookSending, setWebhookSending] = useState(false);
  const [webhookResult, setWebhookResult] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const d = await fetchApi('/fees/payments/reconcile');
      setData(d);
    } catch (e: any) {
      if (e.message?.includes('Unauthorized')) router.push('/login');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const verify = async (paymentId: string) => {
    setVerifying(paymentId);
    try {
      const d = await fetchApi('/fees/payments/verify', { method: 'POST', data: { payment_id: paymentId } });
      setVerifyResult(prev => ({ ...prev, [paymentId]: d.verification }));
    } catch (e: any) {
      setVerifyResult(prev => ({ ...prev, [paymentId]: { error: e.message } }));
    } finally { setVerifying(null); }
  };

  const sendWebhook = async () => {
    if (!webhookForm.transaction_id || !webhookForm.amount) {
      setWebhookResult('❌ transaction_id and amount are required'); return;
    }
    setWebhookSending(true); setWebhookResult('');
    try {
      await fetchApi('/fees/payments/webhook', {
        method: 'POST',
        data: { ...webhookForm, amount: parseFloat(webhookForm.amount) },
      });
      setWebhookResult(`✓ Webhook processed — payment status updated to ${webhookForm.status}`);
      load();
    } catch (e: any) { setWebhookResult(`❌ ${e.message}`); }
    finally { setWebhookSending(false); }
  };

  const rows: Record<Tab, PaymentRow[]> = {
    pending: data?.pending_payments || [],
    failed:  data?.failed_payments  || [],
    recent:  data?.recent_payments  || [],
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-pink-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/payments" className="text-gray-400 hover:text-white transition-colors">Record Payment</a>
            <a href="/payments/history" className="text-gray-400 hover:text-white transition-colors">History</a>
            <a href="/payments/reconcile" className="text-orange-400 font-medium">Reconcile</a>
            <a href="/fees" className="text-gray-400 hover:text-white transition-colors">Fees</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Reconciliation Dashboard</h1>
            <p className="text-gray-500 mt-1">Manage pending, failed, and online payment verification</p>
          </div>
          <button onClick={load} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm hover:bg-white/10 transition-colors">
            ↻ Refresh
          </button>
        </div>

        {/* Summary */}
        {data && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
              <p className="text-2xl font-bold text-amber-400">{data.summary.pending_count}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase">Pending Online Payments</p>
              <p className="text-sm text-amber-300 mt-2">{fmt(data.summary.pending_amount)} awaiting confirmation</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
              <p className="text-2xl font-bold text-red-400">{data.summary.failed_count}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase">Failed Transactions</p>
              <p className="text-sm text-red-300 mt-2">Needs investigation</p>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5">
              <p className="text-2xl font-bold text-emerald-400">{data.recent_payments.length}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase">Recent Successful</p>
              <p className="text-sm text-emerald-300 mt-2">Last {data.recent_payments.length} transactions</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Payment table */}
          <div className="xl:col-span-2">
            {/* Tabs */}
            <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 mb-4 w-fit">
              {([['pending', 'Pending'], ['failed', 'Failed'], ['recent', 'Recent']] as const).map(([t, label]) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    tab === t ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
                  }`}>{label} ({rows[t].length})</button>
              ))}
            </div>

            {rows[tab].length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center text-gray-600">
                <p>No {tab} payments</p>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="text-right px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Method / Txn ID</th>
                      <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Date</th>
                      {tab === 'pending' && <th className="text-center px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Verify</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows[tab].map(p => (
                      <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium">{p.student.firstName} {p.student.lastName}</p>
                          <p className="text-xs text-gray-500 font-mono">{p.student.admission_number}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-white">{fmt(p.amount_paid)}</td>
                        <td className="px-4 py-3">
                          <p className="text-gray-300 capitalize">{p.payment_method.replace('_', ' ')}</p>
                          {p.transaction_id && <p className="text-xs text-gray-600 font-mono truncate max-w-32">{p.transaction_id}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{dtFmt(p.payment_date)}</td>
                        {tab === 'pending' && (
                          <td className="px-4 py-3 text-center">
                            <div>
                              <button onClick={() => verify(p.id)} disabled={verifying === p.id}
                                className="text-xs text-orange-400 hover:text-orange-300 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50">
                                {verifying === p.id ? '…' : 'Verify'}
                              </button>
                              {verifyResult[p.id] && (
                                <p className={`text-xs mt-1 ${verifyResult[p.id].is_balanced === false ? 'text-red-400' : 'text-emerald-400'}`}>
                                  {verifyResult[p.id].error || (verifyResult[p.id].is_balanced ? '✓ Balanced' : `⚠ Gap: ${fmt(verifyResult[p.id].discrepancy)}`)}
                                </p>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Manual webhook trigger panel */}
          <div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-1">Manual Webhook Trigger</h2>
              <p className="text-xs text-gray-600 mb-4">Simulate a payment gateway callback to confirm or fail an online payment.</p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Transaction ID *</label>
                  <input value={webhookForm.transaction_id}
                    onChange={e => setWebhookForm(prev => ({ ...prev, transaction_id: e.target.value }))}
                    placeholder="From gateway"
                    className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Gateway Reference</label>
                  <input value={webhookForm.gateway_reference}
                    onChange={e => setWebhookForm(prev => ({ ...prev, gateway_reference: e.target.value }))}
                    placeholder="Order/payment ref"
                    className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Confirmed Status</label>
                  <select value={webhookForm.status}
                    onChange={e => setWebhookForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-orange-500">
                    <option value="success">Success ✓</option>
                    <option value="failed">Failed ✗</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Amount (₹) *</label>
                  <input type="number" value={webhookForm.amount}
                    onChange={e => setWebhookForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="Same as recorded"
                    className="w-full bg-black/30 border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-orange-500" />
                </div>

                <button onClick={sendWebhook} disabled={webhookSending}
                  className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl text-sm font-medium disabled:opacity-50 transition-all">
                  {webhookSending ? 'Sending…' : 'Send Webhook'}
                </button>

                {webhookResult && (
                  <p className={`text-xs p-3 rounded-xl border ${
                    webhookResult.startsWith('✓')
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>{webhookResult}</p>
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-gray-500 space-y-1.5">
              <p className="font-semibold text-gray-400 mb-2">Status Guide</p>
              <p><span className="text-amber-400">●</span> Pending — online payment awaiting gateway confirmation</p>
              <p><span className="text-emerald-400">●</span> Success — payment confirmed and installments updated</p>
              <p><span className="text-red-400">●</span> Failed — gateway rejected or timeout</p>
              <p><span className="text-purple-400">●</span> Refunded — payment reversed</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
