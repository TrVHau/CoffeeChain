// TODO Week 2: Implement SHA-256 browser-side verification
// Sử dụng Web Crypto API — hoàn toàn độc lập với BE

'use client';

interface EvidenceVerifierProps {
  batchId:       string;
  onChainHash:   string;
  evidenceUri?:  string;  // IPFS URI: ipfs://Qm...
}

export function EvidenceVerifier(_props: EvidenceVerifierProps) {
  // TODO Week 2:
  // 1. Download file từ evidenceUri (IPFS gateway)
  // 2. const buffer = await file.arrayBuffer()
  // 3. const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  // 4. Convert hashBuffer → hex string
  // 5. Compare với onChainHash → hiển thị ✅ Khớp / ❌ Không khớp
  return (
    <div className="evidence-verifier rounded border border-gray-200 p-3">
      <p className="text-sm text-gray-400">EvidenceVerifier — Tuần 2</p>
    </div>
  );
}
