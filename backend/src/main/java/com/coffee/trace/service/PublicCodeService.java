package com.coffee.trace.service;

import com.coffee.trace.repository.BatchRepository;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@Service
public class PublicCodeService {

    private static final DateTimeFormatter TS_FORMAT =
            DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").withZone(ZoneOffset.UTC);
    private static final char[] ALPHANUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int MAX_RETRIES = 20;

    private static final Map<String, String> TYPE_PREFIX = Map.of(
            "HARVEST", "HAR",
            "PROCESSED", "PRO",
            "ROAST", "ROA",
            "PACKAGED", "PKG"
    );

    private final BatchRepository batchRepository;

    public PublicCodeService(BatchRepository batchRepository) {
        this.batchRepository = batchRepository;
    }

    /**
     * Generates a unique public code persisted off-chain and stored on-chain.
     * Format: <PREFIX>-<UTC_yyyyMMdd-HHmmss>-<SUFFIX6>
     */
    public String generateForType(String batchType) {
        String prefix = TYPE_PREFIX.getOrDefault(batchType, "BCH");
        String timestamp = TS_FORMAT.format(Instant.now());

        for (int i = 0; i < MAX_RETRIES; i++) {
            String candidate = prefix + "-" + timestamp + "-" + randomSuffix(6);
            if (batchRepository.findByPublicCode(candidate).isEmpty()) {
                return candidate;
            }
        }
        throw new IllegalStateException("Could not generate unique public code after retries");
    }

    private String randomSuffix(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(ALPHANUM[RANDOM.nextInt(ALPHANUM.length)]);
        }
        return sb.toString();
    }
}
