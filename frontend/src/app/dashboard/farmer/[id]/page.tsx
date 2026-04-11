'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
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
  'OTHER',
] as const;

const INITIAL_ACTIVITY: RecordFarmActivityInput = {
  activityType: 'IRRIGATION',
  activityDate: '',
  note: '',
};

function toEvidenceUrl(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }
  return uri;
}

export default function FarmerBatchDetailPage({ params }: { params: { id: string } }) {
  const { ready } = useRoleGuard('FARMER');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [batch, setBatch] = useState<BatchResponse | null>(null);
  const [activities, setActivities] = useState<FarmActivityItem[]>([]);
  const [form, setForm] = useState<RecordFarmActivityInput>(INITIAL_ACTIVITY);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  const loadBatch = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const detail = await dashboardApi.getBatchById(params.id);
      setBatch(detail);
      let trace: TraceResponse | null = null;
      if (detail.publicCode) {
        trace = await dashboardApi.getTrace(detail.publicCode);
      }
      setActivities(trace?.farmActivities ?? []);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (!ready) return;
    void loadBatch();
  }, [ready, loadBatch]);

  async function handleSubmitActivity(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      let payload = { ...form };
      if (evidenceFile) {
        const evidence = await dashboardApi.uploadEvidence(evidenceFile);
        payload = {
          ...payload,
          evidenceHash: evidence.evidenceHash,
          evidenceUri: evidence.evidenceUri,
        };
      }
      await dashboardApi.recordFarmActivity(params.id, payload);
      setForm(INITIAL_ACTIVITY);
      setEvidenceFile(null);
      setMessage('Đã ghi nhật ký canh tác.');
      await loadBatch();
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
            <h2 className="text-base font-semibold text-amber-900">Thông tin batch</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="font-medium text-slate-500">Batch ID</dt><dd className="font-mono text-xs text-slate-800">{batch.batchId}</dd></div>
              <div><dt className="font-medium text-slate-500">Mã công khai</dt><dd className="font-mono text-xs text-slate-800">{batch.publicCode}</dd></div>
              <div><dt className="font-medium text-slate-500">Trạng thái</dt><dd className="pt-1"><StatusBadge status={batch.status} /></dd></div>
              <div><dt className="font-medium text-slate-500">Chủ sở hữu</dt><dd className="text-slate-700">{batch.ownerUserId} ({batch.ownerMsp})</dd></div>
            </dl>

            <h3 className="mt-6 text-sm font-semibold text-amber-900">Thêm nhật ký canh tác</h3>
            <form onSubmit={handleSubmitActivity} className="mt-3 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Loại hoạt động</span>
                <select
                  value={form.activityType}
                  onChange={(e) => setForm((p) => ({ ...p, activityType: e.target.value }))}
                  className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
                >
                  {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Ngày thực hiện</span>
                <input
                  type="date"
                  value={form.activityDate}
                  onChange={(e) => setForm((p) => ({ ...p, activityDate: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
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
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
              >
                {submitting ? 'Đang ghi...' : 'Lưu nhật ký'}
              </button>
            </form>
            {message && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
          </section>

          <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-amber-900">Nhật ký canh tác ({activities.length})</h2>
            <div className="mt-3 space-y-2">
              {activities.length === 0 && (
                <p className="text-sm text-slate-500">Chưa có hoạt động nào cho batch này.</p>
              )}
              {activities.map((activity, index) => (
                <div key={`${activity.activityDate}-${index}`} className="rounded-xl border border-amber-100 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{activity.activityType}</p>
                    <p className="text-xs text-slate-500">{activity.activityDate}</p>
                  </div>
                  {activity.note && <p className="mt-1 text-sm text-slate-700">{activity.note}</p>}
                  {(activity.evidenceUri || activity.evidenceHash) && (
                    <div className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-slate-600">
                      <p className="font-medium text-amber-800">Minh chứng</p>
                      {activity.evidenceUri && (
                        <p className="mt-1">
                          <a
                            href={toEvidenceUrl(activity.evidenceUri)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-amber-700 underline-offset-2 hover:underline"
                          >
                            Xem minh chứng
                          </a>
                        </p>
                      )}
                      {activity.evidenceHash && (
                        <p className="mt-1 font-mono text-[11px] text-slate-500">
                          Hash: {activity.evidenceHash.slice(0, 16)}...
                        </p>
                      )}
                    </div>
                  )}
                  {(activity.txId || activity.blockNumber) && (
                    <p className="mt-2 text-xs text-slate-500">
                      {activity.txId ? `Tx: ${activity.txId.slice(0, 12)}...` : ''}{' '}
                      {activity.blockNumber ? `Block: ${activity.blockNumber}` : ''}
                    </p>
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
