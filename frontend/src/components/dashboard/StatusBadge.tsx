import type { BatchStatus } from '@/lib/api/types';

const STATUS_STYLES: Record<BatchStatus, string> = {
  CREATED: 'bg-slate-100 text-slate-700 border-slate-200',
  IN_PROCESS: 'bg-blue-100 text-blue-700 border-blue-200',
  COMPLETED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  TRANSFER_PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
  TRANSFERRED: 'bg-violet-100 text-violet-700 border-violet-200',
  IN_STOCK: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  SOLD: 'bg-rose-100 text-rose-700 border-rose-200',
};

const STATUS_LABELS: Record<BatchStatus, string> = {
  CREATED: 'Da tao',
  IN_PROCESS: 'Dang xu ly',
  COMPLETED: 'Hoan thanh',
  TRANSFER_PENDING: 'Cho chuyen giao',
  TRANSFERRED: 'Da chuyen giao',
  IN_STOCK: 'Trong kho',
  SOLD: 'Da ban',
};

export function StatusBadge({ status }: { status: BatchStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
