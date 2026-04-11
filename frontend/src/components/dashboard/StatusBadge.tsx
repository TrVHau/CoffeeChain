import type { BatchStatus } from '@/lib/api/types';

const STATUS_STYLES: Record<BatchStatus, string> = {
  CREATED: 'bg-slate-100 text-slate-700 border-slate-200',
  IN_PROCESS: 'bg-amber-100 text-amber-800 border-amber-200',
  COMPLETED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  TRANSFER_PENDING: 'bg-orange-100 text-orange-700 border-orange-200',
  TRANSFERRED: 'bg-stone-200 text-stone-700 border-stone-300',
  IN_STOCK: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  SOLD: 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_LABELS: Record<BatchStatus, string> = {
  CREATED: 'Đã tạo',
  IN_PROCESS: 'Đang xử lý',
  COMPLETED: 'Hoàn thành',
  TRANSFER_PENDING: 'Đang chuyển giao',
  TRANSFERRED: 'Đã chuyển giao',
  IN_STOCK: 'Trong kho',
  SOLD: 'Đã bán',
};

const STATUS_ICONS: Record<BatchStatus, string> = {
  CREATED: 'M12 4v16M4 12h16',
  IN_PROCESS: 'M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8',
  COMPLETED: 'M5 12l4 4 10-10',
  TRANSFER_PENDING: 'M5 12h14M13 8l4 4-4 4',
  TRANSFERRED: 'M5 12h14M11 8l-4 4 4 4M13 8l4 4-4 4',
  IN_STOCK: 'M4 8h16v10H4zM9 8V6a3 3 0 0 1 6 0v2',
  SOLD: 'M5 5l14 14M19 5 5 19',
};

export function StatusBadge({ status }: { status: BatchStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mr-1 h-3.5 w-3.5" aria-hidden="true">
        <path d={STATUS_ICONS[status]} />
      </svg>
      {STATUS_LABELS[status]}
    </span>
  );
}
