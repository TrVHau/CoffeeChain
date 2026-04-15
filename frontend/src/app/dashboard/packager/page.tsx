'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { EmptyState, ErrorState, LoadingState } from '@/components/dashboard/UiState';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { QrScanner } from '@/components/QrScanner';
import { dashboardApi, getApiErrorMessage, type CreatePackagedInput } from '@/lib/api/dashboardApi';
import { TraceTimeline } from '@/components/TraceTimeline';
import type { BatchResponse, TraceResponse } from '@/lib/api/types';
import { useRoleGuard } from '@/lib/auth/useRoleGuard';

const INITIAL_FORM: CreatePackagedInput = {
  parentBatchId: '',
  packageWeight: '',
  packageDate: '',
  expiryDate: '',
  packageCount: '',
};

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildInitialForm(): CreatePackagedInput {
  return {
    ...INITIAL_FORM,
    packageDate: getTodayDate(),
  };
}

function isMetadataEmpty(batch: BatchResponse): boolean {
  return !batch.metadata || Object.keys(batch.metadata).length === 0;
}

function toEvidenceUrl(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return `http://localhost:8081/ipfs/${uri.slice(7)}`;
  }
  if (uri.startsWith('http://ipfs:8081/')) {
    return uri.replace('http://ipfs:8081/', 'http://localhost:8081/');
  }
  if (uri.startsWith('https://ipfs:8081/')) {
    return uri.replace('https://ipfs:8081/', 'http://localhost:8081/');
  }
  return uri;
}

function extractTraceCode(value: string): string {
  const trimmed = value.trim();
  const matched = trimmed.match(/\/trace\/([^/?#\s]+)/i);
  return matched ? matched[1] : trimmed;
}

const PAGE_SIZE = 10;

export default function PackagerDashboardPage() {
  const { ready } = useRoleGuard('PACKAGER');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  const [roastPendingTransfer, setRoastPendingTransfer] = useState<BatchResponse[]>([]);
  const [roastTransferred, setRoastTransferred] = useState<BatchResponse[]>([]);
  const [packaged, setPackaged] = useState<BatchResponse[]>([]);
  const [form, setForm] = useState<CreatePackagedInput>(buildInitialForm());
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [detailTrace, setDetailTrace] = useState<TraceResponse | null>(null);
  const [sourceCodeInput, setSourceCodeInput] = useState('');
  const [sourceResolving, setSourceResolving] = useState(false);
  const [resolvedSource, setResolvedSource] = useState<BatchResponse | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(packaged.length / PAGE_SIZE));
  const pagedPackaged = packaged.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [pendingTransfer, transferred, packagedList] = await Promise.all([
        dashboardApi.getList({ type: 'ROAST', status: 'TRANSFER_PENDING' }),
        dashboardApi.getList({ type: 'ROAST', status: 'TRANSFERRED' }),
        dashboardApi.getList({ type: 'PACKAGED' }),
      ]);

      const [pendingEnriched, transferredEnriched, packagedEnriched] = await Promise.all([
        Promise.all(pendingTransfer.map(async (item) => {
          if (!isMetadataEmpty(item)) return item;
          try {
            const chainBatch = await dashboardApi.getBatchByIdChain(item.batchId);
            return { ...item, metadata: chainBatch.metadata };
          } catch {
            return item;
          }
        })),
        Promise.all(transferred.map(async (item) => {
          if (!isMetadataEmpty(item)) return item;
          try {
            const chainBatch = await dashboardApi.getBatchByIdChain(item.batchId);
            return { ...item, metadata: chainBatch.metadata };
          } catch {
            return item;
          }
        })),
        Promise.all(packagedList.map(async (item) => {
          if (!isMetadataEmpty(item)) return item;
          try {
            const chainBatch = await dashboardApi.getBatchByIdChain(item.batchId);
            return { ...item, metadata: chainBatch.metadata };
          } catch {
            return item;
          }
        })),
      ]);

      setRoastPendingTransfer(pendingEnriched);
      setRoastTransferred(transferredEnriched);
      setPackaged(packagedEnriched);
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

  async function createPackaged(e: React.FormEvent) {
    e.preventDefault();
    if (!form.parentBatchId) {
      setError('Vui lòng nhập mã hoặc quét QR để xác định Roast nguồn trước khi tạo batch.');
      return;
    }
    if (!evidenceFile) {
      setError('Vui lòng chọn ảnh minh chứng trước khi tạo Packaged batch.');
      return;
    }
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const created = await dashboardApi.createPackaged({
        ...form,
        packageDate: getTodayDate(),
      });
      const evidence = await dashboardApi.uploadEvidence(evidenceFile);
      await dashboardApi.addPackagedEvidence(created.batchId, evidence);
      setForm((p) => ({ ...buildInitialForm(), parentBatchId: p.parentBatchId }));
      setEvidenceFile(null);
      setMessage('Đã tạo Packaged batch và cập nhật minh chứng thành công.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function acceptTransfer(batchId: string) {
    setError('');
    setMessage('');
    try {
      await dashboardApi.acceptTransfer(batchId);
      setMessage('Đã chấp nhận chuyển giao lô rang xay.');
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

  async function resolveRoastSource(rawCode: string) {
    const code = extractTraceCode(rawCode);
    if (!code) {
      setError('Vui lòng nhập mã nguồn hợp lệ.');
      return;
    }

    setSourceResolving(true);
    setError('');
    setMessage('');

    try {
      const trace = await dashboardApi.getTrace(code);
      const chain = [...trace.parentChain, trace.batch];
      const candidates = chain
        .filter((item) => item.type === 'ROAST' && item.status === 'TRANSFERRED')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      const candidate = candidates[0];
      if (!candidate) {
        throw new Error('Không tìm thấy ROAST ở trạng thái TRANSFERRED từ mã đã nhập/quét.');
      }

      setForm((p) => ({ ...p, parentBatchId: candidate.batchId }));
      setResolvedSource(candidate);
      setSourceCodeInput(code);
      setMessage(`Đã xác định Roast nguồn: ${candidate.publicCode}`);
    } catch (e) {
      setForm((p) => ({ ...p, parentBatchId: '' }));
      setResolvedSource(null);
      setError(getApiErrorMessage(e));
    } finally {
      setSourceResolving(false);
    }
  }

  if (!ready) return <LoadingState text="Đang xác thực quyền truy cập..." />;

  return (
    <DashboardShell title="Packager Dashboard" subtitle="Tạo package và quản lý lô đóng gói">
      <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-stone-900">Roast chờ chấp nhận chuyển giao</h2>
            {roastPendingTransfer.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Hiện không có lô nào ở trạng thái TRANSFER_PENDING.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {roastPendingTransfer.map((item) => (
                  <div key={item.batchId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/40 px-3 py-2">
                    <div>
                      <p className="font-mono text-xs text-slate-700">{item.publicCode}</p>
                      <p className="text-xs text-slate-500">{item.batchId}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void acceptTransfer(item.batchId)}
                      className="rounded-md bg-amber-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-900"
                    >
                      Chấp nhận chuyển giao
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-stone-900">Tạo Packaged batch</h2>
            <form onSubmit={createPackaged} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Roast nguồn (nhập mã hoặc quét QR)</span>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={sourceCodeInput}
                    onChange={(e) => setSourceCodeInput(e.target.value)}
                    className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
                    placeholder="Nhập mã public code hoặc link /trace/..."
                  />
                  <button
                    type="button"
                    onClick={() => void resolveRoastSource(sourceCodeInput)}
                    disabled={!sourceCodeInput.trim() || sourceResolving}
                    className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                  >
                    {sourceResolving ? 'Đang tìm...' : 'Xác định nguồn'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowScanner((v) => !v)}
                    className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50"
                  >
                    {showScanner ? 'Ẩn QR' : 'Quét QR'}
                  </button>
                </div>
                {showScanner && (
                  <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/40 p-3">
                    <QrScanner
                      autoNavigate={false}
                      onCodeDetected={(code) => {
                        setSourceCodeInput(code);
                        setShowScanner(false);
                        void resolveRoastSource(code);
                      }}
                    />
                  </div>
                )}
                {resolvedSource && (
                  <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    Nguồn đã chọn: {resolvedSource.publicCode} | {resolvedSource.metadata?.roastProfile ?? 'Chưa có profile'}
                  </p>
                )}
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Khối lượng gói</span>
                <input
                  value={form.packageWeight}
                  onChange={(e) => setForm((p) => ({ ...p, packageWeight: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
                  placeholder="250"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Ngày đóng gói (tự động)</span>
                <input
                  type="text"
                  value={form.packageDate}
                  readOnly
                  className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Ngày hết hạn</span>
                <input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Số lượng gói</span>
                <input
                  value={form.packageCount}
                  onChange={(e) => setForm((p) => ({ ...p, packageCount: e.target.value }))}
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
                disabled={submitting || !form.parentBatchId}
                className="w-full rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-50"
              >
                {submitting ? 'Đang tạo...' : 'Tạo Packaged batch'}
              </button>
            </form>
          </section>
        </div>

        <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-stone-900">Danh sách Packaged</h2>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-lg border border-amber-200 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-50"
            >
              Làm mới
            </button>
          </div>
          {message && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
          {error && <ErrorState message={error} />}
          {loading && <LoadingState />}
          {!loading && !error && packaged.length === 0 && <EmptyState text="Chưa có Packaged batch nào." />}

          {!loading && !error && packaged.length > 0 && (
            <>
              <div className="space-y-3 md:hidden">
                {pagedPackaged.map((item) => (
                  <article key={item.batchId} className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                    <p className="font-mono text-xs text-slate-700">{item.publicCode}</p>
                    <p className="mt-1 text-xs text-slate-700"><span className="font-medium">Khối lượng:</span> {item.metadata?.packageWeight ?? '—'}</p>
                    <p className="mt-1 text-xs text-slate-600"><span className="font-medium">Số lượng gói:</span> {item.metadata?.packageCount ?? '—'}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Trạng thái</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-2 text-xs text-slate-600">Cập nhật: {new Date(item.updatedAt).toLocaleString('vi-VN')}</p>
                    {item.evidenceUri && (
                      <a
                        href={toEvidenceUrl(item.evidenceUri)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs font-medium text-amber-700 underline-offset-2 hover:underline"
                      >
                        Xem minh chứng
                      </a>
                    )}
                    <Link
                      href={`/dashboard/packager/update?batchId=${encodeURIComponent(item.batchId)}`}
                      className="mt-3 inline-flex items-center justify-center whitespace-nowrap rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                    >
                      Xem chi tiết
                    </Link>
                  </article>
                ))}
              </div>

              <div className="hidden w-full max-w-full overflow-x-auto md:block">
                <table className="min-w-[700px] text-sm">
                  <thead>
                    <tr className="border-b border-amber-100 text-left text-slate-500">
                      <th className="px-2 py-2 font-medium">Khối lượng gói</th>
                      <th className="px-2 py-2 font-medium">Số lượng gói</th>
                      <th className="px-2 py-2 font-medium">Mã công khai</th>
                      <th className="px-2 py-2 font-medium">Trạng thái</th>
                      <th className="px-2 py-2 font-medium">Cập nhật</th>
                      <th className="px-2 py-2 font-medium">Minh chứng</th>
                      <th className="px-2 py-2 font-medium">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedPackaged.map((item) => (
                      <tr key={item.batchId} className="border-b border-amber-50">
                        <td className="px-2 py-2 text-xs text-slate-700">{item.metadata?.packageWeight ?? '—'}</td>
                        <td className="px-2 py-2 text-xs text-slate-700">{item.metadata?.packageCount ?? '—'}</td>
                        <td className="px-2 py-2 font-mono text-xs text-slate-700">{item.publicCode}</td>
                        <td className="px-2 py-2"><StatusBadge status={item.status} /></td>
                        <td className="px-2 py-2 text-slate-600">{new Date(item.updatedAt).toLocaleString('vi-VN')}</td>
                        <td className="px-2 py-2 text-xs text-slate-600">
                          {item.evidenceUri ? (
                            <a
                              href={toEvidenceUrl(item.evidenceUri)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-amber-700 underline-offset-2 hover:underline"
                            >
                              Xem minh chứng
                            </a>
                          ) : 'Chưa có'}
                        </td>
                        <td className="px-2 py-2">
                          <Link
                            href={`/dashboard/packager/update?batchId=${encodeURIComponent(item.batchId)}`}
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

      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-amber-900">Chi tiết lô đóng gói</h3>
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
