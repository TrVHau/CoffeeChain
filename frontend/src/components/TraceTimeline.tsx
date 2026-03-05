// TODO Week 2: Implement full TraceTimeline
// Reference: docs/06_frontend_qr.md — wireframe + component interface

import type { BatchResponse, FarmActivity, LedgerRef } from '@/lib/api/types';

interface TraceTimelineProps {
  chain:          BatchResponse[];
  farmActivities: FarmActivity[];
  ledgerRefs:     Record<string, LedgerRef>;
}

export function TraceTimeline(_props: TraceTimelineProps) {
  // TODO Week 2:
  // - buildSteps(chain, ledgerRefs) → TraceStep[]
  // - Render từng step: icon + date + actor + metadata
  // - Step ROAST → <EvidenceVerifier onChainHash evidenceUri />
  // - Step HARVEST → <FarmActivityLog activities farmActivities />
  // - Footer: Block # | TxId (8 ký tự)
  return (
    <div className="trace-timeline space-y-4">
      <p className="text-center text-sm text-gray-400">
        TraceTimeline — Tuần 2
      </p>
    </div>
  );
}
