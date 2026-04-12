'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { EmptyState, ErrorState, LoadingState } from '@/components/dashboard/UiState';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { dashboardApi, getApiErrorMessage, type CreateRoastInput } from '@/lib/api/dashboardApi';
import { TraceTimeline } from '@/components/TraceTimeline';
import type { BatchResponse, BatchStatus, TraceResponse } from '@/lib/api/types';
import { useRoleGuard } from '@/lib/auth/useRoleGuard';

const INITIAL_CREATE: CreateRoastInput = {
  parentBatchId: '',
  roastProfile: 'Medium',
  roastDate: '',
  roastDurationMinutes: '',
  weightKg: '',
};

const ROAST_PROFILES = ['Light', 'Medium-Light', 'Medium', 'Dark'] as const;

function canMoveTo(current: BatchStatus, next: BatchStatus): boolean {
  if (current === 'CREATED' && (next === 'IN_PROCESS' || next === 'COMPLETED')) return true;
  if (current === 'IN_PROCESS' && next === 'COMPLETED') return true;
  return false;
}

export default function RoasterDashboardPage() {
  const { ready } = useRoleGuard('ROASTER');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [createForm, setCreateForm] = useState<CreateRoastInput>(INITIAL_CREATE);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  const [parents, setParents] = useState<BatchResponse[]>([]);
  const [roasts, setRoasts] = useState<BatchResponse[]>([]);
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
      const [parentList, roastList] = await Promise.all([
        dashboardApi.getList({ type: 'PROCESSED', status: 'COMPLETED' }),
        dashboardApi.getList({ type: 'ROAST' }),
      ]);
      setParents(parentList);
      setRoasts(roastList);
      setCreateForm((p) => ({ ...p, parentBatchId: p.parentBatchId || parentList[0]?.batchId || '' }));
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
      setError('Vui lòng chọn ảnh minh chứng trước khi tạo Roast batch.');
      return;
    }
    setSubmittingCreate(true);
    setError('');
    setMessage('');
    try {
      const created = await dashboardApi.createRoast(createForm);
      const evidence = await dashboardApi.uploadEvidence(evidenceFile);
      await dashboardApi.addEvidence(created.batchId, evidence);
      setCreateForm((p) => ({ ...INITIAL_CREATE, parentBatchId: p.parentBatchId, roastProfile: p.roastProfile }));
      setEvidenceFile(null);
      setMessage('Tạo Roast batch thành công.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmittingCreate(false);
    }
  }

  async function updateStatus(batchId: string, newStatus: BatchStatus) {
    setError('');
    setMessage('');
    try {
      await dashboardApi.updateRoastStatus(batchId, newStatus);
      setMessage(`Đã cập nhật trạng thái -> ${newStatus}.`);
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }

  async function requestTransfer(batchId: string) {
    setError('');
    setMessage('');
    try {
      await dashboardApi.requestTransfer(batchId);
      setMessage('Đã gửi yêu cầu chuyển giao sang Org2MSP.');
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
    <DashboardShell title="Roaster Dashboard" subtitle="Tạo Roast, gắn minh chứng và chuyển giao">
      <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-amber-900">Tạo Roast batch</h2>
            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Processed nguồn</span>
                <select
                  value={createForm.parentBatchId}
                  onChange={(e) => setCreateForm((p) => ({ ...p, parentBatchId: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
                >
                  {parents.length === 0 && <option value="">Không có parent hợp lệ</option>}
                  {parents.map((item) => (
                    <option key={item.batchId} value={item.batchId}>
                      {item.publicCode} - {item.batchId.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Roast profile</span>
                <select
                  value={createForm.roastProfile}
                  onChange={(e) => setCreateForm((p) => ({ ...p, roastProfile: e.target.value }))}
                  className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
                >
                  {ROAST_PROFILES.map((profile) => <option key={profile} value={profile}>{profile}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Ngày rang</span>
                <input
                  type="date"
                  value={createForm.roastDate}
                  onChange={(e) => setCreateForm((p) => ({ ...p, roastDate: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Thời gian rang (phút)</span>
                <input
                  type="number"
                  min="1"
                  value={createForm.roastDurationMinutes}
                  onChange={(e) => setCreateForm((p) => ({ ...p, roastDurationMinutes: e.target.value }))}
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
                  value={createForm.weightKg}
                  onChange={(e) => setCreateForm((p) => ({ ...p, weightKg: e.target.value }))}
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
              {evidenceFile && (
                <p className="text-xs text-slate-500">Đã chọn: {evidenceFile.name}</p>
              )}
              <button
                type="submit"
                disabled={submittingCreate || parents.length === 0}
                className="w-full rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
              >
                {submittingCreate ? 'Đang tạo...' : 'Tạo Roast batch'}
              </button>
            </form>
          </section>
        </div>

        <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-amber-900">Danh sách Roast</h2>
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
          {!loading && !error && roasts.length === 0 && <EmptyState text="Chưa có Roast batch nào." />}

          {!loading && !error && roasts.length > 0 && (
            <>
              <div className="space-y-3 md:hidden">
                {roasts.map((item) => (
                  <article key={item.batchId} className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                    <p className="font-mono text-xs text-slate-700">{item.publicCode}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Trạng thái</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      Minh chứng: {item.evidenceHash ? 'Đã có minh chứng' : 'Chưa có minh chứng'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canMoveTo(item.status, 'IN_PROCESS') && (
                        <button
                          type="button"
                          onClick={() => void updateStatus(item.batchId, 'IN_PROCESS')}
                          className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                        >
                          IN_PROCESS
                        </button>
                      )}
                      {canMoveTo(item.status, 'COMPLETED') && (
                        <button
                          type="button"
                          onClick={() => void updateStatus(item.batchId, 'COMPLETED')}
                          className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200"
                        >
                          COMPLETED
                        </button>
                      )}
                      {item.status === 'COMPLETED' && (
                        <button
                          type="button"
                          onClick={() => void requestTransfer(item.batchId)}
                          className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                        >
                          Yêu cầu chuyển giao
                        </button>
                      )}
                      {!canMoveTo(item.status, 'IN_PROCESS') &&
                        !canMoveTo(item.status, 'COMPLETED') &&
                        item.status !== 'COMPLETED' && (
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
                      <th className="px-2 py-2 font-medium">Minh chứng</th>
                      <th className="px-2 py-2 font-medium">Thao tác</th>
                      <th className="px-2 py-2 font-medium">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roasts.map((item) => (
                      <tr key={item.batchId} className="border-b border-amber-50">
                        <td className="px-2 py-2 font-mono text-xs text-slate-700">{item.publicCode}</td>
                        <td className="px-2 py-2"><StatusBadge status={item.status} /></td>
                        <td className="px-2 py-2 text-xs text-slate-600">
                          {item.evidenceHash ? 'Đã có minh chứng' : 'Chưa có minh chứng'}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-2">
                            {canMoveTo(item.status, 'IN_PROCESS') && (
                              <button
                                type="button"
                                onClick={() => void updateStatus(item.batchId, 'IN_PROCESS')}
                                className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                              >
                                IN_PROCESS
                              </button>
                            )}
                            {canMoveTo(item.status, 'COMPLETED') && (
                              <button
                                type="button"
                                onClick={() => void updateStatus(item.batchId, 'COMPLETED')}
                                className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200"
                              >
                                COMPLETED
                              </button>
                            )}
                            {item.status === 'COMPLETED' && (
                              <button
                                type="button"
                                onClick={() => void requestTransfer(item.batchId)}
                                className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                              >
                                Yêu cầu chuyển giao
                              </button>
                            )}
                            {!canMoveTo(item.status, 'IN_PROCESS') &&
                              !canMoveTo(item.status, 'COMPLETED') &&
                              item.status !== 'COMPLETED' && (
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
                <h3 className="text-base font-semibold text-amber-900">Chi tiết lô rang xay</h3>
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
