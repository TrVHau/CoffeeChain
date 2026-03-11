package com.coffee.trace.controller;

import com.coffee.trace.dto.response.BatchResponse;
import com.coffee.trace.entity.BatchEntity;
import com.coffee.trace.repository.BatchRepository;
import com.coffee.trace.service.FabricGatewayService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class BatchQueryController {

    private final BatchRepository      batchRepository;
    private final FabricGatewayService fabricGateway;
    private final ObjectMapper         objectMapper;

    public BatchQueryController(BatchRepository batchRepository,
                                FabricGatewayService fabricGateway,
                                ObjectMapper objectMapper) {
        this.batchRepository = batchRepository;
        this.fabricGateway   = fabricGateway;
        this.objectMapper    = objectMapper;
    }

    /**
     * GET /api/batches?type=&status=&ownerMSP= — authenticated, returns list of batches.
     * Filters in PostgreSQL (fast reads, no Fabric round-trip).
     */
    @GetMapping("/batches")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<BatchResponse>> listBatches(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String ownerMSP) {

        List<BatchEntity> batches;
        if (type != null && status != null) {
            batches = batchRepository.findByTypeAndStatus(type, status);
        } else if (ownerMSP != null) {
            batches = batchRepository.findByOwnerMsp(ownerMSP);
        } else {
            batches = batchRepository.findAll();
        }

        return ResponseEntity.ok(batches.stream().map(BatchResponse::from).toList());
    }

    /**
     * GET /api/batch/{id}?source=chain — if source=chain, query Fabric ledger directly.
     * Otherwise reads from PostgreSQL cache.
     */
    @GetMapping("/batch/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getBatch(@PathVariable String id,
                                      @RequestParam(required = false) String source) throws Exception {
        if ("chain".equalsIgnoreCase(source)) {
            byte[] result = fabricGateway.evaluateTransaction("Org1", "queryBatchById", id);
            return ResponseEntity.ok(objectMapper.readValue(result, Map.class));
        }

        BatchEntity batch = batchRepository.findById(id).orElse(null);
        if (batch == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(BatchResponse.from(batch));
    }
}
