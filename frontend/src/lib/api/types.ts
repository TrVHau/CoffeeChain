/**
 * Frontend API types aligned with backend openapi.yaml and response DTOs.
 */

export type BatchType =
  | 'HARVEST'
  | 'PROCESSED'
  | 'ROAST'
  | 'PACKAGED';

export type BatchStatus =
  | 'CREATED'
  | 'IN_PROCESS'
  | 'COMPLETED'
  | 'TRANSFER_PENDING'
  | 'TRANSFERRED'
  | 'IN_STOCK'
  | 'SOLD';

export interface AuthResponse {
  token: string;
  userId: string;
  role: string;
  org: string;
}

export interface BatchResponse {
  batchId: string;
  publicCode: string;
  type: BatchType;
  status: BatchStatus;
  parentBatchId: string | null;
  ownerMsp: string;
  ownerUserId: string;
  pendingToMsp: string | null;
  evidenceHash: string | null;
  evidenceUri: string | null;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, string>;
}

export interface FarmActivityItem {
  activityType: string;
  activityDate: string;
  note: string;
  evidenceHash: string;
  evidenceUri: string;
  recordedBy?: string;
  recordedAt?: string;
  txId?: string;
  blockNumber?: number;
}

export interface LedgerRefItem {
  eventName: string;
  txId: string;
  blockNumber: number;
  createdAt: string;
}

export interface TraceResponse {
  batch: BatchResponse;
  parentChain: BatchResponse[];
  farmActivities: FarmActivityItem[];
  ledgerRefs: LedgerRefItem[];
}

export interface TraceStep {
  batchType: BatchType;
  date: string;
  actor: string;
  metadata: Record<string, string>;
  txId?: string;
  blockNumber?: number;
  evidenceHash?: string | null;
  evidenceUri?: string | null;
}
