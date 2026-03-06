package com.coffee.trace.controller;

import com.coffee.trace.dto.response.AuthResponse;
import com.coffee.trace.dto.response.ErrorResponse;
import com.coffee.trace.entity.UserEntity;
import com.coffee.trace.repository.UserRepository;
import com.coffee.trace.service.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository  userRepo;
    private final JwtService      jwtService;
    private final PasswordEncoder passwordEncoder;

    public AuthController(UserRepository userRepo,
                          JwtService jwtService,
                          PasswordEncoder passwordEncoder) {
        this.userRepo        = userRepo;
        this.jwtService      = jwtService;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * POST /api/auth/login
     * Body: { "userId": "farmer_alice", "password": "pw123" }
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String userId   = body.get("userId");
        String password = body.get("password");

        if (userId == null || password == null) {
            return ResponseEntity.badRequest()
                    .body(ErrorResponse.builder()
                            .message("userId and password are required")
                            .timestamp(Instant.now()).build());
        }

        return userRepo.findByUserId(userId)
                .filter(u -> passwordEncoder.matches(password, u.getPassword()))
                .map(u -> ResponseEntity.ok((Object) AuthResponse.builder()
                        .token("Bearer " + jwtService.generateToken(u.getUserId(), u.getRole(), u.getOrg()))
                        .userId(u.getUserId())
                        .role(u.getRole())
                        .org(u.getOrg())
                        .build()))
                .orElse(ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(ErrorResponse.builder()
                                .message("Invalid credentials")
                                .timestamp(Instant.now()).build()));
    }
}
