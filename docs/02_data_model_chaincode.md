# Mô Hình Dữ Liệu & Chaincode

## 1. Tổng Quan Các Entity On-Chain

```
World State (CouchDB key-value):
┌──────────────────────────────────────────────────────┐
│  Batch (docType: "batch")                            │
│  → type: HARVEST | PROCESSED | ROAST | PACKAGED      │
└──────────────────────────────────────────────────────┘

Event Log (Fabric ledger — bất biến):
┌──────────────────────────────────────────────────────┐
│  BATCH_CREATED                                       │
│  BATCH_STATUS_UPDATED                                │
│  TRANSFER_REQUESTED / TRANSFER_ACCEPTED              │
│  EVIDENCE_ADDED                                      │
│  FARM_ACTIVITY_RECORDED                              │
│  BATCH_IN_STOCK / BATCH_SOLD                         │
└──────────────────────────────────────────────────────┘

Off-chain Index DB (PostgreSQL):
┌──────────────────────────────────────────────────────┐
│  batches           — mirror world state              │
│  farm_activities   — từ FARM_ACTIVITY_RECORDED       │
│  timeline_cache    — assembled timeline per package  │
└──────────────────────────────────────────────────────┘
```

**Quyết định thiết kế — State vs Event:**

| Dữ liệu | Lưu ở đâu | Lý do |
|---|---|---|
| Batch snapshot | World state | Query nhanh, đọc được kể cả khi indexer lỗi |
| evidenceHash / evidenceUri | World state (trong Batch) | Cần verify trực tiếp, cố định 1 per batch |
| Farm activity | Event only | Số lượng không giới hạn — lưu state làm Batch phình vô hạn |
| Lịch sử chuyển trạng thái | Event only | Indexer xây timeline |

## 2. Batch — Cấu Trúc World State

```java
public class Batch {
    private String batchId;
    // UUID do chaincode sinh. Fabric là key-value store —
    // key do app/chaincode tự đặt (không có auto-increment).
    // Dùng txId + timestamp để đảm bảo unique tuyệt đối.

    private String publicCode;   // FARM-20240315-001 — dễ đọc, dùng in QR
    private String docType;      // Luôn = "batch" — bắt buộc cho CouchDB query

    private String type;         // HARVEST | PROCESSED | ROAST | PACKAGED
    private String parentBatchId;// batchId lô cha; "" nếu là HarvestBatch

    private String ownerMSP;     // MSP org đang sở hữu; đổi sau acceptTransfer
    private String ownerUserId;  // CN của cert người tạo

    private String status;       // Xem sơ đồ chuyển trạng thái bên dưới
    private String pendingToMSP; // MSP org nhận khi TRANSFER_PENDING; "" còn lại

    private String createdAt;    // ISO-8601, từ stub.getTxTimestamp()
    private String updatedAt;

    private String evidenceHash; // SHA-256 file chứng cứ — lưu state để verify trực tiếp
    private String evidenceUri;  // IPFS CID

    private Map<String, String> metadata; // Dữ liệu nghiệp vụ theo type
}
```

## 3. Metadata Theo Loại Batch

```java
// HARVEST
{ "farmLocation": "Cầu Đất, Đà Lạt", "harvestDate": "2024-03-15",
  "coffeeVariety": "Arabica Bourbon", "weightKg": "500" }

// PROCESSED
{ "processingMethod": "Washed", "startDate": "2024-03-18",
  "endDate": "2024-03-25", "facilityName": "Xưởng Đà Lạt", "weightKg": "480" }

// ROAST
{ "roastProfile": "Medium-Light", "roastDate": "2024-04-01",
  "roastDurationMinutes": "12", "weightKg": "420" }

// PACKAGED
{ "packageWeight": "250g", "packageCount": "100",
  "packagedDate": "2024-04-03", "expiryDate": "2025-04-03",
  "qrUrl": "https://trace.example.com/trace/PKG-20240403-001" }
```

## 4. Status & Chuyển Trạng Thái

### Sơ Đồ

```
              ┌──────────┐
              │ CREATED  │  ← HARVEST / PROCESSED / ROAST bắt đầu ở đây
              └────┬─────┘
                   │
              ┌────▼──────┐
              │IN_PROCESS │  optional trong V1 — xem ghi chú B
              └────┬──────┘
                   │
              ┌────▼──────┐
              │ COMPLETED │  ← PACKAGED khởi tạo thẳng ở đây
              └────┬──────┘
                   │ requestTransfer
         ┌─────────▼──────────┐
         │  TRANSFER_PENDING  │
         └─────────┬──────────┘
                   │ acceptTransfer — AND endorsement
                   │ (không qua updateBatchStatus)
              ┌────▼──────┐
              │TRANSFERRED│  ownerMSP đã đổi sang org mới
              └────┬──────┘
                   │ (PACKAGED only — Retailer cập nhật)
              ┌────▼──────┐
              │ IN_STOCK  │
              └────┬──────┘
                   │
              ┌────▼──────┐
              │   SOLD    │
              └───────────┘
```

> **[A] PackagedBatch — flow đúng theo thứ tự:**
>
> 1. RoastBatch sau `acceptTransfer`: status = `TRANSFERRED`,
>    `ownerMSP` đã chuyển sang Org2MSP
> 2. Packager (Org2) tạo `PackagedBatch`: status khởi tạo = `COMPLETED`
>    (đóng gói hoàn tất ngay khi tạo — không qua `IN_PROCESS`)
> 3. `PackagedBatch` qua `requestTransfer` → `TRANSFER_PENDING`
>    → `acceptTransfer` → `TRANSFERRED`
> 4. Retailer nhận `PackagedBatch` ở trạng thái `TRANSFERRED`
>    rồi cập nhật `IN_STOCK` → `SOLD`
>
> Lưu ý: `TRANSFERRED` ở bước 3-4 là của **PackagedBatch**,
> không phải RoastBatch — hai lô khác nhau, không nhầm lẫn.

> **[B] Tại sao `TRANSFER_PENDING → TRANSFERRED` không nằm
> trong `updateBatchStatus`?**
> Chuyển trạng thái này chỉ được phép trong `acceptTransfer`,
> vì yêu cầu endorsement AND của cả 2 org. Nếu để
> `updateBatchStatus` làm được, 1 bên có thể tự chuyển
> mà không cần sự đồng ý của bên kia.

### Quy tắc theo loại batch

| Batch type | Status hợp lệ |
|---|---|
| HARVEST, PROCESSED, ROAST | CREATED → (IN_PROCESS) → COMPLETED → TRANSFER_PENDING → TRANSFERRED |
| PACKAGED | **COMPLETED** (khởi tạo) → TRANSFER_PENDING → TRANSFERRED → IN_STOCK → SOLD |

> **IN_STOCK và SOLD chỉ dành cho PACKAGED.**
> `validateStatusTransition` nhận `batchType` và enforce điều này.

## 5. Farm Activity — Event Only

### Assumption (V1)

Farm activity được ghi **sau khi tạo HarvestBatch**.
`activityDate` là ngày thực tế diễn ra — có thể là ngày trong quá khứ
(nông dân ghi chép lại theo tuần hoặc theo đợt).
`recordedAt` là timestamp blockchain tại thời điểm submit.

Tách entity FarmPlot/Season để log trước thu hoạch là hướng V2.

### Loại Activity

```
IRRIGATION       Tưới nước
FERTILIZATION    Bón phân
PEST_CONTROL     Phun thuốc bảo vệ thực vật
PRUNING          Tỉa cành
SHADE_MANAGEMENT Quản lý che bóng
SOIL_TEST        Kiểm tra đất
OTHER            Khác (ghi rõ trong note)
```

### Event Payload — FARM_ACTIVITY_RECORDED

```json
{
  "eventType":      "FARM_ACTIVITY_RECORDED",
  "harvestBatchId": "uuid-harvest-batch",
  "activityType":   "FERTILIZATION",
  "activityDate":   "2024-02-15",
  "note":           "NPK 16-16-8, 200g/cây, toàn vườn lô A",
  "evidenceHash":   "sha256abc...",
  "evidenceUri":    "ipfs://QmXyz...",
  "recordedBy":     "farmer_alice",
  "recordedAt":     "2024-03-16T08:30:00Z",
  "txId":           "abc123..."
}
```

## 6. Toàn Bộ Events On-Chain

| Event | Payload chính |
|---|---|
| `BATCH_CREATED` | batchId, type, ownerMSP, txId, blockNumber |
| `BATCH_STATUS_UPDATED` | batchId, oldStatus, newStatus, txId |
| `TRANSFER_REQUESTED` | batchId, fromMSP, toMSP, txId |
| `TRANSFER_ACCEPTED` | batchId, fromMSP, toMSP, txId, blockNumber |
| `EVIDENCE_ADDED` | batchId, hash, uri, txId |
| `FARM_ACTIVITY_RECORDED` | harvestBatchId, activityType, activityDate, note, txId |
| `BATCH_IN_STOCK` | batchId, txId |
| `BATCH_SOLD` | batchId, txId |

> `txId` và `blockNumber` được đính kèm mọi event — backend index
> và trả về trong response. Đây là cơ sở của `verifiedOnChain: true`.

## 7. Chaincode Java

### RoleChecker.java

```java
public class RoleChecker {
    public static void require(Context ctx, String... allowedRoles) {
        String role;
        try {
            role = ctx.getClientIdentity().getAttributeValue("role");
        } catch (Exception e) {
            throw new ChaincodeException(
                "Cannot read 'role' attribute. "
                + "Register with: --id.attrs role=...:ecert"
            );
        }
        if (role == null || role.isEmpty()) {
            throw new ChaincodeException("Certificate missing 'role' attribute.");
        }
        for (String allowed : allowedRoles) {
            if (allowed.equals(role)) return;
        }
        throw new ChaincodeException(
            "Access denied. Required: " + Arrays.toString(allowedRoles)
            + " | Caller: " + role
            + " (" + ctx.getClientIdentity().getMSPID() + ")"
        );
    }
}
```

### LedgerUtils.java

```java
public class LedgerUtils {

    public static String generateBatchId(Context ctx) {
        String txId = ctx.getStub().getTxId();
        String ts   = ctx.getStub().getTxTimestamp().toString();
        return UUID.nameUUIDFromBytes((txId + ts).getBytes()).toString();
    }

    public static String now(Context ctx) {
        return ctx.getStub().getTxTimestamp().toString();
    }

    public static Batch getBatchOrThrow(Context ctx, String batchId) {
        byte[] data = ctx.getStub().getState(batchId);
        if (data == null || data.length == 0) {
            throw new ChaincodeException("Batch not found: " + batchId);
        }
        return JSON.deserialize(data, Batch.class);
    }

    /**
     * Kiểm tra parent batch đủ điều kiện để tạo batch con.
     *
     * Nguyên tắc:
     *   Batch con chỉ được tạo khi caller đang SỞ HỮU parent.
     *   "Cross-org" chỉ xảy ra ở bước transfer — không xảy ra
     *   ở bước tạo batch con.
     *
     * Rule status theo expectedType (nghiệp vụ chặt):
     *
     *   HARVEST  → parent của ProcessedBatch (Org1 → Org1):
     *              status phải COMPLETED
     *
     *   PROCESSED → parent của RoastBatch (Org1 → Org1):
     *              status phải COMPLETED
     *
     *   ROAST    → parent của PackagedBatch (Org1 → Org2):
     *              status phải TRANSFERRED
     *              (bắt buộc đã acceptTransfer trước —
     *               cả ownerMSP = Org2MSP lẫn status = TRANSFERRED
     *               chỉ đồng thời đúng sau acceptTransfer)
     */
    public static void validateParentReady(Context ctx,
            String parentBatchId, String expectedType) {

        Batch  parent    = getBatchOrThrow(ctx, parentBatchId);
        String callerMSP = ctx.getClientIdentity().getMSPID();

        // 1. Đúng loại batch cha
        if (!expectedType.equals(parent.getType())) {
            throw new ChaincodeException(
                "Parent type mismatch. Expected: " + expectedType
                + " | Got: " + parent.getType()
            );
        }

        // 2. Caller phải đang sở hữu parent
        if (!callerMSP.equals(parent.getOwnerMSP())) {
            throw new ChaincodeException(
                "Caller does not own the parent batch. "
                + "parent.ownerMSP: " + parent.getOwnerMSP()
                + " | callerMSP: "    + callerMSP
            );
        }

        // 3. Status hợp lệ theo loại parent
        String requiredStatus = "ROAST".equals(expectedType)
            ? "TRANSFERRED"
            : "COMPLETED";

        if (!requiredStatus.equals(parent.getStatus())) {
            throw new ChaincodeException(
                "Parent batch status invalid for type " + expectedType + ". "
                + "Required: " + requiredStatus
                + " | Current: " + parent.getStatus()
            );
        }
    }

    /**
     * Validate chuyển trạng thái hợp lệ.
     *
     * [B] IN_PROCESS là optional trong V1:
     *   CREATED → COMPLETED được phép để giảm thao tác demo.
     *   Mọi thay đổi status đều emit event → vẫn truy được
     *   trách nhiệm qua event log dù bỏ qua IN_PROCESS.
     *   Nếu cần chặt hơn trong V2: bỏ "COMPLETED" khỏi
     *   danh sách next của CREATED.
     *
     * TRANSFER_PENDING → TRANSFERRED KHÔNG nằm ở đây.
     *   Chỉ xảy ra trong acceptTransfer (AND endorsement).
     *
     * IN_STOCK và SOLD chỉ dành cho PACKAGED batch.
     */
    public static void validateStatusTransition(
            String batchType, String current, String next) {

        if (("IN_STOCK".equals(next) || "SOLD".equals(next))
                && !"PACKAGED".equals(batchType)) {
            throw new ChaincodeException(
                "Status '" + next + "' is only valid for PACKAGED batch. "
                + "Current type: " + batchType
            );
        }

        // CREATED → COMPLETED: cho phép trong V1 (IN_PROCESS optional)
        // TRANSFER_PENDING → []: TRANSFERRED chỉ set bởi acceptTransfer
        Map<String, List<String>> rules = Map.of(
            "CREATED",          List.of("IN_PROCESS", "COMPLETED"),
            "IN_PROCESS",       List.of("COMPLETED"),
            "COMPLETED",        List.of("TRANSFER_PENDING"),
            "TRANSFER_PENDING", List.of(),
            "TRANSFERRED",      List.of("IN_STOCK"),
            "IN_STOCK",         List.of("SOLD")
        );

        List<String> allowed = rules.getOrDefault(current, List.of());
        if (!allowed.contains(next)) {
            throw new ChaincodeException(
                "Invalid status transition: " + current + " → " + next
                + ("TRANSFER_PENDING".equals(current)
                    ? " (TRANSFERRED chỉ set bởi acceptTransfer)"
                    : "")
            );
        }
    }
}
```

### CoffeeTraceChaincode.java

```java
@Contract(name = "CoffeeTraceChaincode")
public class CoffeeTraceChaincode implements ContractInterface {

    // ══════════════════════════════════════════════════════════
    // CREATE BATCH
    // ══════════════════════════════════════════════════════════

    @Transaction
    public Batch createHarvestBatch(Context ctx,
            String publicCode, String farmLocation,
            String harvestDate, String coffeeVariety, String weightKg) {

        RoleChecker.require(ctx, "FARMER");

        Batch b = new Batch();
        b.setBatchId(LedgerUtils.generateBatchId(ctx));
        b.setPublicCode(publicCode);
        b.setDocType("batch");
        b.setType("HARVEST");
        b.setParentBatchId("");
        b.setOwnerMSP(ctx.getClientIdentity().getMSPID());
        b.setOwnerUserId(ctx.getClientIdentity().getId());
        b.setStatus("CREATED");
        b.setCreatedAt(LedgerUtils.now(ctx));
        b.setUpdatedAt(LedgerUtils.now(ctx));
        b.setMetadata(Map.of(
            "farmLocation",  farmLocation,
            "harvestDate",   harvestDate,
            "coffeeVariety", coffeeVariety,
            "weightKg",      weightKg
        ));

        ctx.getStub().putState(b.getBatchId(), JSON.serialize(b));
        ctx.getStub().setEvent("BATCH_CREATED", buildPayload(b));
        return b;
    }

    @Transaction
    public Batch createProcessedBatch(Context ctx,
            String publicCode, String parentBatchId,
            String processingMethod, String startDate,
            String endDate, String weightKg) {

        RoleChecker.require(ctx, "PROCESSOR");
        // type=HARVEST, ownerMSP=callerMSP, status=COMPLETED
        LedgerUtils.validateParentReady(ctx, parentBatchId, "HARVEST");

        Batch b = buildBatch(ctx, publicCode, "PROCESSED", parentBatchId,
            Map.of("processingMethod", processingMethod,
                   "startDate", startDate, "endDate", endDate,
                   "weightKg", weightKg));

        ctx.getStub().putState(b.getBatchId(), JSON.serialize(b));
        ctx.getStub().setEvent("BATCH_CREATED", buildPayload(b));
        return b;
    }

    @Transaction
    public Batch createRoastBatch(Context ctx,
            String publicCode, String parentBatchId,
            String roastProfile, String roastDate,
            String roastDurationMinutes, String weightKg) {

        RoleChecker.require(ctx, "ROASTER");
        // type=PROCESSED, ownerMSP=callerMSP, status=COMPLETED
        LedgerUtils.validateParentReady(ctx, parentBatchId, "PROCESSED");

        Batch b = buildBatch(ctx, publicCode, "ROAST", parentBatchId,
            Map.of("roastProfile", roastProfile,
                   "roastDate", roastDate,
                   "roastDurationMinutes", roastDurationMinutes,
                   "weightKg", weightKg));

        ctx.getStub().putState(b.getBatchId(), JSON.serialize(b));
        ctx.getStub().setEvent("BATCH_CREATED", buildPayload(b));
        return b;
    }

    @Transaction
    public Batch createPackagedBatch(Context ctx,
            String publicCode, String parentBatchId,
            String packageWeight, String packageCount,
            String packagedDate, String expiryDate) {

        RoleChecker.require(ctx, "PACKAGER");
        // type=ROAST, ownerMSP=Org2MSP, status=TRANSFERRED
        // Ba điều kiện chỉ đồng thời đúng sau acceptTransfer
        LedgerUtils.validateParentReady(ctx, parentBatchId, "ROAST");

        String qrUrl = "https://trace.example.com/trace/" + publicCode;
        Batch b = buildBatch(ctx, publicCode, "PACKAGED", parentBatchId,
            Map.of("packageWeight", packageWeight,
                   "packageCount",  packageCount,
                   "packagedDate",  packagedDate,
                   "expiryDate",    expiryDate,
                   "qrUrl",         qrUrl));

        // Đóng gói hoàn tất ngay khi tạo
        // PackagedBatch bắt đầu ở COMPLETED, không qua CREATED/IN_PROCESS
        b.setStatus("COMPLETED");

        ctx.getStub().putState(b.getBatchId(), JSON.serialize(b));
        ctx.getStub().setEvent("BATCH_CREATED", buildPayload(b));
        return b;
    }

    // ═════════════════════════════════════════��════════════════
    // FARM ACTIVITY (emit event only — không putState)
    // ══════════════════════════════════════════════════════════

    @Transaction
    public void recordFarmActivity(Context ctx,
            String harvestBatchId, String activityType,
            String activityDate, String note,
            String evidenceHash, String evidenceUri) {

        RoleChecker.require(ctx, "FARMER");

        Batch harvest = LedgerUtils.getBatchOrThrow(ctx, harvestBatchId);
        if (!"HARVEST".equals(harvest.getType())) {
            throw new ChaincodeException(
                "Farm activity must link to HARVEST batch"
            );
        }
        if (!harvest.getOwnerMSP()
                .equals(ctx.getClientIdentity().getMSPID())) {
            throw new ChaincodeException(
                "Only batch owner can record farm activities"
            );
        }

        List<String> validTypes = List.of(
            "IRRIGATION", "FERTILIZATION", "PEST_CONTROL",
            "PRUNING", "SHADE_MANAGEMENT", "SOIL_TEST", "OTHER"
        );
        if (!validTypes.contains(activityType)) {
            throw new ChaincodeException(
                "Invalid activityType: " + activityType
            );
        }

        Map<String, String> payload = new HashMap<>(Map.of(
            "eventType",      "FARM_ACTIVITY_RECORDED",
            "harvestBatchId", harvestBatchId,
            "activityType",   activityType,
            "activityDate",   activityDate,
            "note",           note,
            "evidenceHash",   evidenceHash,
            "evidenceUri",    evidenceUri,
            "recordedBy",     ctx.getClientIdentity().getId(),
            "recordedAt",     LedgerUtils.now(ctx),
            "txId",           ctx.getStub().getTxId()
        ));

        ctx.getStub().setEvent("FARM_ACTIVITY_RECORDED",
            JSON.serializeMap(payload));
    }

    // ══════════════════════════════════════════════════════════
    // TRANSFER
    // ═══════════════════════��══════════════════════════════════

    @Transaction
    public void requestTransfer(Context ctx,
            String batchId, String toMSP) {

        Batch b = LedgerUtils.getBatchOrThrow(ctx, batchId);
        if (!b.getOwnerMSP().equals(ctx.getClientIdentity().getMSPID())) {
            throw new ChaincodeException("Only current owner can request transfer");
        }
        if (!"COMPLETED".equals(b.getStatus())) {
            throw new ChaincodeException(
                "Batch must be COMPLETED. Status: " + b.getStatus()
            );
        }

        b.setStatus("TRANSFER_PENDING");
        b.setPendingToMSP(toMSP);
        b.setUpdatedAt(LedgerUtils.now(ctx));

        ctx.getStub().putState(batchId, JSON.serialize(b));
        ctx.getStub().setEvent("TRANSFER_REQUESTED",
            buildTransferPayload(b, toMSP));
    }

    @Transaction
    public void acceptTransfer(Context ctx, String batchId) {
        // Endorsement: AND('Org1MSP.peer', 'Org2MSP.peer')
        // Nơi DUY NHẤT set TRANSFER_PENDING → TRANSFERRED

        Batch b = LedgerUtils.getBatchOrThrow(ctx, batchId);
        if (!"TRANSFER_PENDING".equals(b.getStatus())) {
            throw new ChaincodeException(
                "Batch not pending transfer. Status: " + b.getStatus()
            );
        }
        if (!ctx.getClientIdentity().getMSPID().equals(b.getPendingToMSP())) {
            throw new ChaincodeException(
                "Only designated receiver (" + b.getPendingToMSP()
                + ") can accept"
            );
        }

        String prevOwner = b.getOwnerMSP();
        b.setOwnerMSP(b.getPendingToMSP());
        b.setPendingToMSP("");
        b.setStatus("TRANSFERRED");
        b.setUpdatedAt(LedgerUtils.now(ctx));

        ctx.getStub().putState(batchId, JSON.serialize(b));
        ctx.getStub().setEvent("TRANSFER_ACCEPTED",
            buildTransferAcceptedPayload(b, prevOwner));
    }

    // ══════════════════════════════════════════════════════════
    // STATUS UPDATE
    // ══════════════════════════════════════════════════════════

    @Transaction
    public void updateBatchStatus(Context ctx,
            String batchId, String newStatus) {

        Batch b = LedgerUtils.getBatchOrThrow(ctx, batchId);
        if (!b.getOwnerMSP().equals(ctx.getClientIdentity().getMSPID())) {
            throw new ChaincodeException("Only current owner can update status");
        }
        LedgerUtils.validateStatusTransition(
            b.getType(), b.getStatus(), newStatus
        );

        String old = b.getStatus();
        b.setStatus(newStatus);
        b.setUpdatedAt(LedgerUtils.now(ctx));

        ctx.getStub().putState(batchId, JSON.serialize(b));
        ctx.getStub().setEvent("BATCH_STATUS_UPDATED",
            buildStatusPayload(b, old, newStatus));
    }

    // ══════════════════════════════════════════════════════════
    // EVIDENCE
    // ══════════════════════════════════════════════════════════

    @Transaction
    public void addEvidence(Context ctx,
            String batchId, String evidenceHash, String evidenceUri) {

        Batch b = LedgerUtils.getBatchOrThrow(ctx, batchId);
        if (!b.getOwnerMSP().equals(ctx.getClientIdentity().getMSPID())) {
            throw new ChaincodeException("Only current owner can add evidence");
        }

        b.setEvidenceHash(evidenceHash);
        b.setEvidenceUri(evidenceUri);
        b.setUpdatedAt(LedgerUtils.now(ctx));

        ctx.getStub().putState(batchId, JSON.serialize(b));
        ctx.getStub().setEvent("EVIDENCE_ADDED", buildEvidencePayload(b));
    }

    // ══════════════════════════════════════════════════════════
    // QUERY (evaluateTransaction)
    // ══════════════════════════════════════════════════════════

    @Transaction(intent = Transaction.TYPE.EVALUATE)
    public Batch getBatch(Context ctx, String batchId) {
        return LedgerUtils.getBatchOrThrow(ctx, batchId);
    }

    @Transaction(intent = Transaction.TYPE.EVALUATE)
    public String getTraceChain(Context ctx, String startBatchId) {
        List<Batch> chain = new ArrayList<>();
        String currentId = startBatchId;
        while (currentId != null && !currentId.isEmpty()) {
            byte[] data = ctx.getStub().getState(currentId);
            if (data == null) break;
            Batch b = JSON.deserialize(data, Batch.class);
            chain.add(b);
            currentId = b.getParentBatchId();
        }
        // [PackagedBatch, RoastBatch, ProcessedBatch, HarvestBatch]
        return JSON.serialize(chain);
    }

    @Transaction(intent = Transaction.TYPE.EVALUATE)
    public String queryBatchByPublicCode(Context ctx, String publicCode) {
        return runRichQuery(ctx, String.format(
            "{\"selector\":{\"docType\":\"batch\",\"publicCode\":\"%s\"}}",
            publicCode));
    }

    @Transaction(intent = Transaction.TYPE.EVALUATE)
    public String queryBatchesByStatus(Context ctx, String status) {
        return runRichQuery(ctx, String.format(
            "{\"selector\":{\"docType\":\"batch\",\"status\":\"%s\"}}",
            status));
    }

    @Transaction(intent = Transaction.TYPE.EVALUATE)
    public String queryBatchesByOwner(Context ctx, String ownerMSP) {
        return runRichQuery(ctx, String.format(
            "{\"selector\":{\"docType\":\"batch\",\"ownerMSP\":\"%s\"}}",
            ownerMSP));
    }
}
```

## 8. CouchDB Rich Query — Quy Tắc

```javascript
// ✅ Đúng — bắt buộc có docType
{ "selector": { "docType": "batch", "status": "IN_STOCK" } }
{ "selector": { "docType": "batch", "publicCode": "PKG-20240403-001" } }

// ❌ Sai — có thể trả về document sai
{ "selector": { "status": "IN_STOCK" } }
```