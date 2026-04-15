'use client';

import { useState } from 'react';
import type { BatchResponse, FarmActivityItem, LedgerRefItem } from '@/lib/api/types';
import { EvidenceVerifier } from '@/components/EvidenceVerifier';

interface TraceTimelineProps {
  batches: BatchResponse[];
  farmActivities: FarmActivityItem[];
  ledgerRefs: LedgerRefItem[];
}

const STEP_ICONS: Record<string, string> = {
  HARVEST: '🌱',
  PROCESSED: '🌿',
  ROAST: '🔥',
  PACKAGED: '📦',
};

const STEP_LABELS: Record<string, string> = {
  HARVEST: 'THU HOẠCH',
  PROCESSED: 'SƠ CHẾ',
  ROAST: 'RANG',
  PACKAGED: 'ĐÓNG GÓI',
};

const METADATA_LABELS: Record<string, string> = {
  farmLocation: 'Vùng trồng',
  harvestDate: 'Ngày thu hoạch',
  coffeeVariety: 'Giống cà phê',
  weightKg: 'Trọng lượng (kg)',
  processingMethod: 'Phương pháp sơ chế',
  startDate: 'Bắt đầu',
  endDate: 'Kết thúc',
  facilityName: 'Cơ sở sơ chế',
  roastProfile: 'Profile rang',
  roastDate: 'Ngày rang',
  roastDurationMinutes: 'Thời gian rang (phút)',
  packageWeight: 'Trọng lượng gói',
  packageDate: 'Ngày đóng gói',
  packagedDate: 'Ngày đóng gói',
  expiryDate: 'Hạn sử dụng',
  packageCount: 'Số lượng gói',
};

const ACTIVITY_ICONS: Record<string, string> = {
  WATERING: '🚿',
  IRRIGATION: '🚿',
  FERTILIZING: '🌿',
  FERTILIZATION: '🌿',
  PESTICIDE: '🐛',
  PEST_CONTROL: '🐛',
  PRUNING: '✂️',
  SHADE_MANAGEMENT: '🌳',
  SOIL_TEST: '🧪',
  OTHER: '📝',
};

function getActivityIcon(type: string): string {
  return ACTIVITY_ICONS[type.toUpperCase()] ?? '📋';
}

function parseTime(value: string): number {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function compareActivitiesDesc(a: FarmActivityItem, b: FarmActivityItem): number {
  if (typeof a.blockNumber === 'number' && typeof b.blockNumber === 'number' && a.blockNumber !== b.blockNumber) {
    return b.blockNumber - a.blockNumber;
  }

  const aRecorded = a.recordedAt ? parseTime(a.recordedAt) : 0;
  const bRecorded = b.recordedAt ? parseTime(b.recordedAt) : 0;
  if (aRecorded !== bRecorded) {
    return bRecorded - aRecorded;
  }

  const aActivity = a.activityDate ? parseTime(a.activityDate) : 0;
  const bActivity = b.activityDate ? parseTime(b.activityDate) : 0;
  if (aActivity !== bActivity) {
    return bActivity - aActivity;
  }

  return (b.txId ?? '').localeCompare(a.txId ?? '');
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const time = parseTime(dateStr);
  if (time === 0) {
    return dateStr;
  }
  return new Date(time).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function findLedgerRef(
  ledgerRefs: LedgerRefItem[],
  eventName: string,
  createdAt: string,
): LedgerRefItem | undefined {
  const target = parseTime(createdAt);
  if (target === 0) return undefined;
  const candidates = ledgerRefs.filter((r) => r.eventName === eventName);
  if (candidates.length === 0) return undefined;
  return candidates.reduce((best, cur) => {
    const bestDiff = Math.abs(parseTime(best.createdAt) - target);
    const curDiff = Math.abs(parseTime(cur.createdAt) - target);
    return curDiff < bestDiff ? cur : best;
  });
}

function FarmActivityLog({ activities }: { activities: FarmActivityItem[] }) {
  const [open, setOpen] = useState(false);
  if (activities.length === 0) return null;
  const sortedActivities = [...activities].sort(compareActivitiesDesc);

  return (
    <div className="mt-3 border-l-2 border-rose-200 pl-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-sm font-medium text-rose-700 hover:text-rose-900"
      >
        🌾 Nhật ký canh tác ({activities.length} sự kiện)
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <ul className="mt-2 space-y-2">
          {sortedActivities.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5">{getActivityIcon(a.activityType)}</span>
              <div>
                <span className="text-slate-500">[{a.activityDate}]</span>{' '}
                <span className="font-medium">{a.activityType}</span>
                {a.note && <span className="text-slate-600"> - {a.note}</span>}
                {a.txId && (
                  <span className="ml-2 font-mono text-xs text-rose-600">
                    tx: {a.txId.slice(0, 8)}...
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TraceTimeline({ batches, farmActivities, ledgerRefs }: TraceTimelineProps) {
  const steps = [...batches].sort((left, right) => parseTime(right.createdAt) - parseTime(left.createdAt));

  return (
    <div className="relative">
      {steps.map((batch, idx) => {
        const icon = STEP_ICONS[batch.type] ?? '📋';
        const label = STEP_LABELS[batch.type] ?? batch.type;
        const isLast = idx === steps.length - 1;
        const ledgerRef = findLedgerRef(ledgerRefs, 'BATCH_CREATED', batch.createdAt);

        return (
          <div key={batch.batchId} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 text-xl shadow-sm">
                {icon}
              </div>
              {!isLast && <div className="my-1 w-0.5 flex-1 bg-rose-200" />}
            </div>

            <div className="min-w-0 flex-1 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-rose-900">{label}</span>
                <span className="text-sm text-slate-500">{formatDate(batch.updatedAt)}</span>
                <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
                  {batch.ownerUserId}
                </span>
                <span className="text-xs text-slate-400">{batch.ownerMsp}</span>
              </div>

              {batch.metadata && Object.keys(batch.metadata).length > 0 && (
                <dl className="mt-1 grid grid-cols-1 gap-y-0.5 text-sm sm:grid-cols-2">
                  {Object.entries(batch.metadata).map(([k, v]) => (
                    <div key={k} className="flex gap-1">
                      <dt className="text-slate-400">{METADATA_LABELS[k] ?? k}:</dt>
                      <dd className="text-slate-700">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {batch.evidenceHash && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-slate-500">Minh chứng công đoạn</p>
                  <EvidenceVerifier
                    batchId={batch.batchId}
                    onChainHash={batch.evidenceHash}
                    evidenceUri={batch.evidenceUri ?? undefined}
                  />
                </div>
              )}

              {batch.type === 'HARVEST' && <FarmActivityLog activities={farmActivities} />}

              {ledgerRef && (
                <p className="mt-1 text-xs text-slate-400">
                  Block #{ledgerRef.blockNumber} · <span className="font-mono">{ledgerRef.txId.slice(0, 8)}...</span>
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
