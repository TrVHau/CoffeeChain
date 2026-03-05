/**
 * Temporary manual types — sẽ được thay thế bằng generated code từ openapi.yaml
 * Chạy: npm run generate:api  (sau khi Unit-2 publish openapi.yaml)
 *
 * Source: docs/03_data_model.md
 */

export type BatchType   = 'HARVEST' | 'PROCESSED' | 'ROAST' | 'PACKAGED';
export type BatchStatus =
  | 'CREATED'
  | 'IN_PROCESS'
  | 'COMPLETED'
  | 'TRANSFER_PENDING'
  | 'TRANSFERRED'
  | 'IN_STOCK'
  | 'SOLD';

export interface BatchResponse {
  batchId:       string;
  publicCode:    string;
  type:          BatchType;
  status:        BatchStatus;
  ownerMSP:      string;
  ownerUserId:   string;
  parentBatchId: string;
  pendingToMSP:  string;
  createdAt:     string;
  updatedAt:     string;
  evidenceHash:  string;
  evidenceUri:   string;
  metadata:      Record<string, string>;
}

export interface FarmActivity {
  id:              number;
  harvestBatchId:  string;
  activityType:    string;
  activityDate:    string;
  note:            string;
  evidenceHash:    string;
  txId:            string;
  blockNumber:     string;
}

export interface LedgerRef {
  batchId:     string;
  eventType:   string;
  txId:        string;
  blockNumber: string;
  createdAt:   string;
}

export interface TraceStep {
  type:          BatchType | 'RETAIL';
  date:          string;
  actor:         string;
  metadata:      Record<string, string>;
  txId?:         string;
  blockNum?:     string;
  evidenceHash?: string;
  evidenceUri?:  string;
}

export interface TraceResponse {
  publicCode:     string;
  chain:          BatchResponse[];
  farmActivities: FarmActivity[];
  ledgerRefs:     Record<string, LedgerRef>;
}
