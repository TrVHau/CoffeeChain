package com.coffee.trace.repository;

import com.coffee.trace.entity.BatchEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface BatchRepository extends JpaRepository<BatchEntity, String> {

    Optional<BatchEntity> findByPublicCode(String publicCode);

    List<BatchEntity> findByOwnerMsp(String ownerMsp);

    List<BatchEntity> findByType(String type);

    List<BatchEntity> findByTypeAndStatus(String type, String status);

    List<BatchEntity> findByOwnerMspAndType(String ownerMsp, String type);

    List<BatchEntity> findByOwnerMspAndStatus(String ownerMsp, String status);

    @Modifying @Transactional
    @Query("UPDATE BatchEntity b SET b.status = :status, b.updatedAt = :now WHERE b.batchId = :batchId")
    void updateStatus(String batchId, String status, Instant now);

    @Modifying @Transactional
    @Query("UPDATE BatchEntity b SET b.ownerMsp = :ownerMsp, b.status = :status, b.updatedAt = :now WHERE b.batchId = :batchId")
    void updateOwnerAndStatus(String batchId, String ownerMsp, String status, Instant now);

    @Modifying @Transactional
    @Query("UPDATE BatchEntity b SET b.evidenceHash = :hash, b.evidenceUri = :uri, b.updatedAt = :now WHERE b.batchId = :batchId")
    void updateEvidence(String batchId, String hash, String uri, Instant now);

    default void updateStatus(String batchId, String status) {
        updateStatus(batchId, status, Instant.now());
    }

    default void updateOwnerAndStatus(String batchId, String ownerMsp, String status) {
        updateOwnerAndStatus(batchId, ownerMsp, status, Instant.now());
    }

    default void updateEvidence(String batchId, String hash, String uri) {
        updateEvidence(batchId, hash, uri, Instant.now());
    }

    /** Upsert minimal batch from event payload — fallback when evaluateTransaction fails */
    default void upsertFromPayload(java.util.Map<String, String> payload) {
        BatchEntity b = BatchEntity.builder()
                .batchId(payload.get("batchId"))
                .publicCode(payload.getOrDefault("publicCode", payload.get("batchId")))
                .type(payload.getOrDefault("type", "UNKNOWN"))
                .ownerMsp(payload.getOrDefault("ownerMSP", ""))
                .status(payload.getOrDefault("status", "CREATED"))
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        save(b);
    }
}
