import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TraceTimeline } from '@/components/TraceTimeline';
import type { BatchResponse, FarmActivityItem, LedgerRefItem } from '@/lib/api/types';

const batches: BatchResponse[] = [
  {
    batchId: 'batch-harvest',
    publicCode: 'HARVEST-001',
    type: 'HARVEST',
    ownerMsp: 'Org1MSP',
    ownerUserId: 'farmer_alice',
    status: 'COMPLETED',
    metadata: {
      farmLocation: 'Cầu Đất',
      harvestDate: '2024-03-15',
    },
    createdAt: '2024-03-15T08:00:00.000Z',
    updatedAt: '2024-03-15T09:00:00.000Z',
  },
  {
    batchId: 'batch-roast',
    publicCode: 'ROAST-001',
    type: 'ROAST',
    ownerMsp: 'Org1MSP',
    ownerUserId: 'roaster_charlie',
    status: 'COMPLETED',
    evidenceHash: 'a'.repeat(64),
    evidenceUri: 'ipfs://QmProof',
    metadata: {
      roastProfile: 'Medium Roast',
    },
    createdAt: '2024-03-20T08:00:00.000Z',
    updatedAt: '2024-03-20T09:00:00.000Z',
  },
  {
    batchId: 'batch-package',
    publicCode: 'PKG-001',
    type: 'PACKAGED',
    ownerMsp: 'Org2MSP',
    ownerUserId: 'packager_dave',
    status: 'SOLD',
    metadata: {
      packageDate: '2024-03-22',
    },
    createdAt: '2024-03-22T08:00:00.000Z',
    updatedAt: '2024-03-22T09:00:00.000Z',
  },
] as BatchResponse[];

const farmActivities: FarmActivityItem[] = [
  {
    activityType: 'WATERING',
    activityDate: '2024-03-01',
    note: 'Tưới nước buổi sáng',
    txId: 'tx-water-12345678',
    blockNumber: 55,
  },
] as FarmActivityItem[];

const ledgerRefs: LedgerRefItem[] = [
  {
    batchId: 'batch-harvest',
    eventName: 'BATCH_CREATED',
    txId: 'tx-harvest-abcdef12',
    blockNumber: 101,
    createdAt: '2024-03-15T08:01:00.000Z',
  },
  {
    batchId: 'batch-roast',
    eventName: 'BATCH_CREATED',
    txId: 'tx-roast-12345678',
    blockNumber: 121,
    createdAt: '2024-03-20T08:01:00.000Z',
  },
  {
    batchId: 'batch-package',
    eventName: 'BATCH_CREATED',
    txId: 'tx-package-12345678',
    blockNumber: 131,
    createdAt: '2024-03-22T08:01:00.000Z',
  },
] as LedgerRefItem[];

describe('TraceTimeline', () => {
  it('render newest-first theo thứ tự PACKAGED → ROAST → HARVEST', () => {
    const { container } = render(
      <TraceTimeline batches={batches} farmActivities={farmActivities} ledgerRefs={ledgerRefs} />,
    );

    const text = container.textContent ?? '';
    expect(text.indexOf('ĐÓNG GÓI')).toBeLessThan(text.indexOf('RANG'));
    expect(text.indexOf('RANG')).toBeLessThan(text.indexOf('THU HOẠCH'));
  });

  it('render metadata labels và ledger refs đúng theo từng bước', () => {
    render(
      <TraceTimeline batches={batches} farmActivities={farmActivities} ledgerRefs={ledgerRefs} />,
    );

    expect(screen.getByText(/Profile rang:/i)).toBeInTheDocument();
    expect(screen.getByText(/Medium Roast/i)).toBeInTheDocument();
    expect(screen.getByText(/Block #131/i)).toBeInTheDocument();
    expect(screen.getByText(/tx-packa/i)).toBeInTheDocument();
  });

  it('toggle được farm activity accordion ở bước HARVEST', async () => {
    const user = userEvent.setup();

    render(
      <TraceTimeline batches={batches} farmActivities={farmActivities} ledgerRefs={ledgerRefs} />,
    );

    expect(screen.queryByText(/Tưới nước buổi sáng/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Nhật ký canh tác/i }));

    expect(screen.getByText(/Tưới nước buổi sáng/i)).toBeInTheDocument();
    expect(screen.getByText(/tx: tx-water/i)).toBeInTheDocument();
  });

  it('render EvidenceVerifier cho bước ROAST', () => {
    render(
      <TraceTimeline batches={batches} farmActivities={farmActivities} ledgerRefs={ledgerRefs} />,
    );

    expect(screen.getByRole('button', { name: /Xác minh hash chứng cứ/i })).toBeInTheDocument();
  });
});