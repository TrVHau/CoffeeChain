package com.coffee.trace.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "farm_activities")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FarmActivityEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "harvest_batch_id", nullable = false)
    private String harvestBatchId;

    @Column(name = "activity_type", nullable = false)
    private String activityType;

    @Column(name = "activity_date")
    private String activityDate;    // ISO date string as entered by farmer

    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "evidence_hash")
    private String evidenceHash;

    @Column(name = "evidence_uri")
    private String evidenceUri;

    @Column(name = "recorded_by")
    private String recordedBy;      // CN of the submitting certificate

    @Column(name = "recorded_at")
    private Instant recordedAt;     // blockchain tx timestamp

    @Column(name = "tx_id")
    private String txId;

    @Column(name = "block_number")
    private Long blockNumber;

    public static FarmActivityEntity from(Map<String, String> payload) {
        return FarmActivityEntity.builder()
                .harvestBatchId(payload.get("harvestBatchId"))
                .activityType(payload.get("activityType"))
                .activityDate(payload.get("activityDate"))
                .note(payload.get("note"))
                .evidenceHash(payload.getOrDefault("evidenceHash", ""))
                .evidenceUri(payload.getOrDefault("evidenceUri", ""))
                .recordedBy(payload.get("recordedBy"))
                .recordedAt(Instant.parse(payload.get("recordedAt")))
                .txId(payload.get("txId"))
                .build();
    }
}
