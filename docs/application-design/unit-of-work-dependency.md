# Unit of Work — Dependency Matrix

> **Tạo**: 2026-03-02

---

## Ma Trận Phụ Thuộc

| Unit | Phụ thuộc vào | Cung cấp cho | Loại phụ thuộc |
|------|-------------|-------------|---------------|
| **Unit-1** (Chaincode) | — | Unit-2, Unit-3 | Source of truth: function signatures + event payloads |
| **Unit-2** (BE Core) | Unit-1 (function sigs) | Unit-4, Unit-5 | Cung cấp OpenAPI spec |
| **Unit-3** (BE Infra+DevOps) | Unit-1 (event names), Unit-2 (shared models) | Unit-2 (EventIndexer data) | PostgreSQL data + Docker network |
| **Unit-4** (FE Dashboards) | Unit-2 (OpenAPI spec) | — | API client generated |
| **Unit-5** (FE Auth+Trace) | Unit-2 (OpenAPI spec) | Unit-4 (auth context, API client) | Shared lib/api + auth |

---

## Sơ Đồ Phụ Thuộc

```
Unit-1 (Chaincode)
 │
 ├─[function signatures]──► Unit-2 (BE Core)
 │                               │
 │                               ├─[OpenAPI spec]──► Unit-4 (FE Dashboards)
 │                               │                  (dùng generated API client từ Unit-5)
 │                               └─[OpenAPI spec]──► Unit-5 (FE Auth+Trace)
 │                                                       │
 │                                                       └─[lib/api + AuthContext]──► Unit-4
 │
 └─[event names/payload]──► Unit-3 (BE Infra+DevOps)
                                 │
                                 └─[PostgreSQL read]──► Unit-2 (TraceController)
```

---

## Critical Path

```
Unit-1 compile ──► Định nghĩa OpenAPI spec ──► Unit-4 + Unit-5 bắt đầu
     │                      ▲
     │              Unit-2 bắt đầu (sau khi có signatures)
     │
Unit-3 network up ──► Unit-2 test submit tx thật
```

**Không thể bắt đầu song song ngay từ đầu:**
- Unit-2 cần Unit-1 xong function signatures trước (khoảng tuần 1–2)
- Unit-4 + Unit-5 cần OpenAPI spec từ Unit-2 (khoảng tuần 3–4)

**Có thể song song:**
- Unit-1 + Unit-3 từ ngày 1
- Unit-4 + Unit-5 sau khi có OpenAPI spec
- Unit-2 + Unit-3 từ tuần 2 trở đi

---

## Interface Contracts (cần đồng thuận sớm)

### Contract 1: Chaincode Function Signatures → BE Core (Unit-1 → Unit-2)
**Deadline đồng thuận**: Cuối tuần 1

Ví dụ:
```java
// createHarvestBatch(batchId, publicCode, farmLocation, harvestDate, coffeeVariety, weightKg)
// recordFarmActivity(harvestBatchId, activityType, activityDate, note, evidenceHash, evidenceUri)
// requestTransfer(batchId, targetMSP)
```

### Contract 2: Fabric Event Payload → EventIndexer (Unit-1 → Unit-3)
**Deadline đồng thuận**: Cuối tuần 1

Ví dụ event payload:
```json
{
  "eventName": "BATCH_CREATED",
  "batchId": "...",
  "type": "HARVEST",
  "ownerMSP": "Org1MSP",
  "publicCode": "FARM-20240315-001"
}
```

### Contract 3: OpenAPI Spec → FE (Unit-2 → Unit-4, Unit-5)
**Deadline đồng thuận**: Cuối tuần 3

File: `backend/src/main/resources/openapi.yaml`  
FE generate client: `npx openapi-typescript-codegen --input openapi.yaml --output src/lib/api/generated`

---

## Parallel Development Windows

| Tuần | Unit-1 | Unit-2 | Unit-3 | Unit-4 | Unit-5 |
|------|--------|--------|--------|--------|--------|
| 1–2 | Chaincode core | — (chờ signatures) | Docker Compose network | — | — |
| 2–3 | Chaincode hoàn thiện | BE Core + FabricGateway | EventIndexer + DB | — | — |
| 3–4 | Unit test | OpenAPI spec + Controllers | IPFS + QR | — (chờ spec) | — (chờ spec) |
| 4–6 | Review/fix | API testing | Integration test | Dashboards CRUD | Auth + Trace |
| 6–8 | — | Tích hợp EventIndexer data | Full flow test | Tích hợp BE thật | Tích hợp BE thật |
| 8–12 | — | Bug fixes | Bug fixes | Polish + test | Polish + test |
