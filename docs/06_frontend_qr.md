# Frontend & QR Code

## 1. Cấu Trúc Trang

```
/login
/dashboard                            → redirect theo role

/dashboard/farmer
  ├── Danh sách HarvestBatch của mình
  ├── Tạo HarvestBatch mới
  ├── Nhật ký canh tác (xem + thêm activity per batch)
  └── Cập nhật status: CREATED → IN_PROCESS → COMPLETED

/dashboard/processor
  ├── HarvestBatch COMPLETED → tạo ProcessedBatch
  └── Cập nhật status: CREATED → IN_PROCESS → COMPLETED

/dashboard/roaster
  ├── ProcessedBatch COMPLETED → tạo RoastBatch
  ├── Upload chứng cứ (PDF / ảnh) → verify hash
  ├── Cập nhật status: CREATED → IN_PROCESS → COMPLETED
  └── requestTransfer sang Org2 (Packager)

/dashboard/packager
  ├── RoastBatch TRANSFER_PENDING → acceptTransfer
  ├── Tạo PackagedBatch (status = COMPLETED ngay)
  └── Sinh & tải QR code

/dashboard/retailer
  ├── PackagedBatch TRANSFERRED → IN_STOCK → SOLD
  └── Xem danh sách hàng tồn kho

/trace/{publicCode}                   → CÔNG KHAI (không cần đăng nhập)
```

---

## 2. Trang Truy Xuất Công Khai `/trace/{publicCode}`

```
┌────────────────────────────────────────────────────────┐
│  ☕ TRUY XUẤT NGUỒN GỐC CÀ PHÊ                        │
│  Mã: PKG-20240403-001  |  ✅ Đã bán                   │
├─────────────────────���──────────────────────────────────┤
│  ✅ [04/04] BÁN LẺ      Retailer XYZ                  │
│  📦 [03/04] ĐÓNG GÓI   Org2 — Đà Lạt Coffee          │
│  🔥 [01/04] RANG        Org1 — Roastery Cầu Đất       │
│             📎 Giấy kiểm định  [🔍 Xác minh hash]     │
│  🌿 [25/03] SƠ CHẾ     Org1 — Washed                 │
│  🌱 [15/03] THU HOẠCH  farmer_alice — Cầu Đất        │
│  └─ 🌾 NHẬT KÝ CANH TÁC [▼]                          │
│       [01/03] 🐛 Phun thuốc  [tx↗]                    │
│       [15/02] 🌿 Bón phân    [tx↗]                    │
│       [01/02] 🚿 Tưới nước   [tx↗]                    │
│       [10/01] ✂️  Tỉa cành   [tx↗]                    │
│  ──────────────────────────────────────────────────── │
│  🔗 Nguồn: Hyperledger Fabric ledger events           │
│  Block #1247 | Tx: abc123...                          │
└────────────────────────────────────────────────────────┘
```

---

## 3. Component TraceTimeline.tsx

```typescript
// src/components/TraceTimeline.tsx

interface TraceStep {
  type:      'HARVEST' | 'PROCESSED' | 'ROAST' | 'PACKAGED' | 'RETAIL';
  date:      string;
  actor:     string;
  metadata:  Record<string, string>;
  txId?:     string;
  blockNum?: string;
  evidenceHash?: string;
  evidenceUri?:  string;
}

interface TraceTimelineProps {
  chain:          Batch[];
  farmActivities: FarmActivity[];
  ledgerRefs:     Record<string, LedgerRef>;
}

export function TraceTimeline({
  chain, farmActivities, ledgerRefs
}: TraceTimelineProps) {

  const steps = buildSteps(chain, ledgerRefs);
  const harvestBatch = chain[chain.length - 1];

  return (
    <div className="trace-timeline">
      {steps.map((step, i) => (
        <TimelineItem key={i} step={step}>
          {step.type === 'ROAST' && step.evidenceHash && (
            <EvidenceVerifier
              batchId={/* batchId */}
              onChainHash={step.evidenceHash}
              evidenceUri={step.evidenceUri}
            />
          )}
          {step.type === 'HARVEST' && (
            <FarmActivityLog
              activities={farmActivities}
              harvestBatchId={harvestBatch.batchId}
            />
          )}
        </TimelineItem>
      ))}

      <div className="ledger-footer">
        🔗 Nguồn: Hyperledger Fabric ledger events<br/>
        Block #{ledgerRefs?.batchCreated?.blockNumber} |
        Tx: {ledgerRefs?.batchCreated?.txId?.slice(0, 8)}...
      </div>
    </div>
  );
}
```

---

## 4. Component EvidenceVerifier.tsx

```typescript
// src/components/EvidenceVerifier.tsx

interface EvidenceVerifierProps {
  batchId:     string;
  onChainHash: string;   // từ world state (evaluateGetBatch)
  evidenceUri: string;   // IPFS URL để tải file
}

export function EvidenceVerifier({
  batchId, onChainHash, evidenceUri
}: EvidenceVerifierProps) {

  const [result, setResult] = useState<{
    onChainHash:   string;
    computedHash:  string;
    match:         boolean;
  } | null>(null);

  async function verify() {
    // 1. Hash on-chain: lấy từ world state trực tiếp (không qua DB)
    const batch = await api.evaluateGetBatch(batchId);

    // 2. Tính hash phía client từ file tải về
    const fileBuffer  = await downloadFile(evidenceUri);
    const computedHash = await sha256(fileBuffer);

    setResult({
      onChainHash:  batch.evidenceHash,
      computedHash,
      match: batch.evidenceHash === computedHash,
    });
  }

  return (
    <div className="evidence-verifier">
      <h4>🔍 Xác minh tính toàn vẹn file chứng cứ</h4>

      {result ? (
        <>
          <div>On-chain hash:   <code>{result.onChainHash}</code></div>
          <div>Computed hash:   <code>{result.computedHash}</code></div>
          <div className={result.match ? 'match' : 'mismatch'}>
            {result.match
              ? '✅ KHỚP — File nguyên bản, chưa bị chỉnh sửa'
              : '❌ KHÔNG KHỚP — File có thể đã bị chỉnh sửa'}
          </div>
        </>
      ) : (
        <button onClick={verify}>
          📎 Xác minh file chứng cứ
        </button>
      )}
    </div>
  );
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function downloadFile(uri: string): Promise<ArrayBuffer> {
  // Chuyển ipfs:// → HTTP gateway
  const url = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
  const res = await fetch(url);
  return res.arrayBuffer();
}
```

---

## 5. Component FarmActivityLog.tsx

```typescript
// src/components/FarmActivityLog.tsx

const ACTIVITY_ICONS: Record<string, string> = {
  IRRIGATION:       '🚿',
  FERTILIZATION:    '🌿',
  PEST_CONTROL:     '🐛',
  PRUNING:          '✂️',
  SHADE_MANAGEMENT: '🌳',
  SOIL_TEST:        '🧪',
  OTHER:            '📝',
};

export function FarmActivityLog({
  activities,
  harvestBatchId
}: {
  activities: FarmActivity[];
  harvestBatchId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="farm-activity-log">
      <button onClick={() => setOpen(!open)}>
        🌾 NHẬT KÝ CANH TÁC [{open ? '▲' : '▼'}]
      </button>

      {open && (
        <ul>
          {activities.map((a, i) => (
            <li key={i}>
              <span>{ACTIVITY_ICONS[a.activityType] ?? '📝'}</span>
              <span>[{formatDate(a.activityDate)}]</span>
              <span>{a.activityType}</span>
              <span>{a.note}</span>
              {a.txId && (
                <a href={`/explorer/tx/${a.txId}`}
                   target="_blank" rel="noreferrer">
                  [tx↗]
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

## 6. API Client (Next.js)

```typescript
// src/lib/api.ts

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

export const api = {

  // Public — không cần auth
  getTrace: (publicCode: string) =>
    fetch(`${BASE}/api/trace/${publicCode}`)
      .then(r => r.json()) as Promise<TraceResponse>,

  getQr: (publicCode: string) =>
    `${BASE}/api/qr/${publicCode}`,  // trả về URL trực tiếp cho <img src>

  // Evaluate từ world state (không qua DB) — dùng trong EvidenceVerifier
  evaluateGetBatch: async (batchId: string): Promise<Batch> => {
    const res = await fetch(`${BASE}/api/batch/${batchId}?source=chain`);
    return res.json();
  },

  // Authenticated
  createHarvestBatch: (data: HarvestBatchRequest, token: string) =>
    fetchAuth('POST', '/api/harvest', data, token),

  createProcessedBatch: (data: ProcessedBatchRequest, token: string) =>
    fetchAuth('POST', '/api/process', data, token),

  createRoastBatch: (data: RoastBatchRequest, token: string) =>
    fetchAuth('POST', '/api/roast', data, token),

  uploadEvidence: (file: File, token: string) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${BASE}/api/evidence/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }).then(r => r.json()) as Promise<{ hash: string; uri: string }>;
  },

  requestTransfer: (batchId: string, toMSP: string, token: string) =>
    fetchAuth('POST', '/api/transfer/request', { batchId, toMSP }, token),

  acceptTransfer: (batchId: string, token: string) =>
    fetchAuth('POST', `/api/transfer/accept/${batchId}`, {}, token),

  updateStatus: (batchId: string, status: string, token: string) =>
    fetchAuth('PATCH', `/api/batch/${batchId}/status`, { status }, token),
};

function fetchAuth(
  method: string, path: string,
  body: object, token: string
) {
  return fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  }).then(r => r.json());
}
```