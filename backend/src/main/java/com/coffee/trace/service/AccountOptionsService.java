package com.coffee.trace.service;

import com.coffee.trace.repository.UserRepository;
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

    private static final List<String> ALL_ORG_MSPS = List.of("Org1MSP", "Org2MSP");

    private final UserRepository userRepository;

    public AccountOptionsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public List<String> getFarmLocations(String userId) {
        return FARM_LOCATIONS_BY_USER.getOrDefault(userId, List.of());
    }

    public List<String> getProcessingFacilities(String userId) {
        return PROCESSING_FACILITIES_BY_USER.getOrDefault(userId, List.of());
    }

    public List<String> getTransferTargets(String userId) {
        String currentOrg = userRepository.findByUserId(userId)
                .map(user -> user.getOrg() != null ? user.getOrg().trim() : "")
                .filter(org -> !org.isBlank())
                .orElse("");
        String currentMsp = currentOrg.endsWith("MSP") ? currentOrg : currentOrg + "MSP";
        return ALL_ORG_MSPS.stream()
                .filter(org -> !org.equalsIgnoreCase(currentMsp))
                .toList();
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
