# Kiến Trúc Hệ Thống

## 1. Sơ Đồ Tổng Thể

```
┌──────────────────────────────────────────────────────────────────┐
│                          FRONTEND                                │
│  ┌─────────────────────────┐   ┌──────────────────────────────┐ │
│  │  Dashboard (theo role)  │   │  Public Trace /trace/{code}  │ │
│  └────────────┬────────────┘   └──────────────┬───────────────┘ │
└───────────────┼────────────────────────────────┼────────────────┘
                │ REST API                        │ REST API
                ▼                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│           BACKEND — Spring Boot (API Server + Indexer)           │
│                                                                  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │  REST Controllers│  │ EventIndexer     │  │ EvidenceService│ │
│  │  (submit tx)     │  │ (listen + mirror)│  │ (IPFS + hash)  │ │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬────────┘ │
│           │                     │                     │          │
│           └──────────┬──────────┘                     │          │
│                      │ Fabric Gateway SDK (gRPC)       │          │
└──────────────────────┼─────────────────────────────────┼─────────┘
                       │                                 │
                       ▼                                 ▼
┌──────────────────────────────────────────────────┐  ┌──────────┐
│           HYPERLEDGER FABRIC NETWORK             │  │   IPFS   │
│  Channel: coffee-traceability-channel            │  │ (files)  │
│  Chaincode: CoffeeTraceChaincode (Java)          │  └──────────┘
│                                                  │
│  ┌───────────────────┐   ┌──────────────────┐   │
│  │       Org1        │   │       Org2        │   │
│  │  (Producer side)  │   │ (Commercial side) │   │
│  │  peer0.org1       │   │  peer0.org2       │   │
│  │  └─ CouchDB       │   │  └─ CouchDB       │   │
│  │  ca.org1          │   │  ca.org2          │   │
│  └───────────────────┘   └──────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │        Orderer — Raft (1 node demo)      │   │
│  └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
                       │ events + evaluateTransaction
                       ▼
        ┌──────────────────────────┐
        │  PostgreSQL (off-chain)  │
        │  - batches               │
        │  - farm_activities       │
        │  - ledger_refs           │
        └──────────────────────────┘
```

---

## 2. Fabric Network Topology

### Demo — Docker Compose

| Thành phần | Số lượng | Chi tiết |
|------------|----------|---------|
| Organization | 2 | Org1 (Producer), Org2 (Commercial) |
| Peer | 1 mỗi org | peer0.org1, peer0.org2 |
| Orderer | 1 (Raft) | orderer.example.com |
| State DB | CouchDB | Mỗi peer một CouchDB riêng |
| Channel | 1 | coffee-traceability-channel |
| CA | 2 | ca.org1, ca.org2 |

### Production — Kubernetes (kế hoạch)

| Thành phần | Mở rộng |
|------------|---------|
| Organization | N org (mỗi doanh nghiệp 1 org) |
| Peer | 2+ mỗi org (High Availability) |
| Orderer | 3 node Raft cluster |
| State DB | CouchDB cluster |

---

## 3. Luồng Dữ Liệu

### 3.1 Write Flow (Ghi dữ liệu)

```
1. User nhập thông tin trên Dashboard
2. (Nếu có file) Upload → Backend tính SHA-256 → {hash, uri}
3. Frontend gọi Backend REST API
4. Backend submit transaction → Fabric Gateway SDK (gRPC)
5. Peer(s) endorse theo policy → Orderer → commit vào ledger
6. Chaincode cập nhật world state (CouchDB) + emit Event
7. Backend EventIndexer bắt Event → cập nhật PostgreSQL off-chain
```

### 3.2 Farm Activity Flow

```
1. Farmer vào Dashboard → chọn HarvestBatch → "Thêm hoạt động"
2. Nhập: activityType, activityDate, note, (tùy chọn) file chứng cứ
3. Backend submit recordFarmActivity(...)
4. Chaincode: kiểm tra role=FARMER, type=HARVEST, ownerMSP khớp
5. Emit FARM_ACTIVITY_RECORDED — KHÔNG lưu world state
6. EventIndexer bắt event → lưu bảng farm_activities (PostgreSQL)
```

### 3.3 Transfer Flow (Bàn giao Org1 → Org2)

```
Bước 1 — Org1 (OR Org1MSP.peer):
  requestTransfer(batchId, "Org2MSP")
  → status = TRANSFER_PENDING, pendingToMSP = Org2MSP

Bước 2 — Org2 (AND Org1MSP.peer + Org2MSP.peer):
  acceptTransfer(batchId)
  → Fabric tự gom endorsement từ cả 2 peer
  → ownerMSP = Org2MSP, status = TRANSFERRED

Sau bước 2:
  Packager (Org2) tạo PackagedBatch — status khởi tạo = COMPLETED
  Retailer cập nhật TRANSFERRED → IN_STOCK → SOLD
```

### 3.4 Read Flow (Truy xuất công khai)

```
1. Quét QR → /trace/<publicCode>
2. GET /api/trace/<publicCode>
3. Backend:
   a. Query PostgreSQL: chain [Packaged → Roast → Processed → Harvest]
   b. Query farm_activities theo harvestBatchId
   c. Gắn ledgerRefs (txId + blockNumber) vào response
   d. Fallback: evaluateTransaction(queryBatchByPublicCode) nếu DB lag
4. Frontend render timeline + EvidenceVerifier
```

---

## 4. Cấu Trúc Thư Mục Dự Án

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
│   ├── src/main/java/com/coffee/trace/chaincode/
│   │   ├── CoffeeTraceChaincode.java
│   │   ├── model/
│   │   │   └── Batch.java
│   │   └── util/
│   │       ├── JSON.java
│   │       ├── RoleChecker.java
│   │       └── LedgerUtils.java
│   └── build.gradle
│
├── backend/
│   ├── src/main/java/com/coffee/trace/
│   │   ├── CoffeeTraceApplication.java
│   │   ├── controller/
│   │   │   ├── TraceController.java
│   │   │   ├── BatchController.java
│   │   │   ├── FarmActivityController.java
│   │   │   ├── TransferController.java
│   │   │   └── EvidenceController.java
│   │   ├── service/
│   │   │   ├── FabricGatewayService.java
│   │   │   ├── EventIndexerService.java
│   │   │   ├── QrGeneratorService.java
│   │   │   └── EvidenceService.java
│   │   ├── repository/
│   │   │   ├── BatchRepository.java
│   │   │   ├── FarmActivityRepository.java
│   │   │   └── LedgerRefRepository.java
│   │   ├── model/
│   │   │   ├── Batch.java
│   │   │   ├── FarmActivity.java
│   │   │   └── TraceResponse.java
│   │   └── config/
│   │       └── FabricConfig.java
│   ├── src/main/resources/
│   │   └── application.yml
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
    ├── 01_system_architecture.md
    ├── 02_roles_and_orgs.md
    ├── 03_data_model.md
    ├── 04_chaincode.md
    ├── 05_backend.md
    ├── 06_frontend_qr.md
    └── 07_deployment.md
```