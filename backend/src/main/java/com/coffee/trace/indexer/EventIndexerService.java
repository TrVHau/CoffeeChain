package com.coffee.trace.indexer;

import com.coffee.trace.entity.BatchEntity;
import com.coffee.trace.entity.FarmActivityEntity;
import com.coffee.trace.repository.BatchRepository;
import com.coffee.trace.repository.FarmActivityRepository;
import com.coffee.trace.repository.LedgerRefRepository;
import com.coffee.trace.service.FabricGatewayService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.dao.DataIntegrityViolationException;
import org.hyperledger.fabric.client.ChaincodeEvent;
import org.hyperledger.fabric.client.CloseableIterator;
import org.hyperledger.fabric.client.Network;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Unit-3: Fabric chaincode event listener.
 *
 * Subscribes to all events emitted by CoffeeTraceChaincode and
 * keeps the PostgreSQL read-model (batches, farm_activities, ledger_refs)
 * in sync with the ledger.
 *
 * Each event type maps to one or more DB mutations:
 *
 *  BATCH_CREATED            → INSERT into batches
 *  BATCH_STATUS_UPDATED     → UPDATE batches.status
 *  TRANSFER_REQUESTED       → UPDATE batches (status = TRANSFER_PENDING, pendingToMsp)
 *  TRANSFER_ACCEPTED        → UPDATE batches (ownerMsp, status = TRANSFERRED)
 *  EVIDENCE_ADDED           → UPDATE batches (evidenceHash, evidenceUri)
 *  FARM_ACTIVITY_RECORDED   → INSERT into farm_activities
 *  BATCH_IN_STOCK           → UPDATE batches.status = IN_STOCK
 *  BATCH_SOLD               → UPDATE batches.status = SOLD
 *
 *  All events also → INSERT into ledger_refs (audit trail).
 */
@Service
public class EventIndexerService {

    private static final Logger log = LoggerFactory.getLogger(EventIndexerService.class);

    private final FabricGatewayService   fabricGateway;
    private final BatchRepository        batchRepository;
    private final FarmActivityRepository farmActivityRepository;
    private final LedgerRefRepository    ledgerRefRepository;
    private final ObjectMapper           objectMapper;

    private final ExecutorService executor = Executors.newFixedThreadPool(2);

    // Keep references to close iterators on shutdown
    private volatile CloseableIterator<ChaincodeEvent> org1EventIterator;
    private volatile CloseableIterator<ChaincodeEvent> org2EventIterator;

    public EventIndexerService(FabricGatewayService fabricGateway,
                               BatchRepository batchRepository,
                               FarmActivityRepository farmActivityRepository,
                               LedgerRefRepository ledgerRefRepository,
                               ObjectMapper objectMapper) {
        this.fabricGateway        = fabricGateway;
        this.batchRepository      = batchRepository;
        this.farmActivityRepository = farmActivityRepository;
        this.ledgerRefRepository  = ledgerRefRepository;
        this.objectMapper         = objectMapper;
    }

    /**
     * Start event listener threads for Org1 and Org2 after Spring context is ready.
     * Using two orgs ensures events are captured even if one peer is temporarily down.
     */
    @PostConstruct
    public void startListening() {
        executor.submit(() -> listenOrg("Org1"));
        executor.submit(() -> listenOrg("Org2"));
        log.info("EventIndexerService started — listening on Org1 and Org2");
    }

    private void listenOrg(String org) {
        while (!Thread.currentThread().isInterrupted()) {
            try {
                Network network = fabricGateway.getNetwork(org);
                CloseableIterator<ChaincodeEvent> iter = network
                        .getChaincodeEvents(fabricGateway.getChaincodeName());

                if ("Org1".equals(org)) {
                    org1EventIterator = iter;
                } else {
                    org2EventIterator = iter;
                }

                log.info("[{}] Event iterator opened", org);
                iter.forEachRemaining(event -> {
                    try {
                        handleEvent(event);
                    } catch (Exception e) {
                        log.error("[{}] Error handling event {}: {}", org, event.getEventName(), e.getMessage(), e);
                    }
                });

            } catch (Exception e) {
                if (Thread.currentThread().isInterrupted()) break;
                log.warn("[{}] Event stream disconnected: {}. Reconnecting in 5s...", org, e.getMessage());
                try {
                    Thread.sleep(5_000);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        log.info("[{}] Event listener thread exiting", org);
    }

    private void handleEvent(ChaincodeEvent event) throws Exception {
        String eventName = event.getEventName();
        String txId      = event.getTransactionId();
        long   blockNum  = event.getBlockNumber();

        Map<String, String> payload = parsePayload(event.getPayload());

        log.debug("Event received: {} txId={} block={}", eventName, txId, blockNum);

        switch (eventName) {
            case "BATCH_CREATED"          -> handleBatchCreated(payload, txId, blockNum);
            case "BATCH_STATUS_UPDATED"   -> handleStatusUpdated(payload);
            case "TRANSFER_REQUESTED"     -> handleTransferRequested(payload);
            case "TRANSFER_ACCEPTED"      -> handleTransferAccepted(payload);
            case "EVIDENCE_ADDED"         -> handleEvidenceAdded(payload);
            case "BATCH_WEIGHT_UPDATED"   -> handleBatchWeightUpdated(payload);
            case "BATCH_ROAST_DURATION_UPDATED" -> handleRoastDurationUpdated(payload);
            case "FARM_ACTIVITY_RECORDED" -> handleFarmActivity(payload, txId, blockNum);
            case "BATCH_IN_STOCK"         -> handleStatusUpdated(payload);
            case "BATCH_SOLD"             -> handleStatusUpdated(payload);
            default -> log.debug("Unknown event '{}' — recorded in ledger_refs only", eventName);
        }

        // Record audit trail after state mutations to avoid FK race with BATCH_CREATED.
        String batchId = payload.getOrDefault("batchId", payload.getOrDefault("harvestBatchId", ""));
        if (batchId != null && !batchId.isBlank()) {
            ledgerRefRepository.save(batchId, eventName, txId, String.valueOf(blockNum));
        }
    }

    // ── Event handlers ───────────────────────────────────────────────────

    private void handleBatchCreated(Map<String, String> p, String txId, long blockNum) {
        String batchId = p.get("batchId");
        if (batchRepository.existsById(batchId)) {
            log.debug("BATCH_CREATED: batchId={} already in DB — skipping", batchId);
            return;
        }
        
        // Deduplication: check if this transaction has already been processed
        // Prevents duplicate batch creation from Org1 + Org2 listeners processing same event
        if (txId != null && !txId.isBlank() && ledgerRefRepository.existsByTxIdAndEventName(txId, "BATCH_CREATED")) {
            log.debug("BATCH_CREATED duplicate txId={} skipped", txId);
            return;
        }
        
        BatchEntity entity = BatchEntity.builder()
                .batchId(batchId)
                .publicCode(p.getOrDefault("publicCode", batchId))
                .type(p.getOrDefault("type", "UNKNOWN"))
                .parentBatchId(p.get("parentBatchId"))
                .ownerMsp(p.getOrDefault("ownerMSP", ""))
                .ownerUserId(p.getOrDefault("ownerUserId", ""))
                .status(p.getOrDefault("status", "CREATED"))
            .metadata(queryMetadataFromChain(batchId, p.get("metadata")))
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        try {
            batchRepository.save(entity);
            log.info("BATCH_CREATED: indexed batchId={}", batchId);
        } catch (DataIntegrityViolationException e) {
            // Race condition: both Org1 and Org2 tried to save same batch simultaneously
            log.debug("BATCH_CREATED duplicate batchId={} caught by unique constraint, silently ignored", batchId);
        }
    }

    private void handleStatusUpdated(Map<String, String> p) {
        String batchId = p.get("batchId");
        String status  = p.get("status");
        if (status == null || status.isBlank()) {
            status = p.get("newStatus");
        }
        if (batchId != null && status != null) {
            batchRepository.updateStatus(batchId, status);

            // Business rule: processed batches only know startDate at creation.
            // When moved to COMPLETED, automatically stamp endDate in read-model.
            if ("COMPLETED".equalsIgnoreCase(status)) {
                batchRepository.findById(batchId).ifPresent(batch -> {
                    if ("PROCESSED".equalsIgnoreCase(batch.getType())) {
                        Map<String, String> metadata = batch.getMetadata();
                        if (metadata == null || metadata.isEmpty()) {
                            metadata = queryMetadataFromChain(batchId, null);
                        }
                        if (metadata != null) {
                            String endDate = metadata.get("endDate");
                            if (endDate == null || endDate.isBlank()) {
                                metadata.put("endDate", LocalDate.now().toString());
                            }
                            batch.setMetadata(metadata);
                            batch.setUpdatedAt(Instant.now());
                            batchRepository.save(batch);
                        }
                    }
                });
            }

            log.info("STATUS_UPDATED: batchId={} → {}", batchId, status);
        }
    }

    private void handleTransferRequested(Map<String, String> p) {
        String batchId      = p.get("batchId");
        String pendingToMsp = p.get("toMSP");
        if (batchId != null) {
            batchRepository.findById(batchId).ifPresent(b -> {
                b.setStatus("TRANSFER_PENDING");
                b.setPendingToMsp(pendingToMsp);
                b.setUpdatedAt(Instant.now());
                batchRepository.save(b);
            });
            log.info("TRANSFER_REQUESTED: batchId={} → pendingToMsp={}", batchId, pendingToMsp);
        }
    }

    private void handleTransferAccepted(Map<String, String> p) {
        String batchId  = p.get("batchId");
        String newOwner = p.get("newOwnerMSP");
        if (batchId != null) {
            batchRepository.updateOwnerAndStatus(batchId, newOwner, "TRANSFERRED");
            log.info("TRANSFER_ACCEPTED: batchId={} → newOwner={}", batchId, newOwner);
        }
    }

    private void handleEvidenceAdded(Map<String, String> p) {
        String batchId = p.get("batchId");
        String hash    = p.get("evidenceHash");
        String uri     = p.get("evidenceUri");
        if (batchId != null) {
            batchRepository.updateEvidence(batchId, hash, uri);
            log.info("EVIDENCE_ADDED: batchId={} hash={}", batchId, hash);
        }
    }

    private void handleFarmActivity(Map<String, String> p, String txId, long blockNum) {
        if (txId != null && !txId.isBlank() && farmActivityRepository.existsByTxId(txId)) {
            log.debug("FARM_ACTIVITY_RECORDED duplicate txId={} skipped", txId);
            return;
        }

        FarmActivityEntity activity = FarmActivityEntity.builder()
                .harvestBatchId(p.get("harvestBatchId"))
                .activityType(p.get("activityType"))
                .activityDate(p.get("activityDate") != null ? LocalDate.parse(p.get("activityDate")) : null)
                .note(p.get("note"))
                .evidenceHash(p.getOrDefault("evidenceHash", ""))
                .evidenceUri(p.getOrDefault("evidenceUri", ""))
                .recordedBy(p.get("recordedBy"))
                .recordedAt(parseInstant(p.get("recordedAt")))
                .txId(txId)
                .blockNumber(blockNum)
                .build();
        try {
            farmActivityRepository.save(activity);
            log.info("FARM_ACTIVITY_RECORDED: harvestBatchId={} type={}", activity.getHarvestBatchId(), activity.getActivityType());
        } catch (DataIntegrityViolationException e) {
            log.debug("FARM_ACTIVITY_RECORDED duplicate txId={} ignored", txId);
        }
    }

    private void handleBatchWeightUpdated(Map<String, String> p) {
        String batchId = p.get("batchId");
        if (batchId == null || batchId.isBlank()) return;

        String weightKey = p.getOrDefault("weightKey", "weightKg");
        String weightValue = p.getOrDefault("weightValue", "");

        batchRepository.findById(batchId).ifPresent(batch -> {
            Map<String, String> metadata = batch.getMetadata();
            if (metadata == null || metadata.isEmpty()) {
                metadata = queryMetadataFromChain(batchId, null);
            }
            if (metadata == null) {
                metadata = new java.util.HashMap<>();
            }

            metadata.put(weightKey, weightValue);
            batch.setMetadata(metadata);
            batch.setUpdatedAt(Instant.now());
            batchRepository.save(batch);
        });

        log.info("BATCH_WEIGHT_UPDATED: batchId={} {}={}", batchId, weightKey, weightValue);
    }

    private void handleRoastDurationUpdated(Map<String, String> p) {
        String batchId = p.get("batchId");
        String roastDurationMinutes = p.getOrDefault("roastDurationMinutes", "");
        if (batchId == null || batchId.isBlank()) return;

        batchRepository.findById(batchId).ifPresent(batch -> {
            Map<String, String> metadata = batch.getMetadata();
            if (metadata == null || metadata.isEmpty()) {
                metadata = queryMetadataFromChain(batchId, null);
            }
            if (metadata == null) {
                metadata = new java.util.HashMap<>();
            }

            metadata.put("roastDurationMinutes", roastDurationMinutes);
            batch.setMetadata(metadata);
            batch.setUpdatedAt(Instant.now());
            batchRepository.save(batch);
        });

        log.info("BATCH_ROAST_DURATION_UPDATED: batchId={} roastDurationMinutes={}", batchId, roastDurationMinutes);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private Map<String, String> parsePayload(byte[] bytes) throws Exception {
        if (bytes == null || bytes.length == 0) {
            return Map.of();
        }
        return objectMapper.readValue(bytes, new TypeReference<Map<String, String>>() {});
    }

    private Map<String, String> parseMetadata(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            log.warn("Could not parse metadata JSON: {}", json);
            return null;
        }
    }

    private Map<String, String> queryMetadataFromChain(String batchId, String payloadMetadataJson) {
        Map<String, String> metadata = parseMetadata(payloadMetadataJson);
        if (metadata != null && !metadata.isEmpty()) {
            return metadata;
        }
        if (batchId == null || batchId.isBlank()) {
            return metadata;
        }
        try {
            byte[] raw = fabricGateway.evaluateTransaction("Org1", "getBatch", batchId);
            Map<String, Object> chainBatch = objectMapper.readValue(raw, new TypeReference<Map<String, Object>>() {});
            Object metaObj = chainBatch.get("metadata");
            if (metaObj instanceof Map<?, ?> mapObj) {
                return mapObj.entrySet().stream()
                        .collect(java.util.stream.Collectors.toMap(
                                entry -> String.valueOf(entry.getKey()),
                                entry -> String.valueOf(entry.getValue())
                        ));
            }
        } catch (Exception e) {
            log.debug("Could not query metadata from chain for batchId={}: {}", batchId, e.getMessage());
        }
        return metadata;
    }

    private Instant parseInstant(String s) {
        if (s == null || s.isBlank()) return Instant.now();
        try {
            return Instant.parse(s);
        } catch (Exception e) {
            return Instant.now();
        }
    }

    @PreDestroy
    public void stop() {
        executor.shutdownNow();
        closeQuietly(org1EventIterator);
        closeQuietly(org2EventIterator);
        log.info("EventIndexerService stopped");
    }

    private void closeQuietly(CloseableIterator<?> iter) {
        if (iter != null) {
            try { iter.close(); } catch (Exception ignored) {}
        }
    }
}
