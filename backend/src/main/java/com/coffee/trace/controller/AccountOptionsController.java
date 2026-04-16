package com.coffee.trace.controller;

import com.coffee.trace.service.AccountOptionsService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/account")
public class AccountOptionsController {

    private final AccountOptionsService accountOptionsService;

    public AccountOptionsController(AccountOptionsService accountOptionsService) {
        this.accountOptionsService = accountOptionsService;
    }

    @GetMapping("/options")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getOptions(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(Map.of(
                "farmLocations", accountOptionsService.getFarmLocations(userId),
                "processingFacilities", accountOptionsService.getProcessingFacilities(userId),
                "transferTargets", accountOptionsService.getTransferTargets(userId)
        ));
    }
}
