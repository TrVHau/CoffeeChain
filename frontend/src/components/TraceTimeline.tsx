'use client';

import { useState } from 'react';
import type { BatchResponse, FarmActivityItem, LedgerRefItem } from '@/lib/api/types';
import { EvidenceVerifier } from '@/components/EvidenceVerifier';

interface TraceTimelineProps {
  /** Tất cả các batch: [...parentChain, batch] đã sắp xếp oldest → newest */
  batches:        BatchResponse[];
  farmActivities: FarmActivityItem[];
  ledgerRefs:     LedgerRefItem[];
}

// ─── Config hiển thị ────────────────────────────────────────────────────────

const STEP_ICONS: Record<string, string> = {
  HARVEST:   '🌱',
  PROCESSED: '🌿',
  ROAST:     '🔥',
  PACKAGED:  '📦',
};

const STEP_LABELS: Record<string, string> = {
  HARVEST:   'THU HOẠCH',
  PROCESSED: 'SƠ CHẾ',
  ROAST:     'RANG',
  PACKAGED:  'ĐÓNG GÓI',
};

const METADATA_LABELS: Record<string, string> = {
  farmLocation:          'Vùng trồng',
  harvestDate:           'Ngày thu hoạch',
  coffeeVariety:         'Giống cà phê',
  weightKg:              'Trọng lượng (kg)',
  processingMethod:      'Phương pháp sơ chế',
  startDate:             'Bắt đầu',
  endDate:               'Kết thúc',
  facilityName:          'Cơ sở sơ chế',
  roastProfile:          'Profile rang',
  roastDate:             'Ngày rang',
  roastDurationMinutes:  'Thời gian rang (phút)',
  packageWeight:         'Trọng lượng gói (kg)',
  packageDate:           'Ngày đóng gói',
  expiryDate:            'Hạn sử dụng',
  packageCount:          'Số lượng gói',
};

const ACTIVITY_ICONS: Record<string, string> = {
  WATERING:    '🚿',
  FERTILIZING: '🌿',
  PESTICIDE:   '🐛',
  PRUNING:     '✂️',
  HARVESTING:  '🌾',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getActivityIcon(type: string): string {
  return ACTIVITY_ICONS[type.toUpperCase()] ?? '📋';
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Tìm LedgerRefItem khớp nhất theo eventName + thời gian gần nhất với createdAt.
 * Dùng để hiển thị txId / blockNumber cho từng bước.
 */
function findLedgerRef(
  ledgerRefs: LedgerRefItem[],
  eventName: string,
  createdAt: string,
): LedgerRefItem | undefined {
  const target     = new Date(createdAt).getTime();
  const candidates = ledgerRefs.filter((r) => r.eventName === eventName);
  if (candidates.length === 0) return undefined;
  return candidates.reduce((best, cur) => {
    const bestDiff = Math.abs(new Date(best.createdAt).getTime() - target);
    const curDiff  = Math.abs(new Date(cur.createdAt).getTime()  - target);
    return curDiff < bestDiff ? cur : best;
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FarmActivityLog({ activities }: { activities: FarmActivityItem[] }) {
  const [open, setOpen] = useState(false);
  if (activities.length === 0) return null;

  return (
    <div className="mt-3 border-l-2 border-green-200 pl-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-sm font-medium text-green-700 hover:text-green-900"
      >
        🌾 Nhật ký canh tác ({activities.length} sự kiện)
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <ul className="mt-2 space-y-2">
          {activities.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5">{getActivityIcon(a.activityType)}</span>
              <div>
                <span className="text-gray-500">[{a.activityDate}]</span>{' '}
                <span className="font-medium">{a.activityType}</span>
                {a.note && (
                  <span className="text-gray-600"> — {a.note}</span>
                )}
                {a.txId && (
                  <span className="ml-2 font-mono text-xs text-blue-500">
                    tx: {a.txId.slice(0, 8)}…
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

// ─── Main component ──────────────────────────────────────────────────────────

export function TraceTimeline({ batches, farmActivities, ledgerRefs }: TraceTimelineProps) {
  // Hiển thị newest first (đảo ngược)
  const steps = [...batches].reverse();

  return (
    <div className="relative">
      {steps.map((batch, idx) => {
        const icon      = STEP_ICONS[batch.type]  ?? '📋';
        const label     = STEP_LABELS[batch.type] ?? batch.type;
        const isLast    = idx === steps.length - 1;
        const ledgerRef = findLedgerRef(ledgerRefs, 'BATCH_CREATED', batch.createdAt);

        return (
          <div key={batch.batchId} className="flex gap-4">
            {/* Timeline: dot + vertical line */}
            <div className="flex flex-col items-center">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl shadow-sm">
                {icon}
              </div>
              {!isLast && (
                <div className="my-1 w-0.5 flex-1 bg-amber-200" />
              )}
            </div>

            {/* Content */}
            <div className="pb-6 flex-1 min-w-0">
              {/* Header */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-amber-900">{label}</span>
                <span className="text-sm text-gray-500">
                  {formatDate(batch.updatedAt)}
                </span>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 border border-amber-200">
                  {batch.ownerUserId}
                </span>
                <span className="text-xs text-gray-400">{batch.ownerMsp}</span>
              </div>

              {/* Metadata key-value */}
              {batch.metadata && Object.keys(batch.metadata).length > 0 && (
                <dl className="mt-1 grid grid-cols-1 gap-y-0.5 text-sm sm:grid-cols-2">
                  {Object.entries(batch.metadata).map(([k, v]) => (
                    <div key={k} className="flex gap-1">
                      <dt className="text-gray-400">{METADATA_LABELS[k] ?? k}:</dt>
                      <dd className="text-gray-700">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {/* EvidenceVerifier — chỉ cho bước ROAST */}
              {batch.type === 'ROAST' && batch.evidenceHash && (
                <EvidenceVerifier
                  batchId={batch.batchId}
                  onChainHash={batch.evidenceHash}
                  evidenceUri={batch.evidenceUri ?? undefined}
                />
              )}

              {/* Farm activity log — chỉ cho bước HARVEST */}
              {batch.type === 'HARVEST' && (
                <FarmActivityLog activities={farmActivities} />
              )}

              {/* Ledger reference */}
              {ledgerRef && (
                <p className="mt-1 text-xs text-gray-400">
                  Block #{ledgerRef.blockNumber}{' · '}
                  <span className="font-mono">{ledgerRef.txId.slice(0, 8)}…</span>
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
