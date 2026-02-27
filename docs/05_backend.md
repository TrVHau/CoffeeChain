# Backend — Spring Boot

## 1. Vai Trò & Giới Hạn

| Backend làm được | Backend KHÔNG làm được |
|---|---|
| Submit transaction lên Fabric | Sửa transaction đã commit |
| Index và cache event | Xóa dữ liệu trên ledger |
| Cung cấp REST API | Thay đổi world state trực tiếp |
| Upload file, tính SHA-256, lưu IPFS | Giả mạo identity org khác |
| Tạo & trả QR code | Bypass endorsement / SBE policy |

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
     * V1: subscribe từ block mới nhất, không checkpoint.
     *
     * Limitation: nếu indexer down đúng lúc event bắn ra
     * (đặc biệt FARM_ACTIVITY_RECORDED — event-only, không có
     * world state backup), DB off-chain sẽ thiếu record.
     * Ledger vẫn đúng, nhưng UI timeline thiếu activity.
     *
     * V2 plan: lưu lastIndexedBlock vào bảng indexer_state sau
     * mỗi block xử lý thành công. Khi restart, replay từ
     * (lastIndexedBlock + 1) để không bỏ sót event nào.
     * farm_activities có thể được recover hoàn toàn vì event
     * vẫn còn trong ledger history.
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
                        // V2: persist lastIndexedBlock vào DB ở đây
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
    url:      jdbc:postgresql://localhost:5432/coffeetrace
    username: coffeetrace
    password: ${DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: validate

fabric:
  channel-name:   coffee-traceability-channel
  chaincode-name: CoffeeTraceChaincode
  org1:
    msp-id:           Org1MSP
    peer-endpoint:    peer0.org1.example.com:7051
    tls-cert-path:    /crypto/org1/tlsca.org1.example.com-cert.pem
    admin-cert-path:  /crypto/org1/users/Admin@org1.example.com/msp/signcerts/cert.pem
    admin-key-path:   /crypto/org1/users/Admin@org1.example.com/msp/keystore/
    users-base-path:  /crypto/org1/users
  org2:
    msp-id:           Org2MSP
    peer-endpoint:    peer0.org2.example.com:9051
    tls-cert-path:    /crypto/org2/tlsca.org2.example.com-cert.pem
    admin-cert-path:  /crypto/org2/users/Admin@org2.example.com/msp/signcerts/cert.pem
    admin-key-path:   /crypto/org2/users/Admin@org2.example.com/msp/keystore/
    users-base-path:  /crypto/org2/users

ipfs:
  api-url: http://localhost:5001

trace:
  public-base-url: https://trace.example.com/trace/
```