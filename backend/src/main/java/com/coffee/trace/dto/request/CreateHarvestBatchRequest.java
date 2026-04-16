package com.coffee.trace.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateHarvestBatchRequest {
    @NotBlank private String farmLocation;
    @NotBlank private String harvestDate;       // ISO date: yyyy-MM-dd
    @NotBlank private String coffeeVariety;
    private String weightKg;
}
