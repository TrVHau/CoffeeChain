package com.coffee.trace.dto.response;

import com.coffee.trace.entity.BatchEntity;
import lombok.Data;

import java.time.Instant;
import java.util.Map;

@Data
public class BatchResponse {
    private String batchId;
    private String publicCode;
    private String type;
    private String parentBatchId;
    private String ownerMsp;
    private String ownerUserId;
    private String status;
    private String pendingToMsp;
    private String evidenceHash;
    private String evidenceUri;
    private Map<String, String> metadata;
    private Instant createdAt;
    private Instant updatedAt;

    public static BatchResponse from(BatchEntity b) {
        BatchResponse r = new BatchResponse();
        r.setBatchId(b.getBatchId());
        r.setPublicCode(b.getPublicCode());
        r.setType(b.getType());
        r.setParentBatchId(b.getParentBatchId());
        r.setOwnerMsp(b.getOwnerMsp());
        r.setOwnerUserId(b.getOwnerUserId());
        r.setStatus(b.getStatus());
        r.setPendingToMsp(b.getPendingToMsp());
        r.setEvidenceHash(b.getEvidenceHash());
        r.setEvidenceUri(b.getEvidenceUri());
        r.setMetadata(b.getMetadata());
        r.setCreatedAt(b.getCreatedAt());
        r.setUpdatedAt(b.getUpdatedAt());
        return r;
    }
}
