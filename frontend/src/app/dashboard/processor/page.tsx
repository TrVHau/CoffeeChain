'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { EmptyState, ErrorState, LoadingState } from '@/components/dashboard/UiState';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { dashboardApi, getApiErrorMessage, type CreateProcessedInput } from '@/lib/api/dashboardApi';
import { TraceTimeline } from '@/components/TraceTimeline';
import { QrScanner } from '@/components/QrScanner';
import { getWeightValidationError, normalizeWeightInput } from '@/lib/validation/weight';
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

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildInitialForm(): CreateProcessedInput {
  return {
    ...INITIAL_FORM,
    startDate: getTodayDate(),
  };
}

const METHODS = ['Washed', 'Natural', 'Honey'] as const;

function isMetadataEmpty(batch: BatchResponse): boolean {
  return !batch.metadata || Object.keys(batch.metadata).length === 0;
}

function pickMetadataValue(batch: BatchResponse | null, keys: string[]): string {
  if (!batch?.metadata) return '—';
  for (const key of keys) {
    const value = batch.metadata[key];
    if (value && value.trim()) return value;
  }
  return '—';
}

function canMoveTo(current: BatchStatus, next: BatchStatus): boolean {
  if (current === 'CREATED' && (next === 'IN_PROCESS' || next === 'COMPLETED')) return true;
  if (current === 'IN_PROCESS' && next === 'COMPLETED') return true;
  return false;
}

const PAGE_SIZE_OPTIONS = [10, 20] as const;

export default function ProcessorDashboardPage() {
  const { ready } = useRoleGuard('PROCESSOR');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<CreateProcessedInput>(buildInitialForm());
  const [sourceCodeInput, setSourceCodeInput] = useState('');
  const [resolvingSource, setResolvingSource] = useState(false);
  const [sourceResolved, setSourceResolved] = useState<BatchResponse | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [processed, setProcessed] = useState<BatchResponse[]>([]);
  const [facilityOptions, setFacilityOptions] = useState<string[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [detailTrace, setDetailTrace] = useState<TraceResponse | null>(null);
  const [qrDownloading, setQrDownloading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const totalPages = Math.max(1, Math.ceil(processed.length / pageSize));
  const pagedProcessed = processed.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [processedList, accountOptions] = await Promise.all([
        dashboardApi.getList({ type: 'PROCESSED' }),
        dashboardApi.getAccountOptions(),
      ]);

      setFacilityOptions(accountOptions.processingFacilities);
      if (!form.facilityName && accountOptions.processingFacilities.length > 0) {
        setForm((prev) => ({ ...prev, facilityName: accountOptions.processingFacilities[0] }));
      }

      const processedEnriched = await Promise.all(
        processedList.map(async (item) => {
          if (!isMetadataEmpty(item)) return item;
          try {
            const chainBatch = await dashboardApi.getBatchByIdChain(item.batchId);
            return { ...item, metadata: chainBatch.metadata };
          } catch {
            return item;
          }
        }),
      );

      setProcessed(processedEnriched);
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
    if (!form.parentBatchId) {
      setError('Vui lòng quét mã QR hoặc nhập mã lô để xác định Harvest nguồn trước khi tạo.');
      return;
    }
    if (!evidenceFile) {
      setError('Vui lòng chọn ảnh minh chứng trước khi tạo Processed batch.');
      return;
    }
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const created = await dashboardApi.createProcessed({
        ...form,
        startDate: getTodayDate(),
      });
      const evidence = await dashboardApi.uploadEvidence(evidenceFile);
      await dashboardApi.addProcessedEvidence(created.batchId, evidence);
      setForm((prev) => ({ ...buildInitialForm(), facilityName: prev.facilityName }));
      setSourceCodeInput('');
      setSourceResolved(null);
      setEvidenceFile(null);
      setMessage('Tạo Processed batch và cập nhật minh chứng thành công.');
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
      if (newStatus === 'COMPLETED') {
        const finalWeightKg = window.prompt('Nhập khối lượng thực tế (kg) sau khi hoàn thành:', '');
        if (!finalWeightKg || !finalWeightKg.trim()) {
          setError('Bạn cần nhập khối lượng thực tế để hoàn thành batch.');
          return;
        }
        const weightError = getWeightValidationError(finalWeightKg, 'Khối lượng thực tế');
        if (weightError) {
          setError(weightError);
          return;
        }
        await dashboardApi.updateProcessedStatusWithWeight(batchId, newStatus, normalizeWeightInput(finalWeightKg));
      } else {
        await dashboardApi.updateProcessedStatus(batchId, newStatus);
      }
      setMessage(`Đã cập nhật trạng thái -> ${newStatus}.`);
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }

  function extractCode(raw: string): string {
    const value = raw.trim();
    const match = value.match(/\/trace\/([^/?#\s]+)/);
    return match ? match[1] : value;
  }

  async function resolveHarvestSource(rawInput?: string) {
    const code = extractCode(rawInput ?? sourceCodeInput);
    if (!code) {
      setError('Vui lòng nhập mã truy xuất hoặc URL QR hợp lệ.');
      return;
    }

    setResolvingSource(true);
    setError('');
    try {
      const trace = await dashboardApi.getTrace(code);
      const chain = [...(trace.parentChain ?? []), trace.batch].filter(Boolean) as BatchResponse[];
      const harvest = chain.find((batch) => batch.type === 'HARVEST');

      if (!harvest) {
        throw new Error('Không truy được Harvest nguồn từ mã đã nhập/quét.');
      }
      if (harvest.status !== 'COMPLETED') {
        throw new Error('Harvest nguồn chưa COMPLETED, chưa thể tạo Processed batch.');
      }

      let resolvedHarvest = harvest;
      if (isMetadataEmpty(harvest)) {
        try {
          const chainBatch = await dashboardApi.getBatchByIdChain(harvest.batchId);
          resolvedHarvest = { ...harvest, metadata: chainBatch.metadata };
        } catch {
          resolvedHarvest = harvest;
        }
      }

      setSourceResolved(resolvedHarvest);
      setForm((prev) => ({ ...prev, parentBatchId: harvest.batchId }));
      setMessage('Đã xác định Harvest nguồn từ mã truy xuất.');
    } catch (e) {
      setSourceResolved(null);
      setForm((prev) => ({ ...prev, parentBatchId: '' }));
      setError(getApiErrorMessage(e));
    } finally {
      setResolvingSource(false);
    }
  }

  function handleQrDetected(code: string) {
    setSourceCodeInput(code);
    setShowScanner(false);
    void resolveHarvestSource(code);
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

  async function downloadQr() {
    if (!detailTrace?.batch.publicCode) return;
    setQrDownloading(true);
    setDetailError('');
    try {
      const url = await dashboardApi.getBatchQrUrl(detailTrace.batch.publicCode);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${detailTrace.batch.publicCode}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setDetailError(getApiErrorMessage(e));
    } finally {
      setQrDownloading(false);
    }
  }

  if (!ready) return <LoadingState text="Đang xác thực quyền truy cập..." />;

  return (
    <DashboardShell title="Processor Dashboard" subtitle="Tạo Processed batch từ Harvest đã hoàn thành">
      <div className="grid gap-6 xl:grid-cols-[380px,1fr]">
        <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-amber-900">Tạo Processed batch</h2>
          {error && <div className="mt-3"><ErrorState message={error} /></div>}
          <form onSubmit={handleCreate} className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Mã truy xuất nguồn (quét QR hoặc nhập tay)</span>
              <div className="flex gap-2">
                <input
                  value={sourceCodeInput}
                  onChange={(e) => setSourceCodeInput(e.target.value)}
                  placeholder="VD: HAR-20260414-173331-WP6VWS hoặc URL /trace/..."
                  className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
                />
                <button
                  type="button"
                  onClick={() => void resolveHarvestSource()}
                  disabled={resolvingSource}
                  className="rounded-lg border border-amber-200 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                >
                  {resolvingSource ? 'Đang tra...' : 'Tra mã'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowScanner((prev) => !prev)}
                  className="rounded-lg border border-amber-200 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50"
                >
                  {showScanner ? 'Ẩn quét QR' : 'Quét QR'}
                </button>
              </div>
            </label>

            {showScanner && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <QrScanner onCodeDetected={handleQrDetected} autoNavigate={false} />
              </div>
            )}

            {sourceResolved && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <p><span className="font-semibold">Harvest nguồn:</span> {sourceResolved.publicCode}</p>
                <p><span className="font-semibold">Nơi trồng:</span> {pickMetadataValue(sourceResolved, ['farmLocation', 'farm_location', 'location', 'origin'])}</p>
                <p><span className="font-semibold">Giống:</span> {pickMetadataValue(sourceResolved, ['coffeeVariety', 'coffee_variety', 'variety'])}</p>
                <p><span className="font-semibold">ID liên kết:</span> {sourceResolved.batchId}</p>
              </div>
            )}

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Harvest nguồn đã xác định</span>
              <input
                value={form.parentBatchId}
                readOnly
                className="w-full rounded-lg border border-amber-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-700"
              />
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
              <span className="mb-1 block font-medium text-slate-700">Ngày bắt đầu (tự động)</span>
              <input
                type="text"
                value={form.startDate}
                readOnly
                className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
              />
            </label>
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Ngày kết thúc sẽ tự động cập nhật khi bạn chuyển trạng thái lô sang COMPLETED.
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Tên cơ sở sơ chế</span>
              <select
                value={form.facilityName}
                onChange={(e) => setForm((p) => ({ ...p, facilityName: e.target.value }))}
                required
                className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
              >
                {facilityOptions.length === 0 && <option value="">Không có cơ sở hợp lệ</option>}
                {facilityOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
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
              disabled={submitting || !form.parentBatchId || !form.facilityName}
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
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <span>Dòng/trang</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs text-amber-800"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </label>
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
          </div>
          {message && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
          {loading && <LoadingState />}
          {!loading && processed.length === 0 && <EmptyState text="Chưa có Processed batch nào." />}

          {!loading && processed.length > 0 && (
            <>
              <div className="space-y-3 md:hidden">
                {pagedProcessed.map((item) => (
                  <article key={item.batchId} className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                    <p className="font-mono text-xs text-slate-700">{item.publicCode}</p>
                    <p className="mt-1 text-xs text-slate-700"><span className="font-medium">Cơ sở:</span> {item.metadata?.facilityName ?? 'Chưa có dữ liệu'}</p>
                    <p className="mt-1 text-xs text-slate-600"><span className="font-medium">Phương pháp:</span> {item.metadata?.processingMethod ?? 'Chưa có dữ liệu'}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Trạng thái</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-2 text-xs text-slate-600">Cập nhật: {new Date(item.updatedAt).toLocaleString('vi-VN')}</p>
                    <Link
                      href={`/dashboard/processor/update?batchId=${encodeURIComponent(item.batchId)}`}
                      className="mt-3 inline-flex items-center justify-center whitespace-nowrap rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                    >
                      Xem chi tiết
                    </Link>
                  </article>
                ))}
              </div>

              <div className="hidden w-full max-w-full overflow-x-auto md:block">
                <table className="min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-amber-100 text-left text-slate-500">
                      <th className="px-2 py-2 font-medium">Cơ sở sơ chế</th>
                      <th className="px-2 py-2 font-medium">Phương pháp</th>
                      <th className="px-2 py-2 font-medium">Mã công khai</th>
                      <th className="px-2 py-2 font-medium">Trạng thái</th>
                      <th className="px-2 py-2 font-medium">Cập nhật</th>
                      <th className="px-2 py-2 font-medium">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedProcessed.map((item) => (
                      <tr key={item.batchId} className="border-b border-amber-50">
                        <td className="px-2 py-2 text-xs text-slate-700">{item.metadata?.facilityName ?? '—'}</td>
                        <td className="px-2 py-2 text-xs text-slate-700">{item.metadata?.processingMethod ?? '—'}</td>
                        <td className="px-2 py-2 font-mono text-xs text-slate-700">{item.publicCode}</td>
                        <td className="px-2 py-2"><StatusBadge status={item.status} /></td>
                        <td className="px-2 py-2 text-slate-600">{new Date(item.updatedAt).toLocaleString('vi-VN')}</td>
                        <td className="px-2 py-2">
                          <Link
                            href={`/dashboard/processor/update?batchId=${encodeURIComponent(item.batchId)}`}
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
              <>
                <TraceTimeline
                  batches={[...detailTrace.parentChain, detailTrace.batch]}
                  farmActivities={detailTrace.farmActivities}
                  ledgerRefs={detailTrace.ledgerRefs}
                />
                {detailTrace.batch.status === 'COMPLETED' && (
                  <button
                    type="button"
                    onClick={() => void downloadQr()}
                    disabled={qrDownloading}
                    className="mt-4 inline-flex rounded-lg border border-amber-200 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                  >
                    {qrDownloading ? 'Đang tạo QR...' : 'Tải QR truy xuất'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
