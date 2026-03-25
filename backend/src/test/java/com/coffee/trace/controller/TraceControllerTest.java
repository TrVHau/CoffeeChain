package com.coffee.trace.controller;

import com.coffee.trace.dto.response.TraceResponse;
import com.coffee.trace.entity.BatchEntity;
import com.coffee.trace.entity.FarmActivityEntity;
import com.coffee.trace.entity.LedgerRefEntity;
import com.coffee.trace.repository.BatchRepository;
import com.coffee.trace.repository.FarmActivityRepository;
import com.coffee.trace.repository.LedgerRefRepository;
import com.coffee.trace.service.QrCodeService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TraceControllerTest {

    @Mock
    private BatchRepository batchRepository;
    @Mock
    private FarmActivityRepository farmActivityRepository;
    @Mock
    private LedgerRefRepository ledgerRefRepository;
    @Mock
    private QrCodeService qrCodeService;

    @Test
    void trace_returnsParentChainOldestFirst_andAggregatesRefsAcrossChain() {
        TraceController controller = new TraceController(
                batchRepository,
                farmActivityRepository,
                ledgerRefRepository,
                qrCodeService
        );

        BatchEntity packaged = BatchEntity.builder()
                .batchId("PKG-1")
                .publicCode("PKG-CODE")
                .type("PACKAGED")
                .parentBatchId("ROA-1")
                .createdAt(Instant.parse("2026-03-15T12:30:00Z"))
                .updatedAt(Instant.parse("2026-03-15T12:30:00Z"))
                .build();
        BatchEntity roast = BatchEntity.builder()
                .batchId("ROA-1")
                .type("ROAST")
                .parentBatchId("PRO-1")
                .createdAt(Instant.parse("2026-03-15T10:30:00Z"))
                .updatedAt(Instant.parse("2026-03-15T10:30:00Z"))
                .build();
        BatchEntity processed = BatchEntity.builder()
                .batchId("PRO-1")
                .type("PROCESSED")
                .parentBatchId("HAR-1")
                .createdAt(Instant.parse("2026-03-15T09:30:00Z"))
                .updatedAt(Instant.parse("2026-03-15T09:30:00Z"))
                .build();
        BatchEntity harvest = BatchEntity.builder()
                .batchId("HAR-1")
                .type("HARVEST")
                .createdAt(Instant.parse("2026-03-15T08:30:00Z"))
                .updatedAt(Instant.parse("2026-03-15T08:30:00Z"))
                .build();

        when(batchRepository.findByPublicCode("PKG-CODE")).thenReturn(Optional.of(packaged));
        when(batchRepository.findById("ROA-1")).thenReturn(Optional.of(roast));
        when(batchRepository.findById("PRO-1")).thenReturn(Optional.of(processed));
        when(batchRepository.findById("HAR-1")).thenReturn(Optional.of(harvest));

        when(farmActivityRepository.findByHarvestBatchIdOrderByActivityDateAsc("HAR-1"))
                .thenReturn(List.of(
                        FarmActivityEntity.builder()
                                .harvestBatchId("HAR-1")
                                .activityType("IRRIGATION")
                                .activityDate(LocalDate.parse("2026-03-14"))
                                .build()
                ));

        when(ledgerRefRepository.findByBatchIdInOrderByCreatedAtAsc(List.of("HAR-1", "PRO-1", "ROA-1", "PKG-1")))
                .thenReturn(List.of(
                        LedgerRefEntity.builder()
                                .batchId("HAR-1")
                                .eventName("BATCH_CREATED")
                                .txId("tx1")
                                .blockNumber(1L)
                                .createdAt(Instant.parse("2026-03-15T08:31:00Z"))
                                .build(),
                        LedgerRefEntity.builder()
                                .batchId("PKG-1")
                                .eventName("BATCH_CREATED")
                                .txId("tx4")
                                .blockNumber(4L)
                                .createdAt(Instant.parse("2026-03-15T12:31:00Z"))
                                .build()
                ));

        ResponseEntity<TraceResponse> response = controller.trace("PKG-CODE");

        assertEquals(200, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals(
                List.of("HAR-1", "PRO-1", "ROA-1"),
                response.getBody().getParentChain().stream().map(p -> p.getBatchId()).toList()
        );
        assertEquals(1, response.getBody().getFarmActivities().size());
        assertEquals(2, response.getBody().getLedgerRefs().size());

        verify(farmActivityRepository).findByHarvestBatchIdOrderByActivityDateAsc("HAR-1");
        verify(ledgerRefRepository).findByBatchIdInOrderByCreatedAtAsc(List.of("HAR-1", "PRO-1", "ROA-1", "PKG-1"));
    }
}
