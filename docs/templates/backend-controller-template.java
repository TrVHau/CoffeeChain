package com.coffee.trace.controller;

import com.coffee.trace.dto.request.CreateExampleRequest;
import com.coffee.trace.dto.response.BatchResponse;
import com.coffee.trace.exception.ApiException;
import com.coffee.trace.service.FabricGatewayService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

/**
 * TEMPLATE: REST Controller — SUBMIT transaction
 *
 * Copy file này khi thêm controller mới.
 * Đổi tên class, path, role logic phù hợp.
 *
 * Checklist:
 * [ ] @RestController + @RequestMapping("/api/<resource>")
 * [ ] @RequiredArgsConstructor — inject qua constructor
 * [ ] userId từ @AuthenticationPrincipal — KHÔNG nhận từ request body
 * [ ] @Valid trên @RequestBody
 * [ ] Không có business logic — chỉ gọi service
 * [ ] Log request (không log sensitive data)
 * [ ] Trả ResponseEntity với status code phù hợp
 */
@Slf4j
@RestController
@RequestMapping("/api/harvest")   // ← đổi path
@RequiredArgsConstructor
public class _TemplateController {

    private final FabricGatewayService fabricGateway;
    private final ObjectMapper objectMapper;

    /**
     * POST /api/harvest
     * Role: FARMER
     */
    @PostMapping
    public ResponseEntity<BatchResponse> create(
            @RequestBody @Valid CreateExampleRequest req,
            @AuthenticationPrincipal UserDetails principal
    ) {
        // ── 1. Lấy userId từ JWT principal ──────────────────────────────
        // KHÔNG dùng req.getUserId() hay hardcode
        String userId = principal.getUsername();
        log.info("createHarvestBatch: userId={}, publicCode={}", userId, req.getPublicCode());

        try {
            // ── 2. Submit transaction ────────────────────────────────────
            byte[] result = fabricGateway.submitAs(userId, "createHarvestBatch",
                req.getBatchId(),
                req.getPublicCode(),
                req.getFarmLocation(),
                req.getHarvestDate(),
                req.getCoffeeVariety(),
                String.valueOf(req.getWeightKg())
                // Tất cả args là String — convert numeric ở chaincode
            );

            // ── 3. Parse result ──────────────────────────────────────────
            BatchResponse response = objectMapper.readValue(result, BatchResponse.class);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            // Log lỗi đầy đủ, nhưng KHÔNG expose stack trace ra client
            log.error("createHarvestBatch failed: userId={}, error={}", userId, e.getMessage(), e);
            throw new ApiException("Failed to create harvest batch: " + e.getMessage());
        }
    }

    /**
     * GET /api/harvest/{batchId}
     * Evaluate — không cần user cert, dùng org gateway
     */
    @GetMapping("/{batchId}")
    public ResponseEntity<BatchResponse> getById(
            @PathVariable String batchId,
            @RequestParam(defaultValue = "db") String source  // "db" | "chain"
    ) {
        try {
            if ("chain".equals(source)) {
                // Đọc trực tiếp từ world state (không qua PostgreSQL)
                byte[] result = fabricGateway.evaluateTransaction("Org1", "getBatch", batchId);
                return ResponseEntity.ok(objectMapper.readValue(result, BatchResponse.class));
            }
            // Mặc định: đọc từ PostgreSQL (nhanh hơn)
            // → Inject BatchRepository và query ở đây
            throw new UnsupportedOperationException("DB source not implemented in template");

        } catch (Exception e) {
            log.error("getBatch failed: batchId={}, error={}", batchId, e.getMessage());
            throw new ApiException("Failed to get batch: " + e.getMessage());
        }
    }

    /**
     * PATCH /api/harvest/{batchId}/status
     */
    @PatchMapping("/{batchId}/status")
    public ResponseEntity<Void> updateStatus(
            @PathVariable String batchId,
            @RequestBody @Valid UpdateStatusRequest req,   // { "status": "IN_PROCESS" }
            @AuthenticationPrincipal UserDetails principal
    ) {
        String userId = principal.getUsername();
        try {
            fabricGateway.submitAs(userId, "updateBatchStatus", batchId, req.getStatus());
            return ResponseEntity.noContent().build();   // 204 No Content
        } catch (Exception e) {
            log.error("updateStatus failed: batchId={}, error={}", batchId, e.getMessage());
            throw new ApiException("Failed to update status: " + e.getMessage());
        }
    }
}

// ── DTO Templates ─────────────────────────────────────────────────────────────

// request/CreateExampleRequest.java
/*
@Data
public class CreateExampleRequest {
    @NotBlank(message = "batchId is required")
    private String batchId;

    @NotBlank(message = "publicCode is required")
    private String publicCode;

    @NotBlank
    private String farmLocation;

    @NotBlank
    @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}", message = "harvestDate must be YYYY-MM-DD")
    private String harvestDate;

    @NotBlank
    private String coffeeVariety;

    @Positive(message = "weightKg must be positive")
    private double weightKg;
}
*/

// request/UpdateStatusRequest.java
/*
@Data
public class UpdateStatusRequest {
    @NotBlank
    @Pattern(regexp = "CREATED|IN_PROCESS|COMPLETED|IN_STOCK|SOLD",
             message = "Invalid status value")
    private String status;
}
*/
