package com.coffee.trace.repository;

import com.coffee.trace.entity.LedgerRefEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface LedgerRefRepository extends JpaRepository<LedgerRefEntity, Long> {

    List<LedgerRefEntity> findByBatchIdOrderByCreatedAtAsc(String batchId);
    List<LedgerRefEntity> findByBatchIdInOrderByCreatedAtAsc(List<String> batchIds);

    Optional<LedgerRefEntity> findTopByBatchIdAndEventNameOrderByCreatedAtDesc(
            String batchId, String eventName);

    default void save(String batchId, String eventName, String txId, String blockNumber) {
        save(LedgerRefEntity.builder()
                .batchId(batchId)
                .eventName(eventName)
                .txId(txId)
                .blockNumber(blockNumber != null ? Long.parseLong(blockNumber) : null)
                .createdAt(Instant.now())
                .build());
    }
}
