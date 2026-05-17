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

const PAGE_SIZE_OPTIONS = [10, 20] as const;

export default function RetailerDashboardPage() {
  const { ready } = useRoleGuard('RETAILER');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [packaged, setPackaged] = useState<BatchResponse[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [detailTrace, setDetailTrace] = useState<TraceResponse | null>(null);
  const [qrDownloading, setQrDownloading] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const totalPages = Math.max(1, Math.ceil(packaged.length / pageSize));
  const pagedPackaged = packaged.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

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

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  async function updateToInStock(batchId: string) {
    setError('');
    setMessage('');
    try {
      await dashboardApi.updateRetailStatus(batchId, 'IN_STOCK');
      setMessage('Cập nhật trạng thái thành công: Đang trong kho.');
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
      setMessage('Cập nhật trạng thái thành công: Đã bán.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }

  async function downloadQr(publicCode: string) {
    setError('');
    setQrDownloading(true);
    try {
      const url = await dashboardApi.getBatchQrUrl(publicCode);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${publicCode}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setQrDownloading(false);
    }
  }

  async function openDetail(publicCode: string) {
    setSelectedCode(publicCode);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError('');
    setDetailTrace(null);
    setQrImageUrl(null);
    try {
      const trace = await dashboardApi.getTrace(publicCode);
      setDetailTrace(trace);
      try {
        const url = await dashboardApi.getBatchQrUrl(publicCode);
        setQrImageUrl(url);
      } catch {
        // QR load failed, silently ignore
      }
    } catch (e) {
      setDetailError(getApiErrorMessage(e));
    } finally {
      setDetailLoading(false);
    }
  }

  if (!ready) return <LoadingState text="Đang xác thực quyền truy cập..." />;

  return (
    <DashboardShell title="Retailer Dashboard" subtitle="Quản lý tồn kho và trạng thái bán lẻ">
      <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
      <h2 className="text-base font-semibold text-stone-900">Danh sách lô đóng gói</h2>
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
              className="rounded-lg border border-amber-200 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-50"
            >
              Làm mới
            </button>
          </div>
        </div>
        {message && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
        {error && <ErrorState message={error} />}
        {loading && <LoadingState />}
        {!loading && packaged.length === 0 && <EmptyState text="Chưa có lô nào được phân phối." />}

        {!loading && packaged.length > 0 && (
          <>
            <div className="space-y-3 md:hidden">
              {pagedPackaged.map((item) => (
                <article key={item.batchId} className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                  <p className="font-mono text-xs text-slate-700">{item.publicCode}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Trạng thái</span>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="mt-2 text-xs text-slate-600">Chủ sở hữu: {item.ownerMsp}</p>
                    <Link
                      href={`/dashboard/retailer/update?batchId=${encodeURIComponent(item.batchId)}`}
                      className="mt-3 inline-flex items-center justify-center whitespace-nowrap rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                    >
                      Xem chi tiết
                    </Link>
                </article>
              ))}
            </div>

            <div className="hidden w-full max-w-full overflow-x-auto md:block">
              <table className="w-full min-w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-100 text-left text-slate-500">
                    <th className="px-2 py-2 font-medium">Mã công khai</th>
                    <th className="px-2 py-2 font-medium">Trạng thái</th>
                    <th className="px-2 py-2 font-medium">Chủ sở hữu</th>
                    <th className="px-2 py-2 font-medium">Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedPackaged.map((item) => (
                    <tr key={item.batchId} className="border-b border-amber-50">
                      <td className="px-2 py-2 font-mono text-xs text-slate-700">{item.publicCode}</td>
                      <td className="px-2 py-2"><StatusBadge status={item.status} /></td>
                      <td className="px-2 py-2 text-slate-600">{item.ownerMsp}</td>
                      <td className="px-2 py-2">
                        <Link
                          href={`/dashboard/retailer/update?batchId=${encodeURIComponent(item.batchId)}`}
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

      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-amber-900">Chi tiết lô bán lẻ</h3>
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

            {detailLoading && <LoadingState text="Đang tải..." />}
            {!detailLoading && detailError && <ErrorState message={detailError} />}
            {!detailLoading && !detailError && detailTrace && (
              <>
                <TraceTimeline
                  batches={[...detailTrace.parentChain, detailTrace.batch]}
                  farmActivities={detailTrace.farmActivities}
                  batchEvidenceEvents={detailTrace.batchEvidenceEvents}
                  ledgerRefs={detailTrace.ledgerRefs}
                />
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">QR truy xuất</p>
                <div className="mt-3 flex flex-col items-center gap-3">
                  {qrImageUrl && (
                    <img
                      src={qrImageUrl}
                      alt={`QR truy xuất ${detailTrace.batch.publicCode}`}
                      className="h-48 w-48 rounded-xl border border-amber-200 bg-white p-2"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => void downloadQr(detailTrace.batch.publicCode)}
                    disabled={qrDownloading}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-amber-200 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                  >
                    {qrDownloading ? 'Đang tạo QR...' : 'Tải QR truy xuất'}
                  </button>
                </div>
              </div>
              </>
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
