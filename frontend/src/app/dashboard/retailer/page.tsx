'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { EmptyState, ErrorState, LoadingState } from '@/components/dashboard/UiState';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { dashboardApi, getApiErrorMessage } from '@/lib/api/dashboardApi';
import { TraceTimeline } from '@/components/TraceTimeline';
import type { BatchResponse, TraceResponse } from '@/lib/api/types';
import { useRoleGuard } from '@/lib/auth/useRoleGuard';

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

  async function updateToInStock(batchId: string) {
    setError('');
    setMessage('');
    try {
      await dashboardApi.updateRetailStatus(batchId, 'IN_STOCK');
      setMessage('Đã cập nhật trạng thái -> IN_STOCK.');
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
      setMessage('Đã cập nhật trạng thái -> SOLD.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
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
    <DashboardShell title="Retailer Dashboard" subtitle="Quản lý tồn kho và trạng thái bán lẻ">
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
              {packaged.map((item) => (
                <article key={item.batchId} className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                  <p className="font-mono text-xs text-slate-700">{item.publicCode}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Trạng thái</span>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="mt-2 text-xs text-slate-600">Chủ sở hữu: {item.ownerMsp}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void downloadQr(item.batchId)}
                      className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200"
                    >
                      Tải QR
                    </button>
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
                        className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                      >
                        SOLD
                      </button>
                    )}
                    {item.status !== 'TRANSFERRED' && item.status !== 'IN_STOCK' && (
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
              <table className="min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-amber-100 text-left text-slate-500">
                    <th className="px-2 py-2 font-medium">Mã công khai</th>
                    <th className="px-2 py-2 font-medium">Trạng thái</th>
                    <th className="px-2 py-2 font-medium">Chủ sở hữu</th>
                    <th className="px-2 py-2 font-medium">QR</th>
                    <th className="px-2 py-2 font-medium">Thao tác</th>
                    <th className="px-2 py-2 font-medium">Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {packaged.map((item) => (
                    <tr key={item.batchId} className="border-b border-amber-50">
                      <td className="px-2 py-2 font-mono text-xs text-slate-700">{item.publicCode}</td>
                      <td className="px-2 py-2"><StatusBadge status={item.status} /></td>
                      <td className="px-2 py-2 text-slate-600">{item.ownerMsp}</td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => void downloadQr(item.batchId)}
                          className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200"
                        >
                          Tải QR
                        </button>
                      </td>
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
                              className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                            >
                              SOLD
                            </button>
                          )}
                          {item.status !== 'TRANSFERRED' && item.status !== 'IN_STOCK' && (
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
