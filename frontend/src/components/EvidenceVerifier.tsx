'use client';

import { useState } from 'react';

type VerifyState = 'idle' | 'verifying' | 'match' | 'mismatch' | 'error';

interface EvidenceVerifierProps {
  batchId: string;
  onChainHash: string;
  evidenceUri?: string;
}

function ipfsToHttp(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }
  if (uri.startsWith('http://ipfs:8081/')) {
    return uri.replace('http://ipfs:8081/', 'https://ipfs.io/');
  }
  if (uri.startsWith('https://ipfs:8081/')) {
    return uri.replace('https://ipfs:8081/', 'https://ipfs.io/');
  }
  const ipfsMarker = '/ipfs/';
  const markerIndex = uri.indexOf(ipfsMarker);
  if (markerIndex >= 0) {
    const path = uri.slice(markerIndex + 1);
    return `https://ipfs.io/${path}`;
  }
  return uri;
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function EvidenceVerifier({ batchId: _batchId, onChainHash, evidenceUri }: EvidenceVerifierProps) {
  const [state, setState] = useState<VerifyState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  if (!evidenceUri) {
    return <p className="text-xs italic text-slate-400">Chưa có chứng cứ đính kèm</p>;
  }

  async function handleVerify() {
    setState('verifying');
    setErrorMsg('');
    try {
      const url = ipfsToHttp(evidenceUri ?? '');
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const buffer = await response.arrayBuffer();
      const computedHash = await sha256Hex(buffer);
      setState(computedHash === onChainHash ? 'match' : 'mismatch');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi không xác định');
      setState('error');
    }
  }

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <a
          href={ipfsToHttp(evidenceUri)}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-rose-700 underline-offset-2 hover:underline"
        >
          Xem minh chứng
        </a>
        {onChainHash
          ? <span className="font-mono">Hash: {onChainHash.slice(0, 12)}...</span>
          : <span className="italic text-slate-400">Chưa có hash on-chain để đối chiếu</span>}
      </div>

      <div className="flex items-center gap-2">
        {onChainHash && state === 'idle' && (
          <button
            onClick={handleVerify}
            className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
          >
            Xác minh hash chứng cứ
          </button>
        )}

        {state === 'verifying' && (
          <span className="animate-pulse text-xs text-slate-500">Đang tải và xác minh...</span>
        )}

        {state === 'match' && (
          <span className="text-xs font-medium text-emerald-600">
            Hash khớp. Chứng cứ xác thực thành công.
          </span>
        )}

        {state === 'mismatch' && (
          <span className="text-xs font-medium text-red-600">
            Hash không khớp. Dữ liệu có thể đã bị thay đổi.
          </span>
        )}

        {state === 'error' && (
          <span className="text-xs text-orange-600">
            Lỗi: {errorMsg}{' '}
            <button onClick={handleVerify} className="underline">
              Thử lại
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
