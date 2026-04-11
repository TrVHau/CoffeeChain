import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from '@/app/page';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/components/QrScanner', () => ({
  QrScanner: () => <div data-testid="qr-scanner-mock">QrScannerMock</div>,
}));

describe('HomePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        generatedAt: '2026-04-10T00:00:00.000Z',
        stats: {
          totalItems: 3,
          totalTransactions: 1,
          totalEvidenceUploads: 1,
          latestBlockNumber: 24850275,
        },
        items: [
          {
            id: 'ev-1',
            publicCode: 'COFF-2026-001',
            type: 'EVIDENCE',
            title: 'Upload minh chứng rang cho lô COFF-2026-001',
            subtitle: 'subtitle',
            txId: '0x7a31f6ab23cc64ddf871f2a91b0e4f1022acda93',
            blockNumber: 24850275,
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'tx-1',
            publicCode: 'COFF-2026-001',
            type: 'TRANSACTION',
            title: 'Chuyển giao ROAST -> PACKAGER',
            subtitle: 'subtitle',
            txId: '0x2f8d5a1e4b7c9934aa10f06bce4c1f9a7712456b',
            blockNumber: 24850274,
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'bl-1',
            publicCode: 'COFF-2026-003',
            type: 'BLOCK',
            title: 'Block mới xác nhận trạng thái IN_STOCK',
            subtitle: 'subtitle',
            txId: '0x92d0e4ac77f1a34be5f1bb223e01afd6a81431fe',
            blockNumber: 24850273,
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    }) as jest.Mock;
  });

  it('render feed công khai và có nút Login', async () => {
    render(<HomePage />);

    expect(screen.getByText(/CoffeeChain Public Trace/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/public-feed', { cache: 'no-store' });
    });

    expect(await screen.findByText(/Upload minh chứng rang cho lô COFF-2026-001/i)).toBeInTheDocument();

    const loginLink = screen.getByRole('link', { name: /Login/i });
    expect(loginLink).toHaveAttribute('href', '/login');
  });

  it('click item trong danh sách sẽ mở trang trace chi tiết', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const itemButton = await screen.findByRole('button', {
      name: /Upload minh chứng rang cho lô COFF-2026-001/i,
    });

    await user.click(itemButton);

    expect(mockPush).toHaveBeenCalledWith('/trace/COFF-2026-001');
  });

  it('toggle nút Quét QR để mở scanner', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    expect(screen.queryByTestId('qr-scanner-mock')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Quét QR/i }));

    expect(await screen.findByTestId('qr-scanner-mock')).toBeInTheDocument();
  });
});
