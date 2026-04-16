'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { EmptyState, ErrorState, LoadingState } from '@/components/dashboard/UiState';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { dashboardApi, getApiErrorMessage } from '@/lib/api/dashboardApi';
import { TraceTimeline } from '@/components/TraceTimeline';
import type { BatchResponse, TraceResponse } from '@/lib/api/types';
import { useRoleGuard } from '@/lib/auth/useRoleGuard';

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

const PAGE_SIZE_OPTIONS = [10, 20] as const;

function sortByUpdatedAtDesc(items: BatchResponse[]): BatchResponse[] {
  return [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function mergeByBatchId(items: BatchResponse[]): BatchResponse[] {
  return items.filter((item, index, array) => array.findIndex((x) => x.batchId === item.batchId) === index);
}

export default function PackagerDashboardPage() {
  const { ready } = useRoleGuard('PACKAGER');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [roastPendingTransfer, setRoastPendingTransfer] = useState<BatchResponse[]>([]);
  const [roastTransferred, setRoastTransferred] = useState<BatchResponse[]>([]);
  const [acceptedRoasts, setAcceptedRoasts] = useState<BatchResponse[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [detailTrace, setDetailTrace] = useState<TraceResponse | null>(null);
  const [acceptingBatchId, setAcceptingBatchId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const totalPages = Math.max(1, Math.ceil(acceptedRoasts.length / pageSize));
  const pagedAcceptedRoasts = acceptedRoasts.slice((page - 1) * pageSize, page * pageSize);
  const pendingTotalPages = Math.max(1, Math.ceil(roastPendingTransfer.length / pageSize));
  const pagedPendingRoasts = roastPendingTransfer.slice((pendingPage - 1) * pageSize, pendingPage * pageSize);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [pendingTransfer, transferred] = await Promise.all([
        dashboardApi.getList({ type: 'ROAST', status: 'TRANSFER_PENDING' }),
        dashboardApi.getList({ type: 'ROAST', status: 'TRANSFERRED' }),
      ]);

      const [pendingEnriched, transferredEnriched] = await Promise.all([
        Promise.all(pendingTransfer.map(async (item) => {
          try {
            const chainBatch = await dashboardApi.getBatchByIdChain(item.batchId);
            return {
              ...item,
              status: chainBatch.status,
              ownerMsp: chainBatch.ownerMsp,
              pendingToMsp: chainBatch.pendingToMsp,
              metadata: !isMetadataEmpty(item) ? item.metadata : chainBatch.metadata,
            };
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
      ]);

      const normalizedPending = pendingEnriched.filter((item) => item.status === 'TRANSFER_PENDING');
      const movedToTransferred = pendingEnriched.filter((item) => item.status === 'TRANSFERRED');
      const normalizedTransferred = sortByUpdatedAtDesc(mergeByBatchId([...movedToTransferred, ...transferredEnriched]));

      setRoastPendingTransfer(normalizedPending);
      setRoastTransferred(normalizedTransferred);
      setAcceptedRoasts(normalizedTransferred);
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

  useEffect(() => {
    setPendingPage((current) => Math.min(current, pendingTotalPages));
  }, [pendingTotalPages]);

  async function acceptTransfer(batchId: string) {
    setError('');
    setMessage('');
    setAcceptingBatchId(batchId);
    try {
      await dashboardApi.acceptTransfer(batchId);

      const now = new Date().toISOString();
      const moved = roastPendingTransfer.find((item) => item.batchId === batchId);
      if (moved) {
        const acceptedItem: BatchResponse = {
          ...moved,
          status: 'TRANSFERRED',
          ownerMsp: 'Org2MSP',
          pendingToMsp: null,
          updatedAt: now,
        };
        setRoastPendingTransfer((current) => current.filter((item) => item.batchId !== batchId));
        setRoastTransferred((current) => sortByUpdatedAtDesc(mergeByBatchId([acceptedItem, ...current])));
        setAcceptedRoasts((current) => sortByUpdatedAtDesc(mergeByBatchId([acceptedItem, ...current])));
        setPage(1);
      }

      setMessage('Đã chấp nhận chuyển giao lô rang xay.');
      void refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setAcceptingBatchId((current) => (current === batchId ? null : current));
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
    <DashboardShell title="Packager Dashboard" subtitle="Tạo package và quản lý lô đóng gói">
      <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
        <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-stone-900">Roast chờ chấp nhận chuyển giao</h2>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <span>Dòng/trang</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPendingPage(1);
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
                className="rounded-lg border border-amber-200 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-50"
              >
                Làm mới
              </button>
            </div>
          </div>
          {message && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
          {error && <ErrorState message={error} />}
          {loading && <LoadingState />}
          {!loading && roastPendingTransfer.length === 0 && <EmptyState text="Hiện không có lô nào ở trạng thái TRANSFER_PENDING." />}

          {!loading && roastPendingTransfer.length > 0 && (
            <div className="space-y-3">
              {pagedPendingRoasts.map((item) => (
                <div key={item.batchId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/40 px-3 py-2">
                  <div>
                    <p className="font-mono text-xs text-slate-700">{item.publicCode}</p>
                    <p className="text-xs text-slate-500">{item.batchId}</p>
                    <p className="text-xs text-amber-700">Tổ chức nguồn: {item.ownerMsp ?? 'Org1MSP'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void acceptTransfer(item.batchId)}
                    disabled={acceptingBatchId === item.batchId}
                    className="rounded-md bg-amber-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {acceptingBatchId === item.batchId ? 'Đang xử lý...' : 'Chấp nhận chuyển giao'}
                  </button>
                </div>
              ))}
              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={pendingPage === 1}
                  onClick={() => setPendingPage((current) => Math.max(1, current - 1))}
                  className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                >
                  Trang trước
                </button>
                <span className="text-xs text-slate-600">Trang {pendingPage}/{pendingTotalPages}</span>
                <button
                  type="button"
                  disabled={pendingPage === pendingTotalPages}
                  onClick={() => setPendingPage((current) => Math.min(pendingTotalPages, current + 1))}
                  className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                >
                  Trang sau
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-stone-900">Roast đã nhận chuyển giao</h2>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-lg border border-amber-200 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-50"
            >
              Làm mới
            </button>
          </div>
          {message && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
          {loading && <LoadingState />}
          {!loading && acceptedRoasts.length === 0 && <EmptyState text="Chưa có lô Roast nào đã được chấp nhận chuyển giao." />}

          {!loading && acceptedRoasts.length > 0 && (
            <>
              <div className="space-y-3 md:hidden">
                {pagedAcceptedRoasts.map((item) => (
                  <article key={item.batchId} className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                    <p className="font-mono text-xs text-slate-700">{item.publicCode}</p>
                    <p className="mt-1 text-xs text-slate-700"><span className="font-medium">Hồ sơ rang:</span> {item.metadata?.roastProfile ?? '—'}</p>
                    <p className="mt-1 text-xs text-slate-600"><span className="font-medium">Khối lượng:</span> {item.metadata?.weightKg ?? '—'}</p>
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
                      <th className="px-2 py-2 font-medium">Khối lượng</th>
                      <th className="px-2 py-2 font-medium">Hồ sơ rang</th>
                      <th className="px-2 py-2 font-medium">Mã công khai</th>
                      <th className="px-2 py-2 font-medium">Trạng thái</th>
                      <th className="px-2 py-2 font-medium">Cập nhật</th>
                      <th className="px-2 py-2 font-medium">Minh chứng</th>
                      <th className="px-2 py-2 font-medium">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedAcceptedRoasts.map((item) => (
                      <tr key={item.batchId} className="border-b border-amber-50">
                        <td className="px-2 py-2 text-xs text-slate-700">{item.metadata?.weightKg ?? '—'}</td>
                        <td className="px-2 py-2 text-xs text-slate-700">{item.metadata?.roastProfile ?? '—'}</td>
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
