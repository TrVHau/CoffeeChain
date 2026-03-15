import { NextRequest, NextResponse } from 'next/server';

/**
 * Mock trace endpoint — DEV ONLY.
 * GET /api/trace/{publicCode}
 * Returns realistic mock TraceResponse so the trace page renders without backend.
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: { publicCode: string } },
) {
  const { publicCode } = params;

  // Simulate 404 for unknown-looking codes
  if (publicCode === 'NOT-FOUND-999') {
    return NextResponse.json({ message: 'Batch not found.' }, { status: 404 });
  }

  const now = new Date();
  const daysAgo = (d: number) =>
    new Date(now.getTime() - d * 86_400_000).toISOString();

  const harvestBatch = {
    batchId:       'BATCH-HARVEST-001',
    publicCode:    `${publicCode}-H`,
    type:          'HARVEST',
    status:        'COMPLETED',
    parentBatchId: null,
    ownerMsp:      'FarmerOrg',
    ownerUserId:   'farmer_alice',
    pendingToMsp:  null,
    evidenceHash:  null,
    evidenceUri:   null,
    createdAt:     daysAgo(20),
    updatedAt:     daysAgo(18),
    metadata: {
      farmLocation:  'Đắk Lắk, Việt Nam',
      harvestDate:   daysAgo(20).slice(0, 10),
      coffeeVariety: 'Arabica',
      weightKg:      '150',
    },
  };

  const processedBatch = {
    batchId:       'BATCH-PROCESS-001',
    publicCode:    `${publicCode}-P`,
    type:          'PROCESSED',
    status:        'COMPLETED',
    parentBatchId: 'BATCH-HARVEST-001',
    ownerMsp:      'ProcessorOrg',
    ownerUserId:   'processor_bob',
    pendingToMsp:  null,
    evidenceHash:  null,
    evidenceUri:   null,
    createdAt:     daysAgo(15),
    updatedAt:     daysAgo(13),
    metadata: {
      processingMethod: 'Wet Process',
      startDate:        daysAgo(15).slice(0, 10),
      endDate:          daysAgo(13).slice(0, 10),
      facilityName:     'Nhà máy sơ chế Buôn Ma Thuột',
      weightKg:         '120',
    },
  };

  const roastBatch = {
    batchId:       'BATCH-ROAST-001',
    publicCode:    `${publicCode}-R`,
    type:          'ROAST',
    status:        'COMPLETED',
    parentBatchId: 'BATCH-PROCESS-001',
    ownerMsp:      'RoasterOrg',
    ownerUserId:   'roaster_charlie',
    pendingToMsp:  null,
    evidenceHash:  'a3f1b2c4d5e6f708091a2b3c4d5e6f708091a2b3c4d5e6f708091a2b3c4d5e6',
    evidenceUri:   'ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
    createdAt:     daysAgo(10),
    updatedAt:     daysAgo(8),
    metadata: {
      roastProfile:         'Medium Roast',
      roastDate:            daysAgo(10).slice(0, 10),
      roastDurationMinutes: '14',
      facilityName:         'Rang Mộc Coffee Roastery',
    },
  };

  const packagedBatch = {
    batchId:       'BATCH-PACK-001',
    publicCode,
    type:          'PACKAGED',
    status:        'IN_STOCK',
    parentBatchId: 'BATCH-ROAST-001',
    ownerMsp:      'PackagerOrg',
    ownerUserId:   'packager_dave',
    pendingToMsp:  null,
    evidenceHash:  null,
    evidenceUri:   null,
    createdAt:     daysAgo(5),
    updatedAt:     daysAgo(3),
    metadata: {
      packageWeight: '0.25',
      packageDate:   daysAgo(5).slice(0, 10),
      expiryDate:    new Date(now.getTime() + 365 * 86_400_000)
                       .toISOString()
                       .slice(0, 10),
      packageCount:  '480',
    },
  };

  const farmActivities = [
    {
      activityType: 'WATERING',
      activityDate: daysAgo(60).slice(0, 10),
      note:         'Tưới nước buổi sáng sớm, 30 phút/lượt',
      evidenceHash: '',
      evidenceUri:  '',
      txId:         'tx91a2b3c4d5e6f708091a2b3c4',
      blockNumber:  '95',
    },
    {
      activityType: 'FERTILIZING',
      activityDate: daysAgo(45).slice(0, 10),
      note:         'Bón phân hữu cơ đợt 2',
      evidenceHash: '',
      evidenceUri:  '',
      txId:         'txb2c3d4e5f607182930a1b2c3',
      blockNumber:  '101',
    },
    {
      activityType: 'HARVESTING',
      activityDate: daysAgo(20).slice(0, 10),
      note:         'Thu hoạch thủ công, chọn lọc quả chín đỏ',
      evidenceHash: '',
      evidenceUri:  '',
      txId:         'txc3d4e5f6071829304142a3b4',
      blockNumber:  '128',
    },
  ];

  const ledgerRefs = [
    {
      eventName:   'BATCH_CREATED',
      txId:        'txd4e5f60718293041a2b3c4d5',
      blockNumber: 129,
      createdAt:   daysAgo(20),
    },
    {
      eventName:   'BATCH_CREATED',
      txId:        'txe5f607182930a1b2c3d4e5f6',
      blockNumber: 131,
      createdAt:   daysAgo(10),
    },
    {
      eventName:   'BATCH_CREATED',
      txId:        'txf607182930a1b2c3d4e5f607',
      blockNumber: 145,
      createdAt:   daysAgo(5),
    },
  ];

  return NextResponse.json({
    batch:          packagedBatch,
    parentChain:    [harvestBatch, processedBatch, roastBatch],
    farmActivities,
    ledgerRefs,
  });
}
