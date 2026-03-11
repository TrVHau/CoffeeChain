/**
 * Types aligned with openapi.yaml — Unit-2 v1.0.0 (merged)
 * Schema source: backend/src/main/resources/openapi.yaml
 * To regenerate from spec: npm run generate:api
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

/** POST /api/auth/login → 200 */
export interface AuthResponse {
  token:  string;
  userId: string;
  role:   string;
  org:    string;
}

/** Batch record returned from PostgreSQL index (GET /api/batches, /api/batch/{id}) */
export interface BatchResponse {
  batchId:       string;
  publicCode:    string;
  type:          BatchType;
  status:        BatchStatus;
  parentBatchId: string | null;
  ownerMsp:      string;          // Org1MSP | Org2MSP
  ownerUserId:   string;
  pendingToMsp:  string | null;
  evidenceHash:  string | null;
  evidenceUri:   string | null;
  createdAt:     string;          // ISO-8601
  updatedAt:     string;
  metadata?:     Record<string, string>; // jsonb from EventIndexer
}

/** Farm activity from FARM_ACTIVITY_RECORDED event (EventIndexer) */
export interface FarmActivityItem {
  activityType: string;
  activityDate: string;   // format: YYYY-MM-DD
  note:         string;
  evidenceHash: string;
  evidenceUri:  string;
  // Populated by EventIndexer — present if backend includes them
  txId?:        string;
  blockNumber?: string;
}

/** Fabric ledger event reference stored by EventIndexer */
export interface LedgerRefItem {
  eventName:   string;
  txId:        string;
  blockNumber: number;
  createdAt:   string;  // ISO-8601
}

/** GET /api/trace/{publicCode} → 200 */
export interface TraceResponse {
  batch:          BatchResponse;      // The queried batch (usually PACKAGED)
  parentChain:    BatchResponse[];    // Parent batches oldest → newest
  farmActivities: FarmActivityItem[];
  ledgerRefs:     LedgerRefItem[];
}

/** Internal — used by TraceTimeline to represent a rendered step */
export interface TraceStep {
  batchType:     BatchType;
  date:          string;
  actor:         string;
  metadata:      Record<string, string>;
  txId?:         string;
  blockNumber?:  number;
  evidenceHash?: string | null;
  evidenceUri?:  string | null;
}
