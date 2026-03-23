package com.coffee.trace.dto.response;

import com.coffee.trace.entity.FarmActivityEntity;
import com.coffee.trace.entity.LedgerRefEntity;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class TraceResponse {
    private BatchResponse            batch;
    private List<BatchResponse>      parentChain;     // harvest → processed → roast → packaged
    private List<FarmActivityItem>   farmActivities;  // from farm_activities table
    private List<LedgerRefItem>      ledgerRefs;      // tx references

    @Data
    @Builder
    public static class FarmActivityItem {
        private String activityType;
        private String activityDate;
        private String note;
        private String evidenceHash;
        private String evidenceUri;
        private String recordedBy;
        private String recordedAt;
        private String txId;
        private Long   blockNumber;

        public static FarmActivityItem from(FarmActivityEntity a) {
            return FarmActivityItem.builder()
                    .activityType(a.getActivityType())
                    .activityDate(a.getActivityDate() != null ? a.getActivityDate().toString() : null)
                    .note(a.getNote())
                    .evidenceHash(a.getEvidenceHash())
                    .evidenceUri(a.getEvidenceUri())
                    .recordedBy(a.getRecordedBy())
                    .recordedAt(a.getRecordedAt() != null ? a.getRecordedAt().toString() : null)
                    .txId(a.getTxId())
                    .blockNumber(a.getBlockNumber())
                    .build();
        }
    }

    @Data
    @Builder
    public static class LedgerRefItem {
        private String eventName;
        private String txId;
        private Long   blockNumber;
        private String createdAt;

        public static LedgerRefItem from(LedgerRefEntity r) {
            return LedgerRefItem.builder()
                    .eventName(r.getEventName())
                    .txId(r.getTxId())
                    .blockNumber(r.getBlockNumber())
                    .createdAt(r.getCreatedAt() != null ? r.getCreatedAt().toString() : null)
                    .build();
        }
    }
}
