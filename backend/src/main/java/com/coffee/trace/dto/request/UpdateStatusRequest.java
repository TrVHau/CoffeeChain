package com.coffee.trace.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateStatusRequest {
    @NotBlank private String newStatus;  // IN_STOCK | SOLD | PROCESSING | COMPLETED | ...
}
