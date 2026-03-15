'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { EmptyState, ErrorState, LoadingState } from '@/components/dashboard/UiState';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { dashboardApi, getApiErrorMessage, type CreatePackagedInput } from '@/lib/api/dashboardApi';
import type { BatchResponse } from '@/lib/api/types';
import { useRoleGuard } from '@/lib/auth/useRoleGuard';

const INITIAL_FORM: CreatePackagedInput = {
  parentBatchId: '',
  packageWeight: '',
  packageDate: '',
  expiryDate: '',
  packageCount: '',
};

export default function PackagerDashboardPage() {
  const { ready } = useRoleGuard('PACKAGER');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [roastPending, setRoastPending] = useState<BatchResponse[]>([]);
  const [roastTransferred, setRoastTransferred] = useState<BatchResponse[]>([]);
  const [packaged, setPackaged] = useState<BatchResponse[]>([]);
  const [form, setForm] = useState<CreatePackagedInput>(INITIAL_FORM);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [pending, transferred, packagedList] = await Promise.all([
        dashboardApi.getList({ type: 'ROAST', status: 'TRANSFER_PENDING' }),
        dashboardApi.getList({ type: 'ROAST', status: 'TRANSFERRED' }),
        dashboardApi.getList({ type: 'PACKAGED' }),
      ]);
      setRoastPending(pending);
      setRoastTransferred(transferred);
      setPackaged(packagedList);
      setForm((p) => ({ ...p, parentBatchId: p.parentBatchId || transferred[0]?.batchId || '' }));
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!ready) return;
    void refresh();
  }, [ready]);

  async function acceptTransfer(batchId: string) {
    setError('');
    setMessage('');
    try {
      await dashboardApi.acceptTransfer(batchId);
      setMessage('Da accept transfer thanh cong.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }

  async function createPackaged(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await dashboardApi.createPackaged(form);
      setForm((p) => ({ ...INITIAL_FORM, parentBatchId: p.parentBatchId }));
      setMessage('Da tao Packaged batch thanh cong.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadQr(batchId: string) {
    setError('');
    try {
      const url = await dashboardApi.getPackagedQrUrl(batchId);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${batchId}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }

  if (!ready) return <LoadingState text="Dang xac thuc quyen truy cap..." />;

  return (
    <DashboardShell title="Packager Dashboard" subtitle="Accept transfer, tao package va tai QR">
      <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-rose-900">Roast cho accept transfer</h2>
            {roastPending.length === 0 && (
              <p className="mt-3 text-sm text-slate-500">Khong co Roast nao dang transfer pending.</p>
            )}
            <div className="mt-3 space-y-2">
              {roastPending.map((item) => (
                <div key={item.batchId} className="rounded-xl border border-rose-100 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-mono text-xs text-slate-700">{item.publicCode}</p>
                    <StatusBadge status={item.status} />
                  </div>
                  <button
                    type="button"
                    onClick={() => void acceptTransfer(item.batchId)}
                    className="rounded-md bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200"
                  >
                    Accept transfer
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-rose-900">Tao Packaged batch</h2>
            <form onSubmit={createPackaged} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Parent Roast (TRANSFERRED)</span>
                <select
                  value={form.parentBatchId}
                  onChange={(e) => setForm((p) => ({ ...p, parentBatchId: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
                >
                  {roastTransferred.length === 0 && <option value="">Khong co Roast da transfer</option>}
                  {roastTransferred.map((item) => (
                    <option key={item.batchId} value={item.batchId}>
                      {item.publicCode} - {item.batchId.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Package weight</span>
                <input
                  value={form.packageWeight}
                  onChange={(e) => setForm((p) => ({ ...p, packageWeight: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
                  placeholder="250"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Package date</span>
                <input
                  type="date"
                  value={form.packageDate}
                  onChange={(e) => setForm((p) => ({ ...p, packageDate: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Expiry date</span>
                <input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Package count</span>
                <input
                  value={form.packageCount}
                  onChange={(e) => setForm((p) => ({ ...p, packageCount: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
                />
              </label>
              <button
                type="submit"
                disabled={submitting || roastTransferred.length === 0}
                className="w-full rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
              >
                {submitting ? 'Dang tao...' : 'Tao Packaged batch'}
              </button>
            </form>
          </section>
        </div>

        <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-rose-900">Danh sach Packaged</h2>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50"
            >
              Lam moi
            </button>
          </div>
          {message && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
          {error && <ErrorState message={error} />}
          {loading && <LoadingState />}
          {!loading && !error && packaged.length === 0 && <EmptyState text="Chua co Packaged batch nao." />}

          {!loading && !error && packaged.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-rose-100 text-left text-slate-500">
                    <th className="px-2 py-2 font-medium">Public code</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Updated</th>
                    <th className="px-2 py-2 font-medium">QR</th>
                  </tr>
                </thead>
                <tbody>
                  {packaged.map((item) => (
                    <tr key={item.batchId} className="border-b border-rose-50">
                      <td className="px-2 py-2 font-mono text-xs text-slate-700">{item.publicCode}</td>
                      <td className="px-2 py-2"><StatusBadge status={item.status} /></td>
                      <td className="px-2 py-2 text-slate-600">{new Date(item.updatedAt).toLocaleString('vi-VN')}</td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => void downloadQr(item.batchId)}
                          className="rounded-md bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-200"
                        >
                          Download QR
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
