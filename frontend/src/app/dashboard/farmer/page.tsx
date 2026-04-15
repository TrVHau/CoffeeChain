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

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildInitialForm(): CreateHarvestInput {
  return {
    ...INITIAL_FORM,
    harvestDate: getTodayDate(),
  };
}

function canMoveTo(current: BatchStatus, next: BatchStatus): boolean {
  if (current === 'CREATED' && (next === 'IN_PROCESS' || next === 'COMPLETED')) return true;
  if (current === 'IN_PROCESS' && next === 'COMPLETED') return true;
  return false;
}

const STATUS_ACTION_LABELS: Partial<Record<BatchStatus, string>> = {
  IN_PROCESS: 'Đưa vào xử lý',
  COMPLETED: 'Đánh dấu hoàn thành',
};

const PAGE_SIZE = 10;

export default function FarmerDashboardPage() {
  const { ready } = useRoleGuard('FARMER');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingBatchId, setUpdatingBatchId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<CreateHarvestInput>(buildInitialForm());
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [batches, setBatches] = useState<BatchResponse[]>([]);
  const [farmLocationOptions, setFarmLocationOptions] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(batches.length / PAGE_SIZE));
  const pagedBatches = batches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [list, accountOptions] = await Promise.all([
        dashboardApi.getList({ type: 'HARVEST' }),
        dashboardApi.getAccountOptions(),
      ]);

      setFarmLocationOptions(accountOptions.farmLocations);
      if (!form.farmLocation && accountOptions.farmLocations.length > 0) {
        setForm((prev) => ({ ...prev, farmLocation: accountOptions.farmLocations[0] }));
      }
        // Enrich batches with metadata from chain if not in DB
        const enriched = await Promise.all(
          list.map(async (batch) => {
            // If metadata is empty, try to get it from chain
            if (!batch.metadata || Object.keys(batch.metadata).length === 0) {
              try {
                const chainBatch = await dashboardApi.getBatchByIdChain(batch.batchId);
                return { ...batch, metadata: chainBatch.metadata };
              } catch (e) {
                // Chain query failed, return batch as-is
                return batch;
              }
            }
            return batch;
          }),
        );
        setBatches(enriched);
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

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

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
      const created = await dashboardApi.createHarvest({
        ...form,
        harvestDate: getTodayDate(),
      });
      const evidence = await dashboardApi.uploadEvidence(evidenceFile);
      await dashboardApi.addHarvestEvidence(created.batchId, evidence);
      setForm((prev) => ({ ...buildInitialForm(), farmLocation: prev.farmLocation }));
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
    if (updatingBatchId) return;
    const current = batches.find((batch) => batch.batchId === batchId);
    if (!current || !canMoveTo(current.status, newStatus)) {
      setError('Trạng thái lô đã thay đổi. Vui lòng làm mới và thử lại.');
      await refresh();
      return;
    }

    setUpdatingBatchId(batchId);
    setError('');
    setMessage('');
    try {
      if (newStatus === 'COMPLETED') {
        const finalWeightKg = window.prompt('Nhập khối lượng thực tế (kg) sau khi hoàn thành:', '');
        if (!finalWeightKg || !finalWeightKg.trim()) {
          setError('Bạn cần nhập khối lượng thực tế để hoàn thành batch.');
          return;
        }
        await dashboardApi.updateHarvestStatusWithWeight(batchId, newStatus, finalWeightKg.trim());
      } else {
        await dashboardApi.updateHarvestStatus(batchId, newStatus);
      }
      const actionLabel = STATUS_ACTION_LABELS[newStatus] ?? newStatus;
      setMessage(`Đã thực hiện: ${actionLabel}.`);
      await refresh();
    } catch (e) {
      const apiMessage = getApiErrorMessage(e);
      if (/Invalid transition/i.test(apiMessage)) {
        setError('Lô đã ở trạng thái mới nhất, không thể cập nhật lặp lại. Vui lòng làm mới dữ liệu.');
        await refresh();
      } else {
        setError(apiMessage);
      }
    } finally {
      setUpdatingBatchId(null);
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
              <select
                value={form.farmLocation}
                onChange={(e) => setForm((p) => ({ ...p, farmLocation: e.target.value }))}
                required
                className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
              >
                {farmLocationOptions.length === 0 && <option value="">Không có địa điểm hợp lệ</option>}
                {farmLocationOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Ngày thu hoạch (tự động)</span>
              <input
                type="text"
                value={form.harvestDate}
                readOnly
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
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Khối lượng sẽ được nhập ở bước chuyển trạng thái sang COMPLETED.
              </div>
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
              disabled={submitting || !form.farmLocation}
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
                {pagedBatches.map((batch) => (
                  <article key={batch.batchId} className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                    <div className="space-y-1">
                      {batch.metadata?.farmLocation && <p className="text-xs font-medium text-slate-700">📍 {batch.metadata.farmLocation}</p>}
                      {batch.metadata?.coffeeVariety && <p className="text-xs text-slate-600">☕ {batch.metadata.coffeeVariety}</p>}
                      <p className="font-mono text-xs text-slate-600">{batch.publicCode}</p>
                    </div>
                      {batch.metadata?.farmLocation && (
                      <p className="mt-1 text-xs text-slate-700"><span className="font-medium">Nơi:</span> {batch.metadata.farmLocation}</p>
                    )}
                    {batch.metadata?.coffeeVariety && (
                      <p className="mt-1 text-xs text-slate-700"><span className="font-medium">Giống:</span> {batch.metadata.coffeeVariety}</p>
                    )}
                  <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Trạng thái</span>
                      <StatusBadge status={batch.status} />
                    </div>
                    <p className="mt-2 text-xs text-slate-600">Cập nhật: {new Date(batch.updatedAt).toLocaleString('vi-VN')}</p>
                    <Link
                      href={`/dashboard/farmer/${encodeURIComponent(batch.batchId)}`}
                      className="mt-3 inline-flex items-center justify-center whitespace-nowrap rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                    >
                      Xem chi tiết
                    </Link>
                  </article>
                ))}
              </div>

              <div className="hidden w-full max-w-full overflow-x-auto md:block">
                <table className="min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-amber-100 text-left text-slate-500">
                      <th className="px-3 py-2 font-medium">Địa điểm</th>
                      <th className="px-3 py-2 font-medium">Giống cà phê</th>
                      <th className="px-3 py-2 font-medium">Mã công khai</th>
                      <th className="px-3 py-2 font-medium">Trạng thái</th>
                      <th className="px-3 py-2 font-medium">Cập nhật</th>
                      <th className="px-3 py-2 font-medium">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedBatches.map((batch) => (
                      <tr key={batch.batchId} className="border-b border-amber-50 hover:bg-amber-50/30">
                        <td className="px-3 py-2 text-sm font-medium text-slate-800">{batch.metadata?.farmLocation || '—'}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{batch.metadata?.coffeeVariety || '—'}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-700">{batch.publicCode}</td>
                        <td className="px-3 py-2"><StatusBadge status={batch.status} /></td>
                        <td className="px-3 py-2 text-slate-600 text-xs">{new Date(batch.updatedAt).toLocaleString('vi-VN')}</td>
                        <td className="px-3 py-2">
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

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                  >
                    Trang trước
                  </button>
                  <span className="text-xs text-slate-600">Trang {page}/{totalPages}</span>
                  <button
                    type="button"
                    disabled={page === totalPages}
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                  >
                    Trang sau
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
