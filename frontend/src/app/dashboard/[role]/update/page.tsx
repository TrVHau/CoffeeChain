'use client';

import Link from 'next/link';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { EmptyState, ErrorState, LoadingState } from '@/components/dashboard/UiState';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { TraceTimeline } from '@/components/TraceTimeline';
import { dashboardApi, getApiErrorMessage } from '@/lib/api/dashboardApi';
import type { BatchResponse, BatchStatus, BatchType, TraceResponse } from '@/lib/api/types';
import type { UserRole } from '@/lib/auth/AuthContext';
import { useRoleGuard } from '@/lib/auth/useRoleGuard';

const STATUS_LABELS: Record<BatchStatus, string> = {
  CREATED: 'Đã tạo',
  IN_PROCESS: 'Đang xử lý',
  COMPLETED: 'Hoàn thành',
  TRANSFER_PENDING: 'Chờ chuyển giao',
  TRANSFERRED: 'Đã chuyển giao',
  IN_STOCK: 'Còn hàng',
  SOLD: 'Đã bán',
};

function formatType(type: BatchType): string {
  return {
    HARVEST: 'Harvest',
    PROCESSED: 'Processed',
    ROAST: 'Roast',
    PACKAGED: 'Packaged',
  }[type];
}

function canFinalize(batch: BatchResponse | null): boolean {
  if (!batch) return false;
  return batch.type === 'HARVEST' || batch.type === 'PROCESSED' || batch.type === 'ROAST';
}

function expectedTypeByRole(role: UserRole): BatchType | undefined {
  if (role === 'FARMER') return 'HARVEST';
  if (role === 'PROCESSOR') return 'PROCESSED';
  if (role === 'ROASTER') return 'ROAST';
  if (role === 'PACKAGER' || role === 'RETAILER') return 'PACKAGED';
  return undefined;
}

function getInlineStatusOptions(batch: BatchResponse | null): BatchStatus[] {
  if (!batch) return [];
  if (batch.type === 'PACKAGED') return ['IN_STOCK', 'SOLD'];
  return ['IN_PROCESS', 'COMPLETED'];
}

export default function BatchUpdatePage() {
  const params = useParams<{ role: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pathSegments = pathname.split('/').filter(Boolean);
  const roleFromPath = pathSegments[1]?.toUpperCase();
  const role = ((params.role ?? roleFromPath ?? 'PROCESSOR').toUpperCase() as UserRole);
  const { ready } = useRoleGuard(role);
  const batchId = searchParams.get('batchId') ?? '';

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [batch, setBatch] = useState<BatchResponse | null>(null);
  const [detailTrace, setDetailTrace] = useState<TraceResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [nextStatus, setNextStatus] = useState<BatchStatus>('IN_PROCESS');
  const [inlineWeightKg, setInlineWeightKg] = useState('');
  const [inlineRoastDurationMinutes, setInlineRoastDurationMinutes] = useState('');

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function refresh() {
    if (!batchId) {
      setError('Thiếu batchId trên URL.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      let current: BatchResponse;
      try {
        // Prefer read-model first to avoid 404 for entries not immediately queryable from chain.
        current = await dashboardApi.getBatchById(batchId);
      } catch {
        // Fallback to chain for latest authoritative state when available.
        try {
          current = await dashboardApi.getBatchByIdChain(batchId);
        } catch {
          // Recovery path: if query param id is truncated, try matching by prefix in list.
          const expectedType = expectedTypeByRole(role);
          const list = await dashboardApi.getList(expectedType ? { type: expectedType } : {});
          const candidates = list.filter((item) => item.batchId.startsWith(batchId));
          if (candidates.length !== 1) {
            throw new Error('Không tìm thấy batch hợp lệ từ batchId trên URL.');
          }
          current = candidates[0];
        }
      }
      setBatch(current);
      setDetailLoading(true);
      setDetailError('');
      try {
        const trace = await dashboardApi.getTrace(current.publicCode);
        setDetailTrace(trace);
      } catch (traceError) {
        setDetailError(getApiErrorMessage(traceError));
      } finally {
        setDetailLoading(false);
      }
    } catch (e) {
      setError(getApiErrorMessage(e));
      setBatch(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!ready) return;
    void refresh();
  }, [ready, batchId]);

  useEffect(() => {
    if (!batch) return;
    if (batch.type === 'PACKAGED') {
      setNextStatus(batch.status === 'TRANSFERRED' ? 'IN_STOCK' : 'SOLD');
      setInlineWeightKg('');
      return;
    }
    setNextStatus(batch.status === 'CREATED' ? 'IN_PROCESS' : 'COMPLETED');
    if (batch.type === 'ROAST') {
      const existingDuration = batch.metadata?.roastDurationMinutes;
      setInlineRoastDurationMinutes(existingDuration && existingDuration !== '0' ? existingDuration : '');
    } else {
      setInlineRoastDurationMinutes('');
    }
    if (batch.status === 'COMPLETED') {
      setInlineWeightKg('');
      setInlineRoastDurationMinutes('');
    }
  }, [batch]);

  async function updateWithWeight(nextStatus: BatchStatus) {
    if (!batch) return;
    if (!inlineWeightKg || !inlineWeightKg.trim()) {
      setError('Bạn cần nhập khối lượng thực tế để hoàn thành batch.');
      return;
    }
    if (batch.type === 'ROAST' && (!inlineRoastDurationMinutes || !inlineRoastDurationMinutes.trim())) {
      setError('Bạn cần nhập thời gian rang khi hoàn thành batch.');
      return;
    }

    setUpdating(true);
    setError('');
    setMessage('');
    try {
      if (batch.type === 'HARVEST') {
        await dashboardApi.updateHarvestStatusWithWeight(batch.batchId, nextStatus, inlineWeightKg.trim());
      } else if (batch.type === 'PROCESSED') {
        await dashboardApi.updateProcessedStatusWithWeight(batch.batchId, nextStatus, inlineWeightKg.trim());
      } else if (batch.type === 'ROAST') {
        await dashboardApi.updateRoastStatusWithWeight(
          batch.batchId,
          nextStatus,
          inlineWeightKg.trim(),
          inlineRoastDurationMinutes.trim(),
        );
      }
      setMessage('Đã cập nhật trạng thái và khối lượng thực tế.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setUpdating(false);
    }
  }

  async function updateStatus(nextStatus: BatchStatus) {
    if (!batch) return;
    if (nextStatus === 'COMPLETED' && canFinalize(batch)) {
      await updateWithWeight(nextStatus);
      return;
    }

    setUpdating(true);
    setError('');
    setMessage('');
    try {
      if (batch.type === 'HARVEST') {
        await dashboardApi.updateHarvestStatus(batch.batchId, nextStatus);
      } else if (batch.type === 'PROCESSED') {
        await dashboardApi.updateProcessedStatus(batch.batchId, nextStatus);
      } else if (batch.type === 'ROAST') {
        await dashboardApi.updateRoastStatus(batch.batchId, nextStatus);
      } else if (batch.type === 'PACKAGED') {
        await dashboardApi.updateRetailStatus(batch.batchId, nextStatus as 'IN_STOCK' | 'SOLD');
      }
      setMessage(`Đã cập nhật trạng thái -> ${nextStatus}.`);
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setUpdating(false);
    }
  }

  async function acceptTransfer() {
    if (!batch) return;
    setUpdating(true);
    setError('');
    setMessage('');
    try {
      await dashboardApi.acceptTransfer(batch.batchId);
      setMessage('Đã chấp nhận chuyển giao.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setUpdating(false);
    }
  }

  async function requestTransfer() {
    if (!batch) return;
    setUpdating(true);
    setError('');
    setMessage('');
    try {
      await dashboardApi.requestTransfer(batch.batchId);
      setMessage('Đã gửi yêu cầu chuyển giao sang Org2MSP.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setUpdating(false);
    }
  }

  async function downloadQr() {
    if (!batch) return;
    try {
      const url = await dashboardApi.getPackagedQrUrl(batch.batchId);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${batch.batchId}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }

  if (!ready) return <LoadingState text="Đang xác thực quyền truy cập..." />;

  return (
    <DashboardShell title="Trang cập nhật lô" subtitle={`Vai trò ${role}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={`/dashboard/${role.toLowerCase()}`}
          className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-800 hover:bg-amber-50"
        >
          Quay lại bảng
        </Link>
        {batch && (
          <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-700">
            <span className="font-medium">Trạng thái hiện tại:</span> {STATUS_LABELS[batch.status] ?? batch.status}
          </div>
        )}
      </div>

      {loading && <LoadingState text="Đang tải chi tiết lô..." />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && !batch && <EmptyState text="Không tìm thấy batch cần cập nhật." />}

      {!loading && !error && batch && (
        <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
          <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-amber-800">{formatType(batch.type)}</p>
                <h2 className="text-base font-semibold text-amber-900">{batch.publicCode}</h2>
              </div>
              <StatusBadge status={batch.status} />
            </div>

            <div className="space-y-2 text-sm text-slate-700">
              <p><span className="font-medium">Owner:</span> {batch.ownerMsp}</p>
              <p><span className="font-medium">Người dùng:</span> {batch.ownerUserId}</p>
              <p><span className="font-medium">Cập nhật:</span> {new Date(batch.updatedAt).toLocaleString('vi-VN')}</p>
              <p><span className="font-medium">Trạng thái:</span> {STATUS_LABELS[batch.status] ?? batch.status}</p>
            </div>

            {((role === 'PROCESSOR' && batch.type === 'PROCESSED') || (role === 'ROASTER' && batch.type === 'ROAST')) && batch.status !== 'COMPLETED' ? (
              <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                <h3 className="text-sm font-semibold text-amber-900">
                  {batch.type === 'ROAST' ? 'Cập nhật trạng thái rang xay' : 'Cập nhật trạng thái sơ chế'}
                </h3>
                <div className="mt-3 space-y-3">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Trạng thái mới</span>
                    <select
                      value={nextStatus}
                      onChange={(e) => {
                        const value = e.target.value as BatchStatus;
                        setNextStatus(value);
                        if (value !== 'COMPLETED') {
                          setInlineWeightKg('');
                        }
                      }}
                      className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
                    >
                      {getInlineStatusOptions(batch).map((option) => (
                        <option key={option} value={option}>
                          {option === 'IN_PROCESS' ? 'Đánh dấu IN_PROGRESS' : 'Đánh dấu COMPLETED'}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Khối lượng thực tế (kg)</span>
                    <input
                      value={inlineWeightKg}
                      onChange={(e) => setInlineWeightKg(e.target.value)}
                      disabled={nextStatus !== 'COMPLETED'}
                      placeholder="Chỉ nhập khi chọn COMPLETED"
                      className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </label>

                  {batch.type === 'ROAST' && (
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-slate-700">Thời gian rang (phút)</span>
                      <input
                        value={inlineRoastDurationMinutes}
                        onChange={(e) => setInlineRoastDurationMinutes(e.target.value)}
                        disabled={nextStatus !== 'COMPLETED'}
                        placeholder="Chỉ nhập khi chọn COMPLETED"
                        className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring disabled:bg-slate-100 disabled:text-slate-500"
                      />
                    </label>
                  )}

                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => {
                      if (nextStatus === 'COMPLETED') {
                        void updateWithWeight(nextStatus);
                      } else {
                        void updateStatus(nextStatus);
                      }
                    }}
                    className="w-full rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
                  >
                    {updating
                      ? 'Đang cập nhật...'
                      : nextStatus === 'COMPLETED'
                        ? 'Hoàn thành batch'
                        : batch.type === 'ROAST'
                          ? 'Đánh dấu IN_PROGRESS (Rang)'
                          : 'Đánh dấu IN_PROGRESS'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {(batch.type === 'HARVEST' || batch.type === 'PROCESSED' || batch.type === 'ROAST') && batch.status !== 'COMPLETED' && (
                  <>
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => void updateStatus('IN_PROCESS')}
                      className="rounded-md bg-amber-100 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                    >
                      Đánh dấu IN_PROGRESS
                    </button>
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => void updateStatus('COMPLETED')}
                      className="rounded-md bg-emerald-100 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                    >
                      Đánh dấu COMPLETED
                    </button>
                  </>
                )}

                {batch.type === 'ROAST' && batch.status === 'COMPLETED' && (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => void requestTransfer()}
                    className="rounded-md bg-amber-100 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                  >
                    Yêu cầu chuyển giao
                  </button>
                )}

                {batch.type === 'PACKAGED' && batch.status === 'TRANSFER_PENDING' && (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => void acceptTransfer()}
                    className="rounded-md bg-amber-100 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                  >
                    Chấp nhận chuyển giao
                  </button>
                )}

                {batch.type === 'PACKAGED' && batch.status === 'TRANSFERRED' && (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => void updateStatus('IN_STOCK')}
                    className="rounded-md bg-cyan-100 px-3 py-2 text-xs font-medium text-cyan-700 hover:bg-cyan-200 disabled:opacity-50"
                  >
                    Chuyển sang IN_STOCK
                  </button>
                )}

                {batch.type === 'PACKAGED' && batch.status === 'IN_STOCK' && (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => void updateStatus('SOLD')}
                    className="rounded-md bg-amber-100 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                  >
                    Đánh dấu SOLD
                  </button>
                )}

                {batch.type === 'PACKAGED' && (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => void downloadQr()}
                    className="rounded-md border border-amber-200 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                  >
                    Tải QR
                  </button>
                )}
              </div>
            )}

            {batch.status === 'COMPLETED' && canFinalize(batch) && (
              <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Lô đã hoàn thành. Không còn thao tác cập nhật.
              </div>
            )}

            {batch.type === 'PACKAGED' && batch.status !== 'TRANSFERRED' && batch.status !== 'IN_STOCK' && batch.status !== 'TRANSFER_PENDING' && (
              <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Lô đang ở trạng thái chỉ xem.
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-amber-900">Dòng truy xuất</h3>
              <span className="text-xs text-slate-500">Batch ID: {batch.batchId}</span>
            </div>

            {message && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
            {detailLoading && <LoadingState text="Đang tải trace..." />}
            {!detailLoading && detailError && <ErrorState message={detailError} />}
            {!detailLoading && !detailError && detailTrace && (
              <TraceTimeline
                batches={[...detailTrace.parentChain, detailTrace.batch]}
                farmActivities={detailTrace.farmActivities}
                ledgerRefs={detailTrace.ledgerRefs}
              />
            )}
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
