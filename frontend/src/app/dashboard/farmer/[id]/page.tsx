'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ErrorState, LoadingState } from '@/components/dashboard/UiState';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { dashboardApi, getApiErrorMessage, type RecordFarmActivityInput } from '@/lib/api/dashboardApi';
import type { BatchResponse, FarmActivityItem, TraceResponse } from '@/lib/api/types';
import { useRoleGuard } from '@/lib/auth/useRoleGuard';

const ACTIVITY_TYPES = [
  'IRRIGATION',
  'FERTILIZATION',
  'PEST_CONTROL',
  'PRUNING',
  'SHADE_MANAGEMENT',
  'SOIL_TEST',
  'COMPLETE',
  'OTHER',
] as const;

const INITIAL_ACTIVITY: RecordFarmActivityInput = {
  activityType: 'IRRIGATION',
  activityDate: '',
  note: '',
};

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildInitialActivity(): RecordFarmActivityInput {
  return {
    ...INITIAL_ACTIVITY,
    activityDate: getTodayDate(),
  };
}

function isSameActivity(a: FarmActivityItem, b: FarmActivityItem): boolean {
  return (
    a.activityType === b.activityType
    && a.activityDate === b.activityDate
    && (a.note ?? '') === (b.note ?? '')
    && (a.evidenceHash ?? '') === (b.evidenceHash ?? '')
    && (a.evidenceUri ?? '') === (b.evidenceUri ?? '')
  );
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

function canShowActivityForm(batch: BatchResponse | null): boolean {
  return !!batch && batch.status !== 'COMPLETED';
}

function shouldAutoProgress(batch: BatchResponse | null): boolean {
  return !!batch && batch.status !== 'IN_PROCESS';
}

function isCompleteActivity(activityType: string): boolean {
  return activityType === 'COMPLETE';
}

function toEpoch(value?: string): number {
  if (!value) return Number.NaN;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? Number.NaN : ms;
}

function compareActivities(a: FarmActivityItem, b: FarmActivityItem): number {
  // Prefer immutable ledger ordering when available (newest first).
  if (typeof a.blockNumber === 'number' && typeof b.blockNumber === 'number' && a.blockNumber !== b.blockNumber) {
    return b.blockNumber - a.blockNumber;
  }

  const aRecorded = toEpoch(a.recordedAt);
  const bRecorded = toEpoch(b.recordedAt);
  if (!Number.isNaN(aRecorded) && !Number.isNaN(bRecorded) && aRecorded !== bRecorded) {
    return bRecorded - aRecorded;
  }

  const aActivity = toEpoch(a.activityDate);
  const bActivity = toEpoch(b.activityDate);
  if (!Number.isNaN(aActivity) && !Number.isNaN(bActivity) && aActivity !== bActivity) {
    return bActivity - aActivity;
  }

  return (b.txId ?? '').localeCompare(a.txId ?? '');
}

export default function FarmerBatchDetailPage({ params }: { params: { id: string } }) {
  const { ready } = useRoleGuard('FARMER');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [batch, setBatch] = useState<BatchResponse | null>(null);
  const [activities, setActivities] = useState<FarmActivityItem[]>([]);
  const [form, setForm] = useState<RecordFarmActivityInput>(buildInitialActivity());
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [finalWeightKg, setFinalWeightKg] = useState('');
  const sortedActivities = useMemo(() => [...activities].sort(compareActivities), [activities]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const loadBatch = useCallback(async (): Promise<FarmActivityItem[]> => {
    setLoading(true);
    setError('');
    try {
      const detail = await dashboardApi.getBatchById(params.id);
      setBatch(detail);
      
        // If metadata is not in DB, fetch from chain to get full info
        let batchWithMetadata = detail;
        if (!detail.metadata || Object.keys(detail.metadata).length === 0) {
          try {
            const chainBatch = await dashboardApi.getBatchByIdChain(params.id);
            batchWithMetadata = { ...detail, metadata: chainBatch.metadata };
            setBatch(batchWithMetadata);
          } catch (e) {
            // Chain query failed, use DB data as-is
            console.debug('Could not fetch batch from chain:', e);
          }
        }
      
      let trace: TraceResponse | null = null;
      if (batchWithMetadata.publicCode) {
        trace = await dashboardApi.getTrace(batchWithMetadata.publicCode);
      }
      const nextActivities = trace?.farmActivities ?? [];
      setActivities(nextActivities);
      return nextActivities;
    } catch (e) {
      setError(getApiErrorMessage(e));
      return [];
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (!ready) return;
    void loadBatch();
  }, [ready, loadBatch]);

  async function handleSubmitActivity() {
    if (!batch || batch.status === 'COMPLETED') return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const completeMode = isCompleteActivity(form.activityType);
      if (completeMode) {
        if (!finalWeightKg.trim()) {
          setError('Bạn cần nhập khối lượng thực tế để hoàn thành batch.');
          return;
        }
      }

      let payload = { ...form };
      if (completeMode) {
        const baseNote = payload.note?.trim() ?? '';
        payload = {
          ...payload,
          activityType: 'OTHER',
          note: baseNote ? `[COMPLETE] ${baseNote}` : '[COMPLETE] Hoàn thành batch',
        };
      }
      payload = {
        ...payload,
        activityDate: getTodayDate(),
      };
      if (evidenceFile) {
        const evidence = await dashboardApi.uploadEvidence(evidenceFile);
        payload = {
          ...payload,
          evidenceHash: evidence.evidenceHash,
          evidenceUri: evidence.evidenceUri,
        };
      }
      await dashboardApi.recordFarmActivity(params.id, payload);

      if (completeMode) {
        await dashboardApi.updateHarvestStatusWithWeight(params.id, 'COMPLETED', finalWeightKg.trim());
      } else if (shouldAutoProgress(batch)) {
        await dashboardApi.updateHarvestStatus(params.id, 'IN_PROCESS');
      }

      const optimisticActivity: FarmActivityItem = {
        activityType: payload.activityType,
        activityDate: payload.activityDate,
        note: payload.note ?? '',
        evidenceHash: payload.evidenceHash ?? '',
        evidenceUri: payload.evidenceUri ?? '',
      };

      setForm(buildInitialActivity());
      setEvidenceFile(null);
      setFinalWeightKg('');
      const refreshedActivities = await loadBatch();
      if (refreshedActivities.some((activity) => isSameActivity(activity, optimisticActivity))) {
        setMessage(completeMode ? 'Đã ghi nhật ký và hoàn thành batch.' : 'Đã ghi nhật ký canh tác.');
      } else {
        setActivities((prev) => {
          if (prev.some((activity) => isSameActivity(activity, optimisticActivity))) {
            return prev;
          }
          return [optimisticActivity, ...prev];
        });
        setMessage(
          completeMode
            ? 'Đã ghi nhật ký và hoàn thành batch. Dữ liệu read-model đang đồng bộ.'
            : 'Đã ghi nhật ký canh tác. Dữ liệu read-model đang đồng bộ, batch đã chuyển sang IN_PROCESS.',
        );
      }
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return <LoadingState text="Đang xác thực quyền truy cập..." />;
  }

  return (
    <DashboardShell title="Chi tiết Harvest batch" subtitle={params.id}>
      <div className="mb-4">
        <Link
          href="/dashboard/farmer"
          className="inline-flex rounded-lg border border-amber-200 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50"
        >
          Quay lại danh sách
        </Link>
      </div>

      {error && <ErrorState message={error} />}
      {loading && <LoadingState />}

      {!loading && batch && (
        <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
          <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-amber-900">Thông tin canh tác</h2>
            <dl className="mt-4 space-y-4 text-sm">
              {/* Main harvest info - always show */}
              {batch.metadata?.farmLocation ? (
                <div className="border-b border-amber-100 pb-3">
                  <dt className="font-medium text-slate-500 text-xs uppercase tracking-wide">Địa điểm nông trại</dt>
                  <dd className="mt-1 text-lg font-semibold text-slate-800">{batch.metadata.farmLocation}</dd>
                </div>
              ) : null}
              
              {batch.metadata?.coffeeVariety ? (
                <div className="border-b border-amber-100 pb-3">
                  <dt className="font-medium text-slate-500 text-xs uppercase tracking-wide">Giống cà phê</dt>
                  <dd className="mt-1 text-lg font-semibold text-slate-800">{batch.metadata.coffeeVariety}</dd>
                </div>
              ) : null}
              
              {batch.metadata?.harvestDate ? (
                <div className="border-b border-amber-100 pb-3">
                  <dt className="font-medium text-slate-500 text-xs uppercase tracking-wide">Ngày thu hoạch</dt>
                  <dd className="mt-1 text-lg text-slate-800">{batch.metadata.harvestDate}</dd>
                </div>
              ) : null}
              
              {batch.metadata?.weightKg ? (
                <div className="border-b border-amber-100 pb-3">
                  <dt className="font-medium text-slate-500 text-xs uppercase tracking-wide">Khối lượng</dt>
                  <dd className="mt-1 text-lg text-slate-800">{batch.metadata.weightKg} kg</dd>
                </div>
              ) : null}
              
              {/* Status */}
              <div className="pt-2">
                <dt className="font-medium text-slate-500 text-xs uppercase tracking-wide">Trạng thái</dt>
                <dd className="pt-2"><StatusBadge status={batch.status} /></dd>
              </div>
              
              {/* Technical details in smaller section */}
              <div className="border-t border-slate-200 pt-3 mt-3">
                <dt className="font-medium text-slate-500 text-xs">Chi tiết kỹ thuật</dt>
                <dd className="mt-2 space-y-1 text-xs text-slate-600">
                  <p><span className="font-medium">Mã công khai:</span> {batch.publicCode}</p>
                  <p><span className="font-medium">ID:</span> {batch.batchId.slice(0, 16)}...</p>
                  <p><span className="font-medium">Org:</span> {batch.ownerMsp}</p>
                </dd>
              </div>
            </dl>

            {canShowActivityForm(batch) ? (
              <>
                <h3 className="mt-6 text-sm font-semibold text-amber-900">Thêm nhật ký canh tác</h3>
                <form className="mt-3 space-y-3">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Loại hoạt động</span>
                    <select
                      value={form.activityType}
                      onChange={(e) => {
                        const nextType = e.target.value;
                        setForm((p) => ({ ...p, activityType: nextType }));
                        if (!isCompleteActivity(nextType)) {
                          setFinalWeightKg('');
                        }
                      }}
                      className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
                    >
                      {ACTIVITY_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t === 'COMPLETE' ? 'COMPLETE - Kết thúc batch' : t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-xs text-slate-500">
                    Chọn một hoạt động thường để tự chuyển batch sang IN_PROCESS, hoặc chọn COMPLETE để chốt batch và khóa cập nhật tiếp theo.
                  </p>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Ngày thực hiện (tự động)</span>
                    <input
                      type="text"
                      value={form.activityDate}
                      readOnly
                      className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Khối lượng thực tế (kg)</span>
                    <input
                      value={finalWeightKg}
                      onChange={(e) => setFinalWeightKg(e.target.value)}
                      disabled={!isCompleteActivity(form.activityType)}
                      placeholder="Chỉ nhập khi chọn COMPLETE"
                      className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Ghi chú</span>
                    <textarea
                      value={form.note}
                      onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                      className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
                      rows={3}
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
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleSubmitActivity()}
                    className="w-full rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
                  >
                    {submitting ? 'Đang ghi...' : form.activityType === 'COMPLETE' ? 'Hoàn thành batch' : 'Lưu nhật ký'}
                  </button>
                </form>
              </>
            ) : (
              <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Batch đã hoàn thành, chỉ được xem chi tiết và không thể cập nhật nhật ký canh tác.
              </div>
            )}
            {message && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
          </section>

          <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-amber-900">Nhật ký canh tác ({sortedActivities.length})</h2>
            <div className="mt-3 space-y-2">
              {sortedActivities.length === 0 && (
                <p className="text-sm text-slate-500">Chưa có hoạt động nào cho batch này.</p>
              )}
              {sortedActivities.map((activity, index) => (
                <div key={`${activity.activityDate}-${index}`} className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{activity.activityType}</p>
                      <p className="text-xs text-slate-600">Ngày: {activity.activityDate}</p>
                    </div>
                    <p className="text-xs text-slate-500 text-right">Theo dõi Block</p>
                  </div>
                  {activity.note && <p className="mt-2 text-sm text-slate-700">Ghi chú: {activity.note}</p>}
                  {(activity.evidenceUri || activity.evidenceHash) && (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-xs text-slate-600">
                      <p className="font-medium text-amber-800">📎 Minh chứng</p>
                      {activity.evidenceUri && (
                        <p className="mt-1">
                          <a
                            href={toEvidenceUrl(activity.evidenceUri)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-amber-700 underline-offset-2 hover:underline"
                          >
                            Xem tệp trên IPFS
                          </a>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
