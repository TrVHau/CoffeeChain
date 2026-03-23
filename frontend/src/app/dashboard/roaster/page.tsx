'use client';

import { useEffect, useMemo, useState } from 'react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { EmptyState, ErrorState, LoadingState } from '@/components/dashboard/UiState';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import {
  dashboardApi,
  getApiErrorMessage,
  type AddEvidenceInput,
  type CreateRoastInput,
} from '@/lib/api/dashboardApi';
import type { BatchResponse, BatchStatus } from '@/lib/api/types';
import { useRoleGuard } from '@/lib/auth/useRoleGuard';

const INITIAL_CREATE: CreateRoastInput = {
  parentBatchId: '',
  roastProfile: 'Medium',
  roastDate: '',
  roastDurationMinutes: '',
  weightKg: '',
};

const INITIAL_EVIDENCE: AddEvidenceInput = {
  evidenceHash: '',
  evidenceUri: '',
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
  const [evidenceForm, setEvidenceForm] = useState<AddEvidenceInput>(INITIAL_EVIDENCE);
  const [selectedRoastId, setSelectedRoastId] = useState('');
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [submittingEvidence, setSubmittingEvidence] = useState(false);

  const [parents, setParents] = useState<BatchResponse[]>([]);
  const [roasts, setRoasts] = useState<BatchResponse[]>([]);

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
      setSelectedRoastId((prev) => prev || roastList[0]?.batchId || '');
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
    setSubmittingCreate(true);
    setError('');
    setMessage('');
    try {
      await dashboardApi.createRoast(createForm);
      setCreateForm((p) => ({ ...INITIAL_CREATE, parentBatchId: p.parentBatchId, roastProfile: p.roastProfile }));
      setMessage('Tạo Roast batch thành công.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmittingCreate(false);
    }
  }

  async function handleAddEvidence(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRoastId) return;
    setSubmittingEvidence(true);
    setError('');
    setMessage('');
    try {
      await dashboardApi.addEvidence(selectedRoastId, evidenceForm);
      setEvidenceForm(INITIAL_EVIDENCE);
      setMessage('Đã cập nhật minh chứng.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmittingEvidence(false);
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

  const selectedRoast = useMemo(
    () => roasts.find((item) => item.batchId === selectedRoastId) ?? null,
    [roasts, selectedRoastId]
  );

  if (!ready) return <LoadingState text="Đang xác thực quyền truy cập..." />;

  return (
    <DashboardShell title="Roaster Dashboard" subtitle="Tạo Roast, gắn minh chứng và chuyển giao">
      <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-rose-900">Tạo Roast batch</h2>
            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Processed nguồn</span>
                <select
                  value={createForm.parentBatchId}
                  onChange={(e) => setCreateForm((p) => ({ ...p, parentBatchId: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
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
                  className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
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
                  className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
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
                  className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
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
                  className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
                />
              </label>
              <button
                type="submit"
                disabled={submittingCreate || parents.length === 0}
                className="w-full rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
              >
                {submittingCreate ? 'Đang tạo...' : 'Tạo Roast batch'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-rose-900">Thêm minh chứng</h2>
            <form onSubmit={handleAddEvidence} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Roast batch</span>
                <select
                  value={selectedRoastId}
                  onChange={(e) => setSelectedRoastId(e.target.value)}
                  className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
                >
                  {roasts.length === 0 && <option value="">Không có Roast batch</option>}
                  {roasts.map((item) => (
                    <option key={item.batchId} value={item.batchId}>
                      {item.publicCode} - {item.status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Mã băm minh chứng (SHA-256)</span>
                <input
                  value={evidenceForm.evidenceHash}
                  onChange={(e) => setEvidenceForm((p) => ({ ...p, evidenceHash: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">URI minh chứng</span>
                <input
                  value={evidenceForm.evidenceUri}
                  onChange={(e) => setEvidenceForm((p) => ({ ...p, evidenceUri: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
                  placeholder="ipfs://..."
                />
              </label>
              <button
                type="submit"
                disabled={submittingEvidence || !selectedRoastId}
                className="w-full rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
              >
                {submittingEvidence ? 'Đang cập nhật...' : 'Lưu minh chứng'}
              </button>
              {selectedRoast && (
                <p className="text-xs text-slate-500">
                  Batch được chọn: {selectedRoast.publicCode} ({selectedRoast.status})
                </p>
              )}
            </form>
          </section>
        </div>

        <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-rose-900">Danh sách Roast</h2>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50"
            >
              Làm mới
            </button>
          </div>
          {message && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
          {error && <ErrorState message={error} />}
          {loading && <LoadingState />}
          {!loading && !error && roasts.length === 0 && <EmptyState text="Chưa có Roast batch nào." />}

          {!loading && !error && roasts.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-rose-100 text-left text-slate-500">
                    <th className="px-2 py-2 font-medium">Mã công khai</th>
                    <th className="px-2 py-2 font-medium">Trạng thái</th>
                    <th className="px-2 py-2 font-medium">Minh chứng</th>
                    <th className="px-2 py-2 font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {roasts.map((item) => (
                    <tr key={item.batchId} className="border-b border-rose-50">
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
                              className="rounded-md bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-200"
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
