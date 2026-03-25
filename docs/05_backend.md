# Backend — Spring Boot

## 1. Vai Trò & Giới Hạn

| Backend làm được                    | Backend KHÔNG làm được          |
| ----------------------------------- | ------------------------------- |
| Submit transaction lên Fabric       | Sửa transaction đã commit       |
| Index và cache event                | Xóa dữ liệu trên ledger         |
| Cung cấp REST API                   | Thay đổi world state trực tiếp  |
| Upload file, tính SHA-256, lưu IPFS | Giả mạo identity org khác       |
| Tạo & trả QR code                   | Bypass endorsement / SBE policy |

> **Blockchain là source of truth duy nhất.**

---

## 2. Tech Stack

```
Framework:  Spring Boot 3.x
Language:   Java 21
Database:   PostgreSQL 15
Fabric SDK: fabric-gateway-java (gRPC)
Storage:    IPFS (Kubo / Infura)
QR:         ZXing
Hash:       MessageDigest SHA-256
```

---

## 3. Per-User Identity

### Vấn đề nếu dùng Admin cert

`ownerUserId` và `recordedBy` trên ledger lấy từ
`ctx.getClientIdentity().getId()` — CN của certificate submit tx.
Nếu dùng Admin cert, ledger ghi Admin thay vì `farmer_alice`.

### Option A — Per-user wallet (production)

```java
@Service
public class FabricGatewayService {

    private final Map<String, Gateway> gatewayByUser = new ConcurrentHashMap<>();
    private final Map<String, Gateway> gatewayByOrg  = new ConcurrentHashMap<>();

    @Value("${fabric.channel-name}")   private String channelName;
    @Value("${fabric.chaincode-name}") private String chaincodeName;
    @Autowired private FabricConfig fabricConfig;

    @PostConstruct
    public void init() throws Exception {
        // Org-level: Admin cert — EventIndexer + evaluate
        gatewayByOrg.put("Org1", buildGateway("Org1", loadAdminIdentity("Org1")));
        gatewayByOrg.put("Org2", buildGateway("Org2", loadAdminIdentity("Org2")));

        // User-level: cert từng user — submit tx
        for (String userId : List.of(
                "farmer_alice", "processor_bob", "roaster_charlie",
                "packager_dave", "retailer_eve")) {
            try {
                gatewayByUser.put(userId,
                    buildGateway(orgOfUser(userId), loadUserIdentity(userId)));
            } catch (Exception e) {
                log.warn("Could not load identity for {}: {}", userId, e.getMessage());
            }
        }
    }

    /** Submit tx dưới danh nghĩa user → ownerUserId đúng trên ledger */
    public byte[] submitAs(String userId, String fnName,
            String... args) throws Exception {
        Gateway gw = gatewayByUser.get(userId);
        if (gw == null) throw new IllegalArgumentException(
            "No identity for user: " + userId);
        return getContract(gw).submitTransaction(fnName, args);
    }

    /**
     * acceptTransfer cần SBE AND → cả 2 peer phải endorse.
     *
     * Fabric Gateway SDK dùng service discovery để tự chọn peers.
     *
     * ⚠️ Docker Compose issue: discovery có thể không resolve
     * peer endpoints nội bộ đúng cách. Nếu tx fail với
     * "ENDORSEMENT_POLICY_FAILURE" hoặc "not enough endorsements":
     *
     *   Plan A (khuyến nghị): Bật service discovery đúng cách —
     *     đảm bảo anchor peers đã được update (updateAnchorPeers)
     *     và peer addresses accessible từ backend container.
     *
     *   Plan B (fallback explicit): Dùng withEndorsingOrgs() hoặc
     *     target cả 2 peer connections khi build Gateway.
     *     Xem comment bên dưới.
     *
     * Luôn test đoạn này trước demo.
     */
    public byte[] submitAcceptTransfer(String userId,
            String batchId) throws Exception {
        Gateway gw = gatewayByUser.get(userId);
        if (gw == null) throw new IllegalArgumentException(
            "No identity for user: " + userId);

        return getContract(gw)
            .newProposal("acceptTransfer")
            .addArguments(batchId)
            // Plan B — uncomment nếu discovery không hoạt động:
            // .withEndorsingOrgs("Org1MSP", "Org2MSP")
            .build()
            .endorse()
            .submit();
    }

    public byte[] evaluateTransaction(String org,
            String fnName, String... args) throws Exception {
        return getContract(gatewayByOrg.get(org))
            .evaluateTransaction(fnName, args);
    }

    public Network getNetwork(String org) {
        return gatewayByOrg.get(org).getNetwork(channelName);
    }

    public String getChaincodeName() { return chaincodeName; }

    private Contract getContract(Gateway gw) {
        return gw.getNetwork(channelName).getContract(chaincodeName);
    }

    private Gateway buildGateway(String org, Identity identity)
            throws Exception {
        FabricConfig.OrgConfig cfg = fabricConfig.getOrgConfig(org);
        byte[] tlsCert = Files.readAllBytes(
            Paths.get(cfg.getTlsCertPath()));
        ManagedChannel channel = NettyChannelBuilder
            .forTarget(cfg.getPeerEndpoint())
            .sslContext(GrpcSslContexts.forClient()
                .trustManager(new ByteArrayInputStream(tlsCert))
                .build())
            .build();
        return Gateway.newInstance()
            .identity(identity)
            .signer(Signers.newPrivateKeySigner(
                ((X509Identity) identity).getPrivateKey()))
            .hash(Hash.SHA256)
            .connection(channel)
            .connect();
    }

    private Identity loadUserIdentity(String userId) throws Exception {
        String org  = orgOfUser(userId);
        String base = fabricConfig.getOrgConfig(org).getUsersBasePath();
        return Identities.newX509Identity(mspIdOf(org),
            loadCert(base + "/" + userId + "/msp/signcerts/cert.pem"),
            loadKey(base  + "/" + userId + "/msp/keystore/"));
    }

    private Identity loadAdminIdentity(String org) throws Exception {
        FabricConfig.OrgConfig cfg = fabricConfig.getOrgConfig(org);
        return Identities.newX509Identity(mspIdOf(org),
            loadCert(cfg.getAdminCertPath()),
            loadKey(cfg.getAdminKeyPath()));
    }

    private X509Certificate loadCert(String path) throws Exception {
        try (Reader r = Files.newBufferedReader(Paths.get(path))) {
            return Identities.readX509Certificate(r);
        }
    }

    private PrivateKey loadKey(String keyDir) throws Exception {
        Path keyFile = Files.list(Paths.get(keyDir))
            .filter(p -> p.toString().endsWith("_sk"))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException(
                "No private key in: " + keyDir));
        try (Reader r = Files.newBufferedReader(keyFile)) {
            return Identities.readPrivateKey(r);
        }
    }

    private String orgOfUser(String u) {
        return List.of("packager_dave","retailer_eve").contains(u)
            ? "Org2" : "Org1";
    }

    private String mspIdOf(String org) { return org + "MSP"; }

    @PreDestroy
    public void shutdown() {
        gatewayByUser.values().forEach(Gateway::close);
        gatewayByOrg.values().forEach(Gateway::close);
    }
}
```

### Option B — Admin cert (demo only)

```
⚠️ Demo mode: transactions submitted under Admin identity.
   ownerUserId/recordedBy on ledger = Admin, not individual users.
   Production: use per-user wallet (Option A).
```

---

## 4. EventIndexerService.java

```java
@Service
public class EventIndexerService {

    @Autowired private FabricGatewayService   fabricGateway;
    @Autowired private BatchRepository        batchRepo;
    @Autowired private FarmActivityRepository activityRepo;
    @Autowired private LedgerRefRepository    ledgerRefRepo;
    @Autowired private ObjectMapper           objectMapper;

    private static final Logger log =
        LoggerFactory.getLogger(EventIndexerService.class);

    /**
     * Trade-off đã chấp nhận (demo): subscribe từ block mới nhất,
     * không checkpoint lastIndexedBlock xuống DB.
     *
     * Rủi ro: nếu indexer restart đúng lúc event bắn ra
     * (đặc biệt FARM_ACTIVITY_RECORDED — event-only, không có
     * world state backup), bảng farm_activities sẽ thiếu record.
     * Ledger vẫn đúng, nhưng UI timeline thiếu activity.
     *
     * ✅ Demo: không restart indexer trong khi demo → trade-off OK.
     *
     * Checkpoint pattern (V2 / production):
     *   1. Thêm bảng: CREATE TABLE indexer_state (
     *          key VARCHAR PRIMARY KEY, value VARCHAR);
     *      INSERT INTO indexer_state VALUES ('lastIndexedBlock', '0');
     *   2. Khi init: đọc lastIndexedBlock từ DB → khởi đầu replay từ đó.
     *   3. Sau mỗi block thành công: UPDATE indexer_state
     *          SET value = :block WHERE key = 'lastIndexedBlock';
     *   4. Subscribe với startBlock = lastIndexedBlock + 1:
     *      network.getChaincodeEvents(chaincodeName,
     *          new Checkpointer(startBlock))  // Fabric Gateway SDK hỗ trợ
     *   → farm_activities recover hoàn toàn vì event còn trong ledger history.
     */
    private volatile long lastIndexedBlock = 0;

    @PostConstruct
    public void startListening() {
        Thread.ofVirtual().name("fabric-event-indexer").start(
            this::listenWithRetry);
    }

    private void listenWithRetry() {
        int retryDelaySec = 5;
        while (!Thread.currentThread().isInterrupted()) {
            try {
                // Subscribe từ Org1 peer.
                // Event broadcast qua channel — Org1 peer thấy
                // đầy đủ mọi tx kể cả của Org2.
                // Fallback: đổi "Org1" → "Org2" nếu Org1 peer down.
                Network network = fabricGateway.getNetwork("Org1");
                log.info("EventIndexer: subscribing (lastBlock={})...",
                    lastIndexedBlock);

                try (CloseableIterator<ChaincodeEvent> events =
                        network.getChaincodeEvents(
                            fabricGateway.getChaincodeName())) {
                    events.forEachRemaining(event -> {
                        handleEvent(event);
                        lastIndexedBlock = event.getBlockNumber();
                        // V2/Production: UPDATE indexer_state SET value = lastIndexedBlock
                        // WHERE key = 'lastIndexedBlock' để checkpoint sau mỗi block.
                    });
                }
                log.warn("EventIndexer: stream ended, retry in {}s",
                    retryDelaySec);

            } catch (Exception e) {
                log.error("EventIndexer error, retry in {}s: {}",
                    retryDelaySec, e.getMessage());
            }

            try { Thread.sleep(retryDelaySec * 1000L); }
            catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            }
            retryDelaySec = Math.min(retryDelaySec * 2, 60);
        }
    }

    private void handleEvent(ChaincodeEvent event) {
        try {
            Map<String, String> payload = parsePayload(event.getPayload());

            // blockNumber từ event object — chính xác
            // KHÔNG lấy từ chaincode payload
            String txId        = event.getTransactionId();
            String blockNumber = String.valueOf(event.getBlockNumber());

            switch (event.getEventName()) {

                case "BATCH_CREATED" -> {
                    String batchId = payload.get("batchId");
                    try {
                        byte[] raw = fabricGateway.evaluateTransaction(
                            "Org1", "getBatch", batchId);
                        Batch full = objectMapper.readValue(raw, Batch.class);
                        batchRepo.upsert(full);
                    } catch (Exception e) {
                        log.warn("evaluate failed for {}, upsert from payload",
                            batchId, e);
                        batchRepo.upsertFromPayload(payload);
                    }
                    ledgerRefRepo.save(
                        payload.get("batchId"), "batchCreated",
                        txId, blockNumber);
                }

                case "FARM_ACTIVITY_RECORDED" ->
                    activityRepo.insert(FarmActivity.from(payload));

                case "TRANSFER_REQUESTED" ->
                    batchRepo.updateStatus(
                        payload.get("batchId"), "TRANSFER_PENDING");

                case "TRANSFER_ACCEPTED" -> {
                    batchRepo.updateOwnerAndStatus(
                        payload.get("batchId"),
                        payload.get("toMSP"),
                        "TRANSFERRED");
                    ledgerRefRepo.save(
                        payload.get("batchId"), "transferAccepted",
                        txId, blockNumber);
                }

                case "BATCH_STATUS_UPDATED" -> {
                    batchRepo.updateStatus(
                        payload.get("batchId"),
                        payload.get("newStatus"));
                    ledgerRefRepo.save(
                        payload.get("batchId"), "latestStatusUpdate",
                        txId, blockNumber);
                }

                case "BATCH_IN_STOCK" -> {
                    batchRepo.updateStatus(
                        payload.get("batchId"), "IN_STOCK");
                    ledgerRefRepo.save(
                        payload.get("batchId"), "inStock", txId, blockNumber);
                }

                case "BATCH_SOLD" -> {
                    batchRepo.updateStatus(
                        payload.get("batchId"), "SOLD");
                    ledgerRefRepo.save(
                        payload.get("batchId"), "sold", txId, blockNumber);
                }

                case "EVIDENCE_ADDED" ->
                    batchRepo.updateEvidence(
                        payload.get("batchId"),
                        payload.get("hash"),
                        payload.get("uri"));

                default ->
                    log.debug("Unhandled event: {}", event.getEventName());
            }
        } catch (Exception e) {
            log.error("Error handling event {}: {}",
                event.getEventName(), e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, String> parsePayload(byte[] payload) {
        try {
            return new Gson().fromJson(
                new String(payload, StandardCharsets.UTF_8),
                new TypeToken<Map<String, String>>(){}.getType());
        } catch (Exception e) {
            log.warn("Failed to parse event payload: {}", e.getMessage());
            return Collections.emptyMap();
        }
    }
}
```

---

## 5. REST API Endpoints

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PUBLIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GET  /api/trace/{publicCode}
GET  /api/qr/{publicCode}             → image/png

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTHENTICATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST  /api/harvest                    FARMER
POST  /api/process                    PROCESSOR
POST  /api/roast                      ROASTER
POST  /api/package                    PACKAGER
POST  /api/farm-activity              FARMER
POST  /api/transfer/request           ROASTER
POST  /api/transfer/accept/{id}       PACKAGER
PATCH /api/batch/{id}/status          RETAILER
POST  /api/evidence/upload            → { hash, uri }
POST  /api/batch/{id}/evidence        ROASTER
GET   /api/batches?type=&status=&ownerMSP=
GET   /api/batch/{id}
GET   /api/batch/{id}?source=chain    → evaluate từ world state
```

---

## 6. application.yml

```yaml
server:
  port: 8080

spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/coffeetrace
    username: coffeetrace
    password: ${DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: validate

fabric:
  channel-name: coffee-traceability-channel
  chaincode-name: CoffeeTraceChaincode
  org1:
    msp-id: Org1MSP
    peer-endpoint: peer0.org1.example.com:7051
    tls-cert-path: /crypto/org1/tlsca.org1.example.com-cert.pem
    admin-cert-path: /crypto/org1/users/Admin@org1.example.com/msp/signcerts/cert.pem
    admin-key-path: /crypto/org1/users/Admin@org1.example.com/msp/keystore/
    users-base-path: /crypto/org1/users
  org2:
    msp-id: Org2MSP
    peer-endpoint: peer0.org2.example.com:9051
    tls-cert-path: /crypto/org2/tlsca.org2.example.com-cert.pem
    admin-cert-path: /crypto/org2/users/Admin@org2.example.com/msp/signcerts/cert.pem
    admin-key-path: /crypto/org2/users/Admin@org2.example.com/msp/keystore/
    users-base-path: /crypto/org2/users

ipfs:
  api-url: http://localhost:5001

trace:
  public-base-url: ${TRACE_PUBLIC_BASE_URL:http://localhost:3000/trace/}
  # FIX-04: parameterized via ENV — override khi deploy production
  # Vai trò: backend dùng biến này làm qrBaseUrl khi gọi createPackagedBatch

jwt:
  secret: ${JWT_SECRET:coffee-chain-demo-secret-key-at-least-32chars}
  expiration-ms: 86400000 # 24 hours
```

---

## 7. FabricConfig.java

```java
package com.coffee.trace.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import java.util.Map;

@Configuration
@ConfigurationProperties(prefix = "fabric")
public class FabricConfig {

    private String channelName;
    private String chaincodeName;
    private Map<String, OrgConfig> org1 = new java.util.HashMap<>();
    private Map<String, OrgConfig> org2 = new java.util.HashMap<>();

    // Spring Boot tự bind fabric.org1.* vào field org1
    // nhưng để getOrgConfig("Org1") hoạt động, ta dùng map riêng
    private OrgConfig orgConfig1 = new OrgConfig();
    private OrgConfig orgConfig2 = new OrgConfig();

    public OrgConfig getOrgConfig(String org) {
        return "Org1".equals(org) ? orgConfig1 : orgConfig2;
    }

    public String getChannelName()   { return channelName; }
    public String getChaincodeName() { return chaincodeName; }

    public void setChannelName(String v)   { this.channelName = v; }
    public void setChaincodeName(String v) { this.chaincodeName = v; }
    public OrgConfig getOrg1()   { return orgConfig1; }
    public OrgConfig getOrg2()   { return orgConfig2; }
    public void setOrg1(OrgConfig v) { this.orgConfig1 = v; }
    public void setOrg2(OrgConfig v) { this.orgConfig2 = v; }

    public static class OrgConfig {
        private String mspId;
        private String peerEndpoint;
        private String tlsCertPath;
        private String adminCertPath;
        private String adminKeyPath;
        private String usersBasePath;

        public String getMspId()         { return mspId; }
        public String getPeerEndpoint()  { return peerEndpoint; }
        public String getTlsCertPath()   { return tlsCertPath; }
        public String getAdminCertPath() { return adminCertPath; }
        public String getAdminKeyPath()  { return adminKeyPath; }
        public String getUsersBasePath() { return usersBasePath; }

        public void setMspId(String v)         { this.mspId = v; }
        public void setPeerEndpoint(String v)  { this.peerEndpoint = v; }
        public void setTlsCertPath(String v)   { this.tlsCertPath = v; }
        public void setAdminCertPath(String v) { this.adminCertPath = v; }
        public void setAdminKeyPath(String v)  { this.adminKeyPath = v; }
        public void setUsersBasePath(String v) { this.usersBasePath = v; }
    }
}
```

---

## 8. JPA Entities

### Batch.java (Spring/PostgreSQL entity)

```java
package com.coffee.trace.backend.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Map;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "batches")
public class Batch {

    @Id
    @Column(name = "batch_id")
    private String batchId;

    @Column(name = "public_code", unique = true, nullable = false)
    private String publicCode;

    @Column(nullable = false)
    private String type;           // HARVEST | PROCESSED | ROAST | PACKAGED

    @Column(name = "parent_batch_id")
    private String parentBatchId;

    @Column(name = "owner_msp", nullable = false)
    private String ownerMsp;

    @Column(name = "owner_user_id")
    private String ownerUserId;

    @Column(nullable = false)
    private String status;

    @Column(name = "pending_to_msp")
    private String pendingToMsp;

    @Column(name = "evidence_hash")
    private String evidenceHash;

    @Column(name = "evidence_uri")
    private String evidenceUri;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, String> metadata;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    // getters / setters omitted for brevity — use Lombok @Data in implementation
}
```

### FarmActivity.java

```java
package com.coffee.trace.backend.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "farm_activities")
public class FarmActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "harvest_batch_id", nullable = false)
    private String harvestBatchId;

    @Column(name = "activity_type", nullable = false)
    private String activityType;

    @Column(name = "activity_date")
    private String activityDate;   // ISO date string (nông dân nhập)

    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "evidence_hash")
    private String evidenceHash;

    @Column(name = "evidence_uri")
    private String evidenceUri;

    @Column(name = "recorded_by")
    private String recordedBy;     // CN của certificate

    @Column(name = "recorded_at")
    private Instant recordedAt;    // blockchain timestamp

    @Column(name = "tx_id")
    private String txId;

    @Column(name = "block_number")
    private Long blockNumber;

    public static FarmActivity from(java.util.Map<String, String> payload) {
        FarmActivity a = new FarmActivity();
        a.setHarvestBatchId(payload.get("harvestBatchId"));
        a.setActivityType(payload.get("activityType"));
        a.setActivityDate(payload.get("activityDate"));
        a.setNote(payload.get("note"));
        a.setEvidenceHash(payload.getOrDefault("evidenceHash", ""));
        a.setEvidenceUri(payload.getOrDefault("evidenceUri", ""));
        a.setRecordedBy(payload.get("recordedBy"));
        a.setRecordedAt(Instant.parse(payload.get("recordedAt")));
        a.setTxId(payload.get("txId"));
        return a;
    }

    // getters / setters
}
```

### LedgerRef.java

```java
package com.coffee.trace.backend.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "ledger_refs")
public class LedgerRef {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_id", nullable = false)
    private String batchId;

    @Column(name = "event_name", nullable = false)
    private String eventName;     // batchCreated | transferAccepted | inStock | sold | ...

    @Column(name = "tx_id", nullable = false)
    private String txId;

    @Column(name = "block_number")
    private Long blockNumber;

    @Column(name = "created_at")
    private Instant createdAt;

    // getters / setters
}
```

### User.java (cho JWT Authentication)

```java
package com.coffee.trace.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {

    @Id
    @Column(name = "user_id")
    private String userId;          // farmer_alice | processor_bob | ...

    @Column(nullable = false)
    private String password;        // BCrypt hash

    @Column(nullable = false)
    private String role;            // FARMER | PROCESSOR | ROASTER | PACKAGER | RETAILER

    @Column(nullable = false)
    private String org;             // Org1 | Org2

    @Column(name = "fabric_user_id")
    private String fabricUserId;    // mapping sang identity trong wallet
                                    // thường = userId

    // getters / setters
}
```

---

## 9. JPA Repositories

```java
package com.coffee.trace.backend.repository;

import com.coffee.trace.backend.model.Batch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;
import java.util.Optional;
import java.util.List;

public interface BatchRepository extends JpaRepository<Batch, String> {

    Optional<Batch> findByPublicCode(String publicCode);

    List<Batch> findByOwnerMsp(String ownerMsp);

    List<Batch> findByTypeAndStatus(String type, String status);

    @Modifying @Transactional
    @Query("UPDATE Batch b SET b.status = :status, b.updatedAt = now() WHERE b.batchId = :batchId")
    void updateStatus(String batchId, String status);

    @Modifying @Transactional
    @Query("UPDATE Batch b SET b.ownerMsp = :ownerMsp, b.status = :status, b.updatedAt = now() WHERE b.batchId = :batchId")
    void updateOwnerAndStatus(String batchId, String ownerMsp, String status);

    @Modifying @Transactional
    @Query("UPDATE Batch b SET b.evidenceHash = :hash, b.evidenceUri = :uri, b.updatedAt = now() WHERE b.batchId = :batchId")
    void updateEvidence(String batchId, String hash, String uri);

    /** Upsert từ payload (fallback khi evaluateTransaction thất bại) */
    default void upsertFromPayload(java.util.Map<String, String> payload) {
        Batch b = new Batch();
        b.setBatchId(payload.get("batchId"));
        b.setPublicCode(payload.get("publicCode"));
        b.setType(payload.get("type"));
        b.setOwnerMsp(payload.get("ownerMSP"));
        b.setStatus(payload.get("status"));
        b.setCreatedAt(java.time.Instant.now());
        b.setUpdatedAt(java.time.Instant.now());
        save(b);
    }
}
```

```java
package com.coffee.trace.backend.repository;

import com.coffee.trace.backend.model.FarmActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface FarmActivityRepository extends JpaRepository<FarmActivity, Long> {
    List<FarmActivity> findByHarvestBatchIdOrderByActivityDateAsc(String harvestBatchId);
}
```

```java
package com.coffee.trace.backend.repository;

import com.coffee.trace.backend.model.LedgerRef;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface LedgerRefRepository extends JpaRepository<LedgerRef, Long> {

    Optional<LedgerRef> findTopByBatchIdAndEventNameOrderByCreatedAtDesc(
        String batchId, String eventName);

    default void save(String batchId, String eventName,
                      String txId, String blockNumber) {
        LedgerRef ref = new LedgerRef();
        ref.setBatchId(batchId);
        ref.setEventName(eventName);
        ref.setTxId(txId);
        ref.setBlockNumber(Long.parseLong(blockNumber));
        ref.setCreatedAt(java.time.Instant.now());
        save(ref);
    }
}
```

```java
package com.coffee.trace.backend.repository;

import com.coffee.trace.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByUserId(String userId);
}
```

---

## 10. JWT Authentication Layer

### JwtService.java

```java
package com.coffee.trace.backend.service;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Service
public class JwtService {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration-ms:86400000}")  // 24h default
    private long expirationMs;

    public String generateToken(String userId, String role, String org) {
        return Jwts.builder()
            .subject(userId)
            .claim("role", role)
            .claim("org", org)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + expirationMs))
            .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)))
            .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
            .verifyWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)))
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }

    public String extractUserId(String token) {
        return parseToken(token).getSubject();
    }

    public String extractRole(String token) {
        return (String) parseToken(token).get("role");
    }
}
```

### SecurityConfig.java

```java
package com.coffee.trace.backend.config;

import com.coffee.trace.backend.service.JwtService;
import com.coffee.trace.backend.repository.UserRepository;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.context.annotation.*;
import org.springframework.security.authentication.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.*;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
            JwtAuthFilter jwtFilter) throws Exception {
        http
            .csrf(c -> c.disable())
            .sessionManagement(s ->
                s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Public endpoints
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/trace/**").permitAll()
                .requestMatchers("/api/qr/**").permitAll()
                // All others require authentication
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter,
                UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authManager(
            org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }
}
```

### JwtAuthFilter.java

```java
package com.coffee.trace.backend.config;

import com.coffee.trace.backend.service.JwtService;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req,
            HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            try {
                var claims  = jwtService.parseToken(token);
                String userId = claims.getSubject();
                String role   = (String) claims.get("role");

                var auth = new UsernamePasswordAuthenticationToken(
                    userId, null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + role)));

                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (Exception e) {
                // Token invalid — SecurityContext remains empty → 401
            }
        }
        chain.doFilter(req, res);
    }
}
```

### AuthController.java

```java
package com.coffee.trace.backend.controller;

import com.coffee.trace.backend.model.User;
import com.coffee.trace.backend.repository.UserRepository;
import com.coffee.trace.backend.service.JwtService;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository  userRepo;
    private final JwtService      jwtService;
    private final PasswordEncoder passwordEncoder;

    public AuthController(UserRepository userRepo,
            JwtService jwtService, PasswordEncoder passwordEncoder) {
        this.userRepo        = userRepo;
        this.jwtService      = jwtService;
        this.passwordEncoder = passwordEncoder;
    }

    /** POST /api/auth/login
     *  Body: { "userId": "farmer_alice", "password": "pw123" }
     *  Returns: { "token": "Bearer eyJ..." }
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String userId   = body.get("userId");
        String password = body.get("password");

        return userRepo.findByUserId(userId)
            .filter(u -> passwordEncoder.matches(password, u.getPassword()))
            .map(u -> ResponseEntity.ok(Map.of(
                "token",  jwtService.generateToken(u.getUserId(), u.getRole(), u.getOrg()),
                "userId", u.getUserId(),
                "role",   u.getRole(),
                "org",    u.getOrg()
            )))
            .orElse(ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Invalid credentials")));
    }
}
```

### application.yml — additions

Bổ sung vào `application.yml` (thêm vào section hiện có):

```yaml
jwt:
  secret: ${JWT_SECRET:coffee-chain-demo-secret-key-32chars}
  expiration-ms: 86400000 # 24 hours

trace:
  public-base-url: ${TRACE_PUBLIC_BASE_URL:http://localhost:3000/trace/}
  # FIX-04: ENV-parameterized — override khi deploy production
```

---

## 11. Flyway Migration — V1\_\_init_schema.sql

```sql
-- backend/src/main/resources/db/migration/V1__init_schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ──────────────────────────────────────────────────────
CREATE TABLE users (
    user_id        VARCHAR(64)  PRIMARY KEY,
    password       VARCHAR(255) NOT NULL,  -- BCrypt hash
    role           VARCHAR(32)  NOT NULL,
    org            VARCHAR(32)  NOT NULL,
    fabric_user_id VARCHAR(64)  NOT NULL
);

-- Seed demo users (password = 'pw123' BCrypted)
INSERT INTO users VALUES
  ('farmer_alice',    '$2a$10$dummyHashForfarmer_alice1234567', 'FARMER',    'Org1', 'farmer_alice'),
  ('processor_bob',   '$2a$10$dummyHashForprocessor_bob12345', 'PROCESSOR', 'Org1', 'processor_bob'),
  ('roaster_charlie', '$2a$10$dummyHashForroaster_charlie123', 'ROASTER',   'Org1', 'roaster_charlie'),
  ('packager_dave',   '$2a$10$dummyHashForpackager_dave12345', 'PACKAGER',  'Org2', 'packager_dave'),
  ('retailer_eve',    '$2a$10$dummyHashForretailer_eve123456', 'RETAILER',  'Org2', 'retailer_eve');
-- NOTE: Replace dummyHash with real BCrypt hashes of 'pw123' before running

-- ── Batches ────────────────────────────────────────────────────
CREATE TABLE batches (
    batch_id        VARCHAR(64)  PRIMARY KEY,
    public_code     VARCHAR(128) UNIQUE NOT NULL,
    type            VARCHAR(32)  NOT NULL,
    parent_batch_id VARCHAR(64),
    owner_msp       VARCHAR(64)  NOT NULL,
    owner_user_id   VARCHAR(128),
    status          VARCHAR(32)  NOT NULL,
    pending_to_msp  VARCHAR(64),
    evidence_hash   VARCHAR(64),
    evidence_uri    VARCHAR(512),
    metadata        JSONB,
    created_at      TIMESTAMPTZ  DEFAULT now(),
    updated_at      TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX idx_batches_public_code  ON batches(public_code);
CREATE INDEX idx_batches_owner_msp   ON batches(owner_msp);
CREATE INDEX idx_batches_status      ON batches(status);
CREATE INDEX idx_batches_type_status ON batches(type, status);

-- ── Farm Activities ────────────────────────────────────────────
CREATE TABLE farm_activities (
    id               BIGSERIAL    PRIMARY KEY,
    harvest_batch_id VARCHAR(64)  NOT NULL,
    activity_type    VARCHAR(32)  NOT NULL,
    activity_date    VARCHAR(32),
    note             TEXT,
    evidence_hash    VARCHAR(64),
    evidence_uri     VARCHAR(512),
    recorded_by      VARCHAR(128),
    recorded_at      TIMESTAMPTZ,
    tx_id            VARCHAR(128),
    block_number     BIGINT
);

CREATE INDEX idx_farm_activities_harvest ON farm_activities(harvest_batch_id);

-- ── Ledger Refs ────────────────────────────────────────────────
CREATE TABLE ledger_refs (
    id           BIGSERIAL    PRIMARY KEY,
    batch_id     VARCHAR(64)  NOT NULL,
    event_name   VARCHAR(64)  NOT NULL,
    tx_id        VARCHAR(128) NOT NULL,
    block_number BIGINT,
    created_at   TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX idx_ledger_refs_batch ON ledger_refs(batch_id, event_name);
```
