# 🔥 ASSIGNMENT THÀNH VIÊN 3: ROASTER MODULE
**Quản Lý Khâu Rang, Upload Chứng Cứ, Yêu Cầu Bàn Giao**

---

## 📌 BUSINESS FLOW

```
ROASTER WORKFLOW:
1. Đăng nhập (roaster_charlie / pw123)
2. Xem danh sách ProcessedBatch COMPLETED
3. Tạo RoastBatch (profile, date, duration, weight)
   → Metadata: roast profile (Light/Medium/Dark), ngày rang, thời gian, trọng lượng
4. Upload chứng cứ (PDF/ảnh): tính SHA-256 hash → lưu IPFS → ghi hash on-chain
5. Cập nhật status: CREATED → COMPLETED
6. Yêu cầu bàn giao sang Org2 (requestTransfer)
   → Set State-Based Endorsement (SBE): AND endorsement cần cả 2 org
```

---

## 💼 BACKEND TASKS

### 1. RoasterController.java
**File:** `backend/src/main/java/com/coffee/trace/controller/RoasterController.java`

**Endpoints:**

```java
// POST /api/roast — tạo RoastBatch
@PostMapping
@PreAuthorize("hasRole('ROASTER')")
public ResponseEntity<?> createRoastBatch(
    @AuthenticationPrincipal String userId,
    @Valid @RequestBody CreateRoastBatchRequest req
) throws Exception

// GET /api/roast — danh sách batch
@GetMapping
@PreAuthorize("hasRole('ROASTER')")
public ResponseEntity<?> getMyBatches(@AuthenticationPrincipal String userId)

// GET /api/roast/{id}
@GetMapping("/{id}")
@PreAuthorize("hasRole('ROASTER')")
public ResponseEntity<?> getBatchDetail(@PathVariable String id)

// PATCH /api/roast/{id}/status
@PatchMapping("/{id}/status")
@PreAuthorize("hasRole('ROASTER')")
public ResponseEntity<?> updateStatus(
    @AuthenticationPrincipal String userId,
    @PathVariable String id,
    @Valid @RequestBody UpdateStatusRequest req
) throws Exception

// POST /api/roast/{id}/evidence — upload file chứng cứ
@PostMapping("/{id}/evidence")
@PreAuthorize("hasRole('ROASTER')")
public ResponseEntity<?> addEvidence(
    @AuthenticationPrincipal String userId,
    @PathVariable String id,
    @RequestParam MultipartFile file
) throws Exception

// POST /api/transfer/request — yêu cầu bàn giao
@PostMapping("/transfer/request")
@PreAuthorize("hasRole('ROASTER')")
public ResponseEntity<?> requestTransfer(
    @AuthenticationPrincipal String userId,
    @Valid @RequestBody TransferRequest req
) throws Exception
```

**Key logic:**
- `addEvidence()`: 
  - Upload file to IPFS (call EvidenceService)
  - Get back hash + ipfs:// URI
  - Call chaincode `addEvidence(batchId, hash, uri)`
  
- `requestTransfer()`:
  - Call chaincode `requestTransfer(batchId, toMSP)`
  - This sets SBE on the key

### 2. Request DTOs

**CreateRoastBatchRequest:**
```java
@Data
@Valid
public class CreateRoastBatchRequest {
    @NotBlank
    String parentBatchId;           // ProcessedBatch ID
    
    @NotBlank
    String roastProfile;            // "Light", "Medium", "Dark"
    
    @NotBlank
    String roastDate;               // "2026-03-25"
    
    @NotNull
    Integer roastDurationMinutes;   // 12
    
    @NotNull
    Double weightKg;                // 430.0
}
```

**TransferRequest:**
```java
@Data
@Valid
public class TransferRequest {
    @NotBlank
    String batchId;
    
    @NotBlank
    String toMSP;                   // "Org2MSP"
}
```

### 3. EvidenceService.java
**File:** `backend/src/main/java/com/coffee/trace/service/EvidenceService.java`

```java
public class EvidenceService {
    
    // Upload file to IPFS, compute SHA-256
    public EvidenceResult uploadEvidence(MultipartFile file) throws Exception {
        byte[] fileData = file.getBytes();
        
        // 1. Compute SHA-256 hash
        String hash = computeSHA256(fileData);
        
        // 2. Upload to IPFS (via REST API or Java library)
        String ipfsCID = uploadToIPFS(fileData);
        String uri = "ipfs://" + ipfsCID;
        
        return new EvidenceResult(hash, uri);
    }
    
    private String computeSHA256(byte[] data) throws NoSuchAlgorithmException {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(data);
        return HexFormat.of().formatHex(hash);
    }
    
    private String uploadToIPFS(byte[] data) throws Exception {
        // Call IPFS REST API or use go-ipfs-api
        // POST to /ipfs/api/v0/add → returns CID
        // Return CID
    }
}

public class EvidenceResult {
    public String hash;
    public String uri;
}
```

---

## 🎨 FRONTEND TASKS

### 1. Roaster Dashboard
**File:** `frontend/src/app/dashboard/roaster/page.tsx`

```typescript
// Hiển thị:
// - Danh sách RoastBatch
// - Danh sách ProcessedBatch available
// - Button "Tạo lô rang mới"

export default function RoasterDashboard() {
  // GET /api/roast
  // GET available parent batches
}
```

### 2. Create Roast Batch Form
**File:** `frontend/src/app/dashboard/roaster/update/page.tsx` (hoặc modal)

```typescript
// Form:
// - Parent batch (dropdown)
// - Roast profile (dropdown: Light/Medium/Dark)
// - Roast date (date picker)
// - Duration minutes (number)
// - Weight (number)
// - Submit → POST /api/roast

export function CreateRoastBatchForm() {
  // Form logic
}
```

### 3. Upload Evidence Component
**File:** `frontend/src/app/dashboard/roaster/[id]/page.tsx`

```typescript
// Hiển thị batch detail
// + Evidence upload section:
// - File input (accept PDF/image)
// - Progress bar
// - Submit button → POST /api/roast/{id}/evidence
// - On success: show hash + IPFS link
// - Show "Yêu cầu bàn giao" button (when status=COMPLETED)

export default function RoastBatchDetail({ params }) {
  const { id } = params;
  // GET /api/roast/{id}
  // Render detail + upload form + transfer button
}
```

### 4. Evidence Verifier Component
**File:** `frontend/src/components/EvidenceVerifier.tsx`

```typescript
// Component để verify hash:
// - Show on-chain hash (from world state)
// - Button "Verify" → download file từ IPFS
// - Compute hash phía client (SHA-256)
// - Compare: on-chain vs computed
// - Show ✅ KHỚP hoặc ❌ KHÔNG KHỚP

export function EvidenceVerifier({
  batchId, onChainHash, evidenceUri
}: EvidenceVerifierProps) {
  async function verify() {
    const batch = await api.evaluateGetBatch(batchId);
    const fileBuffer = await downloadFile(evidenceUri);
    const computed = await sha256(fileBuffer);
    setResult({
      onChainHash: batch.evidenceHash,
      computedHash: computed,
      match: batch.evidenceHash === computed
    });
  }
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function downloadFile(uri: string): Promise<ArrayBuffer> {
  const url = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
  const res = await fetch(url);
  return res.arrayBuffer();
}
```

---

## ⛓️ CHAINCODE TASKS

### 1. CoffeeTraceChaincode.java

**Function: createRoastBatch**

```java
@Transaction(intent = Transaction.TYPE.SUBMIT)
public byte[] createRoastBatch(
    Context ctx,
    String parentBatchId,
    String roastProfile,
    String roastDate,
    int roastDurationMinutes,
    double weightKg
) throws Exception {
    
    // 1. Check role = ROASTER
    RoleChecker.enforceRole(ctx, "ROASTER");
    
    // 2. Get parent (ProcessedBatch)
    Batch parent = LedgerUtils.getBatch(ctx, parentBatchId);
    if (parent == null || !parent.getType().equals("PROCESSED")) {
        throw new ChaincodeException("Parent must be PROCESSED batch");
    }
    
    if (!parent.getStatus().equals("COMPLETED")) {
        throw new ChaincodeException("Parent must be COMPLETED");
    }
    
    // 3. Create batch
    String batchId = ctx.getStub().getTxId() + "-" + System.currentTimeMillis();
    String publicCode = "ROAST-" + roastDate.replace("-", "") + "-001";
    
    Batch batch = new Batch();
    batch.setBatchId(batchId);
    batch.setPublicCode(publicCode);
    batch.setDocType("batch");
    batch.setType("ROAST");
    batch.setParentBatchId(parentBatchId);
    batch.setOwnerMSP(ctx.getClientIdentity().getMSPID());  // Org1MSP
    batch.setOwnerUserId(ctx.getClientIdentity().getX509Certificate()
        .getSubjectDN().getName());
    batch.setStatus("CREATED");
    
    Map<String, String> metadata = new HashMap<>();
    metadata.put("roastProfile", roastProfile);
    metadata.put("roastDate", roastDate);
    metadata.put("roastDurationMinutes", String.valueOf(roastDurationMinutes));
    metadata.put("weightKg", String.valueOf(weightKg));
    batch.setMetadata(metadata);
    
    batch.setCreatedAt(Instant.now().toString());
    batch.setUpdatedAt(batch.getCreatedAt());
    
    ctx.getStub().putStateAsJson(batchId, batch);
    ctx.setEvent("BATCH_CREATED", buildBatchPayload(ctx, batch));
    
    return JSON.serializeMap(stableEventMap(
        "batchId", batchId,
        "publicCode", publicCode
    ));
}
```

**Function: addEvidence**

```java
@Transaction(intent = Transaction.TYPE.SUBMIT)
public byte[] addEvidence(
    Context ctx,
    String batchId,
    String evidenceHash,
    String evidenceUri
) throws Exception {
    
    Batch batch = LedgerUtils.getBatch(ctx, batchId);
    
    // Validate role (ROASTER)
    RoleChecker.enforceRole(ctx, "ROASTER");
    
    // Update batch with evidence
    batch.setEvidenceHash(evidenceHash);
    batch.setEvidenceUri(evidenceUri);
    batch.setUpdatedAt(Instant.now().toString());
    
    ctx.getStub().putStateAsJson(batchId, batch);
    ctx.setEvent("EVIDENCE_ADDED", buildEvidencePayload(ctx, batch));
    
    return JSON.serializeMap(stableEventMap("status", "SUCCESS"));
}
```

**Function: requestTransfer (CRITICAL)**

```java
@Transaction(intent = Transaction.TYPE.SUBMIT)
public byte[] requestTransfer(
    Context ctx,
    String batchId,
    String toMSP
) throws Exception {
    
    // 1. Check role = ROASTER
    RoleChecker.enforceRole(ctx, "ROASTER");
    
    // 2. Get batch (must be ROAST type, COMPLETED status)
    Batch batch = LedgerUtils.getBatch(ctx, batchId);
    if (!batch.getType().equals("ROAST")) {
        throw new ChaincodeException("Only ROAST batches can be transferred");
    }
    
    if (!batch.getStatus().equals("COMPLETED")) {
        throw new ChaincodeException("Batch must be COMPLETED before transfer");
    }
    
    String fromMSP = batch.getOwnerMSP();
    
    // 3. Update status + set pendingToMSP
    batch.setStatus("TRANSFER_PENDING");
    batch.setPendingToMSP(toMSP);
    batch.setUpdatedAt(Instant.now().toString());
    
    ctx.getStub().putStateAsJson(batchId, batch);
    
    // 4. Set State-Based Endorsement: AND('Org1MSP.peer', 'Org2MSP.peer')
    //    Sau bước này, acceptTransfer sẽ cần AND endorsement
    String sbePolicyString = "AND('Org1MSP.peer','Org2MSP.peer')";
    ctx.getStub().setStateValidationParameter(batchId, 
        sbePolicyString.getBytes(StandardCharsets.UTF_8));
    
    ctx.setEvent("TRANSFER_REQUESTED", buildTransferPayload(ctx, batch, toMSP));
    
    return JSON.serializeMap(stableEventMap(
        "status", "TRANSFER_PENDING",
        "batchId", batchId,
        "toMSP", toMSP
    ));
}
```

---

## 🧪 TESTING CHECKLIST

- [ ] Create RoastBatch: `POST /api/roast` ✓
- [ ] Upload evidence: `POST /api/roast/{id}/evidence` ✓
  - Verify hash computed
  - Verify file on IPFS
  - Verify hash stored on-chain
  
- [ ] Request transfer: `POST /api/transfer/request` ✓
  - Verify SBE set on key
  - Verify status = TRANSFER_PENDING
  
- [ ] Verify evidence: client-side SHA-256 ✓
  - Download file from IPFS
  - Compute hash
  - Compare with on-chain

---

## 🎓 VẤN ĐÁP

1. **Tại sao cần upload file chứng cứ?**
   - Để chứng minh quy trình rang thực sự
   - File lưu off-chain (IPFS), hash on-chain (immutable)

2. **SHA-256 hash được tính từ phía nào?**
   - Backend tính khi upload
   - Frontend cũng có thể tính để verify

3. **State-Based Endorsement là gì? Tại sao SET trên requestTransfer?**
   - SBE cho phép gắn policy trên một key riêng
   - Khi acceptTransfer write vào key, nó bắt buộc AND endorsement
   - Nếu không SBE, 1 bên có thể tự chuyển mà không cần sự đồng ý của bên kia

4. **Làm sao mà acceptTransfer biết dùng AND endorsement?**
   - Fabric tự check SBE trên key
   - Nếu SBE = AND, gateway tự collect endorsement từ 2 peer

5. **Người dùng có thể fake file chứng cứ được không?**
   - Không, vì nếu fake file → hash khác → EvidenceVerifier sẽ cho ❌

---

## 📎 FILES

**Backend:**
- `backend/src/main/java/com/coffee/trace/controller/RoasterController.java` ← **MAIN**
- `backend/src/main/java/com/coffee/trace/service/EvidenceService.java`
- `backend/src/main/java/com/coffee/trace/dto/request/CreateRoastBatchRequest.java`
- `backend/src/main/java/com/coffee/trace/dto/request/TransferRequest.java`

**Frontend:**
- `frontend/src/app/dashboard/roaster/page.tsx` ← **MAIN**
- `frontend/src/app/dashboard/roaster/update/page.tsx`
- `frontend/src/app/dashboard/roaster/[id]/page.tsx`
- `frontend/src/components/EvidenceVerifier.tsx`

**Chaincode:**
- `chaincode/src/main/java/com/coffee/trace/chaincode/CoffeeTraceChaincode.java` → `createRoastBatch()`, `addEvidence()`, `requestTransfer()`
- `chaincode/src/main/java/com/coffee/trace/chaincode/util/LedgerUtils.java` → `setStateValidationParameter()`

---

## 🚀 START HERE

1. Implement EvidenceService (IPFS upload, SHA-256)
2. Implement RoasterController endpoints
3. Implement chaincode functions (especially requestTransfer with SBE)
4. Implement frontend forms
5. Test evidence upload + verification
6. Test transfer request + verify SBE set

**Let's roast this! 🔥**
