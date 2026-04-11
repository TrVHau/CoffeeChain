package com.coffee.trace.controller;

import com.coffee.trace.dto.request.CreateProcessedBatchRequest;
import com.coffee.trace.dto.request.AddEvidenceRequest;
import com.coffee.trace.dto.request.UpdateStatusRequest;
import com.coffee.trace.service.FabricGatewayService;
import com.coffee.trace.service.PublicCodeService;
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
    private final ObjectMapper         objectMapper;

    public ProcessorController(FabricGatewayService fabricGateway,
                               PublicCodeService publicCodeService,
                               ObjectMapper objectMapper) {
        this.fabricGateway    = fabricGateway;
        this.publicCodeService = publicCodeService;
        this.objectMapper     = objectMapper;
    }

    /** POST /api/processed — create a ProcessedBatch */
    @PostMapping
    @PreAuthorize("hasRole('PROCESSOR')")
    public ResponseEntity<?> createProcessed(@AuthenticationPrincipal String userId,
                                             @Valid @RequestBody CreateProcessedBatchRequest req) throws Exception {
        String publicCode = publicCodeService.generateForType("PROCESSED");
        byte[] result = fabricGateway.submitAs(
                userId,
                "createProcessedBatch",
                publicCode,
                req.getParentBatchId(),
                req.getProcessingMethod(),
                req.getStartDate(),
                req.getEndDate(),
                req.getFacilityName(),
                req.getWeightKg()
        );
        return ResponseEntity.ok(toResponse(result, "createProcessedBatch"));
    }

    /** PATCH /api/processed/{id}/status */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('PROCESSOR')")
    public ResponseEntity<?> updateStatus(@AuthenticationPrincipal String userId,
                                          @PathVariable String id,
                                          @Valid @RequestBody UpdateStatusRequest req) throws Exception {
        byte[] result = fabricGateway.submitAs(userId, "updateBatchStatus", id, req.getNewStatus());
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

        return objectMapper.readValue(payload, Map.class);
    }

    /** POST /api/process/{id}/evidence — attach evidence hash + IPFS URI */
    @PostMapping("/{id}/evidence")
    @PreAuthorize("hasRole('PROCESSOR')")
    public ResponseEntity<?> addEvidence(@AuthenticationPrincipal String userId,
                                         @PathVariable String id,
                                         @Valid @RequestBody AddEvidenceRequest req) throws Exception {
        byte[] result = fabricGateway.submitAs(userId, "addEvidence",
                id, req.getEvidenceHash(), req.getEvidenceUri());
        return ResponseEntity.ok(objectMapper.readValue(result, Map.class));
    }
}
