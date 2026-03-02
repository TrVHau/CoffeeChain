package com.coffee.trace.chaincode;

import com.coffee.trace.chaincode.model.Batch;
import com.coffee.trace.chaincode.util.JSON;
import com.coffee.trace.chaincode.util.LedgerUtils;
import com.coffee.trace.chaincode.util.RoleChecker;
import org.hyperledger.fabric.contract.Context;
import org.hyperledger.fabric.contract.annotation.Transaction;
import org.hyperledger.fabric.shim.ChaincodeException;

import java.util.Map;

/**
 * TEMPLATE: Chaincode function — SUBMIT (write)
 *
 * Copy file này khi thêm function mới vào CoffeeTraceChaincode.java.
 * Đổi tên method, role, và logic phù hợp.
 *
 * Checklist:
 * [ ] @Transaction annotation (không có intent = SUBMIT by default)
 * [ ] RoleChecker.require() đầu tiên
 * [ ] Validate input trước khi đọc ledger
 * [ ] LedgerUtils.now(ctx) cho timestamp
 * [ ] TreeMap cho metadata
 * [ ] ctx.getStub().putState() để lưu
 * [ ] ctx.getStub().setEvent() để emit event
 * [ ] ChaincodeException với message rõ ràng
 */
public class _TemplateSubmitFunction {

    /**
     * Tên method: camelCase, động từ + danh từ
     * Arguments: Context luôn đứng đầu, rồi mới các param
     *
     * KHÔNG trả về complex object — dùng void hoặc String (JSON)
     * vì Fabric serialize return value.
     */
    @Transaction
    public void createExampleBatch(Context ctx,
            String batchId,
            String publicCode,
            String someField,
            String numericField   // Fabric args always String — convert manually
    ) {
        // ── 1. CHECK ROLE + MSP BINDING ─────────────────────────────────
        // Luôn là bước đầu tiên — fail fast
        RoleChecker.require(ctx, "FARMER");  // đổi role theo function

        // ── 2. VALIDATE INPUT ───────────────────────────────────────────
        if (batchId == null || batchId.isBlank()) {
            throw new ChaincodeException("batchId must not be empty");
        }
        if (publicCode == null || publicCode.isBlank()) {
            throw new ChaincodeException("publicCode must not be empty");
        }
        // Parse numeric sau validate null
        double weightKg;
        try {
            weightKg = Double.parseDouble(numericField);
        } catch (NumberFormatException e) {
            throw new ChaincodeException("numericField must be a number, got: " + numericField);
        }
        if (weightKg <= 0) {
            throw new ChaincodeException("numericField must be positive");
        }

        // ── 3. CHECK DUPLICATE ──────────────────────────────────────────
        byte[] existing = ctx.getStub().getState(batchId);
        if (existing != null && existing.length > 0) {
            throw new ChaincodeException("Batch already exists: " + batchId);
        }

        // ── 4. BUILD OBJECT ─────────────────────────────────────────────
        Batch b = new Batch();
        b.setBatchId(batchId);
        b.setPublicCode(publicCode);
        b.setDocType("batch");
        b.setType("HARVEST");        // đổi theo loại batch
        b.setParentBatchId("");
        b.setOwnerMSP(ctx.getClientIdentity().getMSPID());
        b.setOwnerUserId(ctx.getClientIdentity().getId());
        b.setStatus("CREATED");
        b.setPendingToMSP("");
        b.setEvidenceHash("");
        b.setEvidenceUri("");

        // ✅ ĐÚNG: LedgerUtils.now() — deterministic timestamp
        String now = LedgerUtils.now(ctx);
        b.setCreatedAt(now);
        b.setUpdatedAt(now);

        // ✅ ĐÚNG: setMetadata() wrap trong TreeMap — sorted keys
        b.setMetadata(Map.of(
            "someField",    someField,
            "numericField", numericField
        ));

        // ── 5. SAVE TO LEDGER ────────────────────────────────────────────
        ctx.getStub().putState(batchId, JSON.serialize(b));

        // ── 6. EMIT EVENT ────────────────────────────────────────────────
        // Event name: SCREAMING_SNAKE_CASE
        // Payload: JSON với các field cần thiết cho EventIndexer
        ctx.getStub().setEvent("BATCH_CREATED",
            JSON.serializeMap(Map.of(
                "batchId",    batchId,
                "publicCode", publicCode,
                "type",       "HARVEST",
                "ownerMSP",   b.getOwnerMSP()
                // KHÔNG đặt blockNumber/txId ở đây
                // EventIndexer lấy từ event object, không từ payload
            )));
    }
}
