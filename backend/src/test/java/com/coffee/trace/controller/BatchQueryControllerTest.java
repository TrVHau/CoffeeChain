package com.coffee.trace.controller;

import com.coffee.trace.entity.BatchEntity;
import com.coffee.trace.repository.BatchRepository;
import com.coffee.trace.service.FabricGatewayService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BatchQueryControllerTest {

    @Mock
    private BatchRepository batchRepository;
    @Mock
    private FabricGatewayService fabricGateway;
    @Mock
    private ObjectMapper objectMapper;

    @Test
    void listBatches_supportsCombinedFilters() {
        BatchQueryController controller = new BatchQueryController(batchRepository, fabricGateway, objectMapper);

        BatchEntity a = BatchEntity.builder()
                .batchId("A")
                .type("HARVEST")
                .status("COMPLETED")
                .ownerMsp("Org1MSP")
                .updatedAt(Instant.parse("2026-03-15T10:00:00Z"))
                .build();
        BatchEntity b = BatchEntity.builder()
                .batchId("B")
                .type("HARVEST")
                .status("IN_PROCESS")
                .ownerMsp("Org1MSP")
                .updatedAt(Instant.parse("2026-03-15T11:00:00Z"))
                .build();
        BatchEntity c = BatchEntity.builder()
                .batchId("C")
                .type("ROAST")
                .status("COMPLETED")
                .ownerMsp("Org2MSP")
                .updatedAt(Instant.parse("2026-03-15T12:00:00Z"))
                .build();

        when(batchRepository.findAll()).thenReturn(List.of(a, b, c));

        ResponseEntity<?> response = controller.listBatches("HARVEST", "COMPLETED", "Org1MSP");

        @SuppressWarnings("unchecked")
        List<?> body = (List<?>) response.getBody();
        assertEquals(1, body == null ? 0 : body.size());
    }
}
