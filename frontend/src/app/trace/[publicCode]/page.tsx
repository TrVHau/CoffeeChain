'use client';

import { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { apiClient } from '@/lib/api/client';
import type { TraceResponse, BatchResponse } from '@/lib/api/types';
import { TraceTimeline } from '@/components/TraceTimeline';

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

const STATUS_LABELS: Record<string, string> = {
  CREATED: 'Đã tạo',
  IN_PROCESS: 'Đang xử lý',
  COMPLETED: 'Hoàn thành',
  TRANSFER_PENDING: 'Đang chuyển giao',
  TRANSFERRED: 'Đã chuyển giao',
  IN_STOCK: 'Trong kho',
  SOLD: 'Đã bán',
};

const STATUS_COLORS: Record<string, string> = {
  CREATED: 'bg-slate-100 text-slate-700',
  IN_PROCESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  TRANSFER_PENDING: 'bg-amber-100 text-amber-700',
  TRANSFERRED: 'bg-violet-100 text-violet-700',
  IN_STOCK: 'bg-cyan-100 text-cyan-700',
  SOLD: 'bg-red-100 text-red-800',
};

export default function TracePage({ params }: { params: { publicCode: string } }) {
  const { publicCode } = params;

  const [data, setData] = useState<TraceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function fetchTrace() {
      setLoading(true);
      setNotFound(false);
      setError('');
      try {
        const res = await apiClient.get<TraceResponse>(`/api/trace/${encodeURIComponent(publicCode)}`);
        if (!cancelled) setData(res.data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AxiosError && err.response?.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu truy xuất.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchTrace();
    return () => {
      cancelled = true;
    };
  }, [publicCode]);

  const batches: BatchResponse[] = data ? [...data.parentChain, data.batch] : [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-stone-50 px-4 py-12">
      <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white/90 p-6 shadow-lg backdrop-blur">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-stone-900">Truy xuất nguồn gốc</h1>
          <p className="mt-1 text-sm text-slate-500">
            Mã sản phẩm: <span className="font-mono font-semibold text-amber-800">{publicCode}</span>
          </p>
          {data && (
            <span
              className={`mt-2 inline-block rounded-full px-3 py-0.5 text-xs font-medium ${STATUS_COLORS[data.batch.status] ?? 'bg-slate-100 text-slate-700'
                }`}
            >
              {STATUS_LABELS[data.batch.status] ?? data.batch.status}
            </span>
          )}
        </div>

        <hr className="mb-6 border-amber-100" />

        {loading && <TraceSkeleton />}

        {!loading && notFound && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center">
            <p className="text-lg font-semibold text-red-700">Không tìm thấy sản phẩm</p>
            <p className="mt-1 text-sm text-slate-500">
              Mã <span className="font-mono">{publicCode}</span> không tồn tại trong hệ thống.
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-6 py-8 text-center">
            <p className="text-base font-semibold text-orange-700">Lỗi kết nối</p>
            <p className="mt-1 text-sm text-slate-600">{error}</p>
          </div>
        )}

        {!loading && data && (
          <TraceTimeline batches={batches} farmActivities={data.farmActivities} ledgerRefs={data.ledgerRefs} />
        )}

        <p className="mt-10 text-center text-xs text-slate-400">
          Dữ liệu được xác thực bởi Hyperledger Fabric và không thể chỉnh sửa sau khi ghi nhận.
        </p>
      </div>
    </main>
  );
}
