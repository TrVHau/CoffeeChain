# Unit of Work — Story Map

> **Tạo**: 2026-03-02  
> Mapping: yêu cầu nghiệp vụ (FR) → unit thực thi

---

## Mapping FR → Unit

| FR | Mô tả | Unit | Thành viên |
|----|-------|------|-----------|
| FR-01-1 | Farmer tạo HarvestBatch + metadata | Unit-1 (createHarvestBatch), Unit-2 (POST /api/harvest), Unit-4 (form) | BE1, BE2, FE1 |
| FR-01-2 | Farmer ghi nhật ký canh tác | Unit-1 (recordFarmActivity), Unit-2 (POST /api/harvest/{id}/activity), Unit-3 (EventIndexer→farm_activities), Unit-4 (UI) | BE1, BE2, BE3, FE1 |
| FR-01-3 | Processor tạo ProcessedBatch | Unit-1, Unit-2 (POST /api/processed), Unit-4 | BE1, BE2, FE1 |
| FR-01-4 | Roaster tạo RoastBatch + evidence | Unit-1 (createRoastBatch + addEvidence), Unit-2, Unit-3 (IPFS+SHA256), Unit-4 | BE1, BE2, BE3, FE1 |
| FR-01-5 | Packager acceptTransfer + tạo PackagedBatch + QR | Unit-1 (acceptTransfer + createPackagedBatch), Unit-2, Unit-3 (SBE+QrCodeService), Unit-4 | BE1, BE2, BE3, FE1 |
| FR-01-6 | Retailer cập nhật IN_STOCK → SOLD | Unit-1 (updateBatchStatus), Unit-2, Unit-4 | BE1, BE2, FE1 |
| FR-02-1 | requestTransfer + SBE setup | Unit-1 (SBE logic), Unit-2 | BE1, BE2 |
| FR-02-2 | acceptTransfer AND endorsement | Unit-1 (SBE), Unit-2 (submitAcceptTransfer), Unit-3 (Docker anchor peers) | BE1, BE2, BE3 |
| FR-03-1 | Upload file → SHA-256 → IPFS | Unit-3 (EvidenceService), Unit-2 (POST /api/roast/{id}/evidence) | BE3, BE2 |
| FR-03-2 | Verify hash browser-side | Unit-5 (EvidenceVerifier.tsx) | FE2 |
| FR-04-1 | QR scan → /trace/{publicCode} | Unit-3 (QR generation), Unit-2 (GET /api/trace), Unit-5 (public page) | BE3, BE2, FE2 |
| FR-04-2 | Timeline: chain + farm activities | Unit-3 (PostgreSQL query), Unit-2 (TraceController), Unit-5 (TraceTimeline.tsx) | BE3, BE2, FE2 |
| FR-04-3 | txId + blockNumber trong response | Unit-3 (ledger_refs), Unit-2 (response DTO), Unit-5 (display) | BE3, BE2, FE2 |
| FR-05-1 | Login → redirect theo role | Unit-5 (login page + middleware) | FE2 |
| FR-05-2 | Dashboard theo role | Unit-4 (5 dashboards) | FE1 |
| FR-05-3 | 5 roles (FARMER…RETAILER) | Unit-1 (RoleChecker), Unit-2 (per-user wallet) | BE1, BE2 |
| FR-06-1 | EventIndexer lắng nghe + lưu PostgreSQL | Unit-3 | BE3 |
| FR-06-2 | Bảng batches, farm_activities, ledger_refs | Unit-3 (schema + migrations) | BE3 |
| FR-06-3 | Read ưu tiên PostgreSQL, fallback on-chain | Unit-2 (TraceController) | BE2 |

---

## Ownership Summary

### BE-Member-1 (Unit-1: Chaincode)
- CoffeeTraceChaincode.java — tất cả 13 functions
- Batch.java, JSON.java, RoleChecker.java, LedgerUtils.java
- SBE AND policy trên requestTransfer/acceptTransfer key
- Unit test chaincode với mock Context
- Định nghĩa function signatures + event payloads (input cho BE2, BE3)

### BE-Member-2 (Unit-2: Backend Core)
- FabricGatewayService.java — per-user wallet, submit/evaluate
- 6 Controllers (5 roles + trace)
- DTO classes (request/response)
- OpenAPI spec `openapi.yaml` (input cho FE1, FE2)
- TraceController: đọc PostgreSQL ưu tiên, fallback on-chain
- Application config (`application.yaml`)

### BE-Member-3 (Unit-3: BE Infra + DevOps)
- Docker Compose + 3 scripts (setup-network, deploy-chaincode, register-users)
- EventIndexer.java
- EvidenceService.java (IPFS Kubo + SHA-256)
- QrCodeService.java (ZXing)
- PostgreSQL entities + repositories + Flyway migrations
- Phối hợp với BE2 về test SBE AND (anchor peer config)

### FE-Member-1 (Unit-4: FE Dashboards)
- 5 role dashboard pages (Farmer, Processor, Roaster, Packager, Retailer)
- Tất cả CRUD forms
- Status update actions
- Dùng API client generated từ OpenAPI spec (do FE2 setup)

### FE-Member-2 (Unit-5: FE Auth + Public)
- Login page + AuthContext + middleware
- `/trace/{publicCode}` public page
- TraceTimeline.tsx + EvidenceVerifier.tsx
- `lib/api/` — axios client + generated code từ OpenAPI spec
- Setup shared libs cho Unit-4 dùng

---

## Ghi Chú Chia Sẻ

- **OpenAPI spec** (`openapi.yaml`): BE2 tạo, FE1+FE2 dùng để generate client → cần đồng thuận sớm
- **lib/api/** trong frontend: FE2 setup, FE1 dùng lại → FE2 cần làm trước phần này
- **Docker Compose**: BE3 tạo và maintain, cả team BE dùng để chạy local
- **Shared models** (`BatchEntity`, `FarmActivityEntity`): BE3 tạo, BE2 dùng trong TraceController
