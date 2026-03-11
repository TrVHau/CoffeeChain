package com.coffee.trace.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RecordFarmActivityRequest {
    @NotBlank private String harvestBatchId;
    @NotBlank private String activityType;   // IRRIGATION | FERTILIZATION | PESTICIDE | PRUNING | OTHER
    @NotBlank private String activityDate;   // ISO date — may be a past date
    private String note;
    private String evidenceHash;
    private String evidenceUri;
}
