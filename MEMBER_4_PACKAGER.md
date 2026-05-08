# 📦 ASSIGNMENT THÀNH VIÊN 4: PACKAGER MODULE
**Quản Lý Khâu Đóng Gói, Chấp Nhận Bàn Giao, Sinh QR Code**

---

## 📌 BUSINESS FLOW

```
PACKAGER WORKFLOW:
1. Đăng nhập (packager_dave / pw123) — Org2MSP
2. Xem danh sách RoastBatch TRANSFER_PENDING từ Org1
3. Chấp nhận bàn giao (acceptTransfer)
   → CRITICAL: cần AND endorsement (Org1 + Org2)
   → ownerMSP thay đổi từ Org1MSP → Org2MSP
   → Status: TRANSFERRED
4. Tạo PackagedBatch (weight, count, date, expiry)
   → ownerMSP = Org2MSP
   → Status: COMPLETED (khởi tạo thẳng, không qua CREATED)
5. Sinh QR code → lưu vào batch
6. Tải QR code xuống
```

---

## 💼 BACKEND TASKS

### 1. PackagerController.java
**File:** `backend/src/main/java/com/coffee/trace/controller/PackagerController.java`

**Endpoints:**

```java
// GET /api/package/pending — danh sách RoastBatch TRANSFER_PENDING
@GetMapping("/pending")
@PreAuthorize("hasRole('PACKAGER')")
public ResponseEntity<?> getPendingTransfers(@AuthenticationPrincipal String userId)

// POST /api/transfer/accept/{batchId} — chấp nhận bàn giao (AND endorsement)
@PostMapping("/transfer/accept/{batchId}")
@PreAuthorize("hasRole('PACKAGER')")
public ResponseEntity<?> acceptTransfer(
    @AuthenticationPrincipal String userId,
    @PathVariable String batchId
) throws Exception

// POST /api/package — tạo PackagedBatch
@PostMapping
@PreAuthorize("hasRole('PACKAGER')")
public ResponseEntity<?> createPackagedBatch(
    @AuthenticationPrincipal String userId,
    @Valid @RequestBody CreatePackagedBatchRequest req
) throws Exception

// GET /api/package — danh sách PackagedBatch
@GetMapping
@PreAuthorize("hasRole('PACKAGER')")
public ResponseEntity<?> getMyBatches(@AuthenticationPrincipal String userId)

// GET /api/package/{id}
@GetMapping("/{id}")
@PreAuthorize("hasRole('PACKAGER')")
public ResponseEntity<?> getBatchDetail(@PathVariable String id)

// GET /api/qr/{batchId} — lấy QR code image
@GetMapping("/qr/{batchId}")
public ResponseEntity<byte[]> getQrCode(@PathVariable String batchId)
    throws Exception

// POST /api/package/{id}/qr/generate — sinh QR code
@PostMapping("/{id}/qr/generate")
@PreAuthorize("hasRole('PACKAGER')")
public ResponseEntity<?> generateQrCode(
    @AuthenticationPrincipal String userId,
    @PathVariable String id
) throws Exception
```

### 2. Request DTO

**CreatePackagedBatchRequest:**
```java
@Data
@Valid
public class CreatePackagedBatchRequest {
    @NotBlank
    String parentBatchId;           // RoastBatch ID (must be TRANSFERRED)
    
    @NotNull
    Double packageWeight;           // 250 (gram)
    
    @NotNull
    Integer packageCount;           // 1000 (packages)
    
    @NotBlank
    String packageDate;             // "2026-03-26"
    
    @NotBlank
    String expiryDate;              // "2027-03-26"
}
```

### 3. QrCodeService.java
**File:** `backend/src/main/java/com/coffee/trace/service/QrCodeService.java`

```java
public class QrCodeService {
    
    @Value("${trace.public-base-url}")
    private String publicBaseUrl;  // e.g., "https://trace.coffeechain.local"
    
    // Sinh QR code từ public code
    public byte[] generateQr(String publicCode) throws WriterException {
        // QR content: https://trace.coffeechain.local/trace/{publicCode}
        String qrContent = publicBaseUrl + "/trace/" + publicCode;
        
        QRCodeWriter writer = new QRCodeWriter();
        BitMatrix bitMatrix = writer.encode(
            qrContent, 
            BarcodeFormat.QR_CODE, 
            200, 
            200
        );
        
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(bitMatrix, "PNG", out);
        
        return out.toByteArray();
    }
}
```

### 4. Service Integration
- `acceptTransfer()`: Call `FabricGatewayService.submitAs()` → Fabric Gateway tự collect AND endorsement
- `createPackagedBatch()`: Call chaincode `createPackagedBatch()`
- `generateQrCode()`: Use QrCodeService → lưu vào batch metadata

---

## 🎨 FRONTEND TASKS

### 1. Packager Dashboard
**File:** `frontend/src/app/dashboard/packager/page.tsx`

```typescript
// Hiển thị:
// - Danh sách RoastBatch TRANSFER_PENDING (chờ chấp nhận)
// - Danh sách PackagedBatch của packager
// - Button "Chấp nhận bàn giao" per pending batch
// - Button "Tạo lô đóng gói mới"

export default function PackagerDashboard() {
  const [pending, setPending] = useState([]);
  const [packages, setPackages] = useState([]);
  
  useEffect(() => {
    api.getPendingTransfers(token).then(setPending);
    api.getMyPackages(token).then(setPackages);
  }, []);
}
```

### 2. Accept Transfer Action
**File:** Component/Button in dashboard

```typescript
// Button với confirmation dialog:
// "Bạn chắc chắn chấp nhận bàn giao batch {id}?"
// → POST /api/transfer/accept/{batchId}
// → Wait for AND endorsement resolution
// → On success: refresh list, show success toast

async function acceptTransfer(batchId: string) {
  try {
    await api.acceptTransfer(batchId, token);
    // Refresh pending list
    toast.success("Đã chấp nhận bàn giao");
  } catch (e) {
    toast.error("Lỗi: " + e.message);
  }
}
```

### 3. Create Packaged Batch Form
**File:** `frontend/src/app/dashboard/packager/create/page.tsx` (hoặc modal)

```typescript
// Form:
// - Parent batch (dropdown: only TRANSFERRED batches)
// - Package weight (number: gram)
// - Package count (number)
// - Package date (date picker)
// - Expiry date (date picker)
// - Submit button → POST /api/package

export function CreatePackagedBatchForm() {
  const [parentBatch, setParentBatch] = useState(null);
  
  // When parent selected: show roast details (traceability context)
  // Validate dates
}
```

### 4. Batch Detail & QR Download
**File:** `frontend/src/app/dashboard/packager/[id]/page.tsx`

```typescript
// Hiển thị:
// - Batch detail (parent chain, metadata)
// - QR code image (if generated)
// - Button "Sinh QR code" (if not yet)
// - Button "Tải QR xuống" (download as PNG)
// - Show public code + trace link

export default function PackagedBatchDetail({ params }) {
  const { id } = params;
  const [batch, setBatch] = useState(null);
  const [qrImage, setQrImage] = useState(null);
  
  useEffect(() => {
    api.getPackageDetail(id, token).then(setBatch);
    api.getQrCode(batch?.publicCode).then(r => setQrImage(r));
  }, [id]);
  
  async function generateQr() {
    await api.generateQr(id, token);
    // Refresh detail
  }
  
  function downloadQr() {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${qrImage}`;
    link.download = `qr-${batch.publicCode}.png`;
    link.click();
  }
}
```

---

## ⛓️ CHAINCODE TASKS

### 1. CoffeeTraceChaincode.java

**Function: acceptTransfer (CRITICAL — AND endorsement)**

```java
@Transaction(intent = Transaction.TYPE.SUBMIT)
public byte[] acceptTransfer(Context ctx, String batchId) throws Exception {
    
    // 1. Check caller is from Org2 (Packager)
    String callerMSP = ctx.getClientIdentity().getMSPID();
    if (!callerMSP.equals("Org2MSP")) {
        throw new ChaincodeException("Only Org2 can accept transfer");
    }
    
    // 2. Get batch (must be in TRANSFER_PENDING state)
    Batch batch = LedgerUtils.getBatch(ctx, batchId);
    if (batch == null) {
        throw new ChaincodeException("Batch not found");
    }
    
    if (!batch.getStatus().equals("TRANSFER_PENDING")) {
        throw new ChaincodeException("Batch must be TRANSFER_PENDING");
    }
    
    // 3. Verify pendingToMSP == Org2MSP
    if (!batch.getPendingToMSP().equals(callerMSP)) {
        throw new ChaincodeException("Transfer not intended for Org2");
    }
    
    String fromMSP = batch.getOwnerMSP();
    
    // 4. Update batch:
    //    - status = TRANSFERRED
    //    - ownerMSP = Org2MSP (ownership transfer)
    //    - pendingToMSP = "" (clear)
    batch.setStatus("TRANSFERRED");
    batch.setOwnerMSP(callerMSP);
    batch.setPendingToMSP("");
    batch.setUpdatedAt(Instant.now().toString());
    
    // 5. Save to ledger
    ctx.getStub().putStateAsJson(batchId, batch);
    
    // 6. Remove SBE (or set back to OR) after successful transfer
    //    Now Org2 owns it, they can manage it
    String orPolicy = "OR('Org1MSP.peer','Org2MSP.peer')";
    ctx.getStub().setStateValidationParameter(batchId, 
        orPolicy.getBytes(StandardCharsets.UTF_8));
    
    // 7. Emit event
    ctx.setEvent("TRANSFER_ACCEPTED", buildTransferAcceptedPayload(ctx, batch, fromMSP));
    
    return JSON.serializeMap(stableEventMap(
        "status", "TRANSFERRED",
        "batchId", batchId,
        "newOwnerMSP", callerMSP
    ));
}
```

**Function: createPackagedBatch**

```java
@Transaction(intent = Transaction.TYPE.SUBMIT)
public byte[] createPackagedBatch(
    Context ctx,
    String parentBatchId,
    double packageWeight,
    int packageCount,
    String packageDate,
    String expiryDate
) throws Exception {
    
    // 1. Check role = PACKAGER
    RoleChecker.enforceRole(ctx, "PACKAGER");
    
    // 2. Get parent (RoastBatch, TRANSFERRED status)
    Batch parent = LedgerUtils.getBatch(ctx, parentBatchId);
    if (parent == null || !parent.getType().equals("ROAST")) {
        throw new ChaincodeException("Parent must be ROAST batch");
    }
    
    if (!parent.getStatus().equals("TRANSFERRED")) {
        throw new ChaincodeException("Parent must be TRANSFERRED");
    }
    
    // 3. Verify parent is owned by Org2 now
    String callerMSP = ctx.getClientIdentity().getMSPID();
    if (!parent.getOwnerMSP().equals(callerMSP)) {
        throw new ChaincodeException("Not owner of parent batch");
    }
    
    // 4. Create PackagedBatch
    String batchId = ctx.getStub().getTxId() + "-" + System.currentTimeMillis();
    String publicCode = "PKG-" + packageDate.replace("-", "") + "-001";
    
    Batch batch = new Batch();
    batch.setBatchId(batchId);
    batch.setPublicCode(publicCode);
    batch.setDocType("batch");
    batch.setType("PACKAGED");
    batch.setParentBatchId(parentBatchId);
    batch.setOwnerMSP(callerMSP);  // Org2MSP
    batch.setOwnerUserId(ctx.getClientIdentity().getX509Certificate()
        .getSubjectDN().getName());
    batch.setStatus("COMPLETED");  // Khởi tạo thẳng COMPLETED (không CREATED)
    
    Map<String, String> metadata = new HashMap<>();
    metadata.put("packageWeight", String.valueOf(packageWeight));
    metadata.put("packageCount", String.valueOf(packageCount));
    metadata.put("packageDate", packageDate);
    metadata.put("expiryDate", expiryDate);
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

---

## 🧪 TESTING CHECKLIST

- [ ] Get pending transfers: `GET /api/package/pending` ✓
- [ ] Accept transfer: `POST /api/transfer/accept/{batchId}` ✓
  - Verify AND endorsement required
  - Verify ownerMSP changed to Org2MSP
  - Verify status = TRANSFERRED
  
- [ ] Create packaged batch: `POST /api/package` ✓
  - Verify parent is TRANSFERRED
  - Verify status = COMPLETED
  
- [ ] Generate QR: `POST /api/package/{id}/qr/generate` ✓
  - Verify QR code generated
  - Verify content = trace URL
  
- [ ] Get QR code: `GET /api/qr/{batchId}` ✓
  - Return PNG image

---

## 🎓 VẤN ĐÁP

1. **Tại sao acceptTransfer cần AND endorsement?**
   - Vì SBE được set bởi requestTransfer với AND policy
   - Fabric tự kiểm tra: nếu write vào key có SBE = AND, cần cả 2 org endorse
   - Đảm bảo 2 bên đồng ý bàn giao

2. **Làm sao gateway biết gửi request tới 2 peer?**
   - Fabric Java SDK (Gateway) tự collect endorsement
   - Nó check SBE → biết phải gửi tới cả 2 org

3. **Khi acceptTransfer xong, ownerMSP thay đổi, có ảnh hưởng gì?**
   - Retailer (Org2) giờ có quyền update batch
   - Org1 không thể modify batch này nữa

4. **PackagedBatch tại sao khởi tạo ở COMPLETED?**
   - Vì packaging là final step trước bán lẻ
   - Không cần trạng thái IN_PROCESS
   - Status sequence: TRANSFERRED → COMPLETED (quá trình đóng gói) → IN_STOCK → SOLD

5. **QR code chứa gì?**
   - URL: `https://trace.coffeechain.local/trace/{publicCode}`
   - Người tiêu dùng scan → vào trang công khai trace

---

## 📎 FILES

**Backend:**
- `backend/src/main/java/com/coffee/trace/controller/PackagerController.java` ← **MAIN**
- `backend/src/main/java/com/coffee/trace/service/QrCodeService.java`
- `backend/src/main/java/com/coffee/trace/dto/request/CreatePackagedBatchRequest.java`

**Frontend:**
- `frontend/src/app/dashboard/packager/page.tsx` ← **MAIN**
- `frontend/src/app/dashboard/packager/create/page.tsx` (form)
- `frontend/src/app/dashboard/packager/[id]/page.tsx` (detail + QR)

**Chaincode:**
- `chaincode/src/main/java/com/coffee/trace/chaincode/CoffeeTraceChaincode.java` → `acceptTransfer()`, `createPackagedBatch()`
- `chaincode/src/main/java/com/coffee/trace/chaincode/util/LedgerUtils.java` → handle SBE removal

---

## 🚀 START HERE

1. Implement QrCodeService (ZXing library)
2. Implement PackagerController endpoints
3. Implement acceptTransfer chaincode (WITH SBE handling)
4. Implement createPackagedBatch chaincode
5. Implement frontend dashboard
6. Test AND endorsement flow
7. Test QR generation + download

**Ready to package! 📦**
