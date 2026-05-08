# 🌱 ASSIGNMENT THÀNH VIÊN 1: FARMER MODULE
**Quản Lý Khâu Thu Hoạch, Ghi Nhật Ký Canh Tác**

---

## 📌 BUSINESS FLOW

```
FARMER WORKFLOW:
1. Đăng nhập (farmer_alice / pw123)
2. Tạo HarvestBatch (vùng trồng, ngày thu, giống, trọng lượng)
   → System sinh batchId + publicCode + QR code
3. Thêm farm activities (tưới, bón phân, phun thuốc, tỉa cành)
   → Mỗi activity ghi lại activityDate (có thể là ngày quá khứ)
   → Optional: upload file chứng cứ (tính SHA-256)
4. Cập nhật status: CREATED → (IN_PROCESS) → COMPLETED
   → Khi COMPLETED, Processor mới có thể lấy batch này
```

---

## 💼 BACKEND TASKS

### 1. FarmerController.java
**File:** `backend/src/main/java/com/coffee/trace/controller/FarmerController.java`

**Endpoints cần implement:**

```java
// POST /api/harvest — tạo HarvestBatch
@PostMapping
@PreAuthorize("hasRole('FARMER')")
public ResponseEntity<?> createHarvestBatch(
    @AuthenticationPrincipal String userId,
    @Valid @RequestBody CreateHarvestBatchRequest req
) throws Exception

// GET /api/harvest — lấy danh sách batch của farmer này
@GetMapping
@PreAuthorize("hasRole('FARMER')")
public ResponseEntity<?> getMyBatches(@AuthenticationPrincipal String userId)

// GET /api/harvest/{id} — lấy chi tiết batch
@GetMapping("/{id}")
@PreAuthorize("hasRole('FARMER')")
public ResponseEntity<?> getBatchDetail(@PathVariable String id)

// PATCH /api/harvest/{id}/status — cập nhật status
@PatchMapping("/{id}/status")
@PreAuthorize("hasRole('FARMER')")
public ResponseEntity<?> updateStatus(
    @AuthenticationPrincipal String userId,
    @PathVariable String id,
    @Valid @RequestBody UpdateStatusRequest req
) throws Exception

// POST /api/harvest/{id}/activity — ghi farm activity
@PostMapping("/{id}/activity")
@PreAuthorize("hasRole('FARMER')")
public ResponseEntity<?> recordFarmActivity(
    @AuthenticationPrincipal String userId,
    @PathVariable String id,
    @Valid @RequestBody RecordFarmActivityRequest req
) throws Exception

// GET /api/harvest/{id}/activities — lấy danh sách activities
@GetMapping("/{id}/activities")
@PreAuthorize("hasRole('FARMER')")
public ResponseEntity<?> getActivities(@PathVariable String id)
```

**Key logic:**
- Call `FabricGatewayService.submitAs(userId, "createHarvestBatch", ...)`
- Call `FabricGatewayService.submitAs(userId, "recordFarmActivity", ...)`
- Parse response → return BatchResponse

### 2. Request DTOs
**File:** `backend/src/main/java/com/coffee/trace/dto/request/CreateHarvestBatchRequest.java`

```java
@Data
@Valid
public class CreateHarvestBatchRequest {
    @NotBlank
    String farmLocation;    // "Cầu Đất, Đà Lạt"
    
    @NotBlank
    String harvestDate;     // ISO-8601: "2026-03-21"
    
    @NotBlank
    String coffeeVariety;   // "Arabica", "Robusta"
    
    @NotNull
    Double weightKg;        // 500.0
}
```

**File:** `backend/src/main/java/com/coffee/trace/dto/request/RecordFarmActivityRequest.java`

```java
@Data
@Valid
public class RecordFarmActivityRequest {
    @NotBlank
    String activityType;    // IRRIGATION, FERTILIZATION, PEST_CONTROL, PRUNING, etc
    
    @NotBlank
    String activityDate;    // "2026-02-15" (có thể là ngày quá khứ)
    
    String note;            // "NPK 16-16-8, 200g/cây..."
    
    String evidenceHash;    // Optional: nếu có upload file
    
    String evidenceUri;     // Optional: ipfs://Qm...
}
```

### 3. Entity & Repository

**Entity:** `backend/src/main/java/com/coffee/trace/entity/FarmActivityEntity.java`
- Lưu trong PostgreSQL
- Fields: id, harvestBatchId, activityType, activityDate, note, evidenceHash, recordedAt, txId

**Repository:** `backend/src/main/java/com/coffee/trace/repository/FarmActivityRepository.java`
- Method: `List<FarmActivityEntity> findByHarvestBatchId(String harvestBatchId)`

### 4. Service Integration
- `FabricGatewayService` sẽ do shared infrastructure develop
- Call like: `fabricGateway.submitAs(userId, "createHarvestBatch", farmLocation, harvestDate, ...)`

---

## 🎨 FRONTEND TASKS

### 1. Dashboard Page
**File:** `frontend/src/app/dashboard/farmer/page.tsx`

```typescript
// Hiển thị:
// - Danh sách HarvestBatch của farmer này
// - Nút "Tạo lô mới"
// - Mỗi batch: batchId, status, weight, public code, action links

export default function FarmerDashboard() {
  // Hook useAuth() để lấy token
  // API call: GET /api/harvest
  // Hiển thị list
  // Link để xem chi tiết / update status
}
```

### 2. Create Harvest Form
**File:** `frontend/src/app/dashboard/farmer/update/page.tsx`

```typescript
// Form tạo batch mới:
// - Farm location (text)
// - Harvest date (date picker)
// - Coffee variety (dropdown: Arabica, Robusta)
// - Weight (number)
// - Submit button → POST /api/harvest
// - Response: batchId, publicCode → redirect to detail
```

### 3. Batch Detail & Farm Activity Log
**File:** `frontend/src/app/dashboard/farmer/[id]/page.tsx`

```typescript
// Hiển thị:
// - Batch info (location, date, variety, weight, status)
// - Status update buttons (CREATED → IN_PROCESS → COMPLETED)
// - Farm activities list component
// - Button "Thêm hoạt động mới"

export default function BatchDetail({ params }) {
  const { id } = params;
  // GET /api/harvest/{id}
  // GET /api/harvest/{id}/activities
  // Render detail + activities
}
```

### 4. Add Farm Activity Form
**File:** Popup/Modal component

```typescript
// Form:
// - Activity type (dropdown)
// - Activity date (date picker)
// - Note (textarea)
// - File upload (optional)
// - Submit → POST /api/harvest/{id}/activity

export function AddActivityModal({ batchId, onSuccess }) {
  // Form logic
  // Upload handler
  // Submit logic
}
```

### 5. Farm Activity Log Component
**File:** `frontend/src/components/FarmActivityLog.tsx`

```typescript
// Hiển thị timeline hoạt động:
// [01/03] 🐛 Phun thuốc "NPK 16-16-8..." [tx↗]
// [15/02] 🌿 Bón phân "200g/cây..." [tx↗]
// [01/02] 🚿 Tưới nước "Tưới toàn vườn..." [tx↗]

interface FarmActivity {
  id: number;
  activityType: string;
  activityDate: string;
  note: string;
  evidenceHash?: string;
  txId?: string;
}

export function FarmActivityLog({ activities }) {
  // Map activities, render icons
  // Link to ledger explorer (optional)
}
```

---

## ⛓️ CHAINCODE TASKS

### 1. CoffeeTraceChaincode.java

**Function: createHarvestBatch**

```java
@Transaction(intent = Transaction.TYPE.SUBMIT)
public byte[] createHarvestBatch(
    Context ctx,
    String farmLocation,
    String harvestDate,
    String coffeeVariety,
    double weightKg
) throws Exception {
    
    // 1. Check role = FARMER
    RoleChecker.enforceRole(ctx, "FARMER");
    
    // 2. Get user MSP
    String ownerMSP = ctx.getClientIdentity().getMSPID();  // Org1MSP
    String userId = ctx.getClientIdentity().getX509Certificate().getSubjectDN().getName();
    
    // 3. Generate batchId = txId + timestamp
    String batchId = ctx.getStub().getTxId() + "-" + System.currentTimeMillis();
    
    // 4. Generate publicCode = "FARM-20260321-001" (or random)
    String publicCode = "FARM-" + harvestDate.replace("-", "") + "-001";
    
    // 5. Build Batch object
    Batch batch = new Batch();
    batch.setBatchId(batchId);
    batch.setPublicCode(publicCode);
    batch.setDocType("batch");
    batch.setType("HARVEST");
    batch.setParentBatchId("");
    batch.setOwnerMSP(ownerMSP);
    batch.setOwnerUserId(userId);
    batch.setStatus("CREATED");
    
    Map<String, String> metadata = new HashMap<>();
    metadata.put("farmLocation", farmLocation);
    metadata.put("harvestDate", harvestDate);
    metadata.put("coffeeVariety", coffeeVariety);
    metadata.put("weightKg", String.valueOf(weightKg));
    batch.setMetadata(metadata);
    
    batch.setCreatedAt(Instant.now().toString());
    batch.setUpdatedAt(batch.getCreatedAt());
    
    // 6. Save to world state
    ctx.getStub().putStateAsJson(batchId, batch);
    
    // 7. Emit event
    ctx.setEvent("BATCH_CREATED", buildBatchPayload(ctx, batch));
    
    return JSON.serializeMap(stableEventMap(
        "batchId", batchId,
        "publicCode", publicCode,
        "status", "SUCCESS"
    ));
}
```

**Function: recordFarmActivity**

```java
@Transaction(intent = Transaction.TYPE.SUBMIT)
public byte[] recordFarmActivity(
    Context ctx,
    String harvestBatchId,
    String activityType,
    String activityDate,
    String note,
    String evidenceHash,
    String evidenceUri
) throws Exception {
    
    // 1. Check role = FARMER
    RoleChecker.enforceRole(ctx, "FARMER");
    
    // 2. Verify harvestBatchId exists and is HARVEST type
    Batch harvestBatch = LedgerUtils.getBatch(ctx, harvestBatchId);
    if (harvestBatch == null || !harvestBatch.getType().equals("HARVEST")) {
        throw new ChaincodeException("Invalid harvest batch");
    }
    
    // 3. Emit FARM_ACTIVITY_RECORDED event (NOT saved to world state)
    String userId = ctx.getClientIdentity().getX509Certificate()
        .getSubjectDN().getName();
    
    Map<String, String> payload = stableEventMap(
        "harvestBatchId", harvestBatchId,
        "activityType", activityType,
        "activityDate", activityDate,
        "note", note,
        "evidenceHash", evidenceHash != null ? evidenceHash : "",
        "evidenceUri", evidenceUri != null ? evidenceUri : "",
        "recordedBy", userId,
        "recordedAt", Instant.now().toString(),
        "txId", ctx.getStub().getTxId()
    );
    
    ctx.setEvent("FARM_ACTIVITY_RECORDED", JSON.serializeMap(payload));
    
    return JSON.serializeMap(stableEventMap(
        "status", "SUCCESS",
        "message", "Farm activity recorded"
    ));
}
```

**Function: updateBatchStatus (cho Farmer)**

```java
@Transaction(intent = Transaction.TYPE.SUBMIT)
public byte[] updateBatchStatus(Context ctx, String batchId, String newStatus) throws Exception {
    
    Batch batch = LedgerUtils.getBatch(ctx, batchId);
    
    // Validate role based on batch type + status
    // HARVEST + CREATED/IN_PROCESS → FARMER can update
    // HARVEST + COMPLETED → next stage (PROCESSOR)
    if (batch.getType().equals("HARVEST")) {
        RoleChecker.enforceRole(ctx, "FARMER");
    }
    
    // Validate transition
    String oldStatus = batch.getStatus();
    if (!isValidTransition(batch.getType(), oldStatus, newStatus)) {
        throw new ChaincodeException("Invalid status transition");
    }
    
    batch.setStatus(newStatus);
    batch.setUpdatedAt(Instant.now().toString());
    
    ctx.getStub().putStateAsJson(batchId, batch);
    ctx.setEvent("BATCH_STATUS_UPDATED", buildStatusPayload(ctx, batch, oldStatus, newStatus));
    
    return JSON.serializeMap(stableEventMap("status", "SUCCESS"));
}
```

---

## 🧪 TESTING CHECKLIST

- [ ] Create HarvestBatch: `POST /api/harvest` ✓
  - Verify batchId, publicCode returned
  - Verify batch in PostgreSQL
  - Verify in world state (CouchDB)

- [ ] Record Farm Activity: `POST /api/harvest/{id}/activity` ✓
  - Multiple activities per batch
  - Verify in farm_activities table
  - Verify FARM_ACTIVITY_RECORDED event emitted

- [ ] Update Status: `PATCH /api/harvest/{id}/status` ✓
  - CREATED → IN_PROCESS → COMPLETED

- [ ] Get My Batches: `GET /api/harvest` ✓
  - Filter by farmer userId

- [ ] Get Activities: `GET /api/harvest/{id}/activities` ✓
  - Return all activities for batch, ordered by date

---

## 🎓 VẤN ĐÁP: PREPARE SLIDES

1. **Tại sao farm activities được lưu riêng, không phải trong batch state?**
   - Vì activities có thể không giới hạn → batch state sẽ phình vô hạn
   - Dùng event-only pattern → backend index vào PostgreSQL

2. **Activity date có thể là quá khứ không? Ý nghĩa gì?**
   - Có, farmer có thể ghi lại hoạt động quá khứ (theo tuần hoặc đợt)
   - recordedAt = thời điểm submit, activityDate = ngày thực tế

3. **Làm sao trace được ai ghi farm activity?**
   - recordedBy = user DN từ certificate
   - txId + blockNumber trong ledger reference

4. **Public code được sinh như thế nào?**
   - Format: FARM-{YYYYMMDD}-{sequence}
   - Hoặc random UUID suffix

5. **Khi Processor lấy HarvestBatch, họ thấy được farm activities không?**
   - Có, gọi `/api/harvest/{id}/activities`
   - Nó là read-only query từ PostgreSQL

---

## 📎 FILES CÓ LIÊN QUAN

**Backend:**
- `backend/src/main/java/com/coffee/trace/controller/FarmerController.java` ← **MAIN**
- `backend/src/main/java/com/coffee/trace/entity/FarmActivityEntity.java`
- `backend/src/main/java/com/coffee/trace/repository/FarmActivityRepository.java`
- `backend/src/main/java/com/coffee/trace/dto/request/CreateHarvestBatchRequest.java`
- `backend/src/main/java/com/coffee/trace/dto/request/RecordFarmActivityRequest.java`
- `backend/src/main/java/com/coffee/trace/dto/response/BatchResponse.java`
- `backend/src/main/java/com/coffee/trace/service/FabricGatewayService.java` (shared)

**Frontend:**
- `frontend/src/app/dashboard/farmer/page.tsx` ← **MAIN**
- `frontend/src/app/dashboard/farmer/[id]/page.tsx`
- `frontend/src/app/dashboard/farmer/update/page.tsx`
- `frontend/src/components/FarmActivityLog.tsx`
- `frontend/src/lib/api/dashboardApi.ts` (or client.ts)

**Chaincode:**
- `chaincode/src/main/java/com/coffee/trace/chaincode/CoffeeTraceChaincode.java` → `createHarvestBatch()`, `recordFarmActivity()`, `updateBatchStatus()`
- `chaincode/src/main/java/com/coffee/trace/chaincode/util/LedgerUtils.java`
- `chaincode/src/main/java/com/coffee/trace/chaincode/util/RoleChecker.java`

**Config:**
- `network/scripts/register-users.sh` (register farmer_alice with role=FARMER)

---

## 🚀 START CHECKLIST

- [ ] Read this assignment + main README
- [ ] Clone repo + setup network (wait for shared infrastructure team)
- [ ] Review existing FarmerController code
- [ ] Implement endpoints one by one
- [ ] Test each endpoint with Postman/curl
- [ ] Implement frontend pages
- [ ] Implement chaincode functions
- [ ] End-to-end test: create batch → add activity → update status → trace
- [ ] Prepare 5-10 slides for presentation
- [ ] Record demo video (optional)

**Good luck! 🌱**
