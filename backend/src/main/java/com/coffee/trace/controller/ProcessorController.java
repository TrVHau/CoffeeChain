package com.coffee.trace.controller;

import com.coffee.trace.dto.request.CreateProcessedBatchRequest;
import com.coffee.trace.dto.request.AddEvidenceRequest;
import com.coffee.trace.dto.request.UpdateStatusRequest;
import com.coffee.trace.repository.BatchRepository;
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
@RequestMapping("/api/process")
public class ProcessorController {

    private final FabricGatewayService fabricGateway;
    private final PublicCodeService    publicCodeService;
    private final AccountOptionsService accountOptionsService;
    private final BatchRepository      batchRepository;
    private final ObjectMapper         objectMapper;

    public ProcessorController(FabricGatewayService fabricGateway,
                               PublicCodeService publicCodeService,
                               AccountOptionsService accountOptionsService,
                               BatchRepository batchRepository,
                               ObjectMapper objectMapper) {
        this.fabricGateway    = fabricGateway;
        this.publicCodeService = publicCodeService;
        this.accountOptionsService = accountOptionsService;
        this.batchRepository  = batchRepository;
        this.objectMapper     = objectMapper;
    }

    /** POST /api/processed — create a ProcessedBatch */
    @PostMapping
    @PreAuthorize("hasRole('PROCESSOR')")
    public ResponseEntity<?> createProcessed(@AuthenticationPrincipal String userId,
                                             @Valid @RequestBody CreateProcessedBatchRequest req) throws Exception {
        if (!accountOptionsService.isAllowedProcessingFacility(userId, req.getFacilityName())) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Cơ sở sơ chế không hợp lệ cho tài khoản hiện tại.",
                "allowedFacilities", accountOptionsService.getProcessingFacilities(userId)
            ));
        }

        if (batchRepository.existsByParentBatchIdAndType(req.getParentBatchId(), "PROCESSED")) {
            return ResponseEntity.status(409).body(Map.of(
                "error", "Lô nguồn này đã được dùng để tạo Processed batch trước đó, không thể dùng lại.",
                "parentBatchId", req.getParentBatchId(),
                "nextType", "PROCESSED"
            ));
        }

        String normalizedWeight = WeightValidator.normalizeOptional(req.getWeightKg(), "Khối lượng");

        String publicCode = publicCodeService.generateForType("PROCESSED");
        byte[] result = fabricGateway.submitAs(
                userId,
                "createProcessedBatch",
                publicCode,
                req.getParentBatchId(),
                req.getProcessingMethod(),
                req.getStartDate(),
            req.getEndDate() != null ? req.getEndDate() : "",
                req.getFacilityName(),
            normalizedWeight
        );

        // New process batches should start immediately in IN_PROCESS state.
        Map<String, Object> created = toResponse(result, "createProcessedBatch");
        Object batchIdObj = created.get("batchId");
        String batchId = batchIdObj != null ? batchIdObj.toString() : null;
        if (batchId != null && !batchId.isBlank()) {
            fabricGateway.submitAs(userId, "updateBatchStatus", batchId, "IN_PROCESS");
        }

        return ResponseEntity.ok(toResponse(result, "createProcessedBatch"));
    }

    /** PATCH /api/processed/{id}/status */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('PROCESSOR')")
    public ResponseEntity<?> updateStatus(@AuthenticationPrincipal String userId,
                                          @PathVariable String id,
                                          @Valid @RequestBody UpdateStatusRequest req) throws Exception {
        byte[] result = fabricGateway.submitAs(userId, "updateBatchStatus", id, req.getNewStatus());

        if ("COMPLETED".equalsIgnoreCase(req.getNewStatus())) {
            String normalizedFinalWeight = WeightValidator.normalizeRequired(req.getFinalWeightKg(), "Khối lượng thực tế");
            fabricGateway.submitAs(userId, "setBatchFinalWeight", id, normalizedFinalWeight);
        }

        return ResponseEntity.ok(toResponse(result, "updateBatchStatus"));
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

    /** POST /api/process/{id}/evidence — attach evidence hash + IPFS URI */
    @PostMapping("/{id}/evidence")
    @PreAuthorize("hasRole('PROCESSOR')")
    public ResponseEntity<?> addEvidence(@AuthenticationPrincipal String userId,
                                         @PathVariable String id,
                                         @Valid @RequestBody AddEvidenceRequest req) throws Exception {
        byte[] result = fabricGateway.submitAs(userId, "addEvidence",
                id, req.getEvidenceHash(), req.getEvidenceUri());
        return ResponseEntity.ok(toResponse(result, "addEvidence"));
    }
}
