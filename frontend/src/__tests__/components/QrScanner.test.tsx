import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QrScanner } from '@/components/QrScanner';

const mockPush = jest.fn();
const mockRouter = { push: mockPush };
const mockDecodeFromVideoDevice = jest.fn();
const mockReleaseAllStreams = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: jest.fn().mockImplementation(() => ({
    decodeFromVideoDevice: (...args: unknown[]) => mockDecodeFromVideoDevice(...args),
  })),
}));

const { BrowserMultiFormatReader } = jest.requireMock('@zxing/browser') as {
  BrowserMultiFormatReader: jest.Mock & { releaseAllStreams?: jest.Mock };
};
BrowserMultiFormatReader.releaseAllStreams = mockReleaseAllStreams;

describe('QrScanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockReset();
    mockDecodeFromVideoDevice.mockReset();
    mockReleaseAllStreams.mockReset();
  });

  it('khởi tạo camera scanner khi mount', async () => {
    mockDecodeFromVideoDevice.mockResolvedValue(undefined);

    render(<QrScanner />);

    await waitFor(() => {
      expect(mockDecodeFromVideoDevice).toHaveBeenCalled();
    });
    expect(screen.getByLabelText(/Camera để quét mã QR/i)).toBeInTheDocument();
  });

  it('redirect khi decode ra URL đầy đủ /trace/{code}', async () => {
    mockDecodeFromVideoDevice.mockImplementation(
      async (_device: unknown, _video: unknown, callback: (result?: { getText: () => string }, err?: Error) => void) => {
        callback({ getText: () => 'https://coffeechain.example/trace/PKG-123' });
      },
    );

    render(<QrScanner />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/trace/PKG-123');
    });
  });

  it('redirect khi decode ra raw public code', async () => {
    mockDecodeFromVideoDevice.mockImplementation(
      async (_device: unknown, _video: unknown, callback: (result?: { getText: () => string }, err?: Error) => void) => {
        callback({ getText: () => 'PKG-RAW-001' });
      },
    );

    render(<QrScanner />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/trace/PKG-RAW-001');
    });
  });

  it('hiển thị lỗi khi camera bị từ chối truy cập', async () => {
    mockDecodeFromVideoDevice.mockImplementation(() => Promise.reject(new Error('Camera blocked')));

    render(<QrScanner />);

    await waitFor(() => {
      expect(screen.getByText(/Camera blocked/i)).toBeInTheDocument();
    });
  });

  it('hiển thị lỗi khi callback trả lỗi bất thường', async () => {
    mockDecodeFromVideoDevice.mockImplementation(
      async (_device: unknown, _video: unknown, callback: (result?: { getText: () => string }, err?: Error) => void) => {
        const error = new Error('Camera stream lost');
        error.name = 'AbortError';
        callback(undefined, error);
      },
    );

    render(<QrScanner />);

    await waitFor(() => {
      expect(screen.getByText(/Camera stream lost/i)).toBeInTheDocument();
    });
  });

  it('manual fallback submit hoạt động', async () => {
    const user = userEvent.setup();
    mockDecodeFromVideoDevice.mockResolvedValue(undefined);

    render(<QrScanner />);

    await user.type(screen.getByPlaceholderText(/PKG-20240403-001/i), 'PKG-MANUAL-001');
    await user.click(screen.getByRole('button', { name: /Tra cứu/i }));

    expect(mockPush).toHaveBeenCalledWith('/trace/PKG-MANUAL-001');
  });
});