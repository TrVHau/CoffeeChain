package com.coffee.trace.controller;

import com.coffee.trace.dto.response.BatchResponse;
import com.coffee.trace.dto.response.TraceResponse;
import com.coffee.trace.entity.BatchEntity;
import com.coffee.trace.repository.BatchRepository;
import com.coffee.trace.repository.FarmActivityRepository;
import com.coffee.trace.repository.LedgerRefRepository;
import com.coffee.trace.service.QrCodeService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

@RestController
public class TraceController {

    private final BatchRepository        batchRepository;
    private final FarmActivityRepository farmActivityRepository;
    private final LedgerRefRepository    ledgerRefRepository;
    private final QrCodeService          qrCodeService;

    public TraceController(BatchRepository batchRepository,
                           FarmActivityRepository farmActivityRepository,
                           LedgerRefRepository ledgerRefRepository,
                           QrCodeService qrCodeService) {
        this.batchRepository        = batchRepository;
        this.farmActivityRepository = farmActivityRepository;
        this.ledgerRefRepository    = ledgerRefRepository;
        this.qrCodeService          = qrCodeService;
    }

    /**
     * GET /api/trace/{publicCode} — public endpoint, no auth required.
     * Returns full provenance chain: current batch + all ancestors + farm activities + ledger refs.
     */
    @GetMapping("/api/trace/{publicCode}")
    public ResponseEntity<TraceResponse> trace(@PathVariable String publicCode) {
        BatchEntity current = batchRepository.findByPublicCode(publicCode).orElse(null);
        if (current == null) {
            return ResponseEntity.notFound().build();
        }

        // Walk parent chain
        List<BatchEntity> parentChain = new ArrayList<>();
        String parentId = current.getParentBatchId();
        while (parentId != null) {
            BatchEntity parent = batchRepository.findById(parentId).orElse(null);
            if (parent == null) break;
            parentChain.add(parent);
            parentId = parent.getParentBatchId();
        }

        var farmActivities = farmActivityRepository.findByHarvestBatchIdOrderByActivityDateAsc(current.getBatchId());
        var ledgerRefs     = ledgerRefRepository.findByBatchIdOrderByCreatedAtAsc(current.getBatchId());

        TraceResponse response = TraceResponse.builder()
                .batch(BatchResponse.from(current))
                .parentChain(parentChain.stream().map(BatchResponse::from).toList())
                .farmActivities(farmActivities.stream().map(TraceResponse.FarmActivityItem::from).toList())
                .ledgerRefs(ledgerRefs.stream().map(TraceResponse.LedgerRefItem::from).toList())
                .build();
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/qr/{publicCode} — public endpoint, generates QR code PNG for the trace URL.
     */
    @GetMapping(value = "/api/qr/{publicCode}", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> qr(@PathVariable String publicCode) {
        return batchRepository.findByPublicCode(publicCode)
                .map(b -> ResponseEntity.ok(qrCodeService.generateQrPng(publicCode)))
                .orElse(ResponseEntity.notFound().build());
    }
}
