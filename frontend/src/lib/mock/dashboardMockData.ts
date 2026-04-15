import type {
    BatchResponse,
    BatchStatus,
    BatchType,
    FarmActivityItem,
    LedgerRefItem,
} from '@/lib/api/types';
import type {
    CreateHarvestInput,
    CreatePackagedInput,
    CreateProcessedInput,
    CreateRoastInput,
    RecordFarmActivityInput,
} from '@/lib/api/dashboardApi';
import { MOCK_TRACE_DEMO_RESPONSE } from './traceMockData';

interface DashboardMockState {
    batches: BatchResponse[];
    farmActivities: FarmActivityItem[];
    ledgerRefs: LedgerRefItem[];
}

const state: DashboardMockState = {
    batches: [
        ...MOCK_TRACE_DEMO_RESPONSE.parentChain,
        {
            ...MOCK_TRACE_DEMO_RESPONSE.batch,
            status: 'TRANSFERRED',
        },
        {
            batchId: 'BATCH-HARVEST-002',
            publicCode: 'HAR-2026-002',
            type: 'HARVEST',
            status: 'IN_PROCESS',
            parentBatchId: null,
            ownerMsp: 'FarmerOrg',
            ownerUserId: 'farmer_alice',
            pendingToMsp: null,
            evidenceHash: null,
            evidenceUri: null,
            createdAt: '2026-04-08T08:00:00.000Z',
            updatedAt: '2026-04-09T08:00:00.000Z',
            metadata: {
                farmLocation: 'Đắk Lắk, Việt Nam',
                harvestDate: '2026-04-08',
                coffeeVariety: 'Robusta',
                weightKg: '180',
            },
        },
    ],
    farmActivities: [
        ...MOCK_TRACE_DEMO_RESPONSE.farmActivities,
        {
            activityType: 'IRRIGATION',
            activityDate: '2026-04-08',
            note: 'Tưới nhỏ giọt sáng sớm',
            evidenceHash: '',
            evidenceUri: '',
            txId: 'tx-activity-0002',
            blockNumber: 96,
        },
    ],
    ledgerRefs: [...MOCK_TRACE_DEMO_RESPONSE.ledgerRefs],
};

let harvestSequence = 3;
let processedSequence = 2;
let roastSequence = 2;
let packagedSequence = 2;
let evidenceSequence = 1;

function cloneBatch(batch: BatchResponse): BatchResponse {
    return {
        ...batch,
        metadata: batch.metadata ? { ...batch.metadata } : undefined,
    };
}

function cloneStateBatch(batch: BatchResponse): BatchResponse {
    return cloneBatch(batch);
}

function findBatchIndex(batchId: string): number {
    return state.batches.findIndex((batch) => batch.batchId === batchId);
}

function upsertBatch(batch: BatchResponse): BatchResponse {
    const next = cloneStateBatch(batch);
    const index = findBatchIndex(batch.batchId);
    if (index >= 0) {
        state.batches[index] = next;
    } else {
        state.batches.unshift(next);
    }
    return cloneBatch(next);
}

function getBatchById(batchId: string): BatchResponse {
    const batch = state.batches.find((item) => item.batchId === batchId);
    if (!batch) {
        throw new Error(`Batch ${batchId} not found in mock store.`);
    }
    return cloneBatch(batch);
}

function getBatchByPublicCode(publicCode: string): BatchResponse {
    const batch = state.batches.find((item) => item.publicCode === publicCode);
    if (!batch) {
        throw new Error(`Batch ${publicCode} not found in mock store.`);
    }
    return cloneBatch(batch);
}

function nextId(prefix: string, sequence: number): string {
    return `${prefix}-${String(sequence).padStart(3, '0')}`;
}

function nowIso(): string {
    return new Date().toISOString();
}

function toTraceChain(batch: BatchResponse): BatchResponse[] {
    const chain: BatchResponse[] = [];
    let current: BatchResponse | undefined = batch;
    while (current?.parentBatchId) {
        const parent = state.batches.find((item) => item.batchId === current?.parentBatchId);
        if (!parent) break;
        chain.unshift(cloneBatch(parent));
        current = parent;
    }
    return chain;
}

function makeLedgerRef(eventName: string, batchId: string): LedgerRefItem {
    return {
        eventName,
        txId: `tx-${batchId}-${state.ledgerRefs.length + 1}`,
        blockNumber: 24850280 + state.ledgerRefs.length,
        createdAt: nowIso(),
    };
}

export function mockGetList(filters: { type?: BatchType; status?: BatchStatus; ownerMSP?: string } = {}): BatchResponse[] {
    return state.batches
        .filter((batch) => (filters.type ? batch.type === filters.type : true))
        .filter((batch) => (filters.status ? batch.status === filters.status : true))
        .filter((batch) => (filters.ownerMSP ? batch.ownerMsp === filters.ownerMSP : true))
        .map(cloneBatch);
}

export function mockGetBatchById(batchId: string): BatchResponse {
    return getBatchById(batchId);
}

export function mockGetTrace(publicCode: string) {
    const batch = getBatchByPublicCode(publicCode);
    return {
        batch,
        parentChain: toTraceChain(batch),
        farmActivities: state.farmActivities.map((activity) => ({ ...activity })),
        ledgerRefs: state.ledgerRefs.map((ref) => ({ ...ref })),
    };
}

export function mockCreateHarvest(input: CreateHarvestInput): BatchResponse {
    const batch: BatchResponse = {
        batchId: nextId('BATCH-HARVEST', harvestSequence++),
        publicCode: `HAR-2026-${String(harvestSequence - 1).padStart(3, '0')}`,
        type: 'HARVEST',
        status: 'CREATED',
        parentBatchId: null,
        ownerMsp: 'FarmerOrg',
        ownerUserId: 'farmer_alice',
        pendingToMsp: null,
        evidenceHash: null,
        evidenceUri: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        metadata: {
            farmLocation: input.farmLocation,
            harvestDate: input.harvestDate,
            coffeeVariety: input.coffeeVariety,
            weightKg: input.weightKg ?? '',
        },
    };
    state.ledgerRefs.unshift(makeLedgerRef('BATCH_CREATED', batch.batchId));
    return upsertBatch(batch);
}

export function mockCreateProcessed(input: CreateProcessedInput): BatchResponse {
    const batch: BatchResponse = {
        batchId: nextId('BATCH-PROCESS', processedSequence++),
        publicCode: `PROC-2026-${String(processedSequence - 1).padStart(3, '0')}`,
        type: 'PROCESSED',
        status: 'CREATED',
        parentBatchId: input.parentBatchId,
        ownerMsp: 'ProcessorOrg',
        ownerUserId: 'processor_bob',
        pendingToMsp: null,
        evidenceHash: null,
        evidenceUri: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        metadata: {
            processingMethod: input.processingMethod,
            startDate: input.startDate,
            endDate: input.endDate,
            facilityName: input.facilityName,
            weightKg: input.weightKg ?? '',
        },
    };
    state.ledgerRefs.unshift(makeLedgerRef('BATCH_CREATED', batch.batchId));
    return upsertBatch(batch);
}

export function mockCreateRoast(input: CreateRoastInput): BatchResponse {
    const batch: BatchResponse = {
        batchId: nextId('BATCH-ROAST', roastSequence++),
        publicCode: `ROAST-2026-${String(roastSequence - 1).padStart(3, '0')}`,
        type: 'ROAST',
        status: 'CREATED',
        parentBatchId: input.parentBatchId,
        ownerMsp: 'RoasterOrg',
        ownerUserId: 'roaster_charlie',
        pendingToMsp: null,
        evidenceHash: null,
        evidenceUri: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        metadata: {
            roastProfile: input.roastProfile,
            roastDate: input.roastDate,
            roastDurationMinutes: input.roastDurationMinutes,
            weightKg: input.weightKg ?? '',
        },
    };
    state.ledgerRefs.unshift(makeLedgerRef('BATCH_CREATED', batch.batchId));
    return upsertBatch(batch);
}

export function mockCreatePackaged(input: CreatePackagedInput): BatchResponse {
    const batch: BatchResponse = {
        batchId: nextId('BATCH-PACK', packagedSequence++),
        publicCode: `PKG-2026-${String(packagedSequence - 1).padStart(3, '0')}`,
        type: 'PACKAGED',
        status: 'IN_STOCK',
        parentBatchId: input.parentBatchId,
        ownerMsp: 'PackagerOrg',
        ownerUserId: 'packager_dave',
        pendingToMsp: null,
        evidenceHash: null,
        evidenceUri: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        metadata: {
            packageWeight: input.packageWeight,
            packageDate: input.packageDate,
            expiryDate: input.expiryDate,
            packageCount: input.packageCount,
        },
    };
    state.ledgerRefs.unshift(makeLedgerRef('BATCH_CREATED', batch.batchId));
    return upsertBatch(batch);
}

export function mockRecordFarmActivity(batchId: string, input: RecordFarmActivityInput): BatchResponse {
    const activity: FarmActivityItem = {
        activityType: input.activityType,
        activityDate: input.activityDate,
        note: input.note ?? '',
        evidenceHash: input.evidenceHash ?? '',
        evidenceUri: input.evidenceUri ?? '',
        txId: `tx-${batchId}-${state.farmActivities.length + 1}`,
        blockNumber: 24850300 + state.farmActivities.length,
    };
    state.farmActivities.unshift(activity);
    return getBatchById(batchId);
}

export function mockUploadEvidence(file: File): { evidenceHash: string; evidenceUri: string } {
    const evidenceHash = `mock-${file.name}-${file.size || evidenceSequence}`;
    const evidenceUri = `/mock/evidence/${encodeURIComponent(file.name || `evidence-${evidenceSequence}`)}`;
    evidenceSequence += 1;
    return { evidenceHash, evidenceUri };
}

export function mockAddHarvestEvidence(batchId: string, input: { evidenceHash: string; evidenceUri: string }): BatchResponse {
    return upsertBatch({
        ...getBatchById(batchId),
        evidenceHash: input.evidenceHash,
        evidenceUri: input.evidenceUri,
        status: 'COMPLETED',
        updatedAt: nowIso(),
    });
}

export function mockAddProcessedEvidence(batchId: string, input: { evidenceHash: string; evidenceUri: string }): BatchResponse {
    return upsertBatch({
        ...getBatchById(batchId),
        evidenceHash: input.evidenceHash,
        evidenceUri: input.evidenceUri,
        status: 'COMPLETED',
        updatedAt: nowIso(),
    });
}

export function mockAddRoastEvidence(batchId: string, input: { evidenceHash: string; evidenceUri: string }): BatchResponse {
    return upsertBatch({
        ...getBatchById(batchId),
        evidenceHash: input.evidenceHash,
        evidenceUri: input.evidenceUri,
        status: 'COMPLETED',
        updatedAt: nowIso(),
    });
}

export function mockAddPackagedEvidence(batchId: string, input: { evidenceHash: string; evidenceUri: string }): BatchResponse {
    return upsertBatch({
        ...getBatchById(batchId),
        evidenceHash: input.evidenceHash,
        evidenceUri: input.evidenceUri,
        status: 'IN_STOCK',
        updatedAt: nowIso(),
    });
}

export function mockUpdateHarvestStatus(batchId: string, newStatus: BatchStatus): BatchResponse {
    return upsertBatch({ ...getBatchById(batchId), status: newStatus, updatedAt: nowIso() });
}

export function mockUpdateProcessedStatus(batchId: string, newStatus: BatchStatus): BatchResponse {
    return upsertBatch({ ...getBatchById(batchId), status: newStatus, updatedAt: nowIso() });
}

export function mockUpdateRoastStatus(batchId: string, newStatus: BatchStatus): BatchResponse {
    return upsertBatch({ ...getBatchById(batchId), status: newStatus, updatedAt: nowIso() });
}

export function mockUpdateRetailStatus(batchId: string, newStatus: Extract<BatchStatus, 'IN_STOCK' | 'SOLD'>): BatchResponse {
    return upsertBatch({ ...getBatchById(batchId), status: newStatus, updatedAt: nowIso() });
}

export function mockRequestTransfer(batchId: string): BatchResponse {
    return upsertBatch({
        ...getBatchById(batchId),
        status: 'TRANSFER_PENDING',
        pendingToMsp: 'Org2MSP',
        updatedAt: nowIso(),
    });
}

export function mockAcceptTransfer(batchId: string): BatchResponse {
    return upsertBatch({
        ...getBatchById(batchId),
        status: 'TRANSFERRED',
        pendingToMsp: null,
        updatedAt: nowIso(),
    });
}

export function mockGetPackagedQrUrl(batchId: string): string {
    const payload = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><rect width="100%" height="100%" fill="#fffaf0"/><rect x="24" y="24" width="272" height="272" rx="24" fill="#78350f" opacity="0.08"/><text x="50%" y="45%" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#78350f">CoffeeChain</text><text x="50%" y="54%" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#92400e">${batchId}</text><text x="50%" y="63%" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#a16207">Mock QR</text></svg>`;
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        return URL.createObjectURL(new Blob([payload], { type: 'image/svg+xml' }));
    }
    return `data:image/svg+xml;base64,${btoa(payload)}`;
}
