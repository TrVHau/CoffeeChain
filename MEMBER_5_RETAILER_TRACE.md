# 🛒 ASSIGNMENT THÀNH VIÊN 5: RETAILER & TRACE MODULE
**Quản Lý Khâu Bán Lẻ, Truy Xuất Công Khai, Xác Thực Bằng Chứng**

---

## 📌 BUSINESS FLOW

```
RETAILER WORKFLOW:
1. Đăng nhập (retailer_eve / pw123) — Org2MSP
2. Xem danh sách PackagedBatch TRANSFERRED
3. Cập nhật status: TRANSFERRED → IN_STOCK → SOLD
   → Quản lý tồn kho + bán hàng
4. Bất kỳ ai (không cần login) có thể:
   → Quét QR hoặc enter public code
   → Xem trace công khai: Harvest ← Processed ← Roast ← Packaged ← Retail
   → Xem nhật ký canh tác (farm activities)
   → Verify chứng cứ (evidence) từ IPFS
```

---

## 💼 BACKEND TASKS

### 1. RetailerController.java
**File:** `backend/src/main/java/com/coffee/trace/controller/RetailerController.java`

**Endpoints:**

```java
// GET /api/retail — danh sách PackagedBatch
@GetMapping
@PreAuthorize("hasRole('RETAILER')")
public ResponseEntity<?> getMyBatches(@AuthenticationPrincipal String userId)

// GET /api/retail/{id}
@GetMapping("/{id}")
@PreAuthorize("hasRole('RETAILER')")
public ResponseEntity<?> getBatchDetail(@PathVariable String id)

// PATCH /api/retail/{id}/status — update to IN_STOCK hoặc SOLD
@PatchMapping("/{id}/status")
@PreAuthorize("hasRole('RETAILER')")
public ResponseEntity<?> updateStatus(
    @AuthenticationPrincipal String userId,
    @PathVariable String id,
    @Valid @RequestBody UpdateStatusRequest req
) throws Exception
```

### 2. TraceController.java (PUBLIC — no auth needed)
**File:** `backend/src/main/java/com/coffee/trace/controller/TraceController.java`

**Endpoints:**

```java
// GET /api/trace/{publicCode} — PUBLIC trace (no auth needed)
@GetMapping("/{publicCode}")
public ResponseEntity<?> getTrace(@PathVariable String publicCode) throws Exception

// GET /api/batch/{batchId}?source=chain — evaluate from chain (no auth needed)
@GetMapping("/{batchId}")
public ResponseEntity<?> getBatch(
    @PathVariable String batchId,
    @RequestParam(defaultValue = "db") String source
) throws Exception
```

### 3. Trace Logic
**File:** `backend/src/main/java/com/coffee/trace/service/TraceService.java` (create this)

```java
public class TraceService {
    
    private final BatchRepository batchRepo;
    private final FarmActivityRepository farmActivityRepo;
    private final LedgerRefRepository ledgerRefRepo;
    private final FabricGatewayService fabricGateway;
    
    // Build full trace chain từ PackagedBatch ngược lên Harvest
    public TraceResponse buildTrace(String publicCode) throws Exception {
        
        // 1. Find batch từ publicCode
        BatchEntity batch = batchRepo.findByPublicCode(publicCode);
        if (batch == null) {
            throw new NotFoundException("Batch not found");
        }
        
        // 2. Build chain: traverse parentBatchId ngược lên
        List<BatchEntity> chain = new ArrayList<>();
        chain.add(batch);
        String parentId = batch.getParentBatchId();
        
        while (parentId != null && !parentId.isEmpty()) {
            BatchEntity parent = batchRepo.findByBatchId(parentId);
            if (parent == null) break;
            chain.add(parent);
            parentId = parent.getParentBatchId();
        }
        
        // 3. Reverse chain để có thứ tự: Harvest → ... → Packaged
        Collections.reverse(chain);
        
        // 4. Get farm activities (only for HARVEST batch)
        List<FarmActivityEntity> activities = new ArrayList<>();
        if (chain.size() > 0 && chain.get(0).getType().equals("HARVEST")) {
            activities = farmActivityRepo.findByHarvestBatchId(chain.get(0).getBatchId());
        }
        
        // 5. Get ledger references (txId + blockNumber)
        Map<String, LedgerRefEntity> ledgerRefs = new HashMap<>();
        for (BatchEntity b : chain) {
            List<LedgerRefEntity> refs = ledgerRefRepo.findByBatchId(b.getBatchId());
            for (LedgerRefEntity ref : refs) {
                ledgerRefs.put(ref.getEventType(), ref);
            }
        }
        
        // 6. Build response
        TraceResponse response = new TraceResponse();
        response.setChain(chain);
        response.setFarmActivities(activities);
        response.setLedgerRefs(ledgerRefs);
        response.setVerifiedOnChain(true);
        
        return response;
    }
    
    // Fallback: if DB lag, evaluate từ chain
    public TraceResponse buildTraceFromChain(String publicCode) throws Exception {
        byte[] result = fabricGateway.evaluateAs(
            "queryBatchByPublicCode",
            publicCode
        );
        
        // Parse result → TraceResponse
        return JSON.deserialize(result, TraceResponse.class);
    }
}
```

### 4. Response DTOs

**TraceResponse:**
```java
@Data
public class TraceResponse {
    List<BatchEntity> chain;           // Harvest → ... → Packaged
    List<FarmActivityEntity> farmActivities;  // Activities for harvest
    Map<String, LedgerRefEntity> ledgerRefs;  // txId + blockNumber
    Boolean verifiedOnChain;           // Always true for trace
}
```

---

## 🎨 FRONTEND TASKS

### 1. Retailer Dashboard
**File:** `frontend/src/app/dashboard/retailer/page.tsx`

```typescript
// Hiển thị:
// - Danh sách PackagedBatch (filter by status: TRANSFERRED, IN_STOCK, SOLD)
// - Inventory stats
// - Button "Cập nhật trạng thái"

export default function RetailerDashboard() {
  const [batches, setBatches] = useState([]);
  const [filters, setFilters] = useState({ status: 'IN_STOCK' });
  
  useEffect(() => {
    api.getRetailerBatches(filters, token).then(setBatches);
  }, [filters]);
  
  async function updateStatus(batchId: string, newStatus: string) {
    await api.updateBatchStatus(batchId, newStatus, token);
    // Refresh list
  }
}
```

### 2. Public Trace Page (NO AUTH)
**File:** `frontend/src/app/trace/[publicCode]/page.tsx`

```typescript
// PUBLIC page — người tiêu dùng quét QR → vào đây
// Hiển thị:
// - Timeline full chain (Harvest → Packaged)
// - Farm activities (expandable)
// - Evidence verifier button
// - Ledger info (txId, block#)
// - NO authentication needed

export default function TracePage({ params }) {
  const { publicCode } = params;
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    api.getTrace(publicCode)
      .then(setTrace)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [publicCode]);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div className="trace-page">
      <h1>🌍 Truy Xuất Nguồn Gốc Cà Phê</h1>
      <p>Mã sản phẩm: <code>{publicCode}</code></p>
      
      <TraceTimeline
        chain={trace.chain}
        farmActivities={trace.farmActivities}
        ledgerRefs={trace.ledgerRefs}
      />
      
      <div className="verification-footer">
        ✅ Dữ liệu được xác thực từ blockchain Hyperledger Fabric
      </div>
    </div>
  );
}
```

### 3. TraceTimeline Component
**File:** `frontend/src/components/TraceTimeline.tsx`

```typescript
interface TraceStep {
  type: 'HARVEST' | 'PROCESSED' | 'ROAST' | 'PACKAGED' | 'RETAIL';
  date: string;
  actor: string;
  metadata: Record<string, string>;
  txId?: string;
  blockNum?: string;
  evidenceHash?: string;
}

export function TraceTimeline({
  chain, farmActivities, ledgerRefs
}: {
  chain: BatchEntity[];
  farmActivities: FarmActivityEntity[];
  ledgerRefs: Record<string, LedgerRefEntity>;
}) {
  
  const renderStep = (batch: BatchEntity, index: number) => {
    const icons = {
      HARVEST: '🌱',
      PROCESSED: '🏭',
      ROAST: '🔥',
      PACKAGED: '📦',
      RETAIL: '🛒'
    };
    
    return (
      <div key={batch.batchId} className="trace-step">
        <div className="step-header">
          <span className="icon">{icons[batch.type]}</span>
          <span className="stage">[{index + 1}/{chain.length}] {batch.type}</span>
          <span className="date">{batch.metadata?.date || batch.createdAt}</span>
        </div>
        
        <div className="step-details">
          <p><strong>Owner:</strong> {batch.ownerMSP}</p>
          <p><strong>User:</strong> {batch.ownerUserId}</p>
          {Object.entries(batch.metadata || {}).map(([k, v]) => (
            <p key={k}><strong>{k}:</strong> {v}</p>
          ))}
        </div>
        
        {batch.type === 'ROAST' && batch.evidenceHash && (
          <EvidenceVerifier
            batchId={batch.batchId}
            onChainHash={batch.evidenceHash}
            evidenceUri={batch.evidenceUri}
          />
        )}
        
        {batch.type === 'HARVEST' && farmActivities.length > 0 && (
          <FarmActivityLog activities={farmActivities} />
        )}
        
        <div className="ledger-ref">
          <small>
            🔗 Tx: {batch.batchId.substring(0, 8)}... | Block: ?
          </small>
        </div>
      </div>
    );
  };
  
  return (
    <div className="trace-timeline">
      {chain.map((batch, i) => renderStep(batch, i))}
    </div>
  );
}
```

### 4. EvidenceVerifier Component
**File:** `frontend/src/components/EvidenceVerifier.tsx` (same as Roaster module)

```typescript
export function EvidenceVerifier({
  batchId, onChainHash, evidenceUri
}: EvidenceVerifierProps) {
  const [result, setResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  
  async function verify() {
    setVerifying(true);
    try {
      // 1. Get on-chain hash từ world state
      const batch = await api.evaluateGetBatch(batchId);
      
      // 2. Download file từ IPFS
      const fileBuffer = await downloadFile(evidenceUri);
      
      // 3. Compute SHA-256 phía client
      const computedHash = await sha256(fileBuffer);
      
      setResult({
        onChainHash: batch.evidenceHash,
        computedHash,
        match: batch.evidenceHash === computedHash
      });
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setVerifying(false);
    }
  }
  
  return (
    <div className="evidence-verifier">
      <h4>🔍 Xác Minh Tính Toàn Vẹn File Chứng Cứ</h4>
      
      {!result && (
        <button onClick={verify} disabled={verifying}>
          {verifying ? 'Đang xác minh...' : 'Xác minh file'}
        </button>
      )}
      
      {result && (
        <>
          <div className="hash-row">
            <label>On-chain hash:</label>
            <code>{result.onChainHash}</code>
          </div>
          <div className="hash-row">
            <label>Computed hash:</label>
            <code>{result.computedHash}</code>
          </div>
          <div className={`status ${result.match ? 'match' : 'mismatch'}`}>
            {result.match
              ? '✅ KHỚP — File nguyên bản, chưa bị chỉnh sửa'
              : '❌ KHÔNG KHỚP — File có thể đã bị chỉnh sửa'}
          </div>
        </>
      )}
    </div>
  );
}
```

### 5. FarmActivityLog Component
**File:** `frontend/src/components/FarmActivityLog.tsx`

```typescript
const ACTIVITY_ICONS: Record<string, string> = {
  IRRIGATION: '🚿',
  FERTILIZATION: '🌿',
  PEST_CONTROL: '🐛',
  PRUNING: '✂️',
  SHADE_MANAGEMENT: '🌳',
  SOIL_TEST: '🧪',
  OTHER: '📝'
};

export function FarmActivityLog({
  activities
}: {
  activities: FarmActivityEntity[];
}) {
  const [open, setOpen] = useState(false);
  
  if (!activities || activities.length === 0) return null;
  
  return (
    <div className="farm-activity-log">
      <button onClick={() => setOpen(!open)} className="toggle-btn">
        🌾 NHẬT KÝ CANH TÁC ({activities.length}) [{open ? '▲' : '▼'}]
      </button>
      
      {open && (
        <ul className="activity-list">
          {activities.map((a, i) => (
            <li key={i} className="activity-item">
              <span className="icon">{ACTIVITY_ICONS[a.activityType] || '📝'}</span>
              <span className="date">[{a.activityDate}]</span>
              <span className="type">{a.activityType}</span>
              <span className="note">{a.note}</span>
              {a.txId && (
                <a href={`#tx-${a.txId}`} className="tx-link">
                  [txn↗]
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

## ⛓️ CHAINCODE TASKS

### 1. CoffeeTraceChaincode.java

**Function: updateBatchStatus**

```java
@Transaction(intent = Transaction.TYPE.SUBMIT)
public byte[] updateBatchStatus(Context ctx, String batchId, String newStatus)
    throws Exception {
    
    Batch batch = LedgerUtils.getBatch(ctx, batchId);
    String oldStatus = batch.getStatus();
    
    // Role-based validation
    String role = ctx.getClientIdentity().getAttributeValue("role");
    
    if (batch.getType().equals("PACKAGED")) {
        // Only RETAILER can update PACKAGED batch status
        RoleChecker.enforceRole(ctx, "RETAILER");
        
        // Valid transitions: COMPLETED → IN_STOCK → SOLD
        if (oldStatus.equals("COMPLETED") && newStatus.equals("IN_STOCK")) {
            // OK
        } else if (oldStatus.equals("IN_STOCK") && newStatus.equals("SOLD")) {
            // OK
        } else if (oldStatus.equals("TRANSFERRED") && newStatus.equals("IN_STOCK")) {
            // OK (after acceptTransfer)
        } else {
            throw new ChaincodeException("Invalid status transition");
        }
        
        // Emit appropriate event
        if (newStatus.equals("IN_STOCK")) {
            ctx.setEvent("BATCH_IN_STOCK", buildBatchPayload(ctx, batch));
        } else if (newStatus.equals("SOLD")) {
            ctx.setEvent("BATCH_SOLD", buildBatchPayload(ctx, batch));
        }
    } else {
        // For HARVEST, PROCESSED, ROAST: CREATED → IN_PROCESS → COMPLETED
        if (!isValidStatusTransition(batch.getType(), oldStatus, newStatus)) {
            throw new ChaincodeException("Invalid status transition");
        }
        
        ctx.setEvent("BATCH_STATUS_UPDATED", 
            buildStatusPayload(ctx, batch, oldStatus, newStatus));
    }
    
    batch.setStatus(newStatus);
    batch.setUpdatedAt(Instant.now().toString());
    ctx.getStub().putStateAsJson(batchId, batch);
    
    return JSON.serializeMap(stableEventMap("status", "SUCCESS"));
}
```

**Function: queryBatchByPublicCode (evaluate)**

```java
@Transaction(intent = Transaction.TYPE.EVALUATE)
public byte[] queryBatchByPublicCode(Context ctx, String publicCode) throws Exception {
    
    String query = JSON.serializeMap(stableEventMap(
        "selector", "docType", "batch",
        "publicCode", publicCode
    ));
    
    QueryResultsIterator<KeyValue> result = 
        ctx.getStub().getQueryResultIterator(query);
    
    if (result.hasNext()) {
        KeyValue kv = result.next();
        return kv.getStringValue().getBytes();
    }
    
    throw new ChaincodeException("Batch not found");
}
```

**Function: getTraceChain (evaluate)**

```java
@Transaction(intent = Transaction.TYPE.EVALUATE)
public byte[] getTraceChain(Context ctx, String batchId) throws Exception {
    
    List<Batch> chain = new ArrayList<>();
    Batch current = LedgerUtils.getBatch(ctx, batchId);
    
    // Traverse parent chain
    while (current != null) {
        chain.add(0, current);  // Prepend
        
        if (current.getParentBatchId() == null || 
            current.getParentBatchId().isEmpty()) {
            break;
        }
        
        current = LedgerUtils.getBatch(ctx, current.getParentBatchId());
    }
    
    return JSON.serialize(chain);
}
```

---

## 🧪 TESTING CHECKLIST

- [ ] Update status: TRANSFERRED → IN_STOCK → SOLD ✓
- [ ] Get trace public: `GET /api/trace/{publicCode}` ✓
  - No auth needed
  - Full chain returned
  - Farm activities included
  
- [ ] Verify evidence: client-side SHA-256 ✓
- [ ] Farm activity log display ✓
- [ ] Ledger references display ✓

---

## 🎓 VẤN ĐÁP

1. **Tại sao trace page không cần authentication?**
   - Để công khai cho người tiêu dùng
   - Họ chỉ cần QR code hoặc public code
   - Không cần đăng nhập

2. **Làm sao build chain từ PackagedBatch ngược lên?**
   - ParentBatchId trỏ tới parent batch
   - Recursively traverse: Packaged.parent → Roast, Roast.parent → Processed, etc

3. **Farm activities từ đâu?**
   - Event FARM_ACTIVITY_RECORDED được emit khi Farmer ghi activity
   - Backend indexer lưu vào PostgreSQL
   - Trace page query PostgreSQL để lấy

4. **Ledger references là gì?**
   - txId: transaction ID của event
   - blockNumber: block mà transaction được commit
   - Dùng để verify on-chain

5. **Nếu PostgreSQL lag so với blockchain?**
   - Backend có fallback: call `evaluateGetBatch()` evaluate from chain
   - Lấy state mới nhất từ world state

---

## 📎 FILES

**Backend:**
- `backend/src/main/java/com/coffee/trace/controller/RetailerController.java`
- `backend/src/main/java/com/coffee/trace/controller/TraceController.java` ← **MAIN**
- `backend/src/main/java/com/coffee/trace/service/TraceService.java` (create)
- `backend/src/main/java/com/coffee/trace/dto/response/TraceResponse.java`

**Frontend:**
- `frontend/src/app/dashboard/retailer/page.tsx`
- `frontend/src/app/trace/[publicCode]/page.tsx` ← **MAIN**
- `frontend/src/components/TraceTimeline.tsx` ← **MAIN**
- `frontend/src/components/EvidenceVerifier.tsx`
- `frontend/src/components/FarmActivityLog.tsx`

**Chaincode:**
- `chaincode/src/main/java/com/coffee/trace/chaincode/CoffeeTraceChaincode.java` → `updateBatchStatus()`, `queryBatchByPublicCode()`, `getTraceChain()`

---

## 🚀 START HERE

1. Implement TraceService.buildTrace() logic
2. Implement TraceController endpoints (PUBLIC!)
3. Implement RetailerController endpoints
4. Implement chaincode functions
5. Implement TraceTimeline + EvidenceVerifier + FarmActivityLog components
6. Test public trace flow (no auth)
7. Test evidence verification

**Ship it! 🚀**
