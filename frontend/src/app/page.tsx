'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QrScanner } from '@/components/QrScanner';

type FeedItemType = 'EVIDENCE' | 'TRANSACTION' | 'BLOCK';
type TraceStage = 'HARVEST' | 'PROCESSED' | 'ROAST' | 'PACKAGED' | 'RETAIL';
type TypeFilter = 'ALL' | FeedItemType;
type StageFilter = 'ALL' | TraceStage;

interface PublicFeedItem {
  id: string;
  publicCode: string;
  type: FeedItemType;
  traceStage?: TraceStage;
  title: string;
  subtitle: string;
  txId: string;
  blockNumber: number;
  updatedAt: string;
}

interface PublicFeedResponse {
  generatedAt: string;
  stats: {
    totalItems: number;
    totalTransactions: number;
    totalEvidenceUploads: number;
    latestBlockNumber: number;
  };
  items: PublicFeedItem[];
}

const TYPE_BADGE: Record<FeedItemType, string> = {
  EVIDENCE: 'bg-emerald-100 text-emerald-700',
  TRANSACTION: 'bg-blue-100 text-blue-700',
  BLOCK: 'bg-amber-100 text-amber-800',
};

const TYPE_LABEL: Record<FeedItemType, string> = {
  EVIDENCE: 'Minh chứng',
  TRANSACTION: 'Giao dịch',
  BLOCK: 'Cập nhật block',
};

const TYPE_ICON: Record<FeedItemType, string> = {
  EVIDENCE: '🧾',
  TRANSACTION: '🔁',
  BLOCK: '🧱',
};

const STAGE_ICON: Record<TraceStage, string> = {
  HARVEST: '🌱',
  PROCESSED: '🌿',
  ROAST: '🔥',
  PACKAGED: '📦',
  RETAIL: '🏪',
};

function getItemIcon(item: PublicFeedItem): string {
  if (item.traceStage && STAGE_ICON[item.traceStage]) {
    return STAGE_ICON[item.traceStage];
  }
  return TYPE_ICON[item.type];
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} ngày trước`;
}

function buildPages(totalPages: number): number[] {
  return Array.from({ length: totalPages }, (_, i) => i + 1);
}

function paginate(items: PublicFeedItem[], page: number, pageSize: number): PublicFeedItem[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export default function HomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [feed, setFeed] = useState<PublicFeedResponse | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [stageFilter, setStageFilter] = useState<StageFilter>('ALL');
  const [evidencePage, setEvidencePage] = useState(1);
  const [transactionPage, setTransactionPage] = useState(1);

  const PAGE_SIZE = 6;

  useEffect(() => {
    let cancelled = false;

    async function fetchFeed() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/public-feed', { cache: 'no-store' });
        if (!res.ok) throw new Error('Không thể tải danh sách cập nhật hệ thống.');
        const data = (await res.json()) as PublicFeedResponse;
        if (!cancelled) setFeed(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchFeed();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return (feed?.items ?? []).filter((item) => {
      const matchesType = typeFilter === 'ALL' ? true : item.type === typeFilter;
      const matchesStage = stageFilter === 'ALL' ? true : item.traceStage === stageFilter;
      const matchesKeyword = keyword
        ? item.publicCode.toLowerCase().includes(keyword)
          || item.title.toLowerCase().includes(keyword)
          || item.txId.toLowerCase().includes(keyword)
        : true;

      return matchesType && matchesStage && matchesKeyword;
    });
  }, [feed, search, typeFilter, stageFilter]);

  const latestEvidenceAndBlocks = useMemo(
    () => filteredItems.filter((item) => item.type !== 'TRANSACTION'),
    [filteredItems],
  );

  const latestTransactions = useMemo(
    () => filteredItems.filter((item) => item.type === 'TRANSACTION'),
    [filteredItems],
  );

  useEffect(() => {
    setEvidencePage(1);
    setTransactionPage(1);
  }, [search, typeFilter, stageFilter]);

  const evidenceTotalPages = Math.max(1, Math.ceil(latestEvidenceAndBlocks.length / PAGE_SIZE));
  const transactionTotalPages = Math.max(1, Math.ceil(latestTransactions.length / PAGE_SIZE));

  const evidenceItems = paginate(latestEvidenceAndBlocks, evidencePage, PAGE_SIZE);
  const transactionItems = paginate(latestTransactions, transactionPage, PAGE_SIZE);

  return (
    <main className="min-h-screen bg-amber-50 pb-10">
      <header className="border-b border-amber-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">CoffeeChain Public Trace</p>
            <h1 className="text-xl font-bold text-amber-900 md:text-2xl">☕ Danh sách minh chứng và giao dịch toàn hệ thống</h1>
          </div>
          <Link
            href="/login"
            className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
          >
            Login
          </Link>
        </div>
      </header>

      <section className="mx-auto mt-5 grid w-full max-w-6xl grid-cols-1 gap-3 px-4 md:grid-cols-4 md:px-6">
        <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-amber-700">📚 Tổng bản ghi cập nhật</p>
          <p className="mt-1 text-2xl font-bold text-amber-900">{feed?.stats.totalItems ?? '-'}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-amber-700">🔁 Giao dịch mới</p>
          <p className="mt-1 text-2xl font-bold text-amber-900">{feed?.stats.totalTransactions ?? '-'}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-amber-700">🧾 Upload minh chứng</p>
          <p className="mt-1 text-2xl font-bold text-amber-900">{feed?.stats.totalEvidenceUploads ?? '-'}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-amber-700">🧱 Block mới nhất</p>
          <p className="mt-1 text-2xl font-bold text-amber-900">#{feed?.stats.latestBlockNumber ?? '-'}</p>
        </div>
      </section>

      <section className="mx-auto mt-3 w-full max-w-6xl px-4 md:px-6">
        <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-900">📷 Tìm sản phẩm bằng QR</p>
              <p className="text-xs text-gray-500">Không cần đăng nhập để quét và mở trang trace.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowScanner((prev) => !prev)}
              className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800"
            >
              {showScanner ? 'Ẩn QR Scanner' : 'Quét QR'}
            </button>
          </div>
          {showScanner && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <QrScanner />
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto mt-3 w-full max-w-6xl px-4 md:px-6">
        <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-amber-900">🔎 Bộ lọc dữ liệu</p>
            <p className="text-xs text-gray-500">Kết quả: {filteredItems.length} bản ghi</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo mã, tiêu đề, tx..."
              className="rounded-lg border border-amber-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="rounded-lg border border-amber-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            >
              <option value="ALL">Tất cả loại sự kiện</option>
              <option value="EVIDENCE">Minh chứng</option>
              <option value="TRANSACTION">Giao dịch</option>
              <option value="BLOCK">Cập nhật block</option>
            </select>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value as StageFilter)}
              className="rounded-lg border border-amber-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            >
              <option value="ALL">Tất cả stage</option>
              <option value="HARVEST">HARVEST</option>
              <option value="PROCESSED">PROCESSED</option>
              <option value="ROAST">ROAST</option>
              <option value="PACKAGED">PACKAGED</option>
              <option value="RETAIL">RETAIL</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setTypeFilter('ALL');
                setStageFilter('ALL');
              }}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"
            >
              Reset filter
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-3 grid w-full max-w-6xl grid-cols-1 gap-4 px-4 md:grid-cols-2 md:px-6">
        <article className="rounded-2xl border border-amber-200 bg-white shadow-sm">
          <div className="border-b border-amber-200 px-4 py-3">
            <h2 className="text-base font-bold text-amber-900">🌿 Latest Evidence and Block Updates</h2>
          </div>

          {loading && <p className="px-4 py-8 text-sm text-gray-500">Đang tải dữ liệu cập nhật...</p>}
          {!loading && error && <p className="px-4 py-8 text-sm text-rose-600">{error}</p>}

          {!loading && !error && (
            <>
              {latestEvidenceAndBlocks.length === 0 ? (
                <p className="px-4 py-8 text-sm text-gray-500">Không có dữ liệu phù hợp bộ lọc.</p>
              ) : (
                <>
                  <ul className="divide-y divide-amber-100">
                    {evidenceItems.map((item) => (
                      <li key={item.id} className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => router.push(`/trace/${encodeURIComponent(item.publicCode)}`)}
                          className="w-full rounded-lg p-2 text-left transition hover:bg-amber-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex gap-2">
                              <span className="mt-0.5 text-lg">{getItemIcon(item)}</span>
                              <div>
                                <p className="text-sm font-semibold text-amber-900">{item.title}</p>
                                <p className="mt-0.5 text-xs text-gray-500">{item.subtitle}</p>
                                <p className="mt-1 text-xs text-gray-500">
                                  Trace: <span className="font-mono text-amber-700">{item.publicCode}</span> • Tx: <span className="font-mono text-amber-700">{item.txId.slice(0, 12)}...</span> • Block #{item.blockNumber}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${TYPE_BADGE[item.type]}`}>
                                {TYPE_LABEL[item.type]}
                              </span>
                              <p className="mt-2 text-xs text-gray-400">{formatRelativeTime(item.updatedAt)}</p>
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-100 px-4 py-3">
                    <p className="text-xs text-gray-500">Trang {evidencePage}/{evidenceTotalPages}</p>
                    <div className="flex flex-wrap gap-1">
                      {buildPages(evidenceTotalPages).map((pageNumber) => (
                        <button
                          key={`evidence-${pageNumber}`}
                          type="button"
                          onClick={() => setEvidencePage(pageNumber)}
                          className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                            evidencePage === pageNumber
                              ? 'border-amber-600 bg-amber-600 text-white'
                              : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </article>

        <article className="rounded-2xl border border-amber-200 bg-white shadow-sm">
          <div className="border-b border-amber-200 px-4 py-3">
            <h2 className="text-base font-bold text-amber-900">🔥 Latest Transactions</h2>
          </div>

          {loading && <p className="px-4 py-8 text-sm text-gray-500">Đang tải dữ liệu giao dịch...</p>}
          {!loading && error && <p className="px-4 py-8 text-sm text-rose-600">{error}</p>}

          {!loading && !error && (
            <>
              {latestTransactions.length === 0 ? (
                <p className="px-4 py-8 text-sm text-gray-500">Không có dữ liệu phù hợp bộ lọc.</p>
              ) : (
                <>
                  <ul className="divide-y divide-amber-100">
                    {transactionItems.map((item) => (
                      <li key={item.id} className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => router.push(`/trace/${encodeURIComponent(item.publicCode)}`)}
                          className="w-full rounded-lg p-2 text-left transition hover:bg-amber-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex gap-2">
                              <span className="mt-0.5 text-lg">{getItemIcon(item)}</span>
                              <div>
                                <p className="text-sm font-semibold text-amber-900">{item.title}</p>
                                <p className="mt-0.5 text-xs text-gray-500">{item.subtitle}</p>
                                <p className="mt-1 text-xs text-gray-500">
                                  Trace: <span className="font-mono text-amber-700">{item.publicCode}</span> • Tx: <span className="font-mono text-amber-700">{item.txId.slice(0, 12)}...</span> • Block #{item.blockNumber}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${TYPE_BADGE[item.type]}`}>
                                {TYPE_LABEL[item.type]}
                              </span>
                              <p className="mt-2 text-xs text-gray-400">{formatRelativeTime(item.updatedAt)}</p>
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-100 px-4 py-3">
                    <p className="text-xs text-gray-500">Trang {transactionPage}/{transactionTotalPages}</p>
                    <div className="flex flex-wrap gap-1">
                      {buildPages(transactionTotalPages).map((pageNumber) => (
                        <button
                          key={`transaction-${pageNumber}`}
                          type="button"
                          onClick={() => setTransactionPage(pageNumber)}
                          className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                            transactionPage === pageNumber
                              ? 'border-amber-600 bg-amber-600 text-white'
                              : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </article>
      </section>

      <p className="mx-auto mt-5 w-full max-w-6xl px-4 text-xs text-gray-500 md:px-6">
        Đăng nhập sẽ chuyển sang khu vực thao tác nghiệp vụ dashboard (phần việc người 4) như luồng cũ.
      </p>
    </main>
  );
}
