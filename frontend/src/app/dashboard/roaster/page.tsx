'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { EmptyState, ErrorState, LoadingState } from '@/components/dashboard/UiState';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { QrScanner } from '@/components/QrScanner';
import { dashboardApi, getApiErrorMessage, type CreateRoastInput } from '@/lib/api/dashboardApi';
import { TraceTimeline } from '@/components/TraceTimeline';
import type { BatchResponse, BatchStatus, TraceResponse } from '@/lib/api/types';
import { useRoleGuard } from '@/lib/auth/useRoleGuard';

const INITIAL_CREATE: CreateRoastInput = {
  parentBatchId: '',
  roastProfile: 'Medium',
  roastDate: '',
  roastDurationMinutes: '0',
  weightKg: '',
};

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildInitialCreate(): CreateRoastInput {
  return {
    ...INITIAL_CREATE,
    roastDate: getTodayDate(),
  };
}

const ROAST_PROFILES = ['Light', 'Medium-Light', 'Medium', 'Dark'] as const;

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

function extractTraceCode(value: string): string {
  const trimmed = value.trim();
  const matched = trimmed.match(/\/trace\/([^/?#\s]+)/i);
  return matched ? matched[1] : trimmed;
}

function canMoveTo(current: BatchStatus, next: BatchStatus): boolean {
  if (current === 'CREATED' && (next === 'IN_PROCESS' || next === 'COMPLETED')) return true;
  if (current === 'IN_PROCESS' && next === 'COMPLETED') return true;
  return false;
}

const PAGE_SIZE = 10;

export default function RoasterDashboardPage() {
  const { ready } = useRoleGuard('ROASTER');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [createForm, setCreateForm] = useState<CreateRoastInput>(buildInitialCreate());
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  const [roasts, setRoasts] = useState<BatchResponse[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [detailTrace, setDetailTrace] = useState<TraceResponse | null>(null);
  const [sourceCodeInput, setSourceCodeInput] = useState('');
  const [sourceResolving, setSourceResolving] = useState(false);
  const [resolvedSource, setResolvedSource] = useState<BatchResponse | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(roasts.length / PAGE_SIZE));
  const pagedRoasts = roasts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

      const [parentsEnriched, roastsEnriched] = await Promise.all([
        Promise.all(parentList.map(async (item) => {
          if (!isMetadataEmpty(item)) return item;
          try {
            const chainBatch = await dashboardApi.getBatchByIdChain(item.batchId);
            return { ...item, metadata: chainBatch.metadata };
          } catch {
            return item;
          }
        })),
        Promise.all(roastList.map(async (item) => {
          if (!isMetadataEmpty(item)) return item;
          try {
            const chainBatch = await dashboardApi.getBatchByIdChain(item.batchId);
            return { ...item, metadata: chainBatch.metadata };
          } catch {
            return item;
          }
        })),
      ]);

      setRoasts(roastsEnriched);
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.parentBatchId) {
      setError('Vui lòng nhập mã hoặc quét QR để xác định Processed nguồn trước khi tạo Roast batch.');
      return;
    }
    if (!evidenceFile) {
      setError('Vui lòng chọn ảnh minh chứng trước khi tạo Roast batch.');
      return;
    }
    setSubmittingCreate(true);
    setError('');
    setMessage('');
    try {
      const created = await dashboardApi.createRoast({
        ...createForm,
        roastDate: getTodayDate(),
        roastDurationMinutes: '0',
      });
      const evidence = await dashboardApi.uploadEvidence(evidenceFile);
      await dashboardApi.addEvidence(created.batchId, evidence);
      setCreateForm((p) => ({ ...buildInitialCreate(), parentBatchId: p.parentBatchId, roastProfile: p.roastProfile }));
      setEvidenceFile(null);
      setMessage('Tạo Roast batch và cập nhật minh chứng thành công.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmittingCreate(false);
    }
  }

  async function resolveProcessedSource(rawCode: string) {
    const code = extractTraceCode(rawCode);
    if (!code) {
      setError('Vui lòng nhập mã nguồn hợp lệ.');
      return;
    }

    setSourceResolving(true);
    setError('');
    setMessage('');

    try {
      const trace = await dashboardApi.getTrace(code);
      const chain = [...trace.parentChain, trace.batch];
      const candidates = chain
        .filter((item) => item.type === 'PROCESSED' && item.status === 'COMPLETED')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      const candidate = candidates[0];
      if (!candidate) {
        throw new Error('Không tìm thấy PROCESSED ở trạng thái COMPLETED từ mã đã nhập/quét.');
      }

      setCreateForm((p) => ({ ...p, parentBatchId: candidate.batchId }));
      setResolvedSource(candidate);
      setSourceCodeInput(code);
      setMessage(`Đã xác định Processed nguồn: ${candidate.publicCode}`);
    } catch (e) {
      setCreateForm((p) => ({ ...p, parentBatchId: '' }));
      setResolvedSource(null);
      setError(getApiErrorMessage(e));
    } finally {
      setSourceResolving(false);
    }
  }

  async function updateStatus(batchId: string, newStatus: BatchStatus) {
    setError('');
    setMessage('');
    try {
      if (newStatus === 'COMPLETED') {
        const finalWeightKg = window.prompt('Nhập khối lượng thực tế (kg) sau khi hoàn thành:', '');
        if (!finalWeightKg || !finalWeightKg.trim()) {
          setError('Bạn cần nhập khối lượng thực tế để hoàn thành batch.');
          return;
        }
        await dashboardApi.updateRoastStatusWithWeight(batchId, newStatus, finalWeightKg.trim());
      } else {
        await dashboardApi.updateRoastStatus(batchId, newStatus);
      }
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
                <span className="mb-1 block font-medium text-slate-700">Processed nguồn (nhập mã hoặc quét QR)</span>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={sourceCodeInput}
                    onChange={(e) => setSourceCodeInput(e.target.value)}
                    className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
                    placeholder="Nhập mã public code hoặc link /trace/..."
                  />
                  <button
                    type="button"
                    onClick={() => void resolveProcessedSource(sourceCodeInput)}
                    disabled={!sourceCodeInput.trim() || sourceResolving}
                    className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                  >
                    {sourceResolving ? 'Đang tìm...' : 'Xác định nguồn'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowScanner((v) => !v)}
                    className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50"
                  >
                    {showScanner ? 'Ẩn QR' : 'Quét QR'}
                  </button>
                </div>
                {showScanner && (
                  <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/40 p-3">
                    <QrScanner
                      autoNavigate={false}
                      onCodeDetected={(code) => {
                        setSourceCodeInput(code);
                        setShowScanner(false);
                        void resolveProcessedSource(code);
                      }}
                    />
                  </div>
                )}
                {resolvedSource && (
                  <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    Nguồn đã chọn: {resolvedSource.publicCode} | {resolvedSource.metadata?.facilityName ?? 'Chưa có cơ sở'}
                  </p>
                )}
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
                <span className="mb-1 block font-medium text-slate-700">Ngày rang (tự động)</span>
                <input
                  type="text"
                  value={createForm.roastDate}
                  readOnly
                  className="w-full rounded-lg border border-amber-200 px-3 py-2 outline-none ring-amber-400 focus:ring"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Thời gian rang (phút)</span>
                <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Thời gian rang sẽ được nhập khi cập nhật trạng thái sang COMPLETED.
                </div>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Khối lượng (kg)</span>
                <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Khối lượng sẽ được nhập ở bước chuyển trạng thái sang COMPLETED.
                </div>
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
                disabled={submittingCreate || !createForm.parentBatchId}
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
                {pagedRoasts.map((item) => (
                  <article key={item.batchId} className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                    <p className="font-mono text-xs text-slate-700">{item.publicCode}</p>
                    <p className="mt-1 text-xs text-slate-700"><span className="font-medium">Profile:</span> {item.metadata?.roastProfile ?? 'Chưa có dữ liệu'}</p>
                    <p className="mt-1 text-xs text-slate-600"><span className="font-medium">Ngày rang:</span> {item.metadata?.roastDate ?? 'Chưa có dữ liệu'}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Trạng thái</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      Minh chứng: {item.evidenceHash ? 'Đã có minh chứng' : 'Chưa có minh chứng'}
                    </p>
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
                      href={`/dashboard/roaster/update?batchId=${encodeURIComponent(item.batchId)}`}
                      className="mt-3 inline-flex items-center justify-center whitespace-nowrap rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                    >
                      Xem chi tiết
                    </Link>
                  </article>
                ))}
              </div>

              <div className="hidden w-full max-w-full overflow-x-auto md:block">
                <table className="min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-amber-100 text-left text-slate-500">
                      <th className="px-2 py-2 font-medium">Roast profile</th>
                      <th className="px-2 py-2 font-medium">Ngày rang</th>
                      <th className="px-2 py-2 font-medium">Mã công khai</th>
                      <th className="px-2 py-2 font-medium">Trạng thái</th>
                      <th className="px-2 py-2 font-medium">Minh chứng</th>
                      <th className="px-2 py-2 font-medium">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRoasts.map((item) => (
                      <tr key={item.batchId} className="border-b border-amber-50">
                        <td className="px-2 py-2 text-xs text-slate-700">{item.metadata?.roastProfile ?? '—'}</td>
                        <td className="px-2 py-2 text-xs text-slate-700">{item.metadata?.roastDate ?? '—'}</td>
                        <td className="px-2 py-2 font-mono text-xs text-slate-700">{item.publicCode}</td>
                        <td className="px-2 py-2"><StatusBadge status={item.status} /></td>
                        <td className="px-2 py-2 text-xs text-slate-600">
                          {item.evidenceHash ? 'Đã có minh chứng' : 'Chưa có minh chứng'}
                          {item.evidenceUri && (
                            <a
                              href={toEvidenceUrl(item.evidenceUri)}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-2 text-amber-700 underline-offset-2 hover:underline"
                            >
                              Xem
                            </a>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <Link
                            href={`/dashboard/roaster/update?batchId=${encodeURIComponent(item.batchId)}`}
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

              {totalPages > 1 && (
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
              )}
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
