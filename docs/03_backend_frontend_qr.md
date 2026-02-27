# Backend, Frontend & QR Code

## 1. Backend — Spring Boot

### 1.1 Vai Trò

Backend **submit transaction lên blockchain** để đơn giản hóa tích
hợp và quản lý identity tập trung.

| Backend làm được | Backend KHÔNG làm được |
|---|---|
| Submit transaction mới | Sửa transaction đã commit |
| Index và cache event | Xóa dữ liệu trên ledger |
| Cung cấp REST API | Thay đổi world state trực tiếp |
| Upload file, tính hash | Giả mạo identity org khác |
| Tạo QR code | Bypass endorsement policy |

> **Blockchain là source of truth duy nhất.**

### 1.2 Tech Stack

```
Framework:    Spring Boot 3.x
Language:     Java (cùng ngôn ngữ với chaincode)
Database:     PostgreSQL
              ├── batches          (mirror world state)
              ├── farm_activities  (từ FARM_ACTIVITY_RECORDED)
              └── ledger_refs      (txId + blockNumber per event)
Fabric SDK:   fabric-gateway-java
Storage:      IPFS
QR:           ZXing (com.google.zxing)
Hash:         MessageDigest SHA-256 (Java built-in)
```

> **Lý do Spring Boot:** Team đã làm việc với Java qua chaincode.
> Tái sử dụng được `Batch.java`, enum, util — giảm code trùng lặp,
> dễ debug end-to-end.

### 1.3 Cấu Trúc Project Spring Boot

```
backend/
├── src/main/java/com/coffee/trace/
│   ├── CoffeeTraceApplication.java
│   ├── controller/
│   │   ├── TraceController.java
│   │   ├── BatchController.java
│   │   ├── FarmActivityController.java
│   │   ├── TransferController.java
│   │   └── EvidenceController.java
│   ├── service/
│   │   ├── FabricGatewayService.java
│   │   ├── EventIndexerService.java
│   │   ├── QrGeneratorService.java
│   │   └── EvidenceService.java
│   ├── repository/
│   │   ├── BatchRepository.java
│   │   ├── FarmActivityRepository.java
│   │   └── LedgerRefRepository.java
│   ├── model/
│   │   ├── Batch.java
│   │   ├── FarmActivity.java
│   │   └── TraceResponse.java
│   └── config/
│       └── FabricConfig.java
└── src/main/resources/
    └── application.yml
```

### 1.4 REST API Endpoints

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PUBLIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GET  /api/trace/{publicCode}
GET  /api/qr/{publicCode}          → image/png

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTHENTICATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

POST /api/harvest
POST /api/process
POST /api/roast
POST /api/package
POST /api/farm-activity
POST /api/transfer/request
POST /api/transfer/accept/{batchId}
PATCH /api/batch/{batchId}/status
POST /api/evidence/upload          → { hash, uri }
POST /api/batch/{batchId}/evidence
GET  /api/batches?type=&status=&ownerMSP=
GET  /api/batch/{batchId}
```

### 1.5 FabricGatewayService.java

```java
@Service
public class FabricGatewayService {

    private final Map<String, Gateway> gateways = new HashMap<>();

    @PostConstruct
    public void init() throws Exception {
        gateways.put("Org1", buildGateway("Org1",
            "peer0.org1.example.com:7051"));
        gateways.put("Org2", buildGateway("Org2",
            "peer0.org2.example.com:9051"));
    }

    private Gateway buildGateway(String org, String peerEndpoint)
            throws Exception {
        Credentials creds = loadCredentials(org);
        ManagedChannel channel = ManagedChannelBuilder
            .forTarget(peerEndpoint)
            .useTransportSecurity()
            .build();

        return Gateway.newInstance()
            .identity(Identities.newX509Identity(
                org + "MSP", creds.getCertificate()))
            .signer(Signers.newPrivateKeySigner(creds.getPrivateKey()))
            .hash(Hash.SHA256)
            .connection(channel)
            .connect();
    }

    public byte[] submitTransaction(String org,
            String fnName, String... args) throws Exception {
        return getContract(org).submitTransaction(fnName, args);
    }

    public byte[] evaluateTransaction(String org,
            String fnName, String... args) throws Exception {
        // Không qua ordering service;
        // peer trả dữ liệu trực tiếp từ world state
        return getContract(org).evaluateTransaction(fnName, args);
    }

    private Contract getContract(String org) {
        return gateways.get(org)
            .getNetwork("coffee-traceability-channel")
            .getContract("CoffeeTraceChaincode");
    }
}
```

### 1.6 EventIndexerService.java

```java
@Service
public class EventIndexerService {

    @Autowired FabricGatewayService    fabricGateway;
    @Autowired BatchRepository         batchRepo;
    @Autowired FarmActivityRepository  activityRepo;
    @Autowired LedgerRefRepository     ledgerRefRepo;

    @PostConstruct
    public void startListening() throws Exception {
        Network network = fabricGateway
            .getGateway("Org1")
            .getNetwork("coffee-traceability-channel");

        network.getChaincodeEvents("CoffeeTraceChaincode")
               .forEach(this::handleEvent);
    }

    private void handleEvent(ChaincodeEvent event) {
        Map<String, String> payload = parsePayload(event.getPayload());
        String txId        = payload.get("txId");
        String blockNumber = String.valueOf(event.getBlockNumber());

        switch (event.getEventName()) {

            case "BATCH_CREATED" -> {
                // Event payload chỉ chứa fields quan trọng (batchId, type,
                // ownerMSP...), không phải full snapshot (metadata, evidence...).
                // Indexer gọi thêm evaluateTransaction(getBatch) để lấy
                // toàn bộ world state trước khi upsert vào DB mirror.
                String batchId = payload.get("batchId");
                try {
                    byte[] raw = fabricGateway.evaluateTransaction(
                        "Org1", "getBatch", batchId
                    );
                    Batch fullBatch = JSON.deserialize(raw, Batch.class);
                    batchRepo.upsert(fullBatch, txId, blockNumber);
                } catch (Exception e) {
                    // Fallback: upsert từ payload nếu evaluate lỗi
                    batchRepo.upsertFromPayload(payload, txId, blockNumber);
                    log.warn("evaluateTransaction failed for {}, "
                        + "upserted from event payload", batchId, e);
                }
                ledgerRefRepo.save(payload.get("batchId"),
                    "batchCreated", txId, blockNumber);
            }

            case "FARM_ACTIVITY_RECORDED" ->
                // Chỉ tồn tại trong bảng này — không có trong world state
                activityRepo.insert(FarmActivity.from(payload,
                    txId, blockNumber));

            case "TRANSFER_ACCEPTED" -> {
                batchRepo.updateOwnerAndStatus(
                    payload.get("batchId"),
                    payload.get("toMSP"),
                    "TRANSFERRED"
                );
                ledgerRefRepo.save(payload.get("batchId"),
                    "transferAccepted", txId, blockNumber);
            }

            case "BATCH_STATUS_UPDATED" -> {
                batchRepo.updateStatus(
                    payload.get("batchId"),
                    payload.get("newStatus")
                );
                ledgerRefRepo.save(payload.get("batchId"),
                    "latestStatusUpdate", txId, blockNumber);
            }

            case "EVIDENCE_ADDED" ->
                batchRepo.updateEvidence(
                    payload.get("batchId"),
                    payload.get("hash"),
                    payload.get("uri")
                );

            case "TRANSFER_REQUESTED" ->
                batchRepo.updateStatus(
                    payload.get("batchId"), "TRANSFER_PENDING"
                );
        }
    }
}
```

### 1.7 TraceController.java

```java
@RestController
@RequestMapping("/api")
public class TraceController {

    @GetMapping("/trace/{publicCode}")
    public ResponseEntity<TraceResponse> getTrace(
            @PathVariable String publicCode) {

        List<Batch> chain = batchRepo.getChainByPublicCode(publicCode);
        if (chain.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Batch harvestBatch = chain.get(chain.size() - 1);

        List<FarmActivity> activities = activityRepo
            .findByHarvestBatchId(harvestBatch.getBatchId());
        activities.sort(Comparator
            .comparing(FarmActivity::getActivityDate).reversed());

        Map<String, LedgerRef> ledgerRefs = ledgerRefRepo
            .findByBatchId(chain.get(0).getBatchId());

        return ResponseEntity.ok(TraceResponse.builder()
            .publicCode(publicCode)
            .chain(chain)
            .farmActivities(activities)
            .verifiedOnChain(true)
            // verifiedOnChain = true: dữ liệu được index từ
            // chaincode events + world state snapshot qua
            // evaluateTransaction. ledgerRefs cung cấp txId +
            // blockNumber để đối chiếu trực tiếp trên explorer.
            .ledgerRefs(ledgerRefs)
            .build());
    }
}
```

### 1.8 TransferController.java

```java
@RestController
@RequestMapping("/api/transfer")
public class TransferController {

    // Bước 1: Org1 — OR('Org1MSP.peer')
    @PostMapping("/request")
    public ResponseEntity<?> requestTransfer(
            @RequestBody TransferRequest req) throws Exception {
        byte[] result = fabricGateway.submitTransaction(
            "Org1", "requestTransfer",
            req.getBatchId(), req.getToMSP()
        );
        return ResponseEntity.ok(parseResult(result));
    }

    // Bước 2: Org2 — AND('Org1MSP.peer', 'Org2MSP.peer')
    // Fabric Gateway SDK tự gom endorsement từ cả 2 peer
    @PostMapping("/accept/{batchId}")
    public ResponseEntity<?> acceptTransfer(
            @PathVariable String batchId) throws Exception {
        byte[] result = fabricGateway.submitTransaction(
            "Org2", "acceptTransfer", batchId
        );
        return ResponseEntity.ok(parseResult(result));
    }
}
```

---

## 2. Frontend Application

### 2.1 Cấu Trúc Trang

```
/login
/dashboard                       → redirect theo role

/dashboard/farmer
  ├── Tạo HarvestBatch
  ├── Nhật ký canh tác (xem + thêm activity)
  └── CREATED → IN_PROCESS → COMPLETED

/dashboard/processor
  ├── HarvestBatch COMPLETED → tạo ProcessedBatch
  └── CREATED → IN_PROCESS → COMPLETED → requestTransfer

/dashboard/roaster
  ├── ProcessedBatch COMPLETED → tạo RoastBatch
  ├── Upload chứng cứ
  └── CREATED → IN_PROCESS → COMPLETED → requestTransfer sang Org2

/dashboard/packager
  ├── RoastBatch TRANSFER_PENDING → acceptTransfer
  ├── Tạo PackagedBatch (status = COMPLETED ngay)
  └── Sinh QR code

/dashboard/retailer
  ├── PackagedBatch TRANSFERRED → IN_STOCK → SOLD

/trace/{publicCode}              → CÔNG KHAI
```

### 2.2 Trang Truy Xuất Công Khai

```
┌────────────────────────────────────────────────────────┐
│  ☕ TRUY XUẤT NGUỒN GỐC CÀ PHÊ                         │
│  Mã: PKG-20240403-001  |  ✅ Đã bán                    │
├────────────────────────────────────────────────────────┤
│  ✅ [04/04] BÁN LẺ      Retailer XYZ                   │
│  📦 [03/04] ĐÓNG GÓI   Org2 — Đà Lạt Coffee           │
│  🔥 [01/04] RANG        Org1 — Roastery Cầu Đất        │
│             📎 Giấy kiểm định  [🔍 Xác minh hash]      │
│  🌿 [25/03] SƠ CHẾ     Org1 — Washed                  │
│  🌱 [15/03] THU HOẠCH  farmer_alice — Cầu Đất         │
│  └─ 🌾 NHẬT KÝ CANH TÁC [▼]                           │
│       [01/03] 🐛 Phun thuốc  [tx↗]                     │
│       [15/02] 🌿 Bón phân    [tx↗]                     │
│       [01/02] 🚿 Tưới nước   [tx↗]                     │
│       [10/01] ✂️  Tỉa cành   [tx↗]                     │
│  ────────────────────────────────────────────────────  │
│  🔗 Nguồn: Hyperledger Fabric ledger events            │
│  Block #1247 | Tx: abc123...                           │
└────────────────────────────────────────────────────────┘
```

### 2.3 EvidenceVerifier Component

```
┌──────────────────────────────────────────────────────┐
│  🔍 XÁC MINH TÍNH TOÀN VẸN FILE CHỨNG CỨ            │
│                                                      │
│  On-chain hash (từ getTraceChain — world state):     │
│  a3f8c2d1e5b7...9f4a                                 │
│                                                      │
│  Computed hash (SHA-256 tính từ file tải về):        │
│  a3f8c2d1e5b7...9f4a                                 │
│                                                      │
│  ✅ KHỚP — File nguyên bản, chưa bị chỉnh sửa       │
│  Tx: abc123... | Block #1250                        │
└──────────────────────────────────────────────────────┘
```

> Hash on-chain lấy từ `evaluateTransaction(getBatch)` —
> trực tiếp từ world state, độc lập với DB off-chain.

```typescript
async function verifyEvidence(batchId: string, fileUrl: string) {
  // 1. Lấy hash on-chain từ world state (không phải DB)
  const batch        = await api.evaluateGetBatch(batchId);
  const onChainHash  = batch.evidenceHash;

  // 2. Tính hash phía client
  const fileBuffer   = await downloadFile(fileUrl);
  const computedHash = await sha256(fileBuffer);

  return {
    onChainHash,   // hiển thị dòng 1
    computedHash,  // hiển thị dòng 2
    match: onChainHash === computedHash,
  };
}
```

---

## 3. QR Code

```java
@Service
public class QrGeneratorService {
    public byte[] generateQR(String publicCode) throws Exception {
        String url = "https://trace.example.com/trace/" + publicCode;
        BitMatrix matrix = new MultiFormatWriter().encode(
            url, BarcodeFormat.QR_CODE, 300, 300,
            Map.of(EncodeHintType.ERROR_CORRECTION,
                   ErrorCorrectionLevel.M,
                   EncodeHintType.MARGIN, 2)
        );
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(matrix, "PNG", out);
        return out.toByteArray();
    }
}
```

---

## 4. File Chứng Cứ (Evidence)

```java
@Service
public class EvidenceService {
    public EvidenceResult uploadEvidence(MultipartFile file)
            throws Exception {
        byte[] bytes = file.getBytes();
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        String hash = HexFormat.of().formatHex(digest.digest(bytes));
        String cid  = ipfsClient.add(bytes).getCid();
        return new EvidenceResult(hash, "ipfs://" + cid);
    }
}
```

---

## 5. Docker Compose (Demo)

```yaml
version: '3.8'
services:

  orderer.example.com:
    image: hyperledger/fabric-orderer:2.5
    environment:
      - ORDERER_GENERAL_CONSENSUS_TYPE=etcdraft
    ports: ["7050:7050"]

  peer0.org1.example.com:
    image: hyperledger/fabric-peer:2.5
    environment:
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb0:5984
    depends_on: [couchdb0]
    ports: ["7051:7051"]

  peer0.org2.example.com:
    image: hyperledger/fabric-peer:2.5
    environment:
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb1:5984
    depends_on: [couchdb1]
    ports: ["9051:9051"]

  couchdb0:
    image: couchdb:3.3
    ports: ["5984:5984"]

  couchdb1:
    image: couchdb:3.3
    ports: ["7984:5984"]

  ca.org1.example.com:
    image: hyperledger/fabric-ca:1.5
    ports: ["7054:7054"]

  ca.org2.example.com:
    image: hyperledger/fabric-ca:1.5
    ports: ["8054:7054"]

  backend:
    build: ./backend
    environment:
      - SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/coffeetrace
      - CHANNEL_NAME=coffee-traceability-channel
      - CHAINCODE_NAME=CoffeeTraceChaincode
    ports: ["8080:8080"]
    depends_on:
      - peer0.org1.example.com
      - peer0.org2.example.com
      - postgres

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=coffeetrace
      - POSTGRES_PASSWORD=secret
    ports: ["5432:5432"]

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [backend]

  ipfs:
    image: ipfs/kubo:latest
    ports: ["5001:5001", "8081:8080"]
```

---

## 6. Cấu Trúc Thư Mục Dự Án

```
coffee-traceability/
│
├── network/
│   ├── configtx.yaml
│   ├── crypto-config.yaml
│   ├── docker-compose.yaml
│   └── scripts/
│       ├── setup-network.sh
│       ├── deploy-chaincode.sh
│       └── register-users.sh
│
├── chaincode/
│   ├── src/main/java/
│   │   ├── CoffeeTraceChaincode.java
│   │   ├── model/Batch.java
│   │   └── util/
│   │       ├── RoleChecker.java
│   │       └── LedgerUtils.java
│   └── build.gradle
│
├── backend/
│   ├── src/main/java/com/coffee/trace/
│   │   ├── controller/
│   │   ├── service/
│   │   ├── repository/
│   │   ├── model/
│   │   └── config/
│   └── pom.xml
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── trace/[publicCode].tsx
│   │   │   └── dashboard/
│   │   │       ├── farmer.tsx
│   │   │       ├── processor.tsx
│   │   │       ├── roaster.tsx
│   │   │       ├── packager.tsx
│   │   │       └── retailer.tsx
│   │   └── components/
│   │       ├── TraceTimeline.tsx
│   │       ├── FarmActivityLog.tsx
│   │       └── EvidenceVerifier.tsx
│   └── package.json
│
└── docs/
    ├── 00_overview.md
    ├── 01_architecture.md
    ├── 02_data_model_chaincode.md
    └── 03_backend_frontend_qr.md
```