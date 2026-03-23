jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

import { apiClient } from '@/lib/api/client';
import { dashboardApi, getApiErrorMessage, normalizeBatch } from '@/lib/api/dashboardApi';

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('dashboardApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizeBatch maps raw ledger keys correctly', () => {
    const row = normalizeBatch({
      batchId: 'B1',
      publicCode: 'HAR-001',
      type: 'HARVEST',
      status: 'CREATED',
      parentBatchId: '',
      ownerMSP: 'Org1MSP',
      ownerUserId: 'farmer_alice',
      pendingToMSP: '',
      evidenceHash: '',
      evidenceUri: '',
      createdAt: '2026-03-15T10:00:00Z',
      updatedAt: '2026-03-15T10:00:00Z',
      metadata: { weightKg: 500 },
    });

    expect(row.ownerMsp).toBe('Org1MSP');
    expect(row.pendingToMsp).toBeNull();
    expect(row.metadata?.weightKg).toBe('500');
  });

  it('getList normalizes response rows', async () => {
    mockApiClient.get.mockResolvedValueOnce({
      data: [
        {
          batchId: 'B1',
          publicCode: 'HAR-001',
          type: 'HARVEST',
          status: 'CREATED',
          ownerMSP: 'Org1MSP',
          ownerUserId: 'u1',
          createdAt: '2026-03-15T10:00:00Z',
          updatedAt: '2026-03-15T10:00:00Z',
        },
      ],
    } as never);

    const rows = await dashboardApi.getList({ type: 'HARVEST' });
    expect(rows).toHaveLength(1);
    expect(rows[0].ownerMsp).toBe('Org1MSP');
    expect(mockApiClient.get).toHaveBeenCalledWith('/api/batches', { params: { type: 'HARVEST' } });
  });

  it('requestTransfer sends Org2MSP by default', async () => {
    mockApiClient.post.mockResolvedValueOnce({
      data: {
        batchId: 'B1',
        publicCode: 'ROA-001',
        type: 'ROAST',
        status: 'TRANSFER_PENDING',
        ownerMSP: 'Org1MSP',
        ownerUserId: 'u1',
        createdAt: '2026-03-15T10:00:00Z',
        updatedAt: '2026-03-15T10:00:00Z',
      },
    } as never);

    await dashboardApi.requestTransfer('B1');

    expect(mockApiClient.post).toHaveBeenCalledWith('/api/transfer/request', {
      batchId: 'B1',
      toMSP: 'Org2MSP',
    });
  });

  it('extracts message from axios-like error payload', () => {
    const err = {
      message: 'Boom',
      response: { data: { message: 'Readable message' } },
      isAxiosError: true,
    };

    expect(getApiErrorMessage(err)).toBe('Readable message');
  });
});
