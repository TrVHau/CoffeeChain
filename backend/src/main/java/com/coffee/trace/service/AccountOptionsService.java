package com.coffee.trace.service;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class AccountOptionsService {

    private static final Map<String, List<String>> FARM_LOCATIONS_BY_USER = Map.of(
            "farmer_alice", List.of("Test Farm", "Da Lat Farm")
    );

    private static final Map<String, List<String>> PROCESSING_FACILITIES_BY_USER = Map.of(
            "processor_bob", List.of("Test Plant", "Plant A")
    );

    public List<String> getFarmLocations(String userId) {
        return FARM_LOCATIONS_BY_USER.getOrDefault(userId, List.of());
    }

    public List<String> getProcessingFacilities(String userId) {
        return PROCESSING_FACILITIES_BY_USER.getOrDefault(userId, List.of());
    }

    public boolean isAllowedFarmLocation(String userId, String farmLocation) {
        if (farmLocation == null || farmLocation.isBlank()) return false;
        return getFarmLocations(userId).stream().anyMatch(farmLocation::equals);
    }

    public boolean isAllowedProcessingFacility(String userId, String facilityName) {
        if (facilityName == null || facilityName.isBlank()) return false;
        return getProcessingFacilities(userId).stream().anyMatch(facilityName::equals);
    }
}
