# Chaincode Java — CoffeeTraceChaincode

## 1. Cấu Trúc Package

```
chaincode/src/main/java/com/coffee/trace/chaincode/
├── CoffeeTraceChaincode.java
├── model/
│   └── Batch.java
└── util/
    ├── JSON.java
    ├── RoleChecker.java        ← check role + MSP binding
    └── LedgerUtils.java
```

---

## 2. Batch.java

```java
package com.coffee.trace.chaincode.model;

import org.hyperledger.fabric.contract.annotation.DataType;
import org.hyperledger.fabric.contract.annotation.Property;
import java.util.Map;

@DataType
public class Batch {
    @Property private String batchId;
    @Property private String publicCode;
    @Property private String docType;
    @Property private String type;
    @Property private String parentBatchId;
    @Property private String ownerMSP;
    @Property private String ownerUserId;
    @Property private String status;
    @Property private String pendingToMSP;
    @Property private String createdAt;
    @Property private String updatedAt;
    @Property private String evidenceHash;
    @Property private String evidenceUri;
    @Property private Map<String, String> metadata;

    public String getBatchId()                       { return batchId; }
    public void   setBatchId(String v)               { this.batchId = v; }
    public String getPublicCode()                    { return publicCode; }
    public void   setPublicCode(String v)            { this.publicCode = v; }
    public String getDocType()                       { return docType; }
    public void   setDocType(String v)               { this.docType = v; }
    public String getType()                          { return type; }
    public void   setType(String v)                  { this.type = v; }
    public String getParentBatchId()                 { return parentBatchId; }
    public void   setParentBatchId(String v)         { this.parentBatchId = v; }
    public String getOwnerMSP()                      { return ownerMSP; }
    public void   setOwnerMSP(String v)              { this.ownerMSP = v; }
    public String getOwnerUserId()                   { return ownerUserId; }
    public void   setOwnerUserId(String v)           { this.ownerUserId = v; }
    public String getStatus()                        { return status; }
    public void   setStatus(String v)                { this.status = v; }
    public String getPendingToMSP()                  { return pendingToMSP; }
    public void   setPendingToMSP(String v)          { this.pendingToMSP = v; }
    public String getCreatedAt()                     { return createdAt; }
    public void   setCreatedAt(String v)             { this.createdAt = v; }
    public String getUpdatedAt()                     { return updatedAt; }
    public void   setUpdatedAt(String v)             { this.updatedAt = v; }
    public String getEvidenceHash()                  { return evidenceHash; }
    public void   setEvidenceHash(String v)          { this.evidenceHash = v; }
    public String getEvidenceUri()                   { return evidenceUri; }
    public void   setEvidenceUri(String v)           { this.evidenceUri = v; }
    public Map<String, String> getMetadata()         { return metadata; }
    public void   setMetadata(Map<String, String> v) { this.metadata = v; }
}
```

---

## 3. JSON.java

```java
package com.coffee.trace.chaincode.util;

import com.google.gson.Gson;
import java.nio.charset.StandardCharsets;
import java.util.Map;

public class JSON {
    private static final Gson gson = new Gson();

    public static byte[] serialize(Object obj) {
        return gson.toJson(obj).getBytes(StandardCharsets.UTF_8);
    }

    public static <T> T deserialize(byte[] data, Class<T> clazz) {
        return gson.fromJson(
            new String(data, StandardCharsets.UTF_8), clazz);
    }

    public static byte[] serializeMap(Map<String, String> map) {
        return gson.toJson(map).getBytes(StandardCharsets.UTF_8);
    }

    public static String toJson(Object obj) {
        return gson.toJson(obj);
    }
}
```

---

## 4. RoleChecker.java

```java
package com.coffee.trace.chaincode.util;

import org.hyperledger.fabric.contract.Context;
import org.hyperledger.fabric.shim.ChaincodeException;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;

/**
 * Kiểm tra role attribute VÀ MSP binding.
 *
 * Tại sao cần check cả MSP?
 * Certificate attribute "role" do Fabric CA cấp — CA của mỗi org
 * kiểm soát attribute của user thuộc org đó. Trong setup chuẩn,
 * Org2 CA không thể cấp role=FARMER (vì chỉ Org1 CA làm điều đó).
 * Tuy nhiên, nếu một org CA bị compromise hoặc misconfigure,
 * một Org2 user có thể có cert với attribute role=FARMER.
 * Binding role → MSP ở chaincode level tạo thêm một lớp phòng thủ
 * không phụ thuộc vào việc CA có được cấu hình đúng hay không.
 */
public class RoleChecker {

    /**
     * Mapping role → MSP được phép.
     * Đây là source of truth cho phân quyền org trong chaincode.
     */
    private static final Map<String, String> ROLE_TO_MSP = Map.of(
        "FARMER",    "Org1MSP",
        "PROCESSOR", "Org1MSP",
        "ROASTER",   "Org1MSP",
        "PACKAGER",  "Org2MSP",
        "RETAILER",  "Org2MSP"
    );

    /**
     * Kiểm tra caller có đúng role VÀ đúng MSP không.
     *
     * Thứ tự check:
     * 1. Role attribute có trong cert không?
     * 2. Role có nằm trong danh sách allowedRoles không?
     * 3. MSP của caller có khớp với MSP được phép cho role đó không?
     *
     * → Ngăn cross-org role spoofing:
     *   Org2 user có role=FARMER vẫn bị reject vì MSP là Org2MSP,
     *   trong khi FARMER chỉ được phép từ Org1MSP.
     */
    public static void require(Context ctx, String... allowedRoles) {
        String callerMSP = ctx.getClientIdentity().getMSPID();
        String role;

        try {
            role = ctx.getClientIdentity().getAttributeValue("role");
        } catch (Exception e) {
            throw new ChaincodeException(
                "Cannot read 'role' attribute. "
                + "Register with: --id.attrs role=<ROLE>:ecert"
            );
        }

        if (role == null || role.isBlank()) {
            throw new ChaincodeException(
                "Certificate missing 'role' attribute."
            );
        }

        // Check 1: role có trong danh sách được phép không?
        boolean roleMatched = false;
        for (String allowed : allowedRoles) {
            if (allowed.equals(role)) { roleMatched = true; break; }
        }
        if (!roleMatched) {
            throw new ChaincodeException(
                "Access denied. Required roles: "
                + Arrays.toString(allowedRoles)
                + " | Caller role: " + role
                + " | Caller MSP: " + callerMSP
            );
        }

        // Check 2: MSP của caller có khớp với MSP cho role đó không?
        String expectedMSP = ROLE_TO_MSP.get(role);
        if (expectedMSP == null) {
            throw new ChaincodeException(
                "Unknown role in ROLE_TO_MSP mapping: " + role
            );
        }
        if (!expectedMSP.equals(callerMSP)) {
            throw new ChaincodeException(
                "MSP mismatch for role " + role + ". "
                + "Expected MSP: " + expectedMSP
                + " | Caller MSP: " + callerMSP
                + " — possible cross-org role spoofing attempt."
            );
        }
    }

    /**
     * Trả về MSP được phép cho một role.
     * Dùng ở nơi cần biết expected MSP mà không cần throw.
     */
    public static String expectedMSPForRole(String role) {
        return ROLE_TO_MSP.getOrDefault(role, "UNKNOWN");
    }
}
```

---

## 5. LedgerUtils.java

```java
package com.coffee.trace.chaincode.util;

import com.coffee.trace.chaincode.model.Batch;
import org.hyperledger.fabric.contract.Context;
import org.hyperledger.fabric.shim.ChaincodeException;
import java.time.Instant;
import java.util.*;

public class LedgerUtils {

    /**
     * Sinh batchId unique từ txId + seconds + nanos.
     *
     * Không dùng Timestamp.toString() vì format protobuf text
     * ("seconds: 123\nnanos: 0\n") không ổn định giữa các version.
     * Dùng seconds + nanos riêng biệt để đảm bảo deterministic
     * và không phụ thuộc format string.
     */
    public static String generateBatchId(Context ctx) {
        com.google.protobuf.Timestamp ts = ctx.getStub().getTxTimestamp();
        String input = ctx.getStub().getTxId()
            + ":" + ts.getSeconds()
            + ":" + ts.getNanos();
        return UUID.nameUUIDFromBytes(input.getBytes()).toString();
    }

    /**
     * Trả về ISO-8601: "2024-03-15T08:30:00Z"
     *
     * Phải convert qua Instant — KHÔNG dùng Timestamp.toString()
     * vì ra format protobuf text, không parse được bằng
     * Instant.parse() hay JS new Date().
     */
    public static String now(Context ctx) {
        com.google.protobuf.Timestamp ts = ctx.getStub().getTxTimestamp();
        return Instant.ofEpochSecond(ts.getSeconds(), ts.getNanos())
                      .toString();
    }

    public static Batch getBatchOrThrow(Context ctx, String batchId) {
        byte[] data = ctx.getStub().getState(batchId);
        if (data == null || data.length == 0) {
            throw new ChaincodeException("Batch not found: " + batchId);
        }
        return JSON.deserialize(data, Batch.class);
    }

    /**
     * Kiểm tra batch cha đủ điều kiện để tạo batch con.
     *
     * Status yêu cầu:
     *   HARVEST / PROCESSED → COMPLETED
     *   ROAST               → TRANSFERRED (chỉ đúng sau acceptTransfer)
     */
    public static void validateParentReady(Context ctx,
            String parentBatchId, String expectedType) {

        Batch  parent    = getBatchOrThrow(ctx, parentBatchId);
        String callerMSP = ctx.getClientIdentity().getMSPID();

        if (!expectedType.equals(parent.getType())) {
            throw new ChaincodeException(
                "Parent type mismatch. Expected: " + expectedType
                + " | Got: " + parent.getType());
        }
        if (!callerMSP.equals(parent.getOwnerMSP())) {
            throw new ChaincodeException(
                "Caller does not own parent batch. "
                + "parent.ownerMSP: " + parent.getOwnerMSP()
                + " | callerMSP: " + callerMSP);
        }

        String requiredStatus = "ROAST".equals(expectedType)
            ? "TRANSFERRED" : "COMPLETED";

        if (!requiredStatus.equals(parent.getStatus())) {
            throw new ChaincodeException(
                "Parent not ready. Type: " + expectedType
                + " requires status: " + requiredStatus
                + " | Current: " + parent.getStatus());
        }
    }

    /**
     * Validate chuyển trạng thái hợp lệ.
     *
     * TRANSFER_PENDING → TRANSFERRED không nằm ở đây —
     * chỉ acceptTransfer (có SBE AND) mới được set.
     *
     * IN_PROCESS optional V1: CREATED → COMPLETED được phép.
     */
    public static void validateStatusTransition(
            String batchType, String current, String next) {

        if (("IN_STOCK".equals(next) || "SOLD".equals(next))
                && !"PACKAGED".equals(batchType)) {
            throw new ChaincodeException(
                "Status '" + next + "' only valid for PACKAGED. "
                + "Current type: " + batchType);
        }

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
                "Invalid transition: " + current + " → " + next
                + ("TRANSFER_PENDING".equals(current)
                    ? ". TRANSFERRED chỉ set bởi acceptTransfer (SBE AND)"
                    : ""));
        }
    }

    // ── State-Based Endorsement ───────────────────────────────────

    /**
     * Set SBE AND('Org1MSP.peer','Org2MSP.peer') lên key batchId.
     * Gọi trong requestTransfer.
     * → acceptTransfer bắt buộc cần cả 2 peer endorse.
     */
    public static void setSBEAndPolicy(Context ctx, String batchId) {
        org.hyperledger.fabric.shim.ext.sbe.StateBasedEndorsement sbe =
            org.hyperledger.fabric.shim.ext.sbe
                .StateBasedEndorsementFactory.getInstance()
                .newStateBasedEndorsement(
                    ctx.getStub().getStateValidationParameter(batchId));
        sbe.addOrgs(
            org.hyperledger.fabric.shim.ext.sbe.StateBasedEndorsement
                .RoleType.RoleTypePeer,
            "Org1MSP", "Org2MSP");
        ctx.getStub().setStateValidationParameter(batchId, sbe.policy());
    }

    /**
     * Xóa SBE sau acceptTransfer.
     * Reset về chaincode-level policy OR(Org1,Org2).
     */
    public static void clearSBEPolicy(Context ctx, String batchId) {
        ctx.getStub().setStateValidationParameter(batchId, new byte[0]);
    }
}
```

---

## 6. CoffeeTraceChaincode.java

```java
package com.coffee.trace.chaincode;

import com.coffee.trace.chaincode.model.Batch;
import com.coffee.trace.chaincode.util.*;
import org.hyperledger.fabric.contract.*;
import org.hyperledger.fabric.contract.annotation.*;
import org.hyperledger.fabric.shim.ChaincodeException;
import org.hyperledger.fabric.shim.ledger.*;
import java.util.*;

@Contract(name = "CoffeeTraceChaincode")
@Default
public class CoffeeTraceChaincode implements ContractInterface {

    // ══════════════════════════════════════════════════════════
    // EVENT PAYLOAD BUILDERS
    // ══════════════════════════════════════════════════════════

    private byte[] buildBatchPayload(Context ctx, Batch b) {
        return JSON.serializeMap(Map.of(
            "batchId",    b.getBatchId(),
            "type",       b.getType(),
            "ownerMSP",   b.getOwnerMSP(),
            "publicCode", b.getPublicCode(),
            "status",     b.getStatus(),
            "txId",       ctx.getStub().getTxId()
        ));
    }

    private byte[] buildStatusPayload(Context ctx,
            Batch b, String oldStatus, String newStatus) {
        return JSON.serializeMap(Map.of(
            "batchId",   b.getBatchId(),
            "oldStatus", oldStatus,
            "newStatus", newStatus,
            "txId",      ctx.getStub().getTxId()
        ));
    }

    private byte[] buildTransferPayload(Context ctx,
            Batch b, String toMSP) {
        return JSON.serializeMap(Map.of(
            "batchId", b.getBatchId(),
            "fromMSP", b.getOwnerMSP(),
            "toMSP",   toMSP,
            "txId",    ctx.getStub().getTxId()
        ));
    }

    private byte[] buildTransferAcceptedPayload(Context ctx,
            Batch b, String fromMSP) {
        // blockNumber KHÔNG lấy được trong chaincode —
        // lấy từ event.getBlockNumber() ở EventIndexerService.
        return JSON.serializeMap(Map.of(
            "batchId", b.getBatchId(),
            "fromMSP", fromMSP,
            "toMSP",   b.getOwnerMSP(),
            "txId",    ctx.getStub().getTxId()
        ));
    }

    private byte[] buildEvidencePayload(Context ctx, Batch b) {
        return JSON.serializeMap(Map.of(
            "batchId", b.getBatchId(),
            "hash",    b.getEvidenceHash(),
            "uri",     b.getEvidenceUri(),
            "txId",    ctx.getStub().getTxId()
        ));
    }

    private Batch buildBatch(Context ctx, String publicCode,
            String type, String parentBatchId,
            Map<String, String> metadata) {
        Batch b = new Batch();
        b.setBatchId(LedgerUtils.generateBatchId(ctx));
        b.setPublicCode(publicCode);
        b.setDocType("batch");
        b.setType(type);
        b.setParentBatchId(parentBatchId != null ? parentBatchId : "");
        b.setOwnerMSP(ctx.getClientIdentity().getMSPID());
        b.setOwnerUserId(ctx.getClientIdentity().getId());
        b.setStatus("CREATED");
        b.setPendingToMSP("");
        b.setEvidenceHash("");
        b.setEvidenceUri("");
        b.setCreatedAt(LedgerUtils.now(ctx));
        b.setUpdatedAt(LedgerUtils.now(ctx));
        b.setMetadata(metadata);
        return b;
    }

    // ══════════════════════════════════════════════════════════
    // CREATE BATCH
    // ══════════════════════════════════════════════════════════

    @Transaction
    public Batch createHarvestBatch(Context ctx,
            String publicCode, String farmLocation,
            String harvestDate, String coffeeVariety, String weightKg) {

        RoleChecker.require(ctx, "FARMER");
        // FARMER → Org1MSP đã được verify trong RoleChecker
        checkPublicCodeUnique(ctx, publicCode);

        Batch b = buildBatch(ctx, publicCode, "HARVEST", "",
            Map.of("farmLocation",  farmLocation,
                   "harvestDate",   harvestDate,
                   "coffeeVariety", coffeeVariety,
                   "weightKg",      weightKg));

        ctx.getStub().putState(b.getBatchId(), JSON.serialize(b));
        ctx.getStub().setEvent("BATCH_CREATED", buildBatchPayload(ctx, b));
        return b;
    }

    @Transaction
    public Batch createProcessedBatch(Context ctx,
            String publicCode, String parentBatchId,
            String processingMethod, String startDate,
            String endDate, String weightKg) {

        RoleChecker.require(ctx, "PROCESSOR");
        checkPublicCodeUnique(ctx, publicCode);
        LedgerUtils.validateParentReady(ctx, parentBatchId, "HARVEST");

        Batch b = buildBatch(ctx, publicCode, "PROCESSED", parentBatchId,
            Map.of("processingMethod", processingMethod,
                   "startDate", startDate,
                   "endDate",   endDate,
                   "weightKg",  weightKg));

        ctx.getStub().putState(b.getBatchId(), JSON.serialize(b));
        ctx.getStub().setEvent("BATCH_CREATED", buildBatchPayload(ctx, b));
        return b;
    }

    @Transaction
    public Batch createRoastBatch(Context ctx,
            String publicCode, String parentBatchId,
            String roastProfile, String roastDate,
            String roastDurationMinutes, String weightKg) {

        RoleChecker.require(ctx, "ROASTER");
        checkPublicCodeUnique(ctx, publicCode);
        LedgerUtils.validateParentReady(ctx, parentBatchId, "PROCESSED");

        Batch b = buildBatch(ctx, publicCode, "ROAST", parentBatchId,
            Map.of("roastProfile",         roastProfile,
                   "roastDate",            roastDate,
                   "roastDurationMinutes", roastDurationMinutes,
                   "weightKg",             weightKg));

        ctx.getStub().putState(b.getBatchId(), JSON.serialize(b));
        ctx.getStub().setEvent("BATCH_CREATED", buildBatchPayload(ctx, b));
        return b;
    }

    @Transaction
    public Batch createPackagedBatch(Context ctx,
            String publicCode, String parentBatchId,
            String packageWeight, String packageCount,
            String packagedDate, String expiryDate) {

        RoleChecker.require(ctx, "PACKAGER");
        // PACKAGER → Org2MSP đã được verify trong RoleChecker
        checkPublicCodeUnique(ctx, publicCode);
        LedgerUtils.validateParentReady(ctx, parentBatchId, "ROAST");

        String qrUrl = "https://trace.example.com/trace/" + publicCode;
        Batch b = buildBatch(ctx, publicCode, "PACKAGED", parentBatchId,
            Map.of("packageWeight", packageWeight,
                   "packageCount",  packageCount,
                   "packagedDate",  packagedDate,
                   "expiryDate",    expiryDate,
                   "qrUrl",         qrUrl));

        b.setStatus("COMPLETED");

        ctx.getStub().putState(b.getBatchId(), JSON.serialize(b));
        ctx.getStub().setEvent("BATCH_CREATED", buildBatchPayload(ctx, b));
        return b;
    }

    // ══════════════════════════════════════════════════════════
    // FARM ACTIVITY — event only, KHÔNG putState
    // ══════════════════════════════════════════════════════════

    @Transaction
    public void recordFarmActivity(Context ctx,
            String harvestBatchId, String activityType,
            String activityDate, String note,
            String evidenceHash, String evidenceUri) {

        RoleChecker.require(ctx, "FARMER");
        // FARMER → Org1MSP đã được verify trong RoleChecker

        Batch harvest = LedgerUtils.getBatchOrThrow(ctx, harvestBatchId);
        if (!"HARVEST".equals(harvest.getType())) {
            throw new ChaincodeException(
                "Farm activity must link to HARVEST batch. Got: "
                + harvest.getType());
        }
        if (!harvest.getOwnerMSP()
                .equals(ctx.getClientIdentity().getMSPID())) {
            throw new ChaincodeException(
                "Only batch owner can record farm activities");
        }

        List<String> validTypes = List.of(
            "IRRIGATION","FERTILIZATION","PEST_CONTROL",
            "PRUNING","SHADE_MANAGEMENT","SOIL_TEST","OTHER");
        if (!validTypes.contains(activityType)) {
            throw new ChaincodeException(
                "Invalid activityType: " + activityType
                + ". Valid: " + validTypes);
        }

        Map<String, String> payload = new HashMap<>();
        payload.put("eventType",      "FARM_ACTIVITY_RECORDED");
        payload.put("harvestBatchId", harvestBatchId);
        payload.put("activityType",   activityType);
        payload.put("activityDate",   activityDate);
        payload.put("note",           note         != null ? note         : "");
        payload.put("evidenceHash",   evidenceHash != null ? evidenceHash : "");
        payload.put("evidenceUri",    evidenceUri  != null ? evidenceUri  : "");
        payload.put("recordedBy",     ctx.getClientIdentity().getId());
        payload.put("recordedAt",     LedgerUtils.now(ctx));
        payload.put("txId",           ctx.getStub().getTxId());

        ctx.getStub().setEvent("FARM_ACTIVITY_RECORDED",
            JSON.serializeMap(payload));
    }

    // ══════════════════════════════════════════════════════════
    // TRANSFER
    // ══════════════════════════════════════════════════════════

    @Transaction
    public void requestTransfer(Context ctx,
            String batchId, String toMSP) {

        Batch b = LedgerUtils.getBatchOrThrow(ctx, batchId);

        if (!b.getOwnerMSP().equals(ctx.getClientIdentity().getMSPID())) {
            throw new ChaincodeException(
                "Only current owner can request transfer. "
                + "owner: " + b.getOwnerMSP()
                + " | caller: " + ctx.getClientIdentity().getMSPID());
        }
        if (!"COMPLETED".equals(b.getStatus())) {
            throw new ChaincodeException(
                "Batch must be COMPLETED to transfer. Current: "
                + b.getStatus());
        }

        b.setStatus("TRANSFER_PENDING");
        b.setPendingToMSP(toMSP);
        b.setUpdatedAt(LedgerUtils.now(ctx));

        ctx.getStub().putState(batchId, JSON.serialize(b));
        LedgerUtils.setSBEAndPolicy(ctx, batchId);
        ctx.getStub().setEvent("TRANSFER_REQUESTED",
            buildTransferPayload(ctx, b, toMSP));
    }

    @Transaction
    public void acceptTransfer(Context ctx, String batchId) {
        // SBE AND đã set bởi requestTransfer →
        // Fabric kiểm tra trước commit → bắt buộc Org1 + Org2 endorse.

        Batch b = LedgerUtils.getBatchOrThrow(ctx, batchId);

        if (!"TRANSFER_PENDING".equals(b.getStatus())) {
            throw new ChaincodeException(
                "Batch not in TRANSFER_PENDING. Current: " + b.getStatus());
        }
        if (!ctx.getClientIdentity().getMSPID()
                .equals(b.getPendingToMSP())) {
            throw new ChaincodeException(
                "Only designated receiver (" + b.getPendingToMSP()
                + ") can accept. Caller: "
                + ctx.getClientIdentity().getMSPID());
        }

        String prevOwner = b.getOwnerMSP();
        b.setOwnerMSP(b.getPendingToMSP());
        b.setPendingToMSP("");
        b.setStatus("TRANSFERRED");
        b.setUpdatedAt(LedgerUtils.now(ctx));

        ctx.getStub().putState(batchId, JSON.serialize(b));
        LedgerUtils.clearSBEPolicy(ctx, batchId);
        ctx.getStub().setEvent("TRANSFER_ACCEPTED",
            buildTransferAcceptedPayload(ctx, b, prevOwner));
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
        if ("IN_STOCK".equals(newStatus) || "SOLD".equals(newStatus)) {
            RoleChecker.require(ctx, "RETAILER");
            // RETAILER → Org2MSP đã được verify trong RoleChecker
        }

        LedgerUtils.validateStatusTransition(
            b.getType(), b.getStatus(), newStatus);

        String oldStatus = b.getStatus();
        b.setStatus(newStatus);
        b.setUpdatedAt(LedgerUtils.now(ctx));
        ctx.getStub().putState(batchId, JSON.serialize(b));

        if ("IN_STOCK".equals(newStatus)) {
            ctx.getStub().setEvent("BATCH_IN_STOCK",
                buildStatusPayload(ctx, b, oldStatus, newStatus));
        } else if ("SOLD".equals(newStatus)) {
            ctx.getStub().setEvent("BATCH_SOLD",
                buildStatusPayload(ctx, b, oldStatus, newStatus));
        } else {
            ctx.getStub().setEvent("BATCH_STATUS_UPDATED",
                buildStatusPayload(ctx, b, oldStatus, newStatus));
        }
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
        if (evidenceHash == null || evidenceHash.isBlank()) {
            throw new ChaincodeException("evidenceHash must not be empty");
        }

        b.setEvidenceHash(evidenceHash);
        b.setEvidenceUri(evidenceUri != null ? evidenceUri : "");
        b.setUpdatedAt(LedgerUtils.now(ctx));

        ctx.getStub().putState(batchId, JSON.serialize(b));
        ctx.getStub().setEvent("EVIDENCE_ADDED",
            buildEvidencePayload(ctx, b));
    }

    // ══════════════════════════════════════════════════════════
    // QUERY
    // ══════════════════════════════════════════════════════════

    @Transaction(intent = Transaction.TYPE.EVALUATE)
    public Batch getBatch(Context ctx, String batchId) {
        return LedgerUtils.getBatchOrThrow(ctx, batchId);
    }

    @Transaction(intent = Transaction.TYPE.EVALUATE)
    public String getTraceChain(Context ctx, String startBatchId) {
        List<Batch> chain = new ArrayList<>();
        String currentId  = startBatchId;
        while (currentId != null && !currentId.isEmpty()) {
            byte[] data = ctx.getStub().getState(currentId);
            if (data == null || data.length == 0) break;
            Batch b = JSON.deserialize(data, Batch.class);
            chain.add(b);
            currentId = b.getParentBatchId();
        }
        return JSON.toJson(chain);
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

    // ══════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ══════════════════════════════════════════════════════════

    /**
     * Kiểm tra publicCode chưa được dùng.
     *
     * ⚠️ Race condition: 2 tx song song có thể cùng pass check
     * này trước khi commit nếu publicCode được tạo đồng thời.
     * Xác suất thấp nếu publicCode có thành phần timestamp + userId.
     *
     * Production options:
     *   A) Dùng publicCode làm composite key riêng:
     *      stub.putState("PUBCODE_" + publicCode, batchId.getBytes())
     *      → Fabric MVCC sẽ detect conflict và reject 1 trong 2 tx.
     *   B) Dùng publicCode làm key chính thay cho batchId.
     *
     * Demo: rich query đủ dùng. CouchDB index bắt buộc phải có
     * (xem META-INF/statedb/couchdb/indexes/) để tránh full scan.
     */
    private void checkPublicCodeUnique(Context ctx, String publicCode) {
        String query = String.format(
            "{\"selector\":{\"docType\":\"batch\",\"publicCode\":\"%s\"}}",
            publicCode);
        try (QueryResultsIterator<KeyValue> it =
                ctx.getStub().getQueryResult(query)) {
            if (it.iterator().hasNext()) {
                throw new ChaincodeException(
                    "publicCode already exists: " + publicCode);
            }
        } catch (ChaincodeException e) {
            throw e;
        } catch (Exception e) {
            throw new ChaincodeException(
                "Failed to check publicCode uniqueness: " + e.getMessage());
        }
    }

    private String runRichQuery(Context ctx, String query) {
        List<Batch> results = new ArrayList<>();
        try (QueryResultsIterator<KeyValue> it =
                ctx.getStub().getQueryResult(query)) {
            for (KeyValue kv : it) {
                results.add(JSON.deserialize(kv.getValue(), Batch.class));
            }
        } catch (Exception e) {
            throw new ChaincodeException("Rich query failed: " + e.getMessage());
        }
        return JSON.toJson(results);
    }
}
```

---

## 7. CouchDB Index

Đặt trong `chaincode/src/main/resources/META-INF/statedb/couchdb/indexes/`

Fabric tự động deploy các file này cùng chaincode package.

```json name=chaincode/src/main/resources/META-INF/statedb/couchdb/indexes/indexPublicCode.json
{
  "index": { "fields": ["docType", "publicCode"] },
  "ddoc":  "indexPublicCodeDoc",
  "name":  "indexPublicCode",
  "type":  "json"
}
```

```json name=chaincode/src/main/resources/META-INF/statedb/couchdb/indexes/indexStatus.json
{
  "index": { "fields": ["docType", "status"] },
  "ddoc":  "indexStatusDoc",
  "name":  "indexStatus",
  "type":  "json"
}
```

```json name=chaincode/src/main/resources/META-INF/statedb/couchdb/indexes/indexOwnerMSP.json
{
  "index": { "fields": ["docType", "ownerMSP"] },
  "ddoc":  "indexOwnerMSPDoc",
  "name":  "indexOwnerMSP",
  "type":  "json"
}
```

> Không có index: query vẫn chạy nhưng peer log warning
> `"CouchDB index warning"` và full-scan world state.
> Index được đặt đúng trong package → deploy tự động, không cần làm thủ công.

---

## 8. build.gradle

```groovy
plugins {
    id 'java'
    id 'com.github.johnrengelman.shadow' version '8.1.1'
}

group   = 'com.coffee.trace'
version = '1.0.0'

repositories { mavenCentral() }

dependencies {
    implementation 'org.hyperledger.fabric-chaincode-java:fabric-chaincode-shim:2.5.0'
    implementation 'com.google.code.gson:gson:2.10.1'
}

shadowJar {
    archiveBaseName    = 'chaincode'
    archiveVersion     = ''
    archiveClassifier  = ''
    manifest {
        attributes 'Main-Class': 'org.hyperledger.fabric.contract.ContractRouter'
    }
}
```