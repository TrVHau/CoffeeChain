package com.coffee.trace.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateRoastBatchRequest {
    @NotBlank private String parentBatchId;
    @NotBlank private String roastProfile;          // Light | Medium-Light | Medium | Dark
    @NotBlank private String roastDate;
    @NotBlank private String roastDurationMinutes;
    private String weightKg;
}
