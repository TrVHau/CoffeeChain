import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvidenceVerifier } from '@/components/EvidenceVerifier';

const originalCrypto = global.crypto;

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(
    hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
  );
  return bytes.buffer;
}

describe('EvidenceVerifier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: {
        subtle: {
          digest: jest.fn(),
        },
      },
    });
  });

  afterAll(() => {
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
  });

  it('hiển thị fallback khi chưa có evidence hoặc on-chain hash', () => {
    render(<EvidenceVerifier batchId="batch-1" onChainHash="" evidenceUri={undefined} />);

    expect(screen.getByText(/Chưa có chứng cứ đính kèm/i)).toBeInTheDocument();
  });

  it('xác minh thành công khi hash tải về khớp với on-chain hash', async () => {
    const user = userEvent.setup();
    const expectedHash = 'a'.repeat(64);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer,
    });
    (global.crypto.subtle.digest as jest.Mock).mockResolvedValue(hexToArrayBuffer(expectedHash));

    render(
      <EvidenceVerifier
        batchId="batch-1"
        onChainHash={expectedHash}
        evidenceUri="ipfs://QmEvidenceHash"
      />,
    );

    expect(screen.getByRole('link', { name: /Xem minh chứng/i })).toHaveAttribute(
      'href',
      'https://ipfs.io/ipfs/QmEvidenceHash',
    );

    await user.click(screen.getByRole('button', { name: /Xác minh hash chứng cứ/i }));

    await waitFor(() => {
      expect(screen.getByText(/Hash khớp/i)).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith('https://ipfs.io/ipfs/QmEvidenceHash');
  });

  it('hiển thị mismatch khi hash tải về khác on-chain hash', async () => {
    const user = userEvent.setup();

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Uint8Array.from([5, 6, 7, 8]).buffer,
    });
    (global.crypto.subtle.digest as jest.Mock).mockResolvedValue(hexToArrayBuffer('b'.repeat(64)));

    render(
      <EvidenceVerifier
        batchId="batch-2"
        onChainHash={'c'.repeat(64)}
        evidenceUri="https://gateway.example.com/proof.pdf"
      />,
    );

    await user.click(screen.getByRole('button', { name: /Xác minh hash chứng cứ/i }));

    await waitFor(() => {
      expect(screen.getByText(/Hash không khớp/i)).toBeInTheDocument();
    });
  });

  it('hiển thị lỗi fetch và cho phép thử lại', async () => {
    const user = userEvent.setup();

    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('gateway down'))
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => Uint8Array.from([9, 10, 11, 12]).buffer,
      });
    (global.crypto.subtle.digest as jest.Mock).mockResolvedValue(hexToArrayBuffer('d'.repeat(64)));

    render(
      <EvidenceVerifier
        batchId="batch-3"
        onChainHash={'d'.repeat(64)}
        evidenceUri="ipfs://QmRetryHash"
      />,
    );

    await user.click(screen.getByRole('button', { name: /Xác minh hash chứng cứ/i }));

    await waitFor(() => {
      expect(screen.getByText(/Lỗi: gateway down/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Thử lại/i }));

    await waitFor(() => {
      expect(screen.getByText(/Hash khớp/i)).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});