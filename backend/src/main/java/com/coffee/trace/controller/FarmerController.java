package com.coffee.trace.controller;

import com.coffee.trace.dto.request.AddEvidenceRequest;
import com.coffee.trace.dto.request.CreateHarvestBatchRequest;
import com.coffee.trace.dto.request.RecordFarmActivityRequest;
import com.coffee.trace.dto.request.UpdateStatusRequest;
import com.coffee.trace.service.AccountOptionsService;
import com.coffee.trace.service.FabricGatewayService;
import com.coffee.trace.service.PublicCodeService;
import com.coffee.trace.util.WeightValidator;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.Map;

@RestController
@RequestMapping("/api/harvest")
public class FarmerController {

    private final FabricGatewayService fabricGateway;
    private final PublicCodeService    publicCodeService;
    private final AccountOptionsService accountOptionsService;
    private final ObjectMapper         objectMapper;

    public FarmerController(FabricGatewayService fabricGateway,
                            PublicCodeService publicCodeService,
                            AccountOptionsService accountOptionsService,
                            ObjectMapper objectMapper) {
        this.fabricGateway    = fabricGateway;
        this.publicCodeService = publicCodeService;
        this.accountOptionsService = accountOptionsService;
        this.objectMapper     = objectMapper;
    }

    /** POST /api/harvest — create a new HarvestBatch on ledger */
    @PostMapping
    @PreAuthorize("hasRole('FARMER')")
    public ResponseEntity<?> createHarvest(@AuthenticationPrincipal String userId,
                                           @Valid @RequestBody CreateHarvestBatchRequest req) throws Exception {
        if (!accountOptionsService.isAllowedFarmLocation(userId, req.getFarmLocation())) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Địa điểm nông trại không hợp lệ cho tài khoản hiện tại.",
                "allowedFarmLocations", accountOptionsService.getFarmLocations(userId)
            ));
        }

        String normalizedWeight = WeightValidator.normalizeOptional(req.getWeightKg(), "Khối lượng");

        String publicCode = publicCodeService.generateForType("HARVEST");
        byte[] result = fabricGateway.submitAs(
                userId,
                "createHarvestBatch",
                publicCode,
                req.getFarmLocation(),
                req.getHarvestDate(),
                req.getCoffeeVariety(),
            normalizedWeight
        );
        return ResponseEntity.ok(toResponse(result, "createHarvestBatch"));
    }

    /** POST /api/harvest/{id}/activity — record a farm activity event */
    @PostMapping("/{id}/activity")
    @PreAuthorize("hasRole('FARMER')")
    public ResponseEntity<?> recordActivity(@AuthenticationPrincipal String userId,
                                            @PathVariable String id,
                                            @Valid @RequestBody RecordFarmActivityRequest req) throws Exception {
        if (isTransferPending(id)) {
            return ResponseEntity.status(409).body(Map.of(
                "error", "Batch đang chuyển giao, tạm khóa nhật ký canh tác.",
                "batchId", id,
                "currentStatus", "TRANSFER_PENDING"
            ));
        }

        byte[] batchRaw = fabricGateway.evaluateTransaction("Org1", "getBatch", id);
        Map<String, Object> batch = objectMapper.readValue(batchRaw, new TypeReference<Map<String, Object>>() {});
        String status = String.valueOf(batch.getOrDefault("status", ""));
        if (!"CREATED".equalsIgnoreCase(status) && !"IN_PROCESS".equalsIgnoreCase(status)) {
            return ResponseEntity.status(409).body(Map.of(
                "error", "Harvest batch is already completed. Farm activity can only be added when status is CREATED or IN_PROCESS.",
                "batchId", id,
                "currentStatus", status
            ));
        }

        byte[] result = fabricGateway.submitAs(userId, "recordFarmActivity",
                id,
                req.getActivityType(),
                req.getActivityDate(),
                req.getNote() != null ? req.getNote() : "",
                req.getEvidenceHash() != null ? req.getEvidenceHash() : "",
                req.getEvidenceUri() != null ? req.getEvidenceUri() : "");
        return ResponseEntity.ok(toResponse(result, "recordFarmActivity"));
    }

    /** POST /api/harvest/{id}/evidence — attach evidence hash + IPFS URI */
    @PostMapping("/{id}/evidence")
    @PreAuthorize("hasRole('FARMER')")
    public ResponseEntity<?> addEvidence(@AuthenticationPrincipal String userId,
                                         @PathVariable String id,
                                         @Valid @RequestBody AddEvidenceRequest req) throws Exception {
        if (isTransferPending(id)) {
            return ResponseEntity.status(409).body(Map.of(
                "error", "Batch đang chuyển giao, tạm khóa cập nhật minh chứng.",
                "batchId", id,
                "currentStatus", "TRANSFER_PENDING"
            ));
        }

        byte[] result = fabricGateway.submitAs(userId, "addEvidence",
                id, req.getEvidenceHash(), req.getEvidenceUri());
        return ResponseEntity.ok(toResponse(result, "addEvidence"));
    }

    /** PATCH /api/harvest/{id}/status — update HarvestBatch status */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('FARMER')")
    public ResponseEntity<?> updateStatus(@AuthenticationPrincipal String userId,
                                          @PathVariable String id,
                                          @Valid @RequestBody UpdateStatusRequest req) throws Exception {
        if (isTransferPending(id)) {
            return ResponseEntity.status(409).body(Map.of(
                "error", "Batch đang chuyển giao, tạm khóa cập nhật trạng thái.",
                "batchId", id,
                "currentStatus", "TRANSFER_PENDING"
            ));
        }

        byte[] result = fabricGateway.submitAs(userId, "updateBatchStatus", id, req.getNewStatus());

        if ("COMPLETED".equalsIgnoreCase(req.getNewStatus())) {
            String normalizedFinalWeight = WeightValidator.normalizeRequired(req.getFinalWeightKg(), "Khối lượng thực tế");
            fabricGateway.submitAs(userId, "setBatchFinalWeight", id, normalizedFinalWeight);
        }

        return ResponseEntity.ok(toResponse(result, "updateBatchStatus"));
    }

    private boolean isTransferPending(String batchId) throws Exception {
        byte[] batchRaw = fabricGateway.evaluateTransaction("Org1", "getBatch", batchId);
        Map<String, Object> batch = objectMapper.readValue(batchRaw, new TypeReference<Map<String, Object>>() {});
        return "TRANSFER_PENDING".equalsIgnoreCase(String.valueOf(batch.getOrDefault("status", "")));
    }

    private Map<String, Object> toResponse(byte[] result, String action) throws Exception {
        if (result == null || result.length == 0) {
            return Map.of("status", "SUCCESS", "action", action);
        }

        String payload = new String(result, StandardCharsets.UTF_8).trim();
        if (payload.isEmpty()) {
            return Map.of("status", "SUCCESS", "action", action);
        }

        return objectMapper.readValue(payload, new TypeReference<Map<String, Object>>() {});
    }
}
