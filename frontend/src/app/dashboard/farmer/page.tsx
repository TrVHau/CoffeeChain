'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { EmptyState, ErrorState, LoadingState } from '@/components/dashboard/UiState';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { dashboardApi, getApiErrorMessage, type CreateHarvestInput } from '@/lib/api/dashboardApi';
import type { BatchResponse, BatchStatus } from '@/lib/api/types';
import { useRoleGuard } from '@/lib/auth/useRoleGuard';

const INITIAL_FORM: CreateHarvestInput = {
  farmLocation: '',
  harvestDate: '',
  coffeeVariety: '',
  weightKg: '',
};

function canMoveTo(current: BatchStatus, next: BatchStatus): boolean {
  if (current === 'CREATED' && (next === 'IN_PROCESS' || next === 'COMPLETED')) return true;
  if (current === 'IN_PROCESS' && next === 'COMPLETED') return true;
  return false;
}

export default function FarmerDashboardPage() {
  const { ready } = useRoleGuard('FARMER');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<CreateHarvestInput>(INITIAL_FORM);
  const [batches, setBatches] = useState<BatchResponse[]>([]);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const list = await dashboardApi.getList({ type: 'HARVEST' });
      setBatches(list);
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await dashboardApi.createHarvest(form);
      setForm(INITIAL_FORM);
      setMessage('Tạo Harvest batch thành công.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateStatus(batchId: string, newStatus: BatchStatus) {
    setError('');
    setMessage('');
    try {
      await dashboardApi.updateHarvestStatus(batchId, newStatus);
      setMessage(`Đã cập nhật trạng thái -> ${newStatus}.`);
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }

  if (!ready) {
    return <LoadingState text="Đang xác thực quyền truy cập..." />;
  }

  return (
    <DashboardShell title="Farmer Dashboard" subtitle="Quản lý Harvest batch và nhật ký canh tác">
      <div className="grid gap-6 xl:grid-cols-[380px,1fr]">
        <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-rose-900">Tạo Harvest batch</h2>
          <form onSubmit={handleCreate} className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Địa điểm nông trại</span>
              <input
                value={form.farmLocation}
                onChange={(e) => setForm((p) => ({ ...p, farmLocation: e.target.value }))}
                required
                className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
                placeholder="Da Lat"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Ngày thu hoạch</span>
              <input
                type="date"
                value={form.harvestDate}
                onChange={(e) => setForm((p) => ({ ...p, harvestDate: e.target.value }))}
                required
                className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Giống cà phê</span>
              <input
                value={form.coffeeVariety}
                onChange={(e) => setForm((p) => ({ ...p, coffeeVariety: e.target.value }))}
                required
                className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
                placeholder="Arabica"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Khối lượng (kg)</span>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={form.weightKg}
                onChange={(e) => setForm((p) => ({ ...p, weightKg: e.target.value }))}
                required
                className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
                placeholder="500"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:opacity-50"
            >
              {submitting ? 'Đang tạo...' : 'Tạo batch'}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-rose-900">Danh sách Harvest</h2>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50"
            >
              Làm mới
            </button>
          </div>

          {message && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
          {error && <ErrorState message={error} />}
          {loading && <LoadingState />}
          {!loading && !error && batches.length === 0 && <EmptyState text="Chưa có Harvest batch nào." />}

          {!loading && !error && batches.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-rose-100 text-left text-slate-500">
                    <th className="px-2 py-2 font-medium">Mã công khai</th>
                    <th className="px-2 py-2 font-medium">Trạng thái</th>
                    <th className="px-2 py-2 font-medium">Cập nhật</th>
                    <th className="px-2 py-2 font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.batchId} className="border-b border-rose-50">
                      <td className="px-2 py-2 font-mono text-xs text-slate-700">{batch.publicCode}</td>
                      <td className="px-2 py-2"><StatusBadge status={batch.status} /></td>
                      <td className="px-2 py-2 text-slate-600">{new Date(batch.updatedAt).toLocaleString('vi-VN')}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/dashboard/farmer/${encodeURIComponent(batch.batchId)}`}
                            className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                          >
                            Chi tiết
                          </Link>
                          {canMoveTo(batch.status, 'IN_PROCESS') && (
                            <button
                              type="button"
                              onClick={() => void handleUpdateStatus(batch.batchId, 'IN_PROCESS')}
                              className="rounded-md bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-200"
                            >
                              IN_PROCESS
                            </button>
                          )}
                          {canMoveTo(batch.status, 'COMPLETED') && (
                            <button
                              type="button"
                              onClick={() => void handleUpdateStatus(batch.batchId, 'COMPLETED')}
                              className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200"
                            >
                              COMPLETED
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
      </div>
    </DashboardShell>
  );
}
