package com.coffee.trace.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "batches")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchEntity {

    @Id
    @Column(name = "batch_id")
    private String batchId;

    @Column(name = "public_code", unique = true, nullable = false)
    private String publicCode;

    @Column(nullable = false)
    private String type;            // HARVEST | PROCESSED | ROAST | PACKAGED

    @Column(name = "parent_batch_id")
    private String parentBatchId;

    @Column(name = "owner_msp", nullable = false)
    private String ownerMsp;

    @Column(name = "owner_user_id")
    private String ownerUserId;

    @Column(nullable = false)
    private String status;

    @Column(name = "pending_to_msp")
    private String pendingToMsp;

    @Column(name = "evidence_hash")
    private String evidenceHash;

    @Column(name = "evidence_uri")
    private String evidenceUri;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, String> metadata;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;
}
