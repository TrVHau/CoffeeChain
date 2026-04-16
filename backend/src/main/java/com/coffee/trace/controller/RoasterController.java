package com.coffee.trace.controller;

import com.coffee.trace.dto.request.AddEvidenceRequest;
import com.coffee.trace.dto.request.CreateRoastBatchRequest;
import com.coffee.trace.dto.request.TransferRequest;
import com.coffee.trace.dto.request.UpdateStatusRequest;
import com.coffee.trace.repository.BatchRepository;
import com.coffee.trace.service.EvidenceService;
import com.coffee.trace.service.FabricGatewayService;
import com.coffee.trace.service.PublicCodeService;
import com.coffee.trace.util.WeightValidator;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(RoasterController.class);

    private final FabricGatewayService fabricGateway;
    private final EvidenceService      evidenceService;
    private final PublicCodeService    publicCodeService;
    private final BatchRepository      batchRepository;
    private final ObjectMapper         objectMapper;

    public RoasterController(FabricGatewayService fabricGateway,
                             EvidenceService evidenceService,
                             PublicCodeService publicCodeService,
                             BatchRepository batchRepository,
                             ObjectMapper objectMapper) {
        this.fabricGateway    = fabricGateway;
        this.evidenceService  = evidenceService;
        this.publicCodeService = publicCodeService;
        this.batchRepository  = batchRepository;
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
        if (batchRepository.existsByParentBatchIdAndType(req.getParentBatchId(), "ROAST")) {
            return ResponseEntity.status(409).body(Map.of(
                "error", "Lô nguồn này đã được dùng để tạo Roast batch trước đó, không thể dùng lại.",
                "parentBatchId", req.getParentBatchId(),
                "nextType", "ROAST"
            ));
        }

        String normalizedWeight = WeightValidator.normalizeOptional(req.getWeightKg(), "Khối lượng");

        String publicCode = publicCodeService.generateForType("ROAST");
        byte[] result = fabricGateway.submitAs(
                userId,
                "createRoastBatch",
                publicCode,
                req.getParentBatchId(),
                req.getRoastProfile(),
                req.getRoastDate(),
                req.getRoastDurationMinutes(),
            normalizedWeight
        );
        return ResponseEntity.ok(toResponse(result, "createRoastBatch"));
    }

    /** POST /api/roast/{id}/evidence — attach evidence hash + IPFS URI */
    @PostMapping("/roast/{id}/evidence")
    @PreAuthorize("hasRole('ROASTER')")
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
            if (req.getRoastDurationMinutes() == null || req.getRoastDurationMinutes().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Vui lòng nhập thời gian rang khi hoàn thành batch."
                ));
            }
            fabricGateway.submitAs(userId, "setBatchFinalWeight", id, normalizedFinalWeight);

            // Backward-compatible: if network chaincode has not been upgraded yet,
            // keep status update successful and log this optional metadata update.
            try {
                fabricGateway.submitAs(userId, "setRoastDurationMinutes", id, req.getRoastDurationMinutes());
            } catch (Exception metadataError) {
                log.warn("setRoastDurationMinutes is unavailable on current chaincode package: {}", metadataError.getMessage());
            }
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
