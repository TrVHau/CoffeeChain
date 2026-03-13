package com.coffee.trace.controller;

import com.coffee.trace.dto.request.CreatePackagedBatchRequest;
import com.coffee.trace.repository.BatchRepository;
import com.coffee.trace.service.FabricGatewayService;
import com.coffee.trace.service.QrCodeService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class PackagerController {

    private final FabricGatewayService fabricGateway;
    private final ObjectMapper         objectMapper;
    private final QrCodeService        qrCodeService;
    private final BatchRepository      batchRepository;

    @Value("${trace.public-base-url}")
    private String publicBaseUrl;

    public PackagerController(FabricGatewayService fabricGateway,
                              ObjectMapper objectMapper,
                              QrCodeService qrCodeService,
                              BatchRepository batchRepository) {
        this.fabricGateway   = fabricGateway;
        this.objectMapper    = objectMapper;
        this.qrCodeService   = qrCodeService;
        this.batchRepository = batchRepository;
    }

    /**
     * PATCH /api/roast/{id}/accept — accept transfer (SBE AND — Org1 + Org2 endorse).
     * Must be called by a PACKAGER (Org2) user.
     */
    @PostMapping("/transfer/accept/{id}")
    @PreAuthorize("hasRole('PACKAGER')")
    public ResponseEntity<?> acceptTransfer(@AuthenticationPrincipal String userId,
                                            @PathVariable String id) throws Exception {
        byte[] result = fabricGateway.submitAcceptTransfer(userId, id);
        return ResponseEntity.ok(objectMapper.readValue(result, Map.class));
    }

    /** POST /api/package — create a PackagedBatch */
    @PostMapping("/package")
    @PreAuthorize("hasRole('PACKAGER')")
    public ResponseEntity<?> createPackaged(@AuthenticationPrincipal String userId,
                                            @Valid @RequestBody CreatePackagedBatchRequest req) throws Exception {
        String metadata = objectMapper.writeValueAsString(Map.of(
                "packageWeight", req.getPackageWeight(),
                "packagedDate",  req.getPackageDate(),   // key = packagedDate per data model
                "expiryDate",    req.getExpiryDate(),
                "packageCount",  req.getPackageCount()
        ));
        byte[] result = fabricGateway.submitAs(userId, "createPackagedBatch",
                req.getParentBatchId(), metadata, publicBaseUrl);
        return ResponseEntity.ok(objectMapper.readValue(result, Map.class));
    }

    /**
     * GET /api/package/{id}/qr — generate QR code PNG for a batch.
     * Looks up the batch's publicCode from DB and encodes the public trace URL.
     */
    @GetMapping(value = "/package/{id}/qr", produces = MediaType.IMAGE_PNG_VALUE)
    @PreAuthorize("hasRole('PACKAGER')")
    public ResponseEntity<byte[]> getQr(@PathVariable String id) {
        return batchRepository.findById(id)
                .map(batch -> ResponseEntity.ok(qrCodeService.generateQrPng(batch.getPublicCode())))
                .orElse(ResponseEntity.notFound().build());
    }
}
