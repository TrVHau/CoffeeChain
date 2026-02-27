# Mô Hình Dữ Liệu & Chaincode

## 1. Các Loại Batch

```
HarvestBatch    — Lô thu hoạch       (điểm bắt đầu chuỗi)
ProcessedBatch  — Lô sau sơ chế
RoastBatch      — Lô sau rang
PackagedBatch   — Lô đóng gói thành phẩm (gắn QR)
```

## 2. Cấu Trúc Dữ Liệu On-Chain (World State)

### Quyết định thiết kế: Lưu state hiện tại + emit event

- **World state (CouchDB)** lưu snapshot hiện tại của Batch,
  bao gồm `evidenceHash/Uri` — đảm bảo vẫn đọc được dù indexer lỗi
- **Event log** ghi lại mọi hành động để indexer xây dựng timeline

Cách này cho phép:
- Query nhanh state hiện tại qua CouchDB rich query
- Xây dựng timeline đầy đủ qua event indexer
- Fallback an toàn: nếu indexer chưa bắt kịp, state vẫn có đủ
  thông tin cơ bản

### Batch.java

```java
public class Batch {

    // ── Định danh ─────────────────────────────────────────────
    private String batchId;      // UUID do chaincode sinh khi tạo,
                                 // đảm bảo unique trên world state
                                 // (Fabric không tự cấp ID —
                                 //  chaincode/app tự sinh UUID)
    private String publicCode;   // Display code: FARM-20240315-001
                                 // Dễ đọc, dùng để in QR
    private String docType;      // Luôn = "batch"
                                 // Bắt buộc để CouchDB rich query
                                 // không lẫn với document type khác

    // ── Phân loại & liên kết ──────────────────────────────────
    private String type;         // HARVEST | PROCESSED | ROAST | PACKAGED
    private String parentBatchId;// batchId của lô cha (truy ngược)

    // ── Quyền sở hữu ──────────────────────────────────────────
    private String ownerMSP;     // MSP của org đang sở hữu lô
    private String ownerUserId;  // CN của cert người tạo/sở hữu

    // ── Trạng thái ────────────────────────────────────────────
    private String status;       // Xem enum Status bên dưới

    // ── Thời gian ─────────────────────────────────────────────
    private String createdAt;    // ISO-8601, lấy từ stub.getTxTimestamp()
    private String updatedAt;    // ISO-8601, cập nhật mỗi lần thay đổi

    // ── Chứng cứ (Option A: lưu trong state) ──────────────────
    private String evidenceHash; // SHA-256 của file chứng cứ
    private String evidenceUri;  // IPFS CID hoặc URL file

    // ── Dữ liệu nghiệp vụ ────────────────────────────────────
    private Map<String, String> metadata; // Xem chi tiết mục 3
}
```

> **Tại sao `docType`?**
> CouchDB lưu tất cả document trong cùng một database per channel.
> Nếu không có `docType`, câu query `{"selector": {"status": "COMPLETED"}}`
> sẽ trả về mọi document có field `status` — kể cả document không
> phải Batch. Thêm `docType = "batch"` giúp filter chính xác.

## 3. Metadata Theo Loại Batch

```java
// HarvestBatch
{
  "farmLocation":   "Cầu Đất, Đà Lạt, Lâm Đồng",
  "harvestDate":    "2024-03-15",
  "coffeeVariety":  "Arabica Bourbon",
  "weightKg":       "500",
  "farmerId":       "farmer_alice"
}

// ProcessedBatch
{
  "processingMethod": "Washed",        // Washed | Natural | Honey
  "startDate":        "2024-03-18",
  "endDate":          "2024-03-25",
  "facilityName":     "Xưởng sơ chế Đà Lạt",
  "weightKg":         "480"            // Hao hụt sau sơ chế
}

// RoastBatch
{
  "roastProfile":        "Medium-Light", // Light|Medium-Light|Medium|Dark
  "roastDate":           "2024-04-01",
  "roastDurationMinutes":"12",
  "roasterId":           "roaster_charlie",
  "weightKg":            "420"
}

// PackagedBatch
{
  "packageWeight": "250g",             // 250g | 500g | 1kg
  "packageCount":  "100",
  "packagedDate":  "2024-04-03",
  "expiryDate":    "2025-04-03",
  "qrUrl":         "https://trace.example.com/trace/PKG-20240403-001"
}
```

## 4. Enum Status & Chuyển Trạng Thái Hợp Lệ

```
CREATED         → Batch vừa được tạo
IN_PROCESS      → Đang xử lý (sơ chế / rang)
COMPLETED       → Xử lý xong, sẵn sàng bàn giao
TRANSFER_PENDING→ Org hiện tại đã requestTransfer, chờ bên kia accept
TRANSFERRED     → Đã bàn giao xong (ownerMSP đã thay đổi)
IN_STOCK        → Đang ở kho bán lẻ (Retailer cập nhật)
SOLD            → Đã bán cho người tiêu dùng

Chuyển trạng thái hợp lệ:
CREATED → IN_PROCESS → COMPLETED → TRANSFER_PENDING → TRANSFERRED
TRANSFERRED (PackagedBatch) → IN_STOCK → SOLD
```

## 5. Events On-Chain

Chaincode emit event sau mỗi thao tác. Không lưu lịch sử trong state —
indexer chịu trách nhiệm xây dựng timeline từ event log.

| Event | Khi nào phát sinh |
|---|---|
| `BATCH_CREATED` | Tạo batch mới bất kỳ loại |
| `BATCH_STATUS_UPDATED` | Cập nhật status |
| `TRANSFER_REQUESTED` | Org1 gọi requestTransfer |
| `TRANSFER_ACCEPTED` | Org2 gọi acceptTransfer — owner thực sự chuyển |
| `EVIDENCE_ADDED` | Thêm hash chứng cứ |
| `BATCH_IN_STOCK` | Retailer đánh dấu nhập kho |
| `BATCH_SOLD` | Retailer đánh dấu đã bán |

```java
// Payload mẫu cho TRANSFER_ACCEPTED
{
  "eventType":  "TRANSFER_ACCEPTED",
  "batchId":    "ROAST-20240401-001",
  "fromMSP":    "Org1MSP",
  "toMSP":      "Org2MSP",
  "timestamp":  "2024-04-02T10:30:00Z",
  "txId":       "abc123..."
}
```

## 6. Quan Hệ Batch (Parent–Child)

```
HarvestBatch    (FARM-20240315-001)     ownerMSP: Org1MSP
    └── ProcessedBatch (PROC-20240325-001)  ownerMSP: Org1MSP
            └── RoastBatch (ROAST-20240401-001)  ownerMSP: Org1MSP
                    │
                    │ requestTransfer → acceptTransfer (AND endorsement)
                    ▼
            PackagedBatch (PKG-20240403-001)     ownerMSP: Org2MSP
                    └── QR: /trace/PKG-20240403-001
```

> **Quan hệ 1:1** (1 cha – 1 con) cho bản demo.
> Mở rộng n:1 (blend nhiều lô) là Future Work.

## 7. Chaincode Functions (Java)

### 7.1 Kiểm tra role

```java
// RoleChecker.java
public class RoleChecker {

    public static void require(Context ctx, String... allowedRoles)
            throws ChaincodeException {
        String role;
        try {
            role = ctx.getClientIdentity().getAttributeValue("role");
        } catch (Exception e) {
            throw new ChaincodeException("Cannot read role from certificate");
        }

        if (role == null || role.isEmpty()) {
            throw new ChaincodeException(
                "Certificate does not contain 'role' attribute. "
                + "Ensure Fabric CA registered user with --id.attrs role=...:ecert"
            );
        }

        for (String allowed : allowedRoles) {
            if (allowed.equals(role)) return;
        }

        throw new ChaincodeException(
            "Access denied. Required: " + Arrays.toString(allowedRoles)
            + " | Caller role: " + role
            + " | Caller MSP: " + ctx.getClientIdentity().getMSPID()
        );
    }
}
```

### 7.2 Sinh batchId (UUID)

```java
// LedgerUtils.java
public class LedgerUtils {

    /**
     * Sinh UUID làm batchId.
     * Fabric không tự cấp ID — chaincode/app tự sinh để đảm bảo unique.
     * Dùng kết hợp txId + timestamp để tránh collision.
     */
    public static String generateBatchId(Context ctx) {
        String txId = ctx.getStub().getTxId();        // unique per tx
        String ts   = ctx.getStub().getTxTimestamp()
                         .toString();
        return UUID.nameUUIDFromBytes((txId + ts).getBytes()).toString();
    }

    public static String now(Context ctx) {
        return ctx.getStub().getTxTimestamp().toString();
    }
}
```

### 7.3 Toàn bộ functions chaincode

```java
@Contract(name = "CoffeeTraceChaincode")
public class CoffeeTraceChaincode implements ContractInterface {

    // ── CREATE ────────────────────────────────────────────────

    @Transaction
    public Batch createHarvestBatch(Context ctx,
            String publicCode, String farmLocation,
            String harvestDate, String coffeeVariety, String weightKg) {

        RoleChecker.require(ctx, "FARMER");

        Batch b = new Batch();
        b.setBatchId(LedgerUtils.generateBatchId(ctx));
        b.setPublicCode(publicCode);
        b.setDocType("batch");                  // bắt buộc cho rich query
        b.setType("HARVEST");
        b.setParentBatchId("");                 // điểm đầu chuỗi, không có cha
        b.setOwnerMSP(ctx.getClientIdentity().getMSPID());
        b.setOwnerUserId(ctx.getClientIdentity().getId());
        b.setStatus("CREATED");
        b.setCreatedAt(LedgerUtils.now(ctx));
        b.setUpdatedAt(LedgerUtils.now(ctx));

        Map<String,String> meta = new HashMap<>();
        meta.put("farmLocation",  farmLocation);
        meta.put("harvestDate",   harvestDate);
        meta.put("coffeeVariety", coffeeVariety);
        meta.put("weightKg",      weightKg);
        b.setMetadata(meta);

        ctx.getStub().putState(b.getBatchId(), serialize(b));
        ctx.getStub().setEvent("BATCH_CREATED", buildEventPayload(b));
        return b;
    }

    @Transaction
    public Batch createProcessedBatch(Context ctx,
            String publicCode, String parentBatchId,
            String processingMethod, String startDate,
            String endDate, String weightKg) {

        RoleChecker.require(ctx, "PROCESSOR");
        validateParentExists(ctx, parentBatchId, "HARVEST");
        // ... tương tự createHarvestBatch
    }

    @Transaction
    public Batch createRoastBatch(Context ctx,
            String publicCode, String parentBatchId,
            String roastProfile, String roastDate,
            String roastDurationMinutes, String weightKg) {

        RoleChecker.require(ctx, "ROASTER");
        validateParentExists(ctx, parentBatchId, "PROCESSED");
        // ...
    }

    @Transaction
    public Batch createPackagedBatch(Context ctx,
            String publicCode, String parentBatchId,
            String packageWeight, String packageCount,
            String packagedDate, String expiryDate) {

        RoleChecker.require(ctx, "PACKAGER");
        validateParentExists(ctx, parentBatchId, "ROAST");
        // ...
    }

    // ── TRANSFER (2 bước, tránh offline signing phức tạp) ────

    @Transaction
    public void requestTransfer(Context ctx,
            String batchId, String toMSP) {
        // Chỉ cần Org1 ký (policy: OR Org1MSP.peer)
        Batch b = getBatchOrThrow(ctx, batchId);

        if (!b.getOwnerMSP().equals(ctx.getClientIdentity().getMSPID())) {
            throw new ChaincodeException("Only current owner can request transfer");
        }
        b.setStatus("TRANSFER_PENDING");
        b.setPendingToMSP(toMSP);
        b.setUpdatedAt(LedgerUtils.now(ctx));

        ctx.getStub().putState(batchId, serialize(b));
        ctx.getStub().setEvent("TRANSFER_REQUESTED",
            buildTransferPayload(b, toMSP));
    }

    @Transaction
    public void acceptTransfer(Context ctx, String batchId) {
        // Cần AND(Org1MSP.peer, Org2MSP.peer) theo endorsement policy
        // → cả 2 peer phải endorse transaction này
        Batch b = getBatchOrThrow(ctx, batchId);

        if (!"TRANSFER_PENDING".equals(b.getStatus())) {
            throw new ChaincodeException("Batch is not pending transfer");
        }
        String callerMSP = ctx.getClientIdentity().getMSPID();
        if (!callerMSP.equals(b.getPendingToMSP())) {
            throw new ChaincodeException(
                "Only the designated receiver (" + b.getPendingToMSP()
                + ") can accept transfer");
        }

        String prevOwner = b.getOwnerMSP();
        b.setOwnerMSP(b.getPendingToMSP());
        b.setPendingToMSP("");
        b.setStatus("TRANSFERRED");
        b.setUpdatedAt(LedgerUtils.now(ctx));

        ctx.getStub().putState(batchId, serialize(b));
        ctx.getStub().setEvent("TRANSFER_ACCEPTED",
            buildTransferAcceptedPayload(b, prevOwner));
    }

    // ── STATUS UPDATE ─────────────────────────────────────────

    @Transaction
    public void updateBatchStatus(Context ctx,
            String batchId, String newStatus) {

        Batch b = getBatchOrThrow(ctx, batchId);
        validateStatusTransition(b.getStatus(), newStatus);

        // Chỉ owner hiện tại mới được cập nhật
        if (!b.getOwnerMSP().equals(ctx.getClientIdentity().getMSPID())) {
            throw new ChaincodeException("Only current owner can update status");
        }

        b.setStatus(newStatus);
        b.setUpdatedAt(LedgerUtils.now(ctx));

        ctx.getStub().putState(batchId, serialize(b));
        ctx.getStub().setEvent("BATCH_STATUS_UPDATED",
            buildStatusPayload(b, newStatus));
    }

    // ── EVIDENCE ──────────────────────────────────────────────

    @Transaction
    public void addEvidence(Context ctx,
            String batchId, String evidenceHash, String evidenceUri) {

        Batch b = getBatchOrThrow(ctx, batchId);

        if (!b.getOwnerMSP().equals(ctx.getClientIdentity().getMSPID())) {
            throw new ChaincodeException("Only current owner can add evidence");
        }

        b.setEvidenceHash(evidenceHash);  // SHA-256 lưu trong state
        b.setEvidenceUri(evidenceUri);    // IPFS CID lưu trong state
        b.setUpdatedAt(LedgerUtils.now(ctx));

        ctx.getStub().putState(batchId, serialize(b));
        ctx.getStub().setEvent("EVIDENCE_ADDED",
            buildEvidencePayload(b));
    }

    // ── QUERY ─────────────────────────────────────────────────

    @Transaction(intent = Transaction.TYPE.EVALUATE)
    public Batch getBatch(Context ctx, String batchId) {
        return getBatchOrThrow(ctx, batchId);
    }

    @Transaction(intent = Transaction.TYPE.EVALUATE)
    public String getTraceChain(Context ctx, String startBatchId) {
        // Truy ngược từ PackagedBatch về HarvestBatch qua parentBatchId
        List<Batch> chain = new ArrayList<>();
        String currentId = startBatchId;

        while (currentId != null && !currentId.isEmpty()) {
            byte[] data = ctx.getStub().getState(currentId);
            if (data == null) break;

            Batch b = deserialize(data);
            chain.add(b);
            currentId = b.getParentBatchId();
        }
        // chain = [PackagedBatch, RoastBatch, ProcessedBatch, HarvestBatch]
        return serialize(chain);
    }

    @Transaction(intent = Transaction.TYPE.EVALUATE)
    public String queryBatchByPublicCode(Context ctx, String publicCode) {
        String query = String.format(
            "{\"selector\":{\"docType\":\"batch\",\"publicCode\":\"%s\"}}",
            publicCode
        );
        return runRichQuery(ctx, query);
    }

    @Transaction(intent = Transaction.TYPE.EVALUATE)
    public String queryBatchesByStatus(Context ctx, String status) {
        String query = String.format(
            "{\"selector\":{\"docType\":\"batch\",\"status\":\"%s\"}}",
            status
        );
        return runRichQuery(ctx, query);
    }
}
```

## 8. CouchDB Rich Query — Đảm Bảo docType

Tất cả query **bắt buộc** có `"docType": "batch"` để tránh trả về
document không phải Batch (e.g., document metadata của Fabric):

```javascript
// ✅ Đúng — có docType
{ "selector": { "docType": "batch", "status": "IN_STOCK" } }
{ "selector": { "docType": "batch", "publicCode": "PKG-20240403-001" } }
{ "selector": { "docType": "batch", "ownerMSP": "Org2MSP", "type": "PACKAGED" } }

// ❌ Sai — thiếu docType → có thể trả về sai kết quả
{ "selector": { "status": "IN_STOCK" } }
```