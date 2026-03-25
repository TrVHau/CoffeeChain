package com.coffee.trace.controller;

import com.coffee.trace.dto.request.CreateProcessedBatchRequest;
import com.coffee.trace.dto.request.UpdateStatusRequest;
import com.coffee.trace.service.FabricGatewayService;
import com.coffee.trace.service.PublicCodeService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

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
        return ResponseEntity.ok(objectMapper.readValue(result, Map.class));
    }

    /** PATCH /api/processed/{id}/status */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('PROCESSOR')")
    public ResponseEntity<?> updateStatus(@AuthenticationPrincipal String userId,
                                          @PathVariable String id,
                                          @Valid @RequestBody UpdateStatusRequest req) throws Exception {
        byte[] result = fabricGateway.submitAs(userId, "updateBatchStatus", id, req.getNewStatus());
        return ResponseEntity.ok(objectMapper.readValue(result, Map.class));
    }
}
