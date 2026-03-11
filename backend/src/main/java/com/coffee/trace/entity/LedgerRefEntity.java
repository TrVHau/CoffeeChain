package com.coffee.trace.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "ledger_refs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LedgerRefEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_id", nullable = false)
    private String batchId;

    @Column(name = "event_name", nullable = false)
    private String eventName;   // BATCH_CREATED | BATCH_STATUS_UPDATED | TRANSFER_REQUESTED | TRANSFER_ACCEPTED | EVIDENCE_ADDED | FARM_ACTIVITY_RECORDED | BATCH_IN_STOCK | BATCH_SOLD

    @Column(name = "tx_id", nullable = false)
    private String txId;

    @Column(name = "block_number")
    private Long blockNumber;

    @Column(name = "created_at")
    private Instant createdAt;
}
