import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import TracePage from '@/app/trace/[publicCode]/page';

const mockGetApiTrace = jest.fn();
const mockTraceTimeline = jest.fn<void, [unknown]>();

jest.mock('@/lib/api/generated', () => ({
  ApiError: class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  TraceService: {
    getApiTrace: (...args: unknown[]) => mockGetApiTrace(...args),
  },
}));

jest.mock('@/lib/api/client', () => ({}));

jest.mock('@/components/TraceTimeline', () => ({
  TraceTimeline: (props: unknown) => {
    mockTraceTimeline(props);
    return <div data-testid="trace-timeline">TraceTimelineMock</div>;
  },
}));

type CancelableTestPromise<T> = Promise<T> & { cancel: jest.Mock<void, []> };

function makeCancelablePromise<T>(
  executor: (
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: unknown) => void,
  ) => void,
): CancelableTestPromise<T> {
  const promise = new Promise<T>(executor) as CancelableTestPromise<T>;
  promise.cancel = jest.fn();
  return promise;
}

describe('TracePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hiển thị loading skeleton khi request đang pending', () => {
    mockGetApiTrace.mockReturnValueOnce(makeCancelablePromise(() => {}));

    const { container } = render(<TracePage params={{ publicCode: 'PKG-001' }} />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('hiển thị not found state khi API trả 404', async () => {
    const { ApiError } = jest.requireMock('@/lib/api/generated') as {
      ApiError: new (status: number, message: string) => Error;
    };

    mockGetApiTrace.mockReturnValueOnce(
      makeCancelablePromise((_resolve, reject) => {
        reject(new ApiError(404, 'Not Found'));
      }),
    );

    render(<TracePage params={{ publicCode: 'MISSING-001' }} />);

    await waitFor(() => {
      expect(screen.getByText(/Không tìm thấy sản phẩm/i)).toBeInTheDocument();
    });
  });

  it('hiển thị generic error state khi request thất bại', async () => {
    mockGetApiTrace.mockReturnValueOnce(
      makeCancelablePromise((_resolve, reject) => {
        reject(new Error('Network down'));
      }),
    );

    render(<TracePage params={{ publicCode: 'PKG-ERR' }} />);

    await waitFor(() => {
      expect(screen.getByText(/Lỗi kết nối/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Network down/i)).toBeInTheDocument();
  });

  it('render TraceTimeline với batches được map từ parentChain + batch', async () => {
    mockGetApiTrace.mockReturnValueOnce(
      makeCancelablePromise((resolve) => {
        resolve({
          batch: {
            batchId: 'batch-newest',
            publicCode: 'PKG-001',
            type: 'PACKAGED',
            ownerMsp: 'Org2MSP',
            ownerUserId: 'packager_dave',
            status: 'SOLD',
            metadata: {},
            createdAt: '2024-03-22T08:00:00.000Z',
            updatedAt: '2024-03-22T09:00:00.000Z',
          },
          parentChain: [
            {
              batchId: 'batch-parent',
              publicCode: 'ROAST-001',
              type: 'ROAST',
              ownerMsp: 'Org1MSP',
              ownerUserId: 'roaster_charlie',
              status: 'COMPLETED',
              metadata: {},
              createdAt: '2024-03-20T08:00:00.000Z',
              updatedAt: '2024-03-20T09:00:00.000Z',
            },
          ],
          farmActivities: [],
          ledgerRefs: [],
        });
      }),
    );

    render(<TracePage params={{ publicCode: 'PKG-001' }} />);

    await waitFor(() => {
      expect(screen.getByTestId('trace-timeline')).toBeInTheDocument();
    });
    expect(mockTraceTimeline).toHaveBeenCalledWith(
      expect.objectContaining({
        batches: expect.arrayContaining([
          expect.objectContaining({ batchId: 'batch-parent' }),
          expect.objectContaining({ batchId: 'batch-newest' }),
        ]),
        farmActivities: [],
        ledgerRefs: [],
      }),
    );
  });

  it('cancel request khi component unmount', () => {
    const request = makeCancelablePromise(() => {});
    mockGetApiTrace.mockReturnValueOnce(request);

    const { unmount } = render(<TracePage params={{ publicCode: 'PKG-CANCEL' }} />);
    unmount();

    expect(request.cancel).toHaveBeenCalledTimes(1);
  });
});