'use client';

import { useState } from 'react';

type VerifyState = 'idle' | 'verifying' | 'match' | 'mismatch' | 'error';

interface EvidenceVerifierProps {
  batchId:      string;
  onChainHash:  string;
  evidenceUri?: string;  // IPFS URI: ipfs://Qm...
}

/** Chuyển đổi ipfs://Qm... → https://ipfs.io/ipfs/Qm... */
function ipfsToHttp(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }
  return uri;
}

/** Tính SHA-256 của ArrayBuffer, trả về hex string */
async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function EvidenceVerifier({ batchId: _batchId, onChainHash, evidenceUri }: EvidenceVerifierProps) {
  const [state, setState]       = useState<VerifyState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  if (!evidenceUri || !onChainHash) {
    return <p className="text-xs text-gray-400 italic">Chưa có chứng cứ đính kèm</p>;
  }

  async function handleVerify() {
    setState('verifying');
    setErrorMsg('');
    try {
      const url      = ipfsToHttp(evidenceUri!);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const buffer       = await response.arrayBuffer();
      const computedHash = await sha256Hex(buffer);

      setState(computedHash === onChainHash ? 'match' : 'mismatch');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi không xác định');
      setState('error');
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      {state === 'idle' && (
        <button
          onClick={handleVerify}
          className="text-xs text-blue-600 underline hover:text-blue-800"
        >
          🔍 Xác minh hash chứng cứ
        </button>
      )}

      {state === 'verifying' && (
        <span className="text-xs text-gray-500 animate-pulse">⏳ Đang tải &amp; xác minh…</span>
      )}

      {state === 'match' && (
        <span className="text-xs font-medium text-green-600">
          ✅ Hash khớp — chứng cứ xác thực thành công
        </span>
      )}

      {state === 'mismatch' && (
        <span className="text-xs font-medium text-red-600">
          ❌ Hash không khớp — dữ liệu có thể bị thay đổi
        </span>
      )}

      {state === 'error' && (
        <span className="text-xs text-orange-500">
          ⚠️ Lỗi: {errorMsg}{' '}
          <button onClick={handleVerify} className="underline">
            Thử lại
          </button>
        </span>
      )}
    </div>
  );
}
