# Backend, Frontend & QR Code

## 1. Backend API Server

### 1.1 Vai Trò Rõ Ràng Của Backend

Backend **có thể submit transaction lên blockchain** thay frontend
để đơn giản hoá tích hợp và quản lý identity tập trung.

Tuy nhiên cần hiểu đúng:

| Backend làm được       | Backend KHÔNG làm được         |
| ---------------------- | ------------------------------ |
| Submit transaction mới | Sửa transaction đã commit      |
| Index và cache event   | Xóa dữ liệu trên ledger        |
| Cung cấp API truy xuất | Thay đổi world state trực tiếp |
| Upload file, tính hash | Giả mạo identity của org khác  |

> **Blockchain vẫn là source of truth duy nhất.**
> Backend chỉ là lớp tiện ích — nếu backend bị xâm phạm,
> kẻ tấn công chỉ có thể submit tx mới (bị chaincode kiểm tra role),
> không thể sửa lịch sử đã ghi.

### 1.2 Tech Stack

```
Runtime:       Node.js
Framework:     Express.js
Database:      PostgreSQL (off-chain index + QR metadata)
Fabric SDK:    @hyperledger/fabric-gateway (npm)
File storage:  IPFS (ipfs-http-client) hoặc local server
QR library:    qrcode (npm)
Hash:          crypto (built-in Node.js, SHA-256)
```

### 1.3 REST API Endpoints

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PUBLIC — Không cần authentication
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GET  /api/trace/:publicCode
     → Trả về full trace chain (PackagedBatch về HarvestBatch)
     → Backend query DB index hoặc gọi chaincode getTraceChain

GET  /api/qr/:publicCode
     → Trả về ảnh QR (PNG) để in lên bao bì

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTHENTICATED — Yêu cầu JWT / Fabric identity
━━━━━━━━━━━━━━━��━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Tạo batch (backend submit tx lên Fabric)
POST /api/harvest         → Tạo HarvestBatch     (role: FARMER)
POST /api/process         → Tạo ProcessedBatch   (role: PROCESSOR)
POST /api/roast           → Tạo RoastBatch        (role: ROASTER)
POST /api/package         → Tạo PackagedBatch + sinh QR (role: PACKAGER)

# Bàn giao (2 bước)
POST /api/transfer/request          → requestTransfer  (Org1)
POST /api/transfer/accept/:batchId  → acceptTransfer   (Org2)

# Cập nhật trạng thái
PATCH /api/batch/:batchId/status    → IN_STOCK / SOLD  (role: RETAILER)

# Chứng cứ
POST /api/evidence/upload
     → Upload file → trả { hash: "sha256...", uri: "ipfs://CID" }
POST /api/batch/:batchId/evidence
     → Ghi hash lên chain (addEvidence)

# Dashboard
GET  /api/batches?type=HARVEST&status=COMPLETED&ownerMSP=Org1MSP
     → Query từ DB index
GET  /api/batch/:batchId
     → Chi tiết 1 batch
```

### 1.4 Kết Nối Fabric Gateway SDK

```javascript
// fabricGateway.js
const { connect, hash } = require("@hyperledger/fabric-gateway");
const grpc = require("@grpc/grpc-js");

async function newGatewayConnection(org) {
  // Mỗi org có cert và key riêng để submit tx
  const credentials = await loadCredentials(org); // cert + key từ Fabric CA
  const client = new grpc.Client(
    org === "Org1"
      ? "peer0.org1.example.com:7051"
      : "peer0.org2.example.com:9051",
    grpc.credentials.createSsl(credentials.tlsCert),
  );

  return connect({
    client,
    identity: { mspId: org + "MSP", credentials: credentials.cert },
    signer: signers.newPrivateKeySigner(credentials.privateKey),
    hash: hash.sha256,
  });
}

async function submitTransaction(org, fnName, ...args) {
  const gateway = await newGatewayConnection(org);
  const network = gateway.getNetwork("coffee-traceability-channel");
  const contract = network.getContract("CoffeeTraceChaincode");

  try {
    const result = await contract.submitTransaction(fnName, ...args);
    return JSON.parse(Buffer.from(result).toString());
  } finally {
    gateway.close();
  }
}
```

### 1.5 Event Indexer

```javascript
// indexer.js — Lắng nghe event từ Fabric, lưu vào DB off-chain
async function startIndexer(gateway) {
  const network = gateway.getNetwork("coffee-traceability-channel");

  // Lắng nghe tất cả event từ CoffeeTraceChaincode
  const events = await network.getChaincodeEvents("CoffeeTraceChaincode");

  console.log("Indexer started, listening for chaincode events...");

  for await (const event of events) {
    const payload = JSON.parse(Buffer.from(event.payload).toString());

    switch (event.eventName) {
      case "BATCH_CREATED":
        await db.upsertBatch(payload);
        break;
      case "TRANSFER_REQUESTED":
        await db.updateBatchStatus(payload.batchId, "TRANSFER_PENDING");
        break;
      case "TRANSFER_ACCEPTED":
        await db.updateBatchOwner(payload.batchId, payload.toMSP);
        await db.updateBatchStatus(payload.batchId, "TRANSFERRED");
        break;
      case "BATCH_STATUS_UPDATED":
        await db.updateBatchStatus(payload.batchId, payload.newStatus);
        break;
      case "EVIDENCE_ADDED":
        await db.updateEvidence(payload.batchId, payload.hash, payload.uri);
        break;
    }
  }
}
```

### 1.6 Transfer Flow Chi Tiết (2 Transaction Riêng Biệt)

```javascript
// routes/transfer.js

// Bước 1: Org1 (Roaster) khởi tạo yêu cầu bàn giao
router.post("/transfer/request", authenticate, async (req, res) => {
  const { batchId, toMSP } = req.body;
  // Backend dùng identity của Org1 để submit
  // Endorsement policy: OR('Org1MSP.peer') — chỉ Org1 ký
  const result = await fabricGateway.submitTransaction(
    "Org1",
    "requestTransfer",
    batchId,
    toMSP,
  );
  res.json(result);
});

// Bước 2: Org2 (Packager) xác nhận nhận hàng
router.post("/transfer/accept/:batchId", authenticate, async (req, res) => {
  const { batchId } = req.params;
  // Backend dùng identity của Org2 để submit
  // Endorsement policy: AND('Org1MSP.peer', 'Org2MSP.peer')
  // → Fabric tự yêu cầu cả 2 peer endorse trước khi commit
  const result = await fabricGateway.submitTransaction(
    "Org2",
    "acceptTransfer",
    batchId,
  );
  res.json(result);
});
```

> **Tại sao 2 tx riêng thay vì offline signing?**
>
> - `requestTransfer` chỉ đổi status = `TRANSFER_PENDING` → Org1 tự ký đủ
> - `acceptTransfer` cần AND endorsement → Fabric tự thu thập endorsement
>   từ cả 2 peer khi backend submit qua Gateway SDK
> - Không cần implement offline signing phức tạp
> - Demo rõ ràng, ít bug, dễ giải thích khi bảo vệ

---

## 2. Frontend Application

### 2.1 Cấu Trúc Trang

```
/login                       — Đăng nhập, chọn role
/dashboard                   — Redirect theo role sau login

/dashboard/farmer            — Tạo HarvestBatch
/dashboard/processor         — Tạo ProcessedBatch + xem lô chờ xử lý
/dashboard/roaster           — Tạo RoastBatch + xem lô chờ rang
/dashboard/packager          — Nhận lô rang + tạo PackagedBatch + tạo QR
/dashboard/retailer          — Xác nhận nhận hàng → IN_STOCK → SOLD

/trace/:publicCode           — Trang truy xuất CÔNG KHAI (không cần login)
```

### 2.2 Trang Truy Xuất Công Khai (/trace/:publicCode)

```
┌─────────────────────────────────────────────────────┐
│  ☕ TRUY XUẤT NGUỒN GỐC CÀ PHÊ                      │
│  Mã sản phẩm: PKG-20240403-001                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ✅ [04/04/2024] BÁN LẺ                              │
│     Cửa hàng: Retailer XYZ — Đà Lạt                 │
│     Trạng thái: Đã bán                               │
│                                                      │
│  📦 [03/04/2024] ĐÓNG GÓI                            │
│     Đơn vị: Đà Lạt Coffee Packager (Org2MSP)        │
│     Trọng lượng: 250g × 100 gói                     │
│     Hạn sử dụng: 03/04/2025                         │
│                                                      │
│  🔥 [01/04/2024] RANG CÀ PHÊ                         │
│     Đơn vị: Roastery Cầu Đất (Org1MSP)              │
│     Profile rang: Medium-Light — 12 phút            │
│     [📎 Xem giấy kiểm định]  [🔍 Verify hash]       │
│                                                      │
│  🌿 [25/03/2024] SƠ CHẾ                              │
│     Phương pháp: Washed                             │
│     Thời gian: 18/03 – 25/03/2024                   │
│     Cơ sở: Xưởng sơ chế Đà Lạt                     │
│                                                      │
│  🌱 [15/03/2024] THU HOẠCH                           │
│     Vùng trồng: Cầu Đất, Đà Lạt, Lâm Đồng         │
│     Giống cà phê: Arabica Bourbon                   │
│     Nông dân: farmer_alice (Org1MSP)                │
│                                                      │
│  ──────────────────────────────────────────────────  │
│  🔗 Dữ liệu xác thực trên Hyperledger Fabric        │
│  Tx: abc123... │ Block #1247                         │
└─────────────────────────────────────────────────────┘
```

---

## 3. QR Code

### 3.1 Nội Dung QR

```
https://trace.example.com/trace/PKG-20240403-001
```

QR chứa URL — không nhúng data trực tiếp:

- QR gọn, in được trên bao bì nhỏ
- Logic hiển thị thay đổi không cần in lại QR
- Luôn trả về data mới nhất từ backend

### 3.2 Sinh QR Trong Backend

```javascript
// qrGenerator.js
const QRCode = require("qrcode");

async function generateQR(publicCode) {
  const url = `https://trace.example.com/trace/${publicCode}`;

  const qrBuffer = await QRCode.toBuffer(url, {
    errorCorrectionLevel: "M", // chịu được vết xước vừa
    width: 300,
    margin: 2,
    color: { dark: "#1a1a1a", light: "#ffffff" },
  });

  const filename = `${publicCode}.png`;
  await saveFile(`./qr/${filename}`, qrBuffer);
  return `/api/qr/${publicCode}`; // URL trả về cho frontend
}
```

---

## 4. File Chứng Cứ (Evidence)

### 4.1 Quy Trình Đầy Đủ

```
1. User chọn file (PDF/JPG/PNG) trên Dashboard
2. POST /api/evidence/upload
   → Backend nhận file
   → Tính SHA-256: crypto.createHash('sha256').update(buffer).digest('hex')
   → Upload lên IPFS → nhận CID
   → Trả về { hash: "abc123...", uri: "ipfs://QmXyz..." }
3. Frontend nhận hash + uri
4. Gọi POST /api/batch/:batchId/evidence với { hash, uri }
5. Backend submit addEvidence(batchId, hash, uri) lên Fabric
6. Chaincode lưu evidenceHash + evidenceUri vào Batch state
7. Emit event EVIDENCE_ADDED
```

### 4.2 Verify Tính Toàn Vẹn (Người Dùng)

```
1. Click "Verify hash" trên trang /trace/...
2. Download file từ IPFS URI
3. Frontend tính SHA-256 của file vừa tải
4. So sánh với evidenceHash lưu on-chain
   ✅ Khớp → File nguyên bản, không bị chỉnh sửa
   ❌ Không khớp → File đã bị thay thế
```

---

## 5. Docker Compose (Demo)

```yaml
# docker-compose.yml
version: "3.8"

services:
  # ── Fabric Infrastructure ──────────────────────────────────

  orderer.example.com:
    image: hyperledger/fabric-orderer:2.5
    environment:
      - ORDERER_GENERAL_LISTENADDRESS=0.0.0.0
      - ORDERER_GENERAL_CONSENSUS_TYPE=etcdraft # Raft
    volumes:
      - ./network/crypto-config/ordererOrganizations:/var/hyperledger/orderer/msp
    ports:
      - "7050:7050"

  peer0.org1.example.com:
    image: hyperledger/fabric-peer:2.5
    environment:
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb0:5984
    depends_on:
      - couchdb0
    ports:
      - "7051:7051"

  peer0.org2.example.com:
    image: hyperledger/fabric-peer:2.5
    environment:
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb1:5984
    depends_on:
      - couchdb1
    ports:
      - "9051:9051"

  couchdb0: # State DB của peer0.org1
    image: couchdb:3.3
    ports:
      - "5984:5984"

  couchdb1: # State DB của peer0.org2
    image: couchdb:3.3
    ports:
      - "7984:5984"

  ca.org1.example.com:
    image: hyperledger/fabric-ca:1.5
    environment:
      - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server
    # Cấp cert với attribute role=FARMER/PROCESSOR/ROASTER
    ports:
      - "7054:7054"

  ca.org2.example.com:
    image: hyperledger/fabric-ca:1.5
    # Cấp cert với attribute role=PACKAGER/RETAILER
    ports:
      - "8054:7054"

  # ── Application Layer ──────────────────────────────────────

  backend:
    build: ./backend
    environment:
      - ORG1_PEER=peer0.org1.example.com:7051
      - ORG2_PEER=peer0.org2.example.com:9051
      - CHANNEL_NAME=coffee-traceability-channel
      - CHAINCODE_NAME=CoffeeTraceChaincode
    ports:
      - "3000:3000"
    depends_on:
      - peer0.org1.example.com
      - peer0.org2.example.com

  frontend:
    build: ./frontend
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3000
    ports:
      - "8080:8080"
    depends_on:
      - backend

  ipfs: # Local IPFS node (optional)
    image: ipfs/kubo:latest
    ports:
      - "5001:5001" # API
      - "8081:8080" # Gateway
```

---

## 6. Cấu Trúc Thư Mục Dự Án

```
CoffeeChain/
│
├── network/                         # Fabric network config
│   ├── configtx.yaml                # Channel profile + endorsement policy
│   ├── crypto-config.yaml           # Org, peer, CA, user definitions
│   ├── docker-compose.yaml
│   └── scripts/
│       ├── setup-network.sh         # Tạo channel, join peer, anchor peer
│       ├── deploy-chaincode.sh      # Package → install → approve → commit
│       └── register-users.sh        # Đăng ký user với role attribute
│
├── chaincode/                       # Java chaincode
│   ├── src/main/java/
│   │   ├── CoffeeTraceChaincode.java
│   │   ├── model/
│   │   │   ├── Batch.java           # Có field docType = "batch"
│   │   │   └── BatchEvent.java
│   │   └── util/
│   │       ├── RoleChecker.java     # Đọc role từ cert attribute
│   │       └── LedgerUtils.java     # generateBatchId (UUID), now()
│   └── build.gradle
│
├── backend/                         # Node.js API server + indexer
│   ├── src/
│   │   ├── app.js
│   │   ├── routes/
│   │   │   ├── trace.js             # GET /trace/:publicCode (public)
│   │   │   ├── batches.js           # POST harvest/process/roast/package
│   │   │   ├── transfer.js          # POST transfer/request + accept
│   │   │   └── evidence.js          # Upload + addEvidence
│   │   ├── services/
│   │   │   ├── fabricGateway.js     # Gateway SDK connection + submitTx
│   │   │   ├── indexer.js           # Event listener → DB off-chain
│   │   │   └── qrGenerator.js       # Sinh QR PNG
│   │   └── db/
│   │       └── models.js            # PostgreSQL schema (batch index)
│   └── package.json
│
├── frontend/                        # React / Next.js
│   ├── src/
│   │   ├── pages/
│   │   │   ├── trace/
│   │   │   │   └── [publicCode].jsx # Public trace page
│   │   │   └── dashboard/
│   │   │       ├── farmer.jsx
│   │   │       ├── processor.jsx
│   │   │       ├── roaster.jsx
│   │   │       ├── packager.jsx
│   │   │       └── retailer.jsx
│   │   └── components/
│   │       ├── TraceTimeline.jsx    # Timeline UI component
│   │       └── EvidenceVerifier.jsx # Hash verify component
│   └── package.json
│
└── docs/
    ├── 00_overview.md
    ├── 01_architecture.md
    ├── 02_data_model_chaincode.md
    └── 03_backend_frontend_qr.md
```
