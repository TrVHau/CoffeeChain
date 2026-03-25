package com.coffee.trace.controller;

import com.coffee.trace.dto.request.UpdateStatusRequest;
import com.coffee.trace.service.FabricGatewayService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/retail")
public class RetailerController {

    private final FabricGatewayService fabricGateway;
    private final ObjectMapper         objectMapper;

    public RetailerController(FabricGatewayService fabricGateway, ObjectMapper objectMapper) {
        this.fabricGateway = fabricGateway;
        this.objectMapper  = objectMapper;
    }

    /** PATCH /api/retail/{id}/status — update status to IN_STOCK or SOLD */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('RETAILER')")
    public ResponseEntity<?> updateStatus(@AuthenticationPrincipal String userId,
                                          @PathVariable String id,
                                          @Valid @RequestBody UpdateStatusRequest req) throws Exception {
        byte[] result = fabricGateway.submitAs(userId, "updateBatchStatus", id, req.getNewStatus());
        return ResponseEntity.ok(objectMapper.readValue(result, Map.class));
    }
}
