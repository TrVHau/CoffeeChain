package com.coffee.trace.chaincode.util;

import com.coffee.trace.chaincode.model.Batch;
import org.hyperledger.fabric.contract.Context;
import org.hyperledger.fabric.shim.ChaincodeException;
import java.util.*;

public class LedgerUtils {

    /**
     * Sinh batchId unique từ txId + epochSecond + nano.
     *
     * fabric-chaincode-shim 2.5.0: getTxTimestamp() trả về java.time.Instant.
     * Dùng epochSecond + nano riêng biệt để đảm bảo deterministic
     * và không phụ thuộc format string.
     */
    public static String generateBatchId(Context ctx) {
        java.time.Instant ts = ctx.getStub().getTxTimestamp();
        String input = ctx.getStub().getTxId()
            + ":" + ts.getEpochSecond()
            + ":" + ts.getNano();
        return UUID.nameUUIDFromBytes(input.getBytes()).toString();
    }

    /**
     * Trả về ISO-8601: "2024-03-15T08:30:00Z"
     *
     * Instant.toString() đã ra đúng format ISO-8601.
     */
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

        if ("PACKAGED".equals(batchType)
                && "COMPLETED".equals(current)
                && "IN_STOCK".equals(next)) {
            return;
        }

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
            org.hyperledger.fabric.shim.ext.sbe.impl.StateBasedEndorsementFactory.getInstance()
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

