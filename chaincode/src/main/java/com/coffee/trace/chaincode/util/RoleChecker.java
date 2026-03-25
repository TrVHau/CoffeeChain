package com.coffee.trace.chaincode.util;

import org.hyperledger.fabric.contract.Context;
import org.hyperledger.fabric.shim.ChaincodeException;
import java.util.Arrays;
import java.util.Map;

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

