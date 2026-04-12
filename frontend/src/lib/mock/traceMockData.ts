import type { TraceResponse } from '@/lib/api/types';

const MOCK_TRACE_ANCHOR_ISO = '2026-04-12T09:00:00.000Z';
const MOCK_ROAST_EVIDENCE_URI = '/mock/evidence/roast-proof.txt';
const MOCK_ROAST_EVIDENCE_HASH = '60022b62aead8d7bf91cee8f97ccbb1b756572bb9a200a727c7a096112bf6c3';

function daysAgo(baseIso: string, days: number): string {
    return new Date(new Date(baseIso).getTime() - days * 86_400_000).toISOString();
}

export function getMockTraceResponse(publicCode: string): TraceResponse {
    const anchor = MOCK_TRACE_ANCHOR_ISO;

    return {
        batch: {
            batchId: 'BATCH-PACK-001',
            publicCode,
            type: 'PACKAGED',
            status: 'IN_STOCK',
            parentBatchId: 'BATCH-ROAST-001',
            ownerMsp: 'PackagerOrg',
            ownerUserId: 'packager_dave',
            pendingToMsp: null,
            evidenceHash: null,
            evidenceUri: null,
            createdAt: daysAgo(anchor, 5),
            updatedAt: daysAgo(anchor, 3),
            metadata: {
                packageWeight: '0.25',
                packageDate: daysAgo(anchor, 5).slice(0, 10),
                expiryDate: new Date(new Date(anchor).getTime() + 365 * 86_400_000).toISOString().slice(0, 10),
                packageCount: '480',
            },
        },
        parentChain: [
            {
                batchId: 'BATCH-HARVEST-001',
                publicCode: `${publicCode}-H`,
                type: 'HARVEST',
                status: 'COMPLETED',
                parentBatchId: null,
                ownerMsp: 'FarmerOrg',
                ownerUserId: 'farmer_alice',
                pendingToMsp: null,
                evidenceHash: null,
                evidenceUri: null,
                createdAt: daysAgo(anchor, 20),
                updatedAt: daysAgo(anchor, 18),
                metadata: {
                    farmLocation: 'Đắk Lắk, Việt Nam',
                    harvestDate: daysAgo(anchor, 20).slice(0, 10),
                    coffeeVariety: 'Arabica',
                    weightKg: '150',
                },
            },
            {
                batchId: 'BATCH-PROCESS-001',
                publicCode: `${publicCode}-P`,
                type: 'PROCESSED',
                status: 'COMPLETED',
                parentBatchId: 'BATCH-HARVEST-001',
                ownerMsp: 'ProcessorOrg',
                ownerUserId: 'processor_bob',
                pendingToMsp: null,
                evidenceHash: null,
                evidenceUri: null,
                createdAt: daysAgo(anchor, 15),
                updatedAt: daysAgo(anchor, 13),
                metadata: {
                    processingMethod: 'Wet Process',
                    startDate: daysAgo(anchor, 15).slice(0, 10),
                    endDate: daysAgo(anchor, 13).slice(0, 10),
                    facilityName: 'Nhà máy sơ chế Buôn Ma Thuột',
                    weightKg: '120',
                },
            },
            {
                batchId: 'BATCH-ROAST-001',
                publicCode: `${publicCode}-R`,
                type: 'ROAST',
                status: 'COMPLETED',
                parentBatchId: 'BATCH-PROCESS-001',
                ownerMsp: 'RoasterOrg',
                ownerUserId: 'roaster_charlie',
                pendingToMsp: null,
                evidenceHash: MOCK_ROAST_EVIDENCE_HASH,
                evidenceUri: MOCK_ROAST_EVIDENCE_URI,
                createdAt: daysAgo(anchor, 10),
                updatedAt: daysAgo(anchor, 8),
                metadata: {
                    roastProfile: 'Medium Roast',
                    roastDate: daysAgo(anchor, 10).slice(0, 10),
                    roastDurationMinutes: '14',
                    facilityName: 'Rang Mộc Coffee Roastery',
                },
            },
        ],
        farmActivities: [
            {
                activityType: 'WATERING',
                activityDate: daysAgo(anchor, 60).slice(0, 10),
                note: 'Tưới nước buổi sáng sớm, 30 phút/lượt',
                evidenceHash: '',
                evidenceUri: '',
                txId: 'tx91a2b3c4d5e6f708091a2b3c4',
                blockNumber: 95,
            },
            {
                activityType: 'FERTILIZING',
                activityDate: daysAgo(anchor, 45).slice(0, 10),
                note: 'Bón phân hữu cơ đợt 2',
                evidenceHash: '',
                evidenceUri: '',
                txId: 'txb2c3d4e5f607182930a1b2c3',
                blockNumber: 101,
            },
            {
                activityType: 'HARVESTING',
                activityDate: daysAgo(anchor, 20).slice(0, 10),
                note: 'Thu hoạch thủ công, chọn lọc quả chín đỏ',
                evidenceHash: '',
                evidenceUri: '',
                txId: 'txc3d4e5f6071829304142a3b4',
                blockNumber: 128,
            },
        ],
        ledgerRefs: [
            {
                eventName: 'BATCH_CREATED',
                txId: 'txd4e5f60718293041a2b3c4d5',
                blockNumber: 129,
                createdAt: daysAgo(anchor, 20),
            },
            {
                eventName: 'BATCH_CREATED',
                txId: 'txe5f607182930a1b2c3d4e5f6',
                blockNumber: 131,
                createdAt: daysAgo(anchor, 10),
            },
            {
                eventName: 'BATCH_CREATED',
                txId: 'txf607182930a1b2c3d4e5f607',
                blockNumber: 145,
                createdAt: daysAgo(anchor, 5),
            },
        ],
    };
}

export const MOCK_TRACE_DEMO_RESPONSE = getMockTraceResponse('DEMO-001');
