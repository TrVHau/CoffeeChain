/**
 * App-level types — aligned with lib/api/generated/ (openapi-typescript-codegen).
 * Source: backend/src/main/resources/openapi.yaml | Re-generate: npm run generate:api
 *
 * Design: stricter than generated (required fields, typed enums vs all-optional strings).
 * Components import from here. Generated/ used for service calls (TraceService, etc.).
 */

// ─── Enums ───────────────────────────────────────────────────────────────
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

// ─── Core types (aligned with generated/models/) ──────────────────────────────
/** POST /api/auth/login → 200 (aligned with generated/models/AuthResponse) */
export interface AuthResponse {
  token:  string;
  userId: string;
  role:   string;
  org:    string;
}

/** BatchResponse with strict enum types + EventIndexer metadata (Unit-3) */
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
  metadata?:     Record<string, string>; // EventIndexer jsonb (Unit-3)
}

/** FarmActivityItem + EventIndexer ledger ref fields (Unit-3) */
export interface FarmActivityItem {
  activityType: string;
  activityDate: string;   // YYYY-MM-DD
  note:         string;
  evidenceHash: string;
  evidenceUri:  string;
  recordedBy?:  string;
  recordedAt?:  string;
  txId?:        string;   // EventIndexer
  blockNumber?: number;   // EventIndexer
}

/** LedgerRefItem (aligned with generated/models/LedgerRefItem) */
export interface LedgerRefItem {
  eventName:   string;
  txId:        string;
  blockNumber: number;
  createdAt:   string;  // ISO-8601
}

// ─── Composite types ────────────────────────────────────────────────────────────────/** GET /api/trace/{publicCode} → 200 (aligned with generated/models/TraceResponse) */
export interface TraceResponse {
  batch:          BatchResponse;
  parentChain:    BatchResponse[];
  farmActivities: FarmActivityItem[];
  ledgerRefs:     LedgerRefItem[];
}

/** Internal — used by TraceTimeline to render a single step */
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
