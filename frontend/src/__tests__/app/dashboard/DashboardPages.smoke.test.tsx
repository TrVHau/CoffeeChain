import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import FarmerPage from '@/app/dashboard/farmer/page';
import FarmerDetailPage from '@/app/dashboard/farmer/[id]/page';
import ProcessorPage from '@/app/dashboard/processor/page';
import RoasterPage from '@/app/dashboard/roaster/page';
import PackagerPage from '@/app/dashboard/packager/page';
import RetailerPage from '@/app/dashboard/retailer/page';
import { dashboardApi } from '@/lib/api/dashboardApi';

jest.mock('@/lib/auth/useRoleGuard', () => ({
  useRoleGuard: () => ({ ready: true }),
}));

jest.mock('@/components/dashboard/DashboardShell', () => ({
  DashboardShell: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

jest.mock('@/lib/api/dashboardApi', () => ({
  dashboardApi: {
    getList: jest.fn(),
    getBatchById: jest.fn(),
    getTrace: jest.fn(),
    createHarvest: jest.fn(),
    recordFarmActivity: jest.fn(),
    updateHarvestStatus: jest.fn(),
    createProcessed: jest.fn(),
    updateProcessedStatus: jest.fn(),
    createRoast: jest.fn(),
    updateRoastStatus: jest.fn(),
    addEvidence: jest.fn(),
    uploadEvidence: jest.fn(),
    requestTransfer: jest.fn(),
    acceptTransfer: jest.fn(),
    createPackaged: jest.fn(),
    updateRetailStatus: jest.fn(),
    getBatchQrUrl: jest.fn(),
    getPackagedQrUrl: jest.fn(),
  },
  getApiErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'error'),
}));

const mockDashboardApi = dashboardApi as jest.Mocked<typeof dashboardApi>;

describe('dashboard pages smoke', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDashboardApi.getList.mockResolvedValue([]);
    mockDashboardApi.getBatchById.mockResolvedValue({
      batchId: 'B1',
      publicCode: 'HAR-001',
      type: 'HARVEST',
      status: 'CREATED',
      parentBatchId: null,
      ownerMsp: 'Org1MSP',
      ownerUserId: 'farmer_alice',
      pendingToMsp: null,
      evidenceHash: null,
      evidenceUri: null,
      createdAt: '2026-03-15T10:00:00Z',
      updatedAt: '2026-03-15T10:00:00Z',
      metadata: {},
    });
    mockDashboardApi.getTrace.mockResolvedValue({
      batch: {
        batchId: 'B1',
        publicCode: 'HAR-001',
        type: 'HARVEST',
        status: 'CREATED',
        parentBatchId: null,
        ownerMsp: 'Org1MSP',
        ownerUserId: 'farmer_alice',
        pendingToMsp: null,
        evidenceHash: null,
        evidenceUri: null,
        createdAt: '2026-03-15T10:00:00Z',
        updatedAt: '2026-03-15T10:00:00Z',
        metadata: {},
      },
      parentChain: [],
      farmActivities: [],
      ledgerRefs: [],
    });
  });

  it('renders farmer dashboard', async () => {
    render(<FarmerPage />);
    await waitFor(() => expect(screen.getByText('Farmer Dashboard')).toBeInTheDocument());
  });

  it('renders farmer detail page', async () => {
    render(<FarmerDetailPage params={{ id: 'B1' }} />);
    await waitFor(() => expect(screen.getByText('Chi tiết Harvest batch')).toBeInTheDocument());
  });

  it('renders activity evidence block in farmer detail page', async () => {
    mockDashboardApi.getTrace.mockResolvedValueOnce({
      batch: {
        batchId: 'B1',
        publicCode: 'HAR-001',
        type: 'HARVEST',
        status: 'CREATED',
        parentBatchId: null,
        ownerMsp: 'Org1MSP',
        ownerUserId: 'farmer_alice',
        pendingToMsp: null,
        evidenceHash: null,
        evidenceUri: null,
        createdAt: '2026-03-15T10:00:00Z',
        updatedAt: '2026-03-15T10:00:00Z',
        metadata: {},
      },
      parentChain: [],
      farmActivities: [
        {
          activityType: 'IRRIGATION',
          activityDate: '2026-03-20',
          note: 'Tưới nhỏ giọt',
          evidenceHash: 'a'.repeat(64),
          evidenceUri: 'ipfs://QmActivityEvidence',
        },
      ],
      ledgerRefs: [],
    });

    render(<FarmerDetailPage params={{ id: 'B1' }} />);

    await waitFor(() => expect(screen.getByRole('link', { name: /Xem minh chứng/i })).toBeInTheDocument());
    expect(screen.getByText(/Hash:/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Xem minh chứng/i })).toHaveAttribute(
      'href',
      'https://ipfs.io/ipfs/QmActivityEvidence',
    );
  });

  it('renders processor dashboard', async () => {
    render(<ProcessorPage />);
    await waitFor(() => expect(screen.getByText('Processor Dashboard')).toBeInTheDocument());
  });

  it('renders roaster dashboard', async () => {
    render(<RoasterPage />);
    await waitFor(() => expect(screen.getByText('Roaster Dashboard')).toBeInTheDocument());
  });

  it('renders packager dashboard', async () => {
    render(<PackagerPage />);
    await waitFor(() => expect(screen.getByText('Packager Dashboard')).toBeInTheDocument());
  });

  it('renders retailer dashboard', async () => {
    render(<RetailerPage />);
    await waitFor(() => expect(screen.getByText('Retailer Dashboard')).toBeInTheDocument());
  });
});
