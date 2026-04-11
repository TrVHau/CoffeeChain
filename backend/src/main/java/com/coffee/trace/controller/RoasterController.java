package com.coffee.trace.controller;

import com.coffee.trace.dto.request.AddEvidenceRequest;
import com.coffee.trace.dto.request.CreateRoastBatchRequest;
import com.coffee.trace.dto.request.TransferRequest;
import com.coffee.trace.dto.request.UpdateStatusRequest;
import com.coffee.trace.service.EvidenceService;
import com.coffee.trace.service.FabricGatewayService;
import com.coffee.trace.service.PublicCodeService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class RoasterController {

    private final FabricGatewayService fabricGateway;
    private final EvidenceService      evidenceService;
    private final PublicCodeService    publicCodeService;
    private final ObjectMapper         objectMapper;

    public RoasterController(FabricGatewayService fabricGateway,
                             EvidenceService evidenceService,
                             PublicCodeService publicCodeService,
                             ObjectMapper objectMapper) {
        this.fabricGateway    = fabricGateway;
        this.evidenceService  = evidenceService;
        this.publicCodeService = publicCodeService;
        this.objectMapper     = objectMapper;
    }

    /** POST /api/evidence/upload — upload evidence file and return hash + URI */
    @PostMapping("/evidence/upload")
    @PreAuthorize("hasAnyRole('FARMER','PROCESSOR','ROASTER','PACKAGER')")
    public ResponseEntity<?> uploadEvidence(@RequestParam("file") MultipartFile file) {
        EvidenceService.EvidenceResult result = evidenceService.process(
                file.getOriginalFilename() != null ? file.getOriginalFilename() : "evidence",
                getFileBytes(file)
        );
        return ResponseEntity.ok(Map.of(
                "evidenceHash", result.sha256Hash(),
                "evidenceUri", result.ipfsUri()
        ));
    }

    private byte[] getFileBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (Exception e) {
            throw new RuntimeException("Không đọc được file minh chứng", e);
        }
    }

    /** POST /api/roast — create a RoastBatch */
    @PostMapping("/roast")
    @PreAuthorize("hasRole('ROASTER')")
    public ResponseEntity<?> createRoast(@AuthenticationPrincipal String userId,
                                         @Valid @RequestBody CreateRoastBatchRequest req) throws Exception {
        String publicCode = publicCodeService.generateForType("ROAST");
        byte[] result = fabricGateway.submitAs(
                userId,
                "createRoastBatch",
                publicCode,
                req.getParentBatchId(),
                req.getRoastProfile(),
                req.getRoastDate(),
                req.getRoastDurationMinutes(),
                req.getWeightKg()
        );
        return ResponseEntity.ok(toResponse(result, "createRoastBatch"));
    }

    /** POST /api/roast/{id}/evidence — attach evidence hash + IPFS URI */
    @PostMapping("/roast/{id}/evidence")
    @PreAuthorize("hasRole('ROASTER')")
    public ResponseEntity<?> addEvidence(@AuthenticationPrincipal String userId,
                                         @PathVariable String id,
                                         @Valid @RequestBody AddEvidenceRequest req) throws Exception {
        // IPFS upload is handled by Unit-3's EvidenceService before calling this endpoint.
        // This endpoint records the hash + URI on-chain.
        byte[] result = fabricGateway.submitAs(userId, "addEvidence",
                id, req.getEvidenceHash(), req.getEvidenceUri());
        return ResponseEntity.ok(toResponse(result, "addEvidence"));
    }

    /** POST /api/transfer/request — request transfer to Org2 */
    @PostMapping("/transfer/request")
    @PreAuthorize("hasRole('ROASTER')")
    public ResponseEntity<?> requestTransfer(@AuthenticationPrincipal String userId,
                                             @Valid @RequestBody TransferRequest req) throws Exception {
        byte[] result = fabricGateway.submitAs(userId, "requestTransfer", req.getBatchId(), req.getToMSP());
        return ResponseEntity.ok(toResponse(result, "requestTransfer"));
    }

    /** PATCH /api/roast/{id}/status */
    @PatchMapping("/roast/{id}/status")
    @PreAuthorize("hasRole('ROASTER')")
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
}
