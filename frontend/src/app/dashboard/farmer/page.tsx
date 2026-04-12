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

const STATUS_ACTION_LABELS: Partial<Record<BatchStatus, string>> = {
  IN_PROCESS: 'Đưa vào xử lý',
  COMPLETED: 'Đánh dấu hoàn thành',
};

export default function FarmerDashboardPage() {
  const { ready } = useRoleGuard('FARMER');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<CreateHarvestInput>(INITIAL_FORM);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [batches, setBatches] = useState<BatchResponse[]>([]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

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
    if (!evidenceFile) {
      setError('Vui lòng chọn ảnh minh chứng trước khi tạo Harvest batch.');
      return;
    }
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const created = await dashboardApi.createHarvest(form);
      const evidence = await dashboardApi.uploadEvidence(evidenceFile);
      await dashboardApi.addHarvestEvidence(created.batchId, evidence);
      setForm(INITIAL_FORM);
      setEvidenceFile(null);
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
      const actionLabel = STATUS_ACTION_LABELS[newStatus] ?? newStatus;
      setMessage(`Đã thực hiện: ${actionLabel}.`);
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
        <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-amber-900">Tạo Harvest batch</h2>
          <form onSubmit={handleCreate} className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Địa điểm nông trại</span>
              <input
                value={form.farmLocation}
                onChange={(e) => setForm((p) => ({ ...p, farmLocation: e.target.value }))}
                required
                className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
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
                className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Giống cà phê</span>
              <input
                value={form.coffeeVariety}
                onChange={(e) => setForm((p) => ({ ...p, coffeeVariety: e.target.value }))}
                required
                className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
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
                className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
                placeholder="500"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Ảnh minh chứng</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
                required
                className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
              />
            </label>
            {evidenceFile && <p className="text-xs text-slate-500">Đã chọn: {evidenceFile.name}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:opacity-50"
            >
              {submitting ? 'Đang tạo...' : 'Tạo batch'}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-amber-900">Danh sách Harvest</h2>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-lg border border-amber-200 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50"
            >
              Làm mới
            </button>
          </div>

          {message && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
          {error && <ErrorState message={error} />}
          {loading && <LoadingState />}
          {!loading && !error && batches.length === 0 && <EmptyState text="Chưa có Harvest batch nào." />}

          {!loading && !error && batches.length > 0 && (
            <>
              <div className="space-y-3 md:hidden">
                {batches.map((batch) => (
                  <article key={batch.batchId} className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                    <p className="font-mono text-xs text-slate-700">{batch.publicCode}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Trạng thái</span>
                      <StatusBadge status={batch.status} />
                    </div>
                    <p className="mt-2 text-xs text-slate-600">Cập nhật: {new Date(batch.updatedAt).toLocaleString('vi-VN')}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canMoveTo(batch.status, 'IN_PROCESS') && (
                        <button
                          type="button"
                          onClick={() => void handleUpdateStatus(batch.batchId, 'IN_PROCESS')}
                          className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                        >
                          Đưa vào xử lý
                        </button>
                      )}
                      {canMoveTo(batch.status, 'COMPLETED') && (
                        <button
                          type="button"
                          onClick={() => void handleUpdateStatus(batch.batchId, 'COMPLETED')}
                          className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200"
                        >
                          Đánh dấu hoàn thành
                        </button>
                      )}
                      {!canMoveTo(batch.status, 'IN_PROCESS') && !canMoveTo(batch.status, 'COMPLETED') && (
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          Đã hoàn thành
                        </span>
                      )}
                      <Link
                        href={`/dashboard/farmer/${encodeURIComponent(batch.batchId)}`}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                      >
                        Xem chi tiết
                      </Link>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden w-full max-w-full overflow-x-auto md:block">
                <table className="min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-amber-100 text-left text-slate-500">
                      <th className="px-2 py-2 font-medium">Mã công khai</th>
                      <th className="px-2 py-2 font-medium">Trạng thái</th>
                      <th className="px-2 py-2 font-medium">Cập nhật</th>
                      <th className="px-2 py-2 font-medium">Thao tác</th>
                      <th className="px-2 py-2 font-medium">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch) => (
                      <tr key={batch.batchId} className="border-b border-amber-50">
                        <td className="px-2 py-2 font-mono text-xs text-slate-700">{batch.publicCode}</td>
                        <td className="px-2 py-2"><StatusBadge status={batch.status} /></td>
                        <td className="px-2 py-2 text-slate-600">{new Date(batch.updatedAt).toLocaleString('vi-VN')}</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-2">
                            {canMoveTo(batch.status, 'IN_PROCESS') && (
                              <button
                                type="button"
                                onClick={() => void handleUpdateStatus(batch.batchId, 'IN_PROCESS')}
                                className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                              >
                                Đưa vào xử lý
                              </button>
                            )}
                            {canMoveTo(batch.status, 'COMPLETED') && (
                              <button
                                type="button"
                                onClick={() => void handleUpdateStatus(batch.batchId, 'COMPLETED')}
                                className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200"
                              >
                                Đánh dấu hoàn thành
                              </button>
                            )}
                            {!canMoveTo(batch.status, 'IN_PROCESS') && !canMoveTo(batch.status, 'COMPLETED') && (
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                                Đã hoàn thành
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <Link
                            href={`/dashboard/farmer/${encodeURIComponent(batch.batchId)}`}
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                          >
                            Xem chi tiết
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
