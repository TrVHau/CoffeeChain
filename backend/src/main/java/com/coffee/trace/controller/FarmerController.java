package com.coffee.trace.controller;

import com.coffee.trace.dto.request.AddEvidenceRequest;
import com.coffee.trace.dto.request.CreateHarvestBatchRequest;
import com.coffee.trace.dto.request.RecordFarmActivityRequest;
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
@RequestMapping("/api/harvest")
public class FarmerController {

    private final FabricGatewayService fabricGateway;
    private final PublicCodeService    publicCodeService;
    private final ObjectMapper         objectMapper;

    public FarmerController(FabricGatewayService fabricGateway,
                            PublicCodeService publicCodeService,
                            ObjectMapper objectMapper) {
        this.fabricGateway    = fabricGateway;
        this.publicCodeService = publicCodeService;
        this.objectMapper     = objectMapper;
    }

    /** POST /api/harvest — create a new HarvestBatch on ledger */
    @PostMapping
    @PreAuthorize("hasRole('FARMER')")
    public ResponseEntity<?> createHarvest(@AuthenticationPrincipal String userId,
                                           @Valid @RequestBody CreateHarvestBatchRequest req) throws Exception {
        String publicCode = publicCodeService.generateForType("HARVEST");
        byte[] result = fabricGateway.submitAs(
                userId,
                "createHarvestBatch",
                publicCode,
                req.getFarmLocation(),
                req.getHarvestDate(),
                req.getCoffeeVariety(),
                req.getWeightKg()
        );
        return ResponseEntity.ok(objectMapper.readValue(result, Map.class));
    }

    /** POST /api/harvest/{id}/activity — record a farm activity event */
    @PostMapping("/{id}/activity")
    @PreAuthorize("hasRole('FARMER')")
    public ResponseEntity<?> recordActivity(@AuthenticationPrincipal String userId,
                                            @PathVariable String id,
                                            @Valid @RequestBody RecordFarmActivityRequest req) throws Exception {
        byte[] result = fabricGateway.submitAs(userId, "recordFarmActivity",
                id,
                req.getActivityType(),
                req.getActivityDate(),
                req.getNote() != null ? req.getNote() : "",
                req.getEvidenceHash() != null ? req.getEvidenceHash() : "",
                req.getEvidenceUri() != null ? req.getEvidenceUri() : "");
        return ResponseEntity.ok(objectMapper.readValue(result, Map.class));
    }

    /** POST /api/harvest/{id}/evidence — attach evidence hash + IPFS URI */
    @PostMapping("/{id}/evidence")
    @PreAuthorize("hasRole('FARMER')")
    public ResponseEntity<?> addEvidence(@AuthenticationPrincipal String userId,
                                         @PathVariable String id,
                                         @Valid @RequestBody AddEvidenceRequest req) throws Exception {
        byte[] result = fabricGateway.submitAs(userId, "addEvidence",
                id, req.getEvidenceHash(), req.getEvidenceUri());
        return ResponseEntity.ok(objectMapper.readValue(result, Map.class));
    }

    /** PATCH /api/harvest/{id}/status — update HarvestBatch status */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('FARMER')")
    public ResponseEntity<?> updateStatus(@AuthenticationPrincipal String userId,
                                          @PathVariable String id,
                                          @Valid @RequestBody UpdateStatusRequest req) throws Exception {
        byte[] result = fabricGateway.submitAs(userId, "updateBatchStatus", id, req.getNewStatus());
        return ResponseEntity.ok(objectMapper.readValue(result, Map.class));
    }
}
