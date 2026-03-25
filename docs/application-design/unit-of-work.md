# Units of Work — CoffeeChain

> **Tạo**: 2026-03-02 | **Phase**: INCEPTION — Units Generation

---

## Tổng Quan

Hệ thống được chia thành **5 units of work** tương ứng với **5 thành viên**.  
Mỗi unit là một tập hợp các module/file có liên kết nghiệp vụ chặt chẽ,  
có thể phát triển tương đối độc lập sau khi interfaces được đồng thuận.

---

## Unit-1: Chaincode

| Thuộc tính | Giá trị |
|-----------|---------|
| **Thành viên** | BE-Member-1 |
| **Layer** | Hyperledger Fabric Chaincode (Java) |
| **Độc lập với** | Unit-2, Unit-3, Unit-4, Unit-5 |
| **Là input của** | Unit-2 (function signatures), Unit-3 (event names) |

### Phạm vi

```
chaincode/
└── src/main/java/com/coffee/trace/chaincode/
    ├── CoffeeTraceChaincode.java        ← toàn bộ smart contract functions
    ├── model/
    │   └── Batch.java                   ← data model (TreeMap metadata)
    └── util/
        ├── JSON.java                    ← serialize/deserialize Gson
        ├── RoleChecker.java             ← role + MSP binding validation
        └── LedgerUtils.java             ← SBE helpers, key generation
```

### Danh sách chức năng cần implement

| Function | Role | Policy |
|----------|------|--------|
| `createHarvestBatch` | FARMER / Org1 | OR(Org1,Org2) |
| `updateBatchStatus` (HARVEST) | FARMER / Org1 | OR(Org1,Org2) |
| `recordFarmActivity` | FARMER / Org1 | OR(Org1,Org2) — emit event only |
| `createProcessedBatch` | PROCESSOR / Org1 | OR(Org1,Org2) |
| `updateBatchStatus` (PROCESSED) | PROCESSOR / Org1 | OR(Org1,Org2) |
| `createRoastBatch` | ROASTER / Org1 | OR(Org1,Org2) |
| `addEvidence` | ROASTER / Org1 | OR(Org1,Org2) |
| `requestTransfer` | ROASTER / Org1 | OR(Org1,Org2) → **set SBE AND** |
| `acceptTransfer` | PACKAGER / Org2 | **SBE AND** (Org1+Org2) |
| `createPackagedBatch` | PACKAGER / Org2 | OR(Org1,Org2) |
| `updateBatchStatus` (IN_STOCK/SOLD) | RETAILER / Org2 | OR(Org1,Org2) |
| `queryBatchByPublicCode` | PUBLIC (evaluate) | — |
| `queryBatchById` | ANY (evaluate) | — |
| `queryBatchesByOwner` | ANY (evaluate) | — |

### Events cần emit

| Event name | Trigger |
|-----------|---------|
| `BATCH_CREATED` | createHarvestBatch, createProcessedBatch, createRoastBatch, createPackagedBatch |
| `BATCH_STATUS_UPDATED` | updateBatchStatus |
| `TRANSFER_REQUESTED` | requestTransfer |
| `TRANSFER_ACCEPTED` | acceptTransfer |
| `EVIDENCE_ADDED` | addEvidence |
| `FARM_ACTIVITY_RECORDED` | recordFarmActivity |
| `BATCH_IN_STOCK` | updateBatchStatus → IN_STOCK |
| `BATCH_SOLD` | updateBatchStatus → SOLD |

### Deliverables

- [ ] `chaincode/` — Maven project với pom.xml
- [ ] Tất cả classes trên compile thành công
- [ ] Unit test: `CoffeeTraceChaincodeTest.java` (mock Context)
- [ ] `chaincode/README.md` — hướng dẫn build + deploy

---

## Unit-2: Backend Core

| Thuộc tính | Giá trị |
|-----------|---------|
| **Thành viên** | BE-Member-2 |
| **Layer** | Spring Boot — Controllers + Fabric Gateway |
| **Phụ thuộc vào** | Unit-1 (function signatures) |
| **Là input của** | Unit-4, Unit-5 (qua OpenAPI spec) |

### Phạm vi

```
backend/src/main/java/com/coffee/trace/
├── config/
│   └── FabricConfig.java               ← YAML → org endpoints, cert paths
├── service/
│   └── FabricGatewayService.java       ← per-user wallet, submit/evaluate
├── controller/
│   ├── FarmerController.java           ← /api/harvest/**
│   ├── ProcessorController.java        ← /api/processed/**
│   ├── RoasterController.java          ← /api/roast/**
│   ├── PackagerController.java         ← /api/packaged/** + acceptTransfer
│   ├── RetailerController.java         ← /api/retail/**
│   └── TraceController.java            ← /api/trace/{publicCode} (public)
└── dto/
    ├── request/                        ← CreateHarvestBatchRequest.java, v.v.
    └── response/                       ← BatchResponse.java, TraceResponse.java
```

### Deliverables

- [ ] `backend/` — Spring Boot project với pom.xml
- [ ] `FabricGatewayService.java` — per-user wallet hoạt động với 5 users mẫu
- [ ] 6 controllers đủ endpoints theo OpenAPI spec
- [ ] `backend/src/main/resources/openapi.yaml` — OpenAPI 3.0 spec (chia sẻ với FE)
- [ ] `application.yaml` — cấu hình Fabric org endpoints + DB
- [ ] Unit test: `FabricGatewayServiceTest.java`
- [ ] `backend/README.md` — hướng dẫn build + run

### API Endpoints chính

| Method | Path | Role | Chaincode fn |
|--------|------|------|--------------|
| POST | `/api/harvest` | FARMER | createHarvestBatch |
| POST | `/api/harvest/{id}/activity` | FARMER | recordFarmActivity |
| PATCH | `/api/harvest/{id}/status` | FARMER | updateBatchStatus |
| POST | `/api/processed` | PROCESSOR | createProcessedBatch |
| PATCH | `/api/processed/{id}/status` | PROCESSOR | updateBatchStatus |
| POST | `/api/roast` | ROASTER | createRoastBatch |
| POST | `/api/roast/{id}/evidence` | ROASTER | addEvidence (+ IPFS) |
| POST | `/api/roast/{id}/transfer` | ROASTER | requestTransfer |
| PATCH | `/api/roast/{id}/accept` | PACKAGER | acceptTransfer |
| POST | `/api/packaged` | PACKAGER | createPackagedBatch |
| GET | `/api/packaged/{id}/qr` | PACKAGER | — (ZXing) |
| PATCH | `/api/retail/{id}/status` | RETAILER | updateBatchStatus |
| GET | `/api/trace/{publicCode}` | PUBLIC | query PostgreSQL + fallback |

---

## Unit-3: Backend Infrastructure + DevOps

| Thuộc tính | Giá trị |
|-----------|---------|
| **Thành viên** | BE-Member-3 |
| **Layer** | EventIndexer + PostgreSQL + IPFS + Network |
| **Phụ thuộc vào** | Unit-1 (event names) |
| **Song song với** | Unit-2 |

### Phạm vi

```
backend/src/main/java/com/coffee/trace/
├── indexer/
│   └── EventIndexer.java               ← Fabric event listener → PostgreSQL
├── service/
│   ├── EvidenceService.java            ← SHA-256 + IPFS upload/download
│   └── QrCodeService.java              ← ZXing QR generation
├── repository/
│   ├── BatchRepository.java
│   ├── FarmActivityRepository.java
│   └── LedgerRefRepository.java
└── entity/
    ├── BatchEntity.java
    ├── FarmActivityEntity.java
    └── LedgerRefEntity.java

network/
├── configtx.yaml
├── crypto-config.yaml
├── docker-compose.yaml                 ← Fabric + CouchDB + PostgreSQL + IPFS
└── scripts/
    ├── setup-network.sh
    ├── deploy-chaincode.sh
    └── register-users.sh               ← farmer_alice, processor_bob, ...

backend/src/main/resources/
└── db/migration/
    ├── V1__create_batches.sql
    ├── V2__create_farm_activities.sql
    └── V3__create_ledger_refs.sql
```

### PostgreSQL Schema

| Bảng | Columns chính |
|------|--------------|
| `batches` | batch_id, public_code, type, owner_msp, status, metadata (jsonb), tx_id, block_number |
| `farm_activities` | id, harvest_batch_id, activity_type, activity_date, note, evidence_hash, tx_id, block_number |
| `ledger_refs` | id, batch_id, event_type, tx_id, block_number, created_at |

### Deliverables

- [ ] `network/docker-compose.yaml` hoàn chỉnh (Fabric 2.5 + CouchDB + PostgreSQL + IPFS Kubo)
- [ ] `network/scripts/` — 3 scripts chạy được
- [ ] `EventIndexer.java` — subscribe events, parse, lưu PostgreSQL
- [ ] `EvidenceService.java` — SHA-256 + IPFS Kubo API
- [ ] `QrCodeService.java` — ZXing, trả PNG/SVG
- [ ] Flyway migration files (3 scripts SQL)
- [ ] Integration test: EventIndexer nhận mock event → verify PostgreSQL
- [ ] `network/README.md` — step-by-step bring up network

---

## Unit-4: Frontend Dashboards

| Thuộc tính | Giá trị |
|-----------|---------|
| **Thành viên** | FE-Member-1 |
| **Layer** | Next.js — 5 role dashboards |
| **Phụ thuộc vào** | OpenAPI spec từ Unit-2 |
| **Song song với** | Unit-5 |

### Phạm vi

```
frontend/src/
├── app/
│   └── dashboard/
│       ├── farmer/
│       │   ├── page.tsx                ← danh sách HarvestBatch
│       │   ├── new/page.tsx            ← form tạo HarvestBatch
│       │   └── [id]/
│       │       ├── page.tsx            ← chi tiết + activities
│       │       └── activity/new/page.tsx
│       ├── processor/
│       │   ├── page.tsx
│       │   └── new/page.tsx
│       ├── roaster/
│       │   ├── page.tsx
│       │   └── [id]/
│       │       ├── evidence/page.tsx
│       │       └── transfer/page.tsx
│       ├── packager/
│       │   ├── page.tsx
│       │   └── [id]/
│       │       ├── accept/page.tsx
│       │       └── new-package/page.tsx
│       └── retailer/
│           └── page.tsx
└── components/
    ├── forms/                          ← HarvestBatchForm, ProcessedBatchForm, ...
    ├── tables/                         ← BatchTable, ActivityTable
    └── shared/                        ← StatusBadge, MetadataDisplay
```

### Deliverables

- [ ] 5 role dashboard pages với danh sách + form tạo mới
- [ ] Status update actions (CREATED → IN_PROCESS → COMPLETED)
- [ ] Farm activity list + form per HarvestBatch
- [ ] Evidence upload form (Roaster)
- [ ] requestTransfer form (Roaster) + acceptTransfer button (Packager)
- [ ] QR download button (Packager)
- [ ] Tất cả gọi API qua generated API client từ OpenAPI spec
- [ ] `frontend/README.md`

---

## Unit-5: Frontend Auth + Public Trace + API Integration

| Thuộc tính | Giá trị |
|-----------|---------|
| **Thành viên** | FE-Member-2 |
| **Layer** | Next.js — Auth, /trace, API Layer |
| **Phụ thuộc vào** | OpenAPI spec từ Unit-2 |
| **Song song với** | Unit-4 |

### Phạm vi

```
frontend/src/
├── app/
│   ├── login/
│   │   └── page.tsx                    ← form login, redirect theo role
│   └── trace/
│       └── [publicCode]/
│           └── page.tsx                ← public trace page
├── components/
│   ├── TraceTimeline.tsx               ← timeline component
│   ├── EvidenceVerifier.tsx            ← download + SHA-256 verify
│   └── QrScanner.tsx                  ← (optional) webcam QR scan
├── lib/
│   ├── api/
│   │   ├── generated/                  ← openapi-typescript-codegen output
│   │   └── client.ts                   ← axios instance + auth headers
│   └── auth/
│       ├── AuthContext.tsx             ← React context
│       └── useAuth.ts                  ← hook
└── middleware.ts                       ← Next.js route protection
```

### Deliverables

- [ ] Login page → xác thực với BE → lưu JWT/session → redirect dashboard theo role
- [ ] Next.js middleware bảo vệ `/dashboard/**`
- [ ] Public `/trace/{publicCode}` — không cần login
- [ ] `TraceTimeline.tsx` — render chain steps + farm activities
- [ ] `EvidenceVerifier.tsx` — tải file IPFS, tính SHA-256 browser-side, so sánh
- [ ] `lib/api/generated/` — generate từ `openapi.yaml`
- [ ] `AuthContext` + `useAuth` hook
- [ ] `frontend/README.md` (chung với Unit-4)
