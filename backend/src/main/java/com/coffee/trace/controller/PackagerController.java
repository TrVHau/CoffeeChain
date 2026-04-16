package com.coffee.trace.controller;

import com.coffee.trace.dto.request.AddEvidenceRequest;
import com.coffee.trace.dto.request.CreatePackagedBatchRequest;
import com.coffee.trace.repository.BatchRepository;
import com.coffee.trace.service.FabricGatewayService;
import com.coffee.trace.service.PublicCodeService;
import com.coffee.trace.service.QrCodeService;
import com.coffee.trace.util.WeightValidator;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class PackagerController {

    private final FabricGatewayService fabricGateway;
    private final PublicCodeService    publicCodeService;
    private final ObjectMapper         objectMapper;
    private final QrCodeService        qrCodeService;
    private final BatchRepository      batchRepository;

    @Value("${trace.public-base-url}")
    private String publicBaseUrl;

    public PackagerController(FabricGatewayService fabricGateway,
                              PublicCodeService publicCodeService,
                              ObjectMapper objectMapper,
                              QrCodeService qrCodeService,
                              BatchRepository batchRepository) {
        this.fabricGateway    = fabricGateway;
        this.publicCodeService = publicCodeService;
        this.objectMapper     = objectMapper;
        this.qrCodeService    = qrCodeService;
        this.batchRepository  = batchRepository;
    }

    /**
     * PATCH /api/roast/{id}/accept — accept transfer (SBE AND — Org1 + Org2 endorse).
     * Must be called by a PACKAGER (Org2) user.
     */
    @PostMapping("/transfer/accept/{id}")
    @PreAuthorize("hasRole('PACKAGER')")
    public ResponseEntity<?> acceptTransfer(@AuthenticationPrincipal String userId,
                                            @PathVariable String id) throws Exception {
        byte[] batchRaw = fabricGateway.evaluateTransaction("Org1", "getBatch", id);
        Map<String, Object> batch = objectMapper.readValue(batchRaw, new TypeReference<Map<String, Object>>() {});

        String status = String.valueOf(batch.getOrDefault("status", ""));
        String ownerMsp = String.valueOf(batch.getOrDefault("ownerMSP", ""));
        String pendingToMsp = String.valueOf(batch.getOrDefault("pendingToMSP", ""));

        if ("TRANSFERRED".equalsIgnoreCase(status) && "Org2MSP".equalsIgnoreCase(ownerMsp)) {
            batchRepository.updateOwnerAndStatus(id, "Org2MSP", "TRANSFERRED");
            return ResponseEntity.ok(Map.of(
                    "status", "SUCCESS",
                    "action", "acceptTransfer",
                    "message", "Batch da duoc chap nhan chuyen giao truoc do.",
                    "batchId", id,
                    "currentStatus", status,
                    "ownerMSP", ownerMsp
            ));
        }

        if (!"TRANSFER_PENDING".equalsIgnoreCase(status)) {
            return ResponseEntity.status(409).body(Map.of(
                    "error", "Batch khong o trang thai TRANSFER_PENDING.",
                    "batchId", id,
                    "currentStatus", status,
                    "ownerMSP", ownerMsp
            ));
        }

        if (!"Org2MSP".equalsIgnoreCase(pendingToMsp)) {
            return ResponseEntity.status(409).body(Map.of(
                    "error", "Batch khong duoc chuyen toi Org2MSP nen khong the chap nhan tai Packager.",
                    "batchId", id,
                    "currentStatus", status,
                    "pendingToMSP", pendingToMsp
            ));
        }

        byte[] result = fabricGateway.submitAcceptTransfer(userId, id);
        batchRepository.updateOwnerAndStatus(id, "Org2MSP", "TRANSFERRED");
        return ResponseEntity.ok(toResponse(result, "acceptTransfer"));
    }

    /** POST /api/package — create a PackagedBatch */
    @PostMapping("/package")
    @PreAuthorize("hasRole('PACKAGER')")
    public ResponseEntity<?> createPackaged(@AuthenticationPrincipal String userId,
                                            @Valid @RequestBody CreatePackagedBatchRequest req) throws Exception {
        if (batchRepository.existsByParentBatchIdAndType(req.getParentBatchId(), "PACKAGED")) {
            return ResponseEntity.status(409).body(Map.of(
                "error", "Lô nguồn này đã được dùng để tạo Packaged batch trước đó, không thể dùng lại.",
                "parentBatchId", req.getParentBatchId(),
                "nextType", "PACKAGED"
            ));
        }

        String normalizedPackageWeight = WeightValidator.normalizeRequired(req.getPackageWeight(), "Khối lượng đóng gói");

        String publicCode = publicCodeService.generateForType("PACKAGED");
        byte[] result = fabricGateway.submitAs(
                userId,
                "createPackagedBatch",
                publicCode,
                req.getParentBatchId(),
                normalizedPackageWeight,
                req.getPackageCount(),
                req.getPackageDate(),
                req.getExpiryDate(),
                publicBaseUrl
        );
        return ResponseEntity.ok(toResponse(result, "createPackagedBatch"));
    }

    /** POST /api/package/{id}/evidence — attach evidence hash + IPFS URI */
    @PostMapping("/package/{id}/evidence")
    @PreAuthorize("hasRole('PACKAGER')")
    public ResponseEntity<?> addEvidence(@AuthenticationPrincipal String userId,
                                         @PathVariable String id,
                                         @Valid @RequestBody AddEvidenceRequest req) throws Exception {
        byte[] result = fabricGateway.submitAs(userId, "addEvidence",
                id, req.getEvidenceHash(), req.getEvidenceUri());
        return ResponseEntity.ok(toResponse(result, "addEvidence"));
    }

    /**
     * GET /api/package/{id}/qr — generate QR code PNG for a batch.
     * Looks up the batch's publicCode from DB and encodes the public trace URL.
     */
    @GetMapping(value = "/package/{id}/qr", produces = MediaType.IMAGE_PNG_VALUE)
    @PreAuthorize("hasAnyRole('PACKAGER','RETAILER')")
    public ResponseEntity<byte[]> getQr(@PathVariable String id) {
        return batchRepository.findById(id)
            .map(batch -> ResponseEntity.ok(qrCodeService.generateQrPng(batch.getPublicCode())))
            .orElseGet(() -> ResponseEntity.notFound().build());
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
