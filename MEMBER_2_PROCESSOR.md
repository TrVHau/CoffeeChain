# 🏭 ASSIGNMENT THÀNH VIÊN 2: PROCESSOR MODULE
**Quản Lý Khâu Sơ Chế Cà Phê**

---

## 📌 BUSINESS FLOW

```
PROCESSOR WORKFLOW:
1. Đăng nhập (processor_bob / pw123)
2. Xem danh sách HarvestBatch COMPLETED từ Farmer
3. Tạo ProcessedBatch từ HarvestBatch
   → Metadata: phương pháp sơ chế (Washed/Natural/Honey)
   → Ngày bắt đầu, kết thúc, tên cơ sở, trọng lượng đầu ra
4. Cập nhật status: CREATED → (IN_PROCESS) → COMPLETED
   → Khi COMPLETED, Roaster mới có thể lấy batch này
```

---

## 💼 BACKEND TASKS

### 1. ProcessorController.java
**File:** `backend/src/main/java/com/coffee/trace/controller/ProcessorController.java`

**Endpoints:**

```java
// POST /api/process — tạo ProcessedBatch
@PostMapping
@PreAuthorize("hasRole('PROCESSOR')")
public ResponseEntity<?> createProcessedBatch(
    @AuthenticationPrincipal String userId,
    @Valid @RequestBody CreateProcessedBatchRequest req
) throws Exception

// GET /api/process — lấy danh sách batch của processor
@GetMapping
@PreAuthorize("hasRole('PROCESSOR')")
public ResponseEntity<?> getMyBatches(@AuthenticationPrincipal String userId)

// GET /api/process/{id} — chi tiết batch
@GetMapping("/{id}")
@PreAuthorize("hasRole('PROCESSOR')")
public ResponseEntity<?> getBatchDetail(@PathVariable String id)

// PATCH /api/process/{id}/status — cập nhật status
@PatchMapping("/{id}/status")
@PreAuthorize("hasRole('PROCESSOR')")
public ResponseEntity<?> updateStatus(
    @AuthenticationPrincipal String userId,
    @PathVariable String id,
    @Valid @RequestBody UpdateStatusRequest req
) throws Exception

// GET /api/process/parent/{parentId}/available — list parent batches available for processing
@GetMapping("/parent/{parentId}/available")
@PreAuthorize("hasRole('PROCESSOR')")
public ResponseEntity<?> getAvailableParentBatches()
```

**Key logic:**
- Query HarvestBatch with status=COMPLETED từ on-chain hoặc PostgreSQL
- Call `FabricGatewayService.submitAs(userId, "createProcessedBatch", ...)`
- Validate parentBatchId is COMPLETED trước khi submit

### 2. Request DTO
**File:** `backend/src/main/java/com/coffee/trace/dto/request/CreateProcessedBatchRequest.java`

```java
@Data
@Valid
public class CreateProcessedBatchRequest {
    @NotBlank
    String parentBatchId;        // HarvestBatch ID
    
    @NotBlank
    String processingMethod;     // "Washed", "Natural", "Honey"
    
    @NotBlank
    String startDate;            // "2026-03-22"
    
    @NotBlank
    String endDate;              // "2026-03-25"
    
    @NotBlank
    String facilityName;         // "Đà Lạt Mill"
    
    @NotNull
    Double weightKg;             // 460.0 (phải < parent weight)
}
```

### 3. Service Logic
- Create method in ProcessorController: validate parent batch (must be HARVEST type, status COMPLETED)
- Query parent từ chain hoặc PostgreSQL để lấy weight
- Validate `weightKg < parentBatchId.weight` (có mất nước/hư hại)

---

## 🎨 FRONTEND TASKS

### 1. Processor Dashboard
**File:** `frontend/src/app/dashboard/processor/page.tsx`

```typescript
// Hiển thị:
// - Danh sách ProcessedBatch của processor
// - Danh sách HarvestBatch available (status=COMPLETED)
// - Button "Tạo lô sơ chế mới" → form

export default function ProcessorDashboard() {
  // GET /api/process — my batches
  // GET /api/process/parent/available — available parent
  // Render list + actions
}
```

### 2. Create Processed Batch Form
**File:** `frontend/src/app/dashboard/processor/update/page.tsx` (hoặc modal)

```typescript
// Form fields:
// - Parent batch (dropdown with details)
// - Processing method (dropdown)
// - Start date, end date (date pickers)
// - Facility name (text)
// - Weight output (number)
// - Submit → POST /api/process

export function CreateProcessedBatchForm() {
  const [parentBatch, setParentBatch] = useState(null);
  // On parent select: show parent details (weight, date, variety)
  // Validate output weight < parent weight
}
```

### 3. Batch Detail & Status Update
**File:** `frontend/src/app/dashboard/processor/[id]/page.tsx`

```typescript
// Hiển thị:
// - Parent batch link
// - Processing details (method, dates, facility, weight)
// - Status update buttons
// - Back link to list

export default function ProcessedBatchDetail({ params }) {
  // GET /api/process/{id}
  // GET parent batch info for context
  // Show parent chain
}
```

---

## ⛓️ CHAINCODE TASKS

### 1. CoffeeTraceChaincode.java

**Function: createProcessedBatch**

```java
@Transaction(intent = Transaction.TYPE.SUBMIT)
public byte[] createProcessedBatch(
    Context ctx,
    String parentBatchId,
    String processingMethod,
    String startDate,
    String endDate,
    String facilityName,
    double weightKg
) throws Exception {
    
    // 1. Check role = PROCESSOR
    RoleChecker.enforceRole(ctx, "PROCESSOR");
    
    // 2. Get parent batch
    Batch parentBatch = LedgerUtils.getBatch(ctx, parentBatchId);
    if (parentBatch == null) {
        throw new ChaincodeException("Parent batch not found");
    }
    
    // 3. Validate parent is HARVEST and COMPLETED
    if (!parentBatch.getType().equals("HARVEST")) {
        throw new ChaincodeException("Parent must be HARVEST type");
    }
    if (!parentBatch.getStatus().equals("COMPLETED")) {
        throw new ChaincodeException("Parent batch must be COMPLETED");
    }
    
    // 4. Validate weight
    double parentWeight = Double.parseDouble(
        parentBatch.getMetadata().get("weightKg")
    );
    if (weightKg > parentWeight) {
        throw new ChaincodeException("Output weight cannot exceed parent weight");
    }
    
    // 5. Verify owner MSP (should be Org1)
    String ownerMSP = ctx.getClientIdentity().getMSPID();
    if (!ownerMSP.equals(parentBatch.getOwnerMSP())) {
        throw new ChaincodeException("Only parent batch owner can process");
    }
    
    // 6. Create new batch
    String batchId = ctx.getStub().getTxId() + "-" + System.currentTimeMillis();
    String publicCode = "PROC-" + startDate.replace("-", "") + "-001";
    
    Batch batch = new Batch();
    batch.setBatchId(batchId);
    batch.setPublicCode(publicCode);
    batch.setDocType("batch");
    batch.setType("PROCESSED");
    batch.setParentBatchId(parentBatchId);
    batch.setOwnerMSP(ownerMSP);
    batch.setOwnerUserId(ctx.getClientIdentity().getX509Certificate()
        .getSubjectDN().getName());
    batch.setStatus("CREATED");
    
    Map<String, String> metadata = new HashMap<>();
    metadata.put("processingMethod", processingMethod);
    metadata.put("startDate", startDate);
    metadata.put("endDate", endDate);
    metadata.put("facilityName", facilityName);
    metadata.put("weightKg", String.valueOf(weightKg));
    batch.setMetadata(metadata);
    
    batch.setCreatedAt(Instant.now().toString());
    batch.setUpdatedAt(batch.getCreatedAt());
    
    // 7. Save
    ctx.getStub().putStateAsJson(batchId, batch);
    ctx.setEvent("BATCH_CREATED", buildBatchPayload(ctx, batch));
    
    return JSON.serializeMap(stableEventMap(
        "batchId", batchId,
        "publicCode", publicCode,
        "parentBatchId", parentBatchId
    ));
}
```

**Function: getAvailableHarvestBatches (evaluate)**

```java
@Transaction(intent = Transaction.TYPE.EVALUATE)
public byte[] getAvailableHarvestBatches(Context ctx) throws Exception {
    
    // Query all HARVEST batches with status=COMPLETED
    String queryStr = JSON.serializeMap(stableEventMap(
        "selector", "docType", "batch",
        "type", "HARVEST",
        "status", "COMPLETED"
    ));
    
    QueryResultsIterator<KeyValue> result = ctx.getStub()
        .getQueryResultIterator(queryStr);
    
    List<Batch> batches = new ArrayList<>();
    while (result.hasNext()) {
        KeyValue kv = result.next();
        Batch b = JSON.deserialize(kv.getStringValue(), Batch.class);
        batches.add(b);
    }
    
    return JSON.serialize(batches);
}
```

---

## 🧪 TESTING CHECKLIST

- [ ] Query available HarvestBatches ✓
- [ ] Create ProcessedBatch: `POST /api/process` ✓
  - Verify parent validation
  - Verify weight validation
  - Verify batchId, publicCode
  
- [ ] Get my ProcessedBatches: `GET /api/process` ✓
- [ ] Update status: CREATED → COMPLETED ✓
- [ ] Get detail: `GET /api/process/{id}` ✓

---

## 🎓 VẤN ĐÁP

1. **Tại sao cần validate parent batch status?**
   - Farmer phải COMPLETED batch trước mới có thể Processor xử lý
   - Nếu Farmer chưa COMPLETED, batch còn đang được canh tác

2. **Weight có thể bằng parent không?**
   - Không, vì quá trình sơ chế có mất nước/hư hại
   - Output weight phải < parent weight

3. **Ai có thể process một batch?**
   - Chỉ processor ở Org1 (ownerMSP của parent batch)
   - Nếu batch được transfer sang Org2, Org2 không thể process

4. **Parent batch chain có thể dài không?**
   - V1: HARVEST → PROCESSED → ROAST → PACKAGED
   - Processor chỉ lấy từ HARVEST, không phải từ PROCESSED

5. **Làm sao trace ngược từ ProcessedBatch?**
   - parentBatchId trỏ tới HarvestBatch
   - Trong trace page, follow chain ngược lên

---

## 📎 FILES

**Backend:**
- `backend/src/main/java/com/coffee/trace/controller/ProcessorController.java` ← **MAIN**
- `backend/src/main/java/com/coffee/trace/dto/request/CreateProcessedBatchRequest.java`

**Frontend:**
- `frontend/src/app/dashboard/processor/page.tsx` ← **MAIN**
- `frontend/src/app/dashboard/processor/update/page.tsx` (hoặc modal)
- `frontend/src/app/dashboard/processor/[id]/page.tsx`

**Chaincode:**
- `chaincode/src/main/java/com/coffee/trace/chaincode/CoffeeTraceChaincode.java` → `createProcessedBatch()`, `getAvailableHarvestBatches()`

**Shared Services:**
- `FabricGatewayService`
- `BatchRepository`

---

## 🚀 START HERE

1. Review ProcessorController code
2. Implement endpoints
3. Implement chaincode functions
4. Test with Postman
5. Implement frontend
6. End-to-end test

**Happy coding! 🏭**
