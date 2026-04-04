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

    private Map<String, String> stableEventMap(String... kv) {
        Map<String, String> out = new TreeMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            out.put(kv[i], kv[i + 1]);
        }
        return out;
    }

    private byte[] buildBatchPayload(Context ctx, Batch b) {
        return JSON.serializeMap(stableEventMap(
            "batchId", b.getBatchId(),
            "parentBatchId", b.getParentBatchId(),
            "type", b.getType(),
            "ownerMSP", b.getOwnerMSP(),
            "publicCode", b.getPublicCode(),
            "status", b.getStatus(),
            "txId", ctx.getStub().getTxId()
        ));
    }

    private byte[] buildStatusPayload(Context ctx,
            Batch b, String oldStatus, String newStatus) {
        return JSON.serializeMap(stableEventMap(
            "batchId", b.getBatchId(),
            "oldStatus", oldStatus,
            "newStatus", newStatus,
            "txId", ctx.getStub().getTxId()
        ));
    }

    private byte[] buildTransferPayload(Context ctx,
            Batch b, String toMSP) {
        return JSON.serializeMap(stableEventMap(
            "batchId", b.getBatchId(),
            "fromMSP", b.getOwnerMSP(),
            "toMSP", toMSP,
            "txId", ctx.getStub().getTxId()
        ));
    }

    private byte[] buildTransferAcceptedPayload(Context ctx,
            Batch b, String fromMSP) {
        // blockNumber KHÔNG lấy được trong chaincode —
        // lấy từ event.getBlockNumber() ở EventIndexerService.
        return JSON.serializeMap(stableEventMap(
            "batchId", b.getBatchId(),
            "fromMSP", fromMSP,
            "toMSP", b.getOwnerMSP(),
            "txId", ctx.getStub().getTxId()
        ));
    }

    private byte[] buildEvidencePayload(Context ctx, Batch b) {
        return JSON.serializeMap(stableEventMap(
            "batchId", b.getBatchId(),
            "hash", b.getEvidenceHash(),
            "uri", b.getEvidenceUri(),
            "txId", ctx.getStub().getTxId()
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
        // Setter accepts Map but internally wraps in TreeMap (see Batch.java).
        // TreeMap sorts keys alphabetically before Gson serialization →
        // every peer produces identical bytes → no endorsement mismatch.
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
            String endDate, String facilityName, String weightKg) {

        RoleChecker.require(ctx, "PROCESSOR");
        checkPublicCodeUnique(ctx, publicCode);
        LedgerUtils.validateParentReady(ctx, parentBatchId, "HARVEST");

        Batch b = buildBatch(ctx, publicCode, "PROCESSED", parentBatchId,
            Map.of("processingMethod", processingMethod,
                   "startDate",        startDate,
                   "endDate",          endDate,
                   "facilityName",     facilityName,
                   "weightKg",         weightKg));

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
            String packagedDate, String expiryDate,
            String qrBaseUrl) {
        // qrBaseUrl truyền từ backend (${TRACE_PUBLIC_BASE_URL})
        // thay vì hard-code "https://trace.example.com/trace/"

        RoleChecker.require(ctx, "PACKAGER");
        checkPublicCodeUnique(ctx, publicCode);
        LedgerUtils.validateParentReady(ctx, parentBatchId, "ROAST");

        String qrUrl = qrBaseUrl + publicCode;
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

        // Use TreeMap for deterministic key ordering across peers
        Map<String, String> payload = stableEventMap(
            "activityDate",   activityDate,
            "activityType",   activityType,
            "evidenceHash",   evidenceHash != null ? evidenceHash : "",
            "evidenceUri",    evidenceUri  != null ? evidenceUri  : "",
            "eventType",      "FARM_ACTIVITY_RECORDED",
            "harvestBatchId", harvestBatchId,
            "note",           note         != null ? note         : "",
            "recordedAt",     LedgerUtils.now(ctx),
            "recordedBy",     ctx.getClientIdentity().getId(),
            "txId",           ctx.getStub().getTxId());

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
        List<Batch> chain   = new ArrayList<>();
        // FIX-CYCLE: visited set guards against infinite loop if parentBatchId
        // ever forms a cycle due to a data bug or incorrect input.
        Set<String> visited = new HashSet<>();
        String currentId    = startBatchId;
        while (currentId != null && !currentId.isEmpty()) {
            if (visited.contains(currentId)) {
                throw new ChaincodeException(
                    "Cycle detected in trace chain at batchId: " + currentId);
            }
            visited.add(currentId);
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
     * Demo: rich query đủ dùng.
     * ✅ CouchDB index ĐÃ có tại META-INF/statedb/couchdb/indexes/indexPublicCode.json
     *    Fabric tự deploy cùng chaincode package
     *    → không full scan, peer log không còn warning "CouchDB index warning".
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

