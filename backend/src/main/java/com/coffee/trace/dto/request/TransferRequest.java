package com.coffee.trace.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TransferRequest {
    @NotBlank private String batchId;  // batch to transfer
    @NotBlank private String toMSP;    // Org2MSP
}
