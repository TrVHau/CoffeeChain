package com.coffee.trace.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AddEvidenceRequest {
    @NotBlank private String evidenceHash;   // SHA-256 hex
    @NotBlank private String evidenceUri;    // "ipfs://Qm..."
}
