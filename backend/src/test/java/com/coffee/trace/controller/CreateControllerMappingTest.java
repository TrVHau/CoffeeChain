package com.coffee.trace.controller;

import com.coffee.trace.dto.request.CreateHarvestBatchRequest;
import com.coffee.trace.dto.request.CreatePackagedBatchRequest;
import com.coffee.trace.dto.request.CreateProcessedBatchRequest;
import com.coffee.trace.dto.request.CreateRoastBatchRequest;
import com.coffee.trace.repository.BatchRepository;
import com.coffee.trace.service.EvidenceService;
import com.coffee.trace.service.FabricGatewayService;
import com.coffee.trace.service.PublicCodeService;
import com.coffee.trace.service.QrCodeService;
import com.coffee.trace.service.AccountOptionsService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CreateControllerMappingTest {

    @Mock
    private FabricGatewayService fabricGateway;
    @Mock
    private PublicCodeService publicCodeService;
        @Mock
        private EvidenceService evidenceService;
        @Mock
        private AccountOptionsService accountOptionsService;
    @Mock
    private ObjectMapper objectMapper;
    @Mock
    private QrCodeService qrCodeService;
    @Mock
    private BatchRepository batchRepository;

    @BeforeEach
    void commonStubs() throws Exception {
                when(objectMapper.readValue(any(String.class), eq(Map.class))).thenReturn(Map.of("ok", true));
                when(accountOptionsService.getFarmLocations("farmer_alice")).thenReturn(java.util.List.of("Da Lat Farm"));
                when(accountOptionsService.isAllowedFarmLocation("farmer_alice", "Da Lat Farm")).thenReturn(true);
                when(accountOptionsService.getProcessingFacilities("processor_bob")).thenReturn(java.util.List.of("Plant A"));
                when(accountOptionsService.isAllowedProcessingFacility("processor_bob", "Plant A")).thenReturn(true);
                when(batchRepository.existsByParentBatchIdAndType(anyString(), anyString())).thenReturn(false);
    }

    @Test
    void farmerCreateHarvest_mapsArgumentsToChaincodeSignature() throws Exception {
                FarmerController controller = new FarmerController(fabricGateway, publicCodeService, accountOptionsService, objectMapper);
        CreateHarvestBatchRequest req = new CreateHarvestBatchRequest();
                req.setFarmLocation("Da Lat Farm");
        req.setHarvestDate("2026-03-15");
        req.setCoffeeVariety("Arabica");
        req.setWeightKg("500");

        when(publicCodeService.generateForType("HARVEST")).thenReturn("HAR-20260315-000001-ABC123");
        when(fabricGateway.submitAs(any(), any(), any(String[].class)))
                .thenReturn("{\"ok\":true}".getBytes(StandardCharsets.UTF_8));

        controller.createHarvest("farmer_alice", req);

        verify(fabricGateway).submitAs(
                "farmer_alice",
                "createHarvestBatch",
                "HAR-20260315-000001-ABC123",
                                "Da Lat Farm",
                "2026-03-15",
                "Arabica",
                "500"
        );
    }

    @Test
    void processorCreate_mapsArgumentsToChaincodeSignature() throws Exception {
                ProcessorController controller = new ProcessorController(fabricGateway, publicCodeService, accountOptionsService, batchRepository, objectMapper);
        CreateProcessedBatchRequest req = new CreateProcessedBatchRequest();
        req.setParentBatchId("HARVEST-1");
        req.setProcessingMethod("Washed");
        req.setStartDate("2026-03-15");
        req.setEndDate("2026-03-16");
        req.setFacilityName("Plant A");
        req.setWeightKg("480");

        when(publicCodeService.generateForType("PROCESSED")).thenReturn("PRO-20260315-000001-ABC123");
        when(fabricGateway.submitAs(any(), any(), any(String[].class)))
                .thenReturn("{\"ok\":true}".getBytes(StandardCharsets.UTF_8));

        controller.createProcessed("processor_bob", req);

        verify(fabricGateway).submitAs(
                "processor_bob",
                "createProcessedBatch",
                "PRO-20260315-000001-ABC123",
                "HARVEST-1",
                "Washed",
                "2026-03-15",
                "2026-03-16",
                "Plant A",
                "480"
        );
    }

    @Test
    void roasterCreate_mapsArgumentsToChaincodeSignature() throws Exception {
                RoasterController controller = new RoasterController(fabricGateway, evidenceService, publicCodeService, batchRepository, objectMapper);
        CreateRoastBatchRequest req = new CreateRoastBatchRequest();
        req.setParentBatchId("PROCESSED-1");
        req.setRoastProfile("Medium");
        req.setRoastDate("2026-03-20");
        req.setRoastDurationMinutes("15");
        req.setWeightKg("450");

        when(publicCodeService.generateForType("ROAST")).thenReturn("ROA-20260315-000001-ABC123");
        when(fabricGateway.submitAs(any(), any(), any(String[].class)))
                .thenReturn("{\"ok\":true}".getBytes(StandardCharsets.UTF_8));

        controller.createRoast("roaster_charlie", req);

        verify(fabricGateway).submitAs(
                "roaster_charlie",
                "createRoastBatch",
                "ROA-20260315-000001-ABC123",
                "PROCESSED-1",
                "Medium",
                "2026-03-20",
                "15",
                "450"
        );
    }

    @Test
    void packagerCreate_mapsArgumentsToChaincodeSignature() throws Exception {
        PackagerController controller = new PackagerController(
                fabricGateway,
                publicCodeService,
                objectMapper,
                qrCodeService,
                batchRepository
        );
        ReflectionTestUtils.setField(controller, "publicBaseUrl", "http://localhost:3000/trace/");

        CreatePackagedBatchRequest req = new CreatePackagedBatchRequest();
        req.setParentBatchId("ROAST-1");
        req.setPackageWeight("250");
        req.setPackageDate("2026-03-21");
        req.setExpiryDate("2027-03-21");
        req.setPackageCount("100");

        when(publicCodeService.generateForType("PACKAGED")).thenReturn("PKG-20260315-000001-ABC123");
        when(fabricGateway.submitAs(any(), any(), any(String[].class)))
                .thenReturn("{\"ok\":true}".getBytes(StandardCharsets.UTF_8));

        controller.createPackaged("packager_dave", req);

        verify(fabricGateway).submitAs(
                "packager_dave",
                "createPackagedBatch",
                "PKG-20260315-000001-ABC123",
                "ROAST-1",
                "250",
                "100",
                "2026-03-21",
                "2027-03-21",
                "http://localhost:3000/trace/"
        );
    }
}
