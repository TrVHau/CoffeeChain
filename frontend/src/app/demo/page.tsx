'use client';

import { useState } from 'react';
import { TraceTimeline } from '@/components/TraceTimeline';
import { QrScanner } from '@/components/QrScanner';
import type { BatchResponse, FarmActivityItem, LedgerRefItem } from '@/lib/api/types';

// ─── Mock data (same as mock API route for consistency) ──────────────────────

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

const MOCK_BATCHES: BatchResponse[] = [
  {
    batchId:       'BATCH-HARVEST-001',
    publicCode:    'DEMO-001-H',
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
  },
  {
    batchId:       'BATCH-PROCESS-001',
    publicCode:    'DEMO-001-P',
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
  },
  {
    batchId:       'BATCH-ROAST-001',
    publicCode:    'DEMO-001-R',
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
  },
  {
    batchId:       'BATCH-PACK-001',
    publicCode:    'DEMO-001',
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
      expiryDate:    new Date(now.getTime() + 365 * 86_400_000).toISOString().slice(0, 10),
      packageCount:  '480',
    },
  },
];

const MOCK_ACTIVITIES: FarmActivityItem[] = [
  {
    activityType: 'WATERING',
    activityDate: daysAgo(60).slice(0, 10),
    note:         'Tưới nước buổi sáng sớm, 30 phút/lượt',
    evidenceHash: '',
    evidenceUri:  '',
    txId:         'tx91a2b3c4d5e6f708091a2b3c4',
    blockNumber:  95,
  },
  {
    activityType: 'FERTILIZING',
    activityDate: daysAgo(45).slice(0, 10),
    note:         'Bón phân hữu cơ đợt 2',
    evidenceHash: '',
    evidenceUri:  '',
    txId:         'txb2c3d4e5f607182930a1b2c3',
    blockNumber:  101,
  },
  {
    activityType: 'HARVESTING',
    activityDate: daysAgo(20).slice(0, 10),
    note:         'Thu hoạch thủ công, chọn lọc quả chín đỏ',
    evidenceHash: '',
    evidenceUri:  '',
    txId:         'txc3d4e5f6071829304142a3b4',
    blockNumber:  128,
  },
];

const MOCK_LEDGER_REFS: LedgerRefItem[] = [
  { eventName: 'BATCH_CREATED', txId: 'txd4e5f60718293041a2b3c4d5', blockNumber: 129, createdAt: daysAgo(20) },
  { eventName: 'BATCH_CREATED', txId: 'txe5f607182930a1b2c3d4e5f6', blockNumber: 131, createdAt: daysAgo(10) },
  { eventName: 'BATCH_CREATED', txId: 'txf607182930a1b2c3d4e5f607', blockNumber: 145, createdAt: daysAgo(5) },
];

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = 'timeline' | 'qr';

// ─── Demo page ────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState<Tab>('timeline');

  return (
    <main className="min-h-screen bg-amber-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-6 rounded-2xl bg-amber-100 px-5 py-4 border border-amber-300">
          <h1 className="text-2xl font-bold text-amber-800">☕ CoffeeChain — UI Demo</h1>
          <p className="mt-1 text-sm text-amber-700">
            Trang xem trước giao diện (không cần backend).
            Để đăng nhập test:{' '}
            <a href="/login" className="underline font-medium hover:text-amber-900">
              /login
            </a>{' '}
            với user <code className="font-mono text-xs bg-amber-200 px-1 rounded">farmer_alice</code> / mật khẩu{' '}
            <code className="font-mono text-xs bg-amber-200 px-1 rounded">demo</code>
          </p>
          <p className="mt-1 text-xs text-amber-600">
            Trace thật với mock data:{' '}
            <a href="/trace/DEMO-001" className="underline hover:text-amber-900 font-mono">
              /trace/DEMO-001
            </a>
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === 'timeline'
                ? 'bg-amber-700 text-white shadow'
                : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-50'
            }`}
          >
            📋 TraceTimeline
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === 'qr'
                ? 'bg-amber-700 text-white shadow'
                : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-50'
            }`}
          >
            📷 QR Scanner
          </button>
        </div>

        {/* TraceTimeline tab */}
        {activeTab === 'timeline' && (
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-amber-800">
              Truy Xuất Nguồn Gốc — DEMO-001
            </h2>
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-teal-100 text-teal-700 px-3 py-0.5 text-xs font-medium">
                Trong kho
              </span>
              <span className="text-xs text-gray-400">4 bước sản xuất · 3 sự kiện canh tác</span>
            </div>
            <TraceTimeline
              batches={MOCK_BATCHES}
              farmActivities={MOCK_ACTIVITIES}
              ledgerRefs={MOCK_LEDGER_REFS}
            />
          </section>
        )}

        {/* QrScanner tab */}
        {activeTab === 'qr' && (
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-amber-800">Quét Mã QR</h2>
            <p className="mb-4 text-sm text-gray-500">
              Quét mã QR chứa URL sản phẩm hoặc mã công khai (publicCode).
              Sau khi quét sẽ chuyển đến trang truy xuất.
            </p>
            <QrScanner />
          </section>
        )}
      </div>
    </main>
  );
}
