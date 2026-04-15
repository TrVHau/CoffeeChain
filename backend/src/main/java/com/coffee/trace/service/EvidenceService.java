package com.coffee.trace.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.UUID;

/**
 * Unit-3: Evidence handling service.
 *
 * Responsibilities:
 *  1. Compute SHA-256 hash of uploaded file bytes.
 *  2. Upload file to IPFS Kubo via HTTP API (/api/v0/add).
 *  3. Provide IPFS gateway URL for downstream storage (on-chain + DB).
 *
 * Uses java.net.http.HttpClient (Java 11+) — no extra dependencies.
 */
@Service
public class EvidenceService {

    private static final Logger log = LoggerFactory.getLogger(EvidenceService.class);

    private final HttpClient   httpClient = HttpClient.newHttpClient();
    private final ObjectMapper objectMapper;

    @Value("${ipfs.api-url:http://localhost:5001}")
    private String ipfsApiUrl;

    @Autowired
    public EvidenceService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Compute hex-encoded SHA-256 hash of the given bytes.
     *
     * @param data raw file bytes
     * @return lower-case hex SHA-256 string (64 chars)
     */
    public String sha256(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(data);
            StringBuilder sb = new StringBuilder(64);
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 computation failed", e);
        }
    }

    /**
     * Upload a file to IPFS Kubo via its HTTP API (POST /api/v0/add).
     * Returns the CID (Content Identifier) of the uploaded file.
     *
     * @param fileName original file name
     * @param data     raw file bytes
     * @return IPFS CID string (e.g. "QmXyz...")
     */
    public String uploadToIpfs(String fileName, byte[] data) {
        try {
            String boundary = "----CoffeeChainBoundary" + UUID.randomUUID().toString().replace("-", "");
            byte[] body = buildMultipartBody(boundary, fileName, data);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(ipfsApiUrl + "/api/v0/add"))
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                throw new RuntimeException("IPFS API returned HTTP " + response.statusCode() + ": " + response.body());
            }

            JsonNode json = objectMapper.readTree(response.body());
            String cid = json.path("Hash").asText();
            if (cid.isBlank()) {
                throw new RuntimeException("IPFS API returned empty CID: " + response.body());
            }

            log.info("Uploaded evidence '{}' to IPFS: {}", fileName, cid);
            return cid;

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("IPFS upload failed: " + e.getMessage(), e);
        }
    }

    /**
     * Upload from a Spring MultipartFile (convenience overload).
     */
    public String uploadToIpfs(MultipartFile file) {
        try {
            String name = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
            return uploadToIpfs(name, file.getBytes());
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("IPFS upload failed: " + e.getMessage(), e);
        }
    }

    /**
     * Build the public IPFS gateway URL for a given CID.
     * Local Kubo gateway is mapped to port 8081 in docker-compose.
     */
    public String gatewayUrl(String cid) {
        try {
            URI apiUri = URI.create(ipfsApiUrl);
            String host = apiUri.getHost();
            int port = apiUri.getPort() == 5001 ? 8081 : apiUri.getPort();
            String scheme = apiUri.getScheme() != null ? apiUri.getScheme() : "http";

            // The browser cannot resolve the Docker service name (ipfs), so always
            // emit a host-reachable gateway URL.
            String gatewayHost = (host == null || host.equalsIgnoreCase("ipfs")) ? "localhost" : host;
            return scheme + "://" + gatewayHost + ":" + port + "/ipfs/" + cid;
        } catch (Exception e) {
            return "http://localhost:8081/ipfs/" + cid;
        }
    }

    /**
     * Full evidence pipeline: hash → upload → return result.
     *
     * @param fileName original file name
     * @param data     raw file bytes
     * @return EvidenceResult containing sha256 hash and IPFS gateway URI
     */
    public EvidenceResult process(String fileName, byte[] data) {
        String hash = sha256(data);
        String cid  = uploadToIpfs(fileName, data);
        String uri  = gatewayUrl(cid);
        return new EvidenceResult(hash, uri);
    }

    /** Result of the evidence pipeline. */
    public record EvidenceResult(String sha256Hash, String ipfsUri) {}

    // ── Private helpers ──────────────────────────────────────────────────

    private byte[] buildMultipartBody(String boundary, String fileName, byte[] fileData) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        String delimiter = "--" + boundary + "\r\n";
        String disposition = "Content-Disposition: form-data; name=\"file\"; filename=\""
                + fileName.replace("\"", "'") + "\"\r\n";

        out.write(delimiter.getBytes(StandardCharsets.UTF_8));
        out.write(disposition.getBytes(StandardCharsets.UTF_8));
        out.write("Content-Type: application/octet-stream\r\n\r\n".getBytes(StandardCharsets.UTF_8));
        out.write(fileData);
        out.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        return out.toByteArray();
    }
}
