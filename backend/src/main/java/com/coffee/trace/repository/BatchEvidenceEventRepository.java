package com.coffee.trace.repository;

import com.coffee.trace.entity.BatchEvidenceEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BatchEvidenceEventRepository extends JpaRepository<BatchEvidenceEventEntity, Long> {

    List<BatchEvidenceEventEntity> findByBatchIdInOrderByRecordedAtAsc(List<String> batchIds);

    boolean existsByTxId(String txId);
}
