package com.coffee.trace.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class ErrorResponse {
    private String  message;
    private String  path;
    private Instant timestamp;
}
