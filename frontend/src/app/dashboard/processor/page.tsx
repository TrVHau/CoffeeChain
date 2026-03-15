'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { EmptyState, ErrorState, LoadingState } from '@/components/dashboard/UiState';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { dashboardApi, getApiErrorMessage, type CreateProcessedInput } from '@/lib/api/dashboardApi';
import type { BatchResponse, BatchStatus } from '@/lib/api/types';
import { useRoleGuard } from '@/lib/auth/useRoleGuard';

const INITIAL_FORM: CreateProcessedInput = {
  parentBatchId: '',
  processingMethod: 'Washed',
  startDate: '',
  endDate: '',
  facilityName: '',
  weightKg: '',
};

const METHODS = ['Washed', 'Natural', 'Honey'] as const;

function canMoveTo(current: BatchStatus, next: BatchStatus): boolean {
  if (current === 'CREATED' && (next === 'IN_PROCESS' || next === 'COMPLETED')) return true;
  if (current === 'IN_PROCESS' && next === 'COMPLETED') return true;
  return false;
}

export default function ProcessorDashboardPage() {
  const { ready } = useRoleGuard('PROCESSOR');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<CreateProcessedInput>(INITIAL_FORM);
  const [processed, setProcessed] = useState<BatchResponse[]>([]);
  const [harvestParents, setHarvestParents] = useState<BatchResponse[]>([]);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [processedList, harvestList] = await Promise.all([
        dashboardApi.getList({ type: 'PROCESSED' }),
        dashboardApi.getList({ type: 'HARVEST', status: 'COMPLETED' }),
      ]);
      setProcessed(processedList);
      setHarvestParents(harvestList);
      setForm((prev) => ({
        ...prev,
        parentBatchId: prev.parentBatchId || harvestList[0]?.batchId || '',
      }));
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
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await dashboardApi.createProcessed(form);
      setForm((p) => ({ ...INITIAL_FORM, parentBatchId: p.parentBatchId }));
      setMessage('Tao Processed batch thanh cong.');
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
      await dashboardApi.updateProcessedStatus(batchId, newStatus);
      setMessage(`Da cap nhat trang thai -> ${newStatus}.`);
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }

  if (!ready) return <LoadingState text="Dang xac thuc quyen truy cap..." />;

  return (
    <DashboardShell title="Processor Dashboard" subtitle="Tao Processed batch tu Harvest da hoan thanh">
      <div className="grid gap-6 xl:grid-cols-[380px,1fr]">
        <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-rose-900">Tao Processed batch</h2>
          <form onSubmit={handleCreate} className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Parent Harvest</span>
              <select
                value={form.parentBatchId}
                onChange={(e) => setForm((p) => ({ ...p, parentBatchId: e.target.value }))}
                required
                className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
              >
                {harvestParents.length === 0 && <option value="">Khong co parent hop le</option>}
                {harvestParents.map((item) => (
                  <option key={item.batchId} value={item.batchId}>
                    {item.publicCode} - {item.batchId.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Processing method</span>
              <select
                value={form.processingMethod}
                onChange={(e) => setForm((p) => ({ ...p, processingMethod: e.target.value }))}
                className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
              >
                {METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Start date</span>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                required
                className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">End date</span>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                required
                className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Facility name</span>
              <input
                value={form.facilityName}
                onChange={(e) => setForm((p) => ({ ...p, facilityName: e.target.value }))}
                required
                className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Weight (kg)</span>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={form.weightKg}
                onChange={(e) => setForm((p) => ({ ...p, weightKg: e.target.value }))}
                required
                className="w-full rounded-lg border border-rose-200 px-3 py-2 outline-none ring-rose-400 focus:ring"
              />
            </label>
            <button
              type="submit"
              disabled={submitting || harvestParents.length === 0}
              className="w-full rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
            >
              {submitting ? 'Dang tao...' : 'Tao Processed batch'}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-rose-900">Danh sach Processed</h2>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50"
            >
              Lam moi
            </button>
          </div>
          {message && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
          {error && <ErrorState message={error} />}
          {loading && <LoadingState />}
          {!loading && !error && processed.length === 0 && <EmptyState text="Chua co Processed batch nao." />}

          {!loading && !error && processed.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-rose-100 text-left text-slate-500">
                    <th className="px-2 py-2 font-medium">Public code</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Updated</th>
                    <th className="px-2 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {processed.map((item) => (
                    <tr key={item.batchId} className="border-b border-rose-50">
                      <td className="px-2 py-2 font-mono text-xs text-slate-700">{item.publicCode}</td>
                      <td className="px-2 py-2"><StatusBadge status={item.status} /></td>
                      <td className="px-2 py-2 text-slate-600">{new Date(item.updatedAt).toLocaleString('vi-VN')}</td>
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
