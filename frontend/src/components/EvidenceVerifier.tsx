'use client';

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
  return uri;
}

export function EvidenceVerifier({ batchId: _batchId, onChainHash: _onChainHash, evidenceUri }: EvidenceVerifierProps) {

  if (!evidenceUri) {
    return <p className="text-xs italic text-slate-400">Chưa có chứng cứ đính kèm</p>;
  }

  return (
    <div className="mt-2">
      <a
        href={ipfsToHttp(evidenceUri)}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-medium text-rose-700 underline-offset-2 hover:underline"
      >
        Xem ảnh minh chứng
      </a>
    </div>
  );
}
