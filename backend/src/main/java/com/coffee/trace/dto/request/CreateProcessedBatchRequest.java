package com.coffee.trace.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateProcessedBatchRequest {
    @NotBlank private String parentBatchId;
    @NotBlank private String processingMethod;  // Washed | Natural | Honey
    @NotBlank private String startDate;
    private String endDate;
    @NotBlank private String facilityName;
    private String weightKg;
}
