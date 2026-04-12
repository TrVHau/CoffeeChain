'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { EmptyState, ErrorState, LoadingState } from '@/components/dashboard/UiState';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { dashboardApi, getApiErrorMessage, type CreateProcessedInput } from '@/lib/api/dashboardApi';
import { TraceTimeline } from '@/components/TraceTimeline';
import type { BatchResponse, BatchStatus, TraceResponse } from '@/lib/api/types';
import { useRoleGuard } from '@/lib/auth/useRoleGuard';

const INITIAL_FORM: CreateProcessedInput = {
  parentBatchId: '',
  processingMethod: 'Washed',
  startDate: '',
  endDate: '',
  facilityName: '',
  weightKg: '',
};

const METHODS = ['Washed', 'Natural', 'Honey'] as const;

function canMoveTo(current: BatchStatus, next: BatchStatus): boolean {
  if (current === 'CREATED' && (next === 'IN_PROCESS' || next === 'COMPLETED')) return true;
  if (current === 'IN_PROCESS' && next === 'COMPLETED') return true;
  return false;
}

export default function ProcessorDashboardPage() {
  const { ready } = useRoleGuard('PROCESSOR');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<CreateProcessedInput>(INITIAL_FORM);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [processed, setProcessed] = useState<BatchResponse[]>([]);
  const [harvestParents, setHarvestParents] = useState<BatchResponse[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [detailTrace, setDetailTrace] = useState<TraceResponse | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [processedList, harvestList] = await Promise.all([
        dashboardApi.getList({ type: 'PROCESSED' }),
        dashboardApi.getList({ type: 'HARVEST', status: 'COMPLETED' }),
      ]);
      setProcessed(processedList);
      setHarvestParents(harvestList);
      setForm((prev) => ({
        ...prev,
        parentBatchId: prev.parentBatchId || harvestList[0]?.batchId || '',
      }));
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
      setError('Vui lòng chọn ảnh minh chứng trước khi tạo Processed batch.');
      return;
    }
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const created = await dashboardApi.createProcessed(form);
      const evidence = await dashboardApi.uploadEvidence(evidenceFile);
      await dashboardApi.addProcessedEvidence(created.batchId, evidence);
      setForm((p) => ({ ...INITIAL_FORM, parentBatchId: p.parentBatchId }));
      setEvidenceFile(null);
      setMessage('Tạo Processed batch thành công.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(batchId: string, newStatus: BatchStatus) {
    setError('');
    setMessage('');
    try {
      await dashboardApi.updateProcessedStatus(batchId, newStatus);
      setMessage(`Đã cập nhật trạng thái -> ${newStatus}.`);
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }

  async function openDetail(publicCode: string) {
    setSelectedCode(publicCode);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError('');
    setDetailTrace(null);
    try {
      const trace = await dashboardApi.getTrace(publicCode);
      setDetailTrace(trace);
    } catch (e) {
      setDetailError(getApiErrorMessage(e));
    } finally {
      setDetailLoading(false);
    }
  }

  if (!ready) return <LoadingState text="Đang xác thực quyền truy cập..." />;

  return (
    <DashboardShell title="Processor Dashboard" subtitle="Tạo Processed batch từ Harvest đã hoàn thành">
      <div className="grid gap-6 xl:grid-cols-[380px,1fr]">
        <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-amber-900">Tạo Processed batch</h2>
          <form onSubmit={handleCreate} className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Harvest nguồn</span>
              <select
                value={form.parentBatchId}
                onChange={(e) => setForm((p) => ({ ...p, parentBatchId: e.target.value }))}
                required
                className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
              >
                {harvestParents.length === 0 && <option value="">Không có parent hợp lệ</option>}
                {harvestParents.map((item) => (
                  <option key={item.batchId} value={item.batchId}>
                    {item.publicCode} - {item.batchId.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Phương pháp sơ chế</span>
              <select
                value={form.processingMethod}
                onChange={(e) => setForm((p) => ({ ...p, processingMethod: e.target.value }))}
                className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
              >
                {METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Ngày bắt đầu</span>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                required
                className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Ngày kết thúc</span>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                required
                className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Tên cơ sở sơ chế</span>
              <input
                value={form.facilityName}
                onChange={(e) => setForm((p) => ({ ...p, facilityName: e.target.value }))}
                required
                className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
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
              disabled={submitting || harvestParents.length === 0}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
                <path d="M5 12h14M12 5v14" />
              </svg>
              {submitting ? 'Đang tạo...' : 'Tạo Processed batch'}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-amber-900">Danh sách Processed</h2>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
                <path d="M20 12a8 8 0 1 1-2.3-5.7" />
                <path d="M20 5v4h-4" />
              </svg>
              Làm mới
            </button>
          </div>
          {message && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
          {error && <ErrorState message={error} />}
          {loading && <LoadingState />}
          {!loading && !error && processed.length === 0 && <EmptyState text="Chưa có Processed batch nào." />}

          {!loading && !error && processed.length > 0 && (
            <>
              <div className="space-y-3 md:hidden">
                {processed.map((item) => (
                  <article key={item.batchId} className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                    <p className="font-mono text-xs text-slate-700">{item.publicCode}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Trạng thái</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-2 text-xs text-slate-600">Cập nhật: {new Date(item.updatedAt).toLocaleString('vi-VN')}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canMoveTo(item.status, 'IN_PROCESS') && (
                        <button
                          type="button"
                          onClick={() => void updateStatus(item.batchId, 'IN_PROCESS')}
                          className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                        >
                          IN_PROCESS
                        </button>
                      )}
                      {canMoveTo(item.status, 'COMPLETED') && (
                        <button
                          type="button"
                          onClick={() => void updateStatus(item.batchId, 'COMPLETED')}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200"
                        >
                          COMPLETED
                        </button>
                      )}
                      {!canMoveTo(item.status, 'IN_PROCESS') && !canMoveTo(item.status, 'COMPLETED') && (
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          Không có thao tác
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void openDetail(item.publicCode)}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                      >
                        Xem chi tiết
                      </button>
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
                    {processed.map((item) => (
                      <tr key={item.batchId} className="border-b border-amber-50">
                        <td className="px-2 py-2 font-mono text-xs text-slate-700">{item.publicCode}</td>
                        <td className="px-2 py-2"><StatusBadge status={item.status} /></td>
                        <td className="px-2 py-2 text-slate-600">{new Date(item.updatedAt).toLocaleString('vi-VN')}</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-2">
                            {canMoveTo(item.status, 'IN_PROCESS') && (
                              <button
                                type="button"
                                onClick={() => void updateStatus(item.batchId, 'IN_PROCESS')}
                                className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden="true">
                                  <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
                                </svg>
                                IN_PROCESS
                              </button>
                            )}
                            {canMoveTo(item.status, 'COMPLETED') && (
                              <button
                                type="button"
                                onClick={() => void updateStatus(item.batchId, 'COMPLETED')}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden="true">
                                  <path d="M5 12l4 4 10-10" />
                                </svg>
                                COMPLETED
                              </button>
                            )}
                            {!canMoveTo(item.status, 'IN_PROCESS') && !canMoveTo(item.status, 'COMPLETED') && (
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                                Không có thao tác
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => void openDetail(item.publicCode)}
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                          >
                            Xem chi tiết
                          </button>
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

      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-amber-900">Chi tiết lô sơ chế</h3>
                <p className="text-xs text-slate-500">Mã công khai: {selectedCode}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="rounded-md border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
              >
                Đóng
              </button>
            </div>

            {detailLoading && <LoadingState text="Đang tải chi tiết lô..." />}
            {!detailLoading && detailError && <ErrorState message={detailError} />}
            {!detailLoading && !detailError && detailTrace && (
              <TraceTimeline
                batches={[...detailTrace.parentChain, detailTrace.batch]}
                farmActivities={detailTrace.farmActivities}
                ledgerRefs={detailTrace.ledgerRefs}
              />
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
