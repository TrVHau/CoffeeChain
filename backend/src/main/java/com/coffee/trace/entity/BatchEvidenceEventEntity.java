package com.coffee.trace.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "batch_evidence_events")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchEvidenceEventEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_id", nullable = false)
    private String batchId;

    @Column(name = "batch_type")
    private String batchType;

    @Column(name = "evidence_hash")
    private String evidenceHash;

    @Column(name = "evidence_uri")
    private String evidenceUri;

    @Column(name = "recorded_by")
    private String recordedBy;

    @Column(name = "tx_id")
    private String txId;

    @Column(name = "block_number")
    private Long blockNumber;

    @Column(name = "recorded_at")
    private Instant recordedAt;

    @Column(name = "created_at")
    private Instant createdAt;
}
