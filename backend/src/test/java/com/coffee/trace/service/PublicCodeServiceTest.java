package com.coffee.trace.service;

import com.coffee.trace.repository.BatchRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PublicCodeServiceTest {

    @Mock
    private BatchRepository batchRepository;

    @Test
    void generateForType_harvest_hasExpectedFormat() {
        when(batchRepository.findByPublicCode(anyString())).thenReturn(Optional.empty());
        PublicCodeService service = new PublicCodeService(batchRepository);

        String code = service.generateForType("HARVEST");

        assertTrue(code.matches("^HAR-\\d{8}-\\d{6}-[A-Z0-9]{6}$"));
    }

    @Test
    void generateForType_unknownType_usesFallbackPrefix() {
        when(batchRepository.findByPublicCode(anyString())).thenReturn(Optional.empty());
        PublicCodeService service = new PublicCodeService(batchRepository);

        String code = service.generateForType("UNKNOWN");

        assertTrue(code.startsWith("BCH-"));
    }

    @Test
    void generateForType_retriesOnCollision() {
        when(batchRepository.findByPublicCode(anyString()))
                .thenReturn(Optional.ofNullable(new com.coffee.trace.entity.BatchEntity()))
                .thenReturn(Optional.empty());
        PublicCodeService service = new PublicCodeService(batchRepository);

        String code = service.generateForType("ROAST");

        assertTrue(code.startsWith("ROA-"));
        verify(batchRepository, atLeast(2)).findByPublicCode(anyString());
    }
}
