package com.coffee.trace.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreatePackagedBatchRequest {
    @NotBlank private String parentBatchId;
    @NotBlank private String packageWeight;     // weight per package in grams
    @NotBlank private String packageDate;
    @NotBlank private String expiryDate;
    @NotBlank private String packageCount;
}
