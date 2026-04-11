import { AxiosError } from 'axios';
import { apiClient } from './client';
import type {
  BatchResponse,
  BatchStatus,
  BatchType,
  FarmActivityItem,
  LedgerRefItem,
  TraceResponse,
} from './types';

const VALID_TYPES: BatchType[] = ['HARVEST', 'PROCESSED', 'ROAST', 'PACKAGED'];
const VALID_STATUSES: BatchStatus[] = [
  'CREATED',
  'IN_PROCESS',
  'COMPLETED',
  'TRANSFER_PENDING',
  'TRANSFERRED',
  'IN_STOCK',
  'SOLD',
];

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function normalizeMetadata(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const entries = Object.entries(value as Record<string, unknown>);
  return Object.fromEntries(entries.map(([k, v]) => [k, asString(v)]));
}

function normalizeType(raw: unknown): BatchType {
  const value = asString(raw).toUpperCase();
  return (VALID_TYPES.includes(value as BatchType) ? value : 'HARVEST') as BatchType;
}

function normalizeStatus(raw: unknown): BatchStatus {
  const value = asString(raw).toUpperCase();
  return (VALID_STATUSES.includes(value as BatchStatus) ? value : 'CREATED') as BatchStatus;
}

export function normalizeBatch(raw: unknown): BatchResponse {
  const row = (raw ?? {}) as Record<string, unknown>;
  const parent = asString(row.parentBatchId, '');

  return {
    batchId: asString(row.batchId),
    publicCode: asString(row.publicCode),
    type: normalizeType(row.type),
    status: normalizeStatus(row.status),
    parentBatchId: parent || null,
    ownerMsp: asString(row.ownerMsp ?? row.ownerMSP),
    ownerUserId: asString(row.ownerUserId),
    pendingToMsp: asString(row.pendingToMsp ?? row.pendingToMSP) || null,
    evidenceHash: asString(row.evidenceHash) || null,
    evidenceUri: asString(row.evidenceUri) || null,
    createdAt: asString(row.createdAt, new Date().toISOString()),
    updatedAt: asString(row.updatedAt, new Date().toISOString()),
    metadata: normalizeMetadata(row.metadata),
  };
}

function normalizeFarmActivity(raw: unknown): FarmActivityItem {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    activityType: asString(row.activityType),
    activityDate: asString(row.activityDate),
    note: asString(row.note),
    evidenceHash: asString(row.evidenceHash),
    evidenceUri: asString(row.evidenceUri),
    recordedBy: asString(row.recordedBy) || undefined,
    recordedAt: asString(row.recordedAt) || undefined,
    txId: asString(row.txId) || undefined,
    blockNumber: typeof row.blockNumber === 'number'
      ? row.blockNumber
      : Number.parseInt(asString(row.blockNumber), 10) || undefined,
  };
}

function normalizeLedgerRef(raw: unknown): LedgerRefItem {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    eventName: asString(row.eventName),
    txId: asString(row.txId),
    blockNumber: typeof row.blockNumber === 'number'
      ? row.blockNumber
      : Number.parseInt(asString(row.blockNumber), 10) || 0,
    createdAt: asString(row.createdAt),
  };
}

export function getApiErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<{ message?: string }>;
  if (error instanceof AxiosError || (typeof error === 'object' && error !== null && 'isAxiosError' in error)) {
    const data = axiosError.response?.data;
    if (data?.message) return data.message;
    if (axiosError.message) return axiosError.message;
  }
  if (error instanceof Error) return error.message;
  return 'Đã xảy ra lỗi. Vui lòng thử lại.';
}

export interface BatchListFilters {
  type?: BatchType;
  status?: BatchStatus;
  ownerMSP?: string;
}

export interface CreateHarvestInput {
  farmLocation: string;
  harvestDate: string;
  coffeeVariety: string;
  weightKg: string;
}

export interface CreateProcessedInput {
  parentBatchId: string;
  processingMethod: string;
  startDate: string;
  endDate: string;
  facilityName: string;
  weightKg: string;
}

export interface CreateRoastInput {
  parentBatchId: string;
  roastProfile: string;
  roastDate: string;
  roastDurationMinutes: string;
  weightKg: string;
}

export interface CreatePackagedInput {
  parentBatchId: string;
  packageWeight: string;
  packageDate: string;
  expiryDate: string;
  packageCount: string;
}

export interface AddEvidenceInput {
  evidenceHash: string;
  evidenceUri: string;
}

export interface UploadedEvidence {
  evidenceHash: string;
  evidenceUri: string;
}

export interface RecordFarmActivityInput {
  activityType: string;
  activityDate: string;
  note?: string;
  evidenceHash?: string;
  evidenceUri?: string;
}

async function getList(filters: BatchListFilters = {}): Promise<BatchResponse[]> {
  const res = await apiClient.get<unknown[]>('/api/batches', { params: filters });
  return (res.data ?? []).map(normalizeBatch);
}

async function getBatchById(batchId: string): Promise<BatchResponse> {
  const res = await apiClient.get<unknown>(`/api/batch/${encodeURIComponent(batchId)}`);
  return normalizeBatch(res.data);
}

async function getTrace(publicCode: string): Promise<TraceResponse> {
  const res = await apiClient.get<unknown>(`/api/trace/${encodeURIComponent(publicCode)}`);
  const row = (res.data ?? {}) as Record<string, unknown>;
  return {
    batch: normalizeBatch(row.batch),
    parentChain: ((row.parentChain ?? []) as unknown[]).map(normalizeBatch),
    farmActivities: ((row.farmActivities ?? []) as unknown[]).map(normalizeFarmActivity),
    ledgerRefs: ((row.ledgerRefs ?? []) as unknown[]).map(normalizeLedgerRef),
  };
}

async function createHarvest(input: CreateHarvestInput): Promise<BatchResponse> {
  const res = await apiClient.post<unknown>('/api/harvest', input);
  return normalizeBatch(res.data);
}

async function recordFarmActivity(batchId: string, input: RecordFarmActivityInput): Promise<BatchResponse> {
  const payload = {
    harvestBatchId: batchId,
    activityType: input.activityType,
    activityDate: input.activityDate,
    note: input.note ?? '',
    evidenceHash: input.evidenceHash ?? '',
    evidenceUri: input.evidenceUri ?? '',
  };
  const res = await apiClient.post<unknown>(`/api/harvest/${encodeURIComponent(batchId)}/activity`, payload);
  return normalizeBatch(res.data);
}

async function updateHarvestStatus(batchId: string, newStatus: BatchStatus): Promise<BatchResponse> {
  const res = await apiClient.patch<unknown>(`/api/harvest/${encodeURIComponent(batchId)}/status`, { newStatus });
  return normalizeBatch(res.data);
}

async function addHarvestEvidence(batchId: string, input: AddEvidenceInput): Promise<BatchResponse> {
  const res = await apiClient.post<unknown>(`/api/harvest/${encodeURIComponent(batchId)}/evidence`, input);
  return normalizeBatch(res.data);
}

async function createProcessed(input: CreateProcessedInput): Promise<BatchResponse> {
  const res = await apiClient.post<unknown>('/api/process', input);
  return normalizeBatch(res.data);
}

async function updateProcessedStatus(batchId: string, newStatus: BatchStatus): Promise<BatchResponse> {
  const res = await apiClient.patch<unknown>(`/api/process/${encodeURIComponent(batchId)}/status`, { newStatus });
  return normalizeBatch(res.data);
}

async function createRoast(input: CreateRoastInput): Promise<BatchResponse> {
  const res = await apiClient.post<unknown>('/api/roast', input);
  return normalizeBatch(res.data);
}

async function updateRoastStatus(batchId: string, newStatus: BatchStatus): Promise<BatchResponse> {
  const res = await apiClient.patch<unknown>(`/api/roast/${encodeURIComponent(batchId)}/status`, { newStatus });
  return normalizeBatch(res.data);
}

async function addEvidence(batchId: string, input: AddEvidenceInput): Promise<BatchResponse> {
  const res = await apiClient.post<unknown>(`/api/roast/${encodeURIComponent(batchId)}/evidence`, input);
  return normalizeBatch(res.data);
}

async function addProcessedEvidence(batchId: string, input: AddEvidenceInput): Promise<BatchResponse> {
  const res = await apiClient.post<unknown>(`/api/process/${encodeURIComponent(batchId)}/evidence`, input);
  return normalizeBatch(res.data);
}

async function addPackagedEvidence(batchId: string, input: AddEvidenceInput): Promise<BatchResponse> {
  const res = await apiClient.post<unknown>(`/api/package/${encodeURIComponent(batchId)}/evidence`, input);
  return normalizeBatch(res.data);
}

async function uploadEvidence(file: File): Promise<UploadedEvidence> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient.post<UploadedEvidence>('/api/evidence/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return {
    evidenceHash: asString(res.data?.evidenceHash),
    evidenceUri: asString(res.data?.evidenceUri),
  };
}

async function requestTransfer(batchId: string): Promise<BatchResponse> {
  const res = await apiClient.post<unknown>('/api/transfer/request', { batchId, toMSP: 'Org2MSP' });
  return normalizeBatch(res.data);
}

async function acceptTransfer(batchId: string): Promise<BatchResponse> {
  const res = await apiClient.post<unknown>(`/api/transfer/accept/${encodeURIComponent(batchId)}`);
  return normalizeBatch(res.data);
}

async function createPackaged(input: CreatePackagedInput): Promise<BatchResponse> {
  const res = await apiClient.post<unknown>('/api/package', input);
  return normalizeBatch(res.data);
}

async function updateRetailStatus(batchId: string, newStatus: Extract<BatchStatus, 'IN_STOCK' | 'SOLD'>): Promise<BatchResponse> {
  const res = await apiClient.patch<unknown>(`/api/retail/${encodeURIComponent(batchId)}/status`, { newStatus });
  return normalizeBatch(res.data);
}

async function getPackagedQrUrl(batchId: string): Promise<string> {
  const res = await apiClient.get<ArrayBuffer>(`/api/package/${encodeURIComponent(batchId)}/qr`, {
    responseType: 'arraybuffer',
  });
  const blob = new Blob([res.data], { type: 'image/png' });
  return URL.createObjectURL(blob);
}

export const dashboardApi = {
  getList,
  getBatchById,
  getTrace,
  createHarvest,
  recordFarmActivity,
  updateHarvestStatus,
  addHarvestEvidence,
  createProcessed,
  updateProcessedStatus,
  createRoast,
  updateRoastStatus,
  addEvidence,
  addProcessedEvidence,
  addPackagedEvidence,
  uploadEvidence,
  requestTransfer,
  acceptTransfer,
  createPackaged,
  updateRetailStatus,
  getPackagedQrUrl,
};
