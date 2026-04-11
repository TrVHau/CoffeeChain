'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { EmptyState, ErrorState, LoadingState } from '@/components/dashboard/UiState';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { dashboardApi, getApiErrorMessage, type CreatePackagedInput } from '@/lib/api/dashboardApi';
import type { BatchResponse } from '@/lib/api/types';
import { useRoleGuard } from '@/lib/auth/useRoleGuard';

const INITIAL_FORM: CreatePackagedInput = {
  parentBatchId: '',
  packageWeight: '',
  packageDate: '',
  expiryDate: '',
  packageCount: '',
};

export default function PackagerDashboardPage() {
  const { ready } = useRoleGuard('PACKAGER');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  const [roastTransferred, setRoastTransferred] = useState<BatchResponse[]>([]);
  const [packaged, setPackaged] = useState<BatchResponse[]>([]);
  const [form, setForm] = useState<CreatePackagedInput>(INITIAL_FORM);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [transferred, packagedList] = await Promise.all([
        dashboardApi.getList({ type: 'ROAST', status: 'TRANSFERRED' }),
        dashboardApi.getList({ type: 'PACKAGED' }),
      ]);
      setRoastTransferred(transferred);
      setPackaged(packagedList);
      setForm((p) => ({ ...p, parentBatchId: p.parentBatchId || transferred[0]?.batchId || '' }));
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

  async function createPackaged(e: React.FormEvent) {
    e.preventDefault();
    if (!evidenceFile) {
      setError('Vui lòng chọn ảnh minh chứng trước khi tạo Packaged batch.');
      return;
    }
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const created = await dashboardApi.createPackaged(form);
      const evidence = await dashboardApi.uploadEvidence(evidenceFile);
      await dashboardApi.addPackagedEvidence(created.batchId, evidence);
      setForm((p) => ({ ...INITIAL_FORM, parentBatchId: p.parentBatchId }));
      setEvidenceFile(null);
      setMessage('Đã tạo Packaged batch thành công.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
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

  if (!ready) return <LoadingState text="Đang xác thực quyền truy cập..." />;

  return (
    <DashboardShell title="Packager Dashboard" subtitle="Tạo package và tải QR">
      <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-stone-900">Tạo Packaged batch</h2>
            <form onSubmit={createPackaged} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Roast nguồn (ĐÃ CHUYỂN GIAO)</span>
                <select
                  value={form.parentBatchId}
                  onChange={(e) => setForm((p) => ({ ...p, parentBatchId: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
                >
                  {roastTransferred.length === 0 && <option value="">Không có Roast đã chuyển giao</option>}
                  {roastTransferred.map((item) => (
                    <option key={item.batchId} value={item.batchId}>
                      {item.publicCode} - {item.batchId.slice(0, 8)}
                    </option>
                  ))}
                </select>
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
                <span className="mb-1 block font-medium text-slate-700">Ngày đóng gói</span>
                <input
                  type="date"
                  value={form.packageDate}
                  onChange={(e) => setForm((p) => ({ ...p, packageDate: e.target.value }))}
                  required
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
                disabled={submitting || roastTransferred.length === 0}
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
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-100 text-left text-slate-500">
                    <th className="px-2 py-2 font-medium">Mã công khai</th>
                    <th className="px-2 py-2 font-medium">Trạng thái</th>
                    <th className="px-2 py-2 font-medium">Cập nhật</th>
                    <th className="px-2 py-2 font-medium">Chi tiết</th>
                    <th className="px-2 py-2 font-medium">QR</th>
                  </tr>
                </thead>
                <tbody>
                  {packaged.map((item) => (
                    <tr key={item.batchId} className="border-b border-amber-50">
                      <td className="px-2 py-2 font-mono text-xs text-slate-700">{item.publicCode}</td>
                      <td className="px-2 py-2"><StatusBadge status={item.status} /></td>
                      <td className="px-2 py-2 text-slate-600">{new Date(item.updatedAt).toLocaleString('vi-VN')}</td>
                      <td className="px-2 py-2">
                        <Link
                          href={`/trace/${encodeURIComponent(item.publicCode)}`}
                          className="rounded-md border border-amber-200 px-2 py-1 text-xs text-amber-800 hover:bg-amber-50"
                        >
                          Xem chi tiết
                        </Link>
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => void downloadQr(item.batchId)}
                          className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200"
                        >
                          Tải QR
                        </button>
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
