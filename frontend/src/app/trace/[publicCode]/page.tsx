'use client';

import { useEffect, useState } from 'react';
import { TraceService, ApiError } from '@/lib/api/generated';
import type { TraceResponse, BatchResponse } from '@/lib/api/types';
import { TraceTimeline } from '@/components/TraceTimeline';
// client.ts imported for side-effects: configures OpenAPI.BASE + OpenAPI.TOKEN
import '@/lib/api/client';

// ─── Loading skeleton ────────────────────────────────────────────────────────

function TraceSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-amber-200" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 w-1/3 rounded bg-amber-200" />
            <div className="h-3 w-2/3 rounded bg-amber-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Status badge ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  CREATED:          'Đã tạo',
  IN_PROCESS:       'Đang xử lý',
  COMPLETED:        'Hoàn thành',
  TRANSFER_PENDING: 'Chờ chuyển giao',
  TRANSFERRED:      'Đã chuyển giao',
  IN_STOCK:         'Trong kho',
  SOLD:             'Đã bán',
};

const STATUS_COLORS: Record<string, string> = {
  CREATED:          'bg-gray-100 text-gray-700',
  IN_PROCESS:       'bg-blue-100 text-blue-700',
  COMPLETED:        'bg-green-100 text-green-700',
  TRANSFER_PENDING: 'bg-yellow-100 text-yellow-700',
  TRANSFERRED:      'bg-purple-100 text-purple-700',
  IN_STOCK:         'bg-teal-100 text-teal-700',
  SOLD:             'bg-amber-100 text-amber-800',
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function TracePage({
  params,
}: {
  params: { publicCode: string };
}) {
  const { publicCode } = params;

  const [data,    setData]    = useState<TraceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    // CancelablePromise.cancel() dừng request khi component unmount
    let request: ReturnType<typeof TraceService.getApiTrace> | null = null;
    let cancelled = false;

    async function fetchTrace() {
      setLoading(true);
      setNotFound(false);
      setError('');
      try {
        // /api/trace/{publicCode} không yêu cầu auth (security: [] trong openapi.yaml)
        request = TraceService.getApiTrace(publicCode);
        const data = (await request) as unknown as TraceResponse;
        if (!cancelled) setData(data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(
            err instanceof Error ? err.message : 'Không thể tải dữ liệu truy xuất.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchTrace();
    return () => {
      cancelled = true;
      request?.cancel();
    };
  }, [publicCode]);

  // ─── Build batches array: parentChain (oldest→newest) + batch (newest) ───
  const batches: BatchResponse[] = data
    ? [...data.parentChain, data.batch]
    : [];

  return (
    <main className="min-h-screen bg-amber-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-amber-800">☕ Truy Xuất Nguồn Gốc</h1>
          <p className="mt-1 text-sm text-gray-500">
            Mã sản phẩm:{' '}
            <span className="font-mono font-semibold text-amber-700">{publicCode}</span>
          </p>
          {data && (
            <span
              className={`mt-2 inline-block rounded-full px-3 py-0.5 text-xs font-medium ${
                STATUS_COLORS[data.batch.status] ?? 'bg-gray-100 text-gray-700'
              }`}
            >
              {STATUS_LABELS[data.batch.status] ?? data.batch.status}
            </span>
          )}
        </div>

        {/* Divider */}
        <hr className="mb-6 border-amber-200" />

        {/* Loading */}
        {loading && <TraceSkeleton />}

        {/* Not found */}
        {!loading && notFound && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center">
            <p className="text-lg font-semibold text-red-700">Không tìm thấy sản phẩm</p>
            <p className="mt-1 text-sm text-gray-500">
              Mã <span className="font-mono">{publicCode}</span> không tồn tại trong hệ thống.
            </p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-6 py-8 text-center">
            <p className="text-base font-semibold text-orange-700">⚠️ Lỗi kết nối</p>
            <p className="mt-1 text-sm text-gray-500">{error}</p>
          </div>
        )}

        {/* Timeline */}
        {!loading && data && (
          <TraceTimeline
            batches={batches}
            farmActivities={data.farmActivities}
            ledgerRefs={data.ledgerRefs}
          />
        )}

        {/* Footer */}
        <p className="mt-10 text-center text-xs text-gray-400">
          🔗 Dữ liệu được xác thực bởi Hyperledger Fabric — không thể chỉnh sửa sau khi ghi nhận.
        </p>
      </div>
    </main>
  );
}
