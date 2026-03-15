'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { EmptyState, ErrorState, LoadingState } from '@/components/dashboard/UiState';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { dashboardApi, getApiErrorMessage } from '@/lib/api/dashboardApi';
import type { BatchResponse } from '@/lib/api/types';
import { useRoleGuard } from '@/lib/auth/useRoleGuard';

export default function RetailerDashboardPage() {
  const { ready } = useRoleGuard('RETAILER');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [packaged, setPackaged] = useState<BatchResponse[]>([]);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const list = await dashboardApi.getList({ type: 'PACKAGED' });
      setPackaged(list);
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

  async function updateToInStock(batchId: string) {
    setError('');
    setMessage('');
    try {
      await dashboardApi.updateRetailStatus(batchId, 'IN_STOCK');
      setMessage('Da cap nhat status -> IN_STOCK.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }

  async function updateToSold(batchId: string) {
    setError('');
    setMessage('');
    try {
      await dashboardApi.updateRetailStatus(batchId, 'SOLD');
      setMessage('Da cap nhat status -> SOLD.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }

  if (!ready) return <LoadingState text="Dang xac thuc quyen truy cap..." />;

  return (
    <DashboardShell title="Retailer Dashboard" subtitle="Quan ly ton kho va trang thai ban le">
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
                  <th className="px-2 py-2 font-medium">Owner</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {packaged.map((item) => (
                  <tr key={item.batchId} className="border-b border-rose-50">
                    <td className="px-2 py-2 font-mono text-xs text-slate-700">{item.publicCode}</td>
                    <td className="px-2 py-2"><StatusBadge status={item.status} /></td>
                    <td className="px-2 py-2 text-slate-600">{item.ownerMsp}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-2">
                        {item.status === 'TRANSFERRED' && (
                          <button
                            type="button"
                            onClick={() => void updateToInStock(item.batchId)}
                            className="rounded-md bg-cyan-100 px-2 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-200"
                          >
                            IN_STOCK
                          </button>
                        )}
                        {item.status === 'IN_STOCK' && (
                          <button
                            type="button"
                            onClick={() => void updateToSold(item.batchId)}
                            className="rounded-md bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-200"
                          >
                            SOLD
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
