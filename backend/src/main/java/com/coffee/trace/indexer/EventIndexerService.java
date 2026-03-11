package com.coffee.trace.indexer;

import com.coffee.trace.entity.BatchEntity;
import com.coffee.trace.entity.FarmActivityEntity;
import com.coffee.trace.entity.LedgerRefEntity;
import com.coffee.trace.repository.BatchRepository;
import com.coffee.trace.repository.FarmActivityRepository;
import com.coffee.trace.repository.LedgerRefRepository;
import com.coffee.trace.service.FabricGatewayService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.hyperledger.fabric.client.ChaincodeEvent;
import org.hyperledger.fabric.client.CloseableIterator;
import org.hyperledger.fabric.client.Network;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
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

        // Always record in ledger_refs (append-only audit trail)
        String batchId = payload.getOrDefault("batchId", payload.getOrDefault("harvestBatchId", ""));
        ledgerRefRepository.save(batchId, eventName, txId, String.valueOf(blockNum));

        switch (eventName) {
            case "BATCH_CREATED"          -> handleBatchCreated(payload, txId, blockNum);
            case "BATCH_STATUS_UPDATED"   -> handleStatusUpdated(payload);
            case "TRANSFER_REQUESTED"     -> handleTransferRequested(payload);
            case "TRANSFER_ACCEPTED"      -> handleTransferAccepted(payload);
            case "EVIDENCE_ADDED"         -> handleEvidenceAdded(payload);
            case "FARM_ACTIVITY_RECORDED" -> handleFarmActivity(payload, txId, blockNum);
            case "BATCH_IN_STOCK"         -> handleStatusUpdated(payload);
            case "BATCH_SOLD"             -> handleStatusUpdated(payload);
            default -> log.debug("Unknown event '{}' — recorded in ledger_refs only", eventName);
        }
    }

    // ── Event handlers ───────────────────────────────────────────────────

    private void handleBatchCreated(Map<String, String> p, String txId, long blockNum) {
        String batchId = p.get("batchId");
        if (batchRepository.existsById(batchId)) {
            log.debug("BATCH_CREATED: batchId={} already in DB — skipping", batchId);
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
                .metadata(parseMetadata(p.get("metadata")))
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        batchRepository.save(entity);
        log.info("BATCH_CREATED: indexed batchId={}", batchId);
    }

    private void handleStatusUpdated(Map<String, String> p) {
        String batchId = p.get("batchId");
        String status  = p.get("status");
        if (batchId != null && status != null) {
            batchRepository.updateStatus(batchId, status);
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
        FarmActivityEntity activity = FarmActivityEntity.builder()
                .harvestBatchId(p.get("harvestBatchId"))
                .activityType(p.get("activityType"))
                .activityDate(p.get("activityDate"))
                .note(p.get("note"))
                .evidenceHash(p.getOrDefault("evidenceHash", ""))
                .evidenceUri(p.getOrDefault("evidenceUri", ""))
                .recordedBy(p.get("recordedBy"))
                .recordedAt(parseInstant(p.get("recordedAt")))
                .txId(txId)
                .blockNumber(blockNum)
                .build();
        farmActivityRepository.save(activity);
        log.info("FARM_ACTIVITY_RECORDED: harvestBatchId={} type={}", activity.getHarvestBatchId(), activity.getActivityType());
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, String> parsePayload(byte[] bytes) throws Exception {
        if (bytes == null || bytes.length == 0) {
            return Map.of();
        }
        return objectMapper.readValue(bytes, new TypeReference<Map<String, String>>() {});
    }

    @SuppressWarnings("unchecked")
    private Map<String, String> parseMetadata(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            log.warn("Could not parse metadata JSON: {}", json);
            return null;
        }
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
