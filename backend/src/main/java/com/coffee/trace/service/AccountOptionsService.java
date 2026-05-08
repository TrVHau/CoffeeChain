package com.coffee.trace.service;

import com.coffee.trace.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Locale;

@Service
public class AccountOptionsService {

    private static final Map<String, List<String>> FARM_LOCATIONS_BY_USER = Map.of(
        "farmer_alice", List.of("Test Farm", "Da Lat Farm")
    );

    private static final Map<String, List<String>> PROCESSING_FACILITIES_BY_USER = Map.of(
            "processor_bob", List.of("Test Plant", "Plant A")
    );

    private static final List<String> DEFAULT_FARM_LOCATIONS = List.of("Dak Lak Farm", "Da Lat Farm");
    private static final List<String> DEFAULT_PROCESSING_FACILITIES = List.of("Main Processing Plant");

    private static final List<String> ALL_ORG_MSPS = List.of("Org1MSP", "Org2MSP");

    private final UserRepository userRepository;

    public AccountOptionsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public List<String> getFarmLocations(String userId) {
        String normalizedUserId = normalizeUserId(userId);
        List<String> mapped = FARM_LOCATIONS_BY_USER.get(normalizedUserId);
        if (mapped != null && !mapped.isEmpty()) {
            return mapped;
        }

        if (hasRole(normalizedUserId, "FARMER")) {
            return DEFAULT_FARM_LOCATIONS;
        }

        return List.of();
    }

    public List<String> getProcessingFacilities(String userId) {
        String normalizedUserId = normalizeUserId(userId);
        List<String> mapped = PROCESSING_FACILITIES_BY_USER.get(normalizedUserId);
        if (mapped != null && !mapped.isEmpty()) {
            return mapped;
        }

        if (hasRole(normalizedUserId, "PROCESSOR")) {
            return DEFAULT_PROCESSING_FACILITIES;
        }

        return List.of();
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

    private String normalizeUserId(String userId) {
        if (userId == null) {
            return "";
        }
        return userId.trim().toLowerCase(Locale.ROOT);
    }

    private boolean hasRole(String normalizedUserId, String expectedRole) {
        if (normalizedUserId.isBlank()) {
            return false;
        }

        Optional<String> role = userRepository.findByUserId(normalizedUserId)
                .map(user -> user.getRole() != null ? user.getRole().trim() : "");

        return role.map(value -> value.equalsIgnoreCase(expectedRole)).orElse(false);
    }
}
