package com.coffee.trace.controller;

import com.coffee.trace.dto.response.BatchResponse;
import com.coffee.trace.dto.response.TraceResponse;
import com.coffee.trace.entity.BatchEntity;
import com.coffee.trace.entity.FarmActivityEntity;
import com.coffee.trace.entity.LedgerRefEntity;
import com.coffee.trace.repository.BatchRepository;
import com.coffee.trace.repository.FarmActivityRepository;
import com.coffee.trace.repository.LedgerRefRepository;
import com.coffee.trace.service.FabricGatewayService;
import com.coffee.trace.service.QrCodeService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
public class TraceController {

    private static final Logger log = LoggerFactory.getLogger(TraceController.class);

    private final BatchRepository        batchRepository;
    private final FarmActivityRepository farmActivityRepository;
    private final LedgerRefRepository    ledgerRefRepository;
    private final QrCodeService          qrCodeService;
    private final FabricGatewayService   fabricGatewayService;
    private final ObjectMapper           objectMapper;

    public TraceController(BatchRepository batchRepository,
                           FarmActivityRepository farmActivityRepository,
                           LedgerRefRepository ledgerRefRepository,
                           QrCodeService qrCodeService,
                           FabricGatewayService fabricGatewayService,
                           ObjectMapper objectMapper) {
        this.batchRepository        = batchRepository;
        this.farmActivityRepository = farmActivityRepository;
        this.ledgerRefRepository    = ledgerRefRepository;
        this.qrCodeService          = qrCodeService;
        this.fabricGatewayService   = fabricGatewayService;
        this.objectMapper           = objectMapper;
    }

    public TraceController(BatchRepository batchRepository,
                           FarmActivityRepository farmActivityRepository,
                           LedgerRefRepository ledgerRefRepository,
                           QrCodeService qrCodeService) {
        this(batchRepository, farmActivityRepository, ledgerRefRepository, qrCodeService, null, null);
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

        // Walk parent chain from immediate parent -> oldest ancestor
        List<BatchEntity> parentChainNewestToOldest = new ArrayList<>();
        Set<String> visited = new HashSet<>();
        String parentId = current.getParentBatchId();
        while (parentId != null && !parentId.isBlank() && visited.add(parentId)) {
            BatchEntity parent = batchRepository.findById(parentId).orElse(null);
            if (parent == null) break;
            parentChainNewestToOldest.add(parent);
            parentId = parent.getParentBatchId();
        }

        // Response/UI expects oldest -> newest parent order
        List<BatchEntity> parentChain = new ArrayList<>(parentChainNewestToOldest);
        Collections.reverse(parentChain);

        String harvestBatchId = "HARVEST".equalsIgnoreCase(current.getType())
                ? current.getBatchId()
                : parentChain.stream()
                .filter(b -> "HARVEST".equalsIgnoreCase(b.getType()))
                .map(BatchEntity::getBatchId)
                .findFirst()
                .orElse(null);

        List<FarmActivityEntity> farmActivities = harvestBatchId != null
                ? farmActivityRepository.findByHarvestBatchIdOrderByActivityDateAsc(harvestBatchId)
                : List.of();

        List<String> chainBatchIds = new ArrayList<>();
        parentChain.forEach(b -> chainBatchIds.add(b.getBatchId()));
        chainBatchIds.add(current.getBatchId());
        List<LedgerRefEntity> ledgerRefs = chainBatchIds.isEmpty()
                ? List.of()
                : ledgerRefRepository.findByBatchIdInOrderByCreatedAtAsc(chainBatchIds);

        List<BatchEntity> enrichedParentChain = parentChain.stream()
                .map(this::enrichEvidenceFromChainIfMissing)
                .toList();
        BatchEntity enrichedCurrent = enrichEvidenceFromChainIfMissing(current);

        TraceResponse response = TraceResponse.builder()
                .batch(BatchResponse.from(enrichedCurrent))
                .parentChain(enrichedParentChain.stream().map(BatchResponse::from).toList())
                .farmActivities(farmActivities.stream().map(TraceResponse.FarmActivityItem::from).toList())
                .ledgerRefs(ledgerRefs.stream().map(TraceResponse.LedgerRefItem::from).toList())
                .build();
        return ResponseEntity.ok(response);
    }

    private BatchEntity enrichEvidenceFromChainIfMissing(BatchEntity batch) {
        if (batch == null) {
            return null;
        }
        if (fabricGatewayService == null || objectMapper == null) {
            return batch;
        }
        if (hasText(batch.getEvidenceHash()) && hasText(batch.getEvidenceUri())) {
            return batch;
        }
        try {
            byte[] raw = fabricGatewayService.evaluateTransaction("Org1", "getBatch", batch.getBatchId());
            Map<String, Object> payload = objectMapper.readValue(raw, new TypeReference<Map<String, Object>>() {});

            if (!hasText(batch.getEvidenceHash())) {
                batch.setEvidenceHash(readString(payload, "evidenceHash", "evidence_hash", "EvidenceHash"));
            }
            if (!hasText(batch.getEvidenceUri())) {
                batch.setEvidenceUri(readString(payload, "evidenceUri", "evidenceURI", "evidence_uri", "EvidenceUri", "EvidenceURI"));
            }
        } catch (Exception ex) {
            log.debug("Cannot enrich evidence from chain for batchId={}: {}", batch.getBatchId(), ex.getMessage());
        }
        return batch;
    }

    private String readString(Map<String, Object> payload, String... keys) {
        for (String key : keys) {
            Object value = payload.get(key);
            if (value instanceof String str && hasText(str)) {
                return str;
            }
        }
        return null;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
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
