# Mô Hình Dữ Liệu

## 1. Tổng Quan

```
World State (CouchDB — on-chain):
┌──────────────────────────────────────────────────────┐
│  Batch (docType: "batch")                            │
│  → type: HARVEST | PROCESSED | ROAST | PACKAGED      │
│  → evidenceHash / evidenceUri (lưu để verify trực tiếp)│
└──────────────────────────────────────────────────────┘

Event Log (Fabric ledger — bất biến, không thể sửa):
┌──────────────────────────────────────────────────────┐
│  BATCH_CREATED                                       │
│  BATCH_STATUS_UPDATED                                │
│  TRANSFER_REQUESTED / TRANSFER_ACCEPTED              │
│  EVIDENCE_ADDED                                      │
│  FARM_ACTIVITY_RECORDED                              │
│  BATCH_IN_STOCK / BATCH_SOLD                         │
└──────────────────────────────────────────────────────┘

Off-chain Index DB (PostgreSQL):
┌──────────────────────────────────────────────────────┐
│  batches         — mirror world state                │
│  farm_activities — từ FARM_ACTIVITY_RECORDED         │
│  ledger_refs     — txId + blockNumber per event      │
└──────────────────────────────────────────────────────┘
```

**Quyết định thiết kế — State vs Event:**

| Dữ liệu | Lưu ở đâu | Lý do |
|---------|-----------|-------|
| Batch snapshot | World state | Query nhanh, đọc được kể cả khi indexer lỗi |
| evidenceHash / evidenceUri | World state | Cần verify trực tiếp, cố định 1 per batch |
| Farm activity | Event only | Số lượng không giới hạn — lưu state làm Batch phình vô hạn |
| Lịch sử chuyển trạng thái | Event only | Indexer xây timeline |

---

## 2. Batch — Cấu Trúc World State

```java
public class Batch {
    private String batchId;
    // UUID do chaincode sinh từ txId + timestamp.
    // Fabric là key-value store — key do chaincode tự đặt.
    // Dùng txId + timestamp đảm bảo unique tuyệt đối.

    private String publicCode;    // VD: FARM-20240315-001 — in lên QR
    private String docType;       // Luôn = "batch" — bắt buộc cho CouchDB rich query

    private String type;          // HARVEST | PROCESSED | ROAST | PACKAGED
    private String parentBatchId; // batchId lô cha; "" nếu là HarvestBatch

    private String ownerMSP;      // MSP org đang sở hữu; đổi sau acceptTransfer
    private String ownerUserId;   // CN của certificate người tạo

    private String status;        // Xem sơ đồ chuyển trạng thái bên dưới
    private String pendingToMSP;  // MSP org nhận khi TRANSFER_PENDING; "" còn lại

    private String createdAt;     // ISO-8601, từ stub.getTxTimestamp()
    private String updatedAt;

    private String evidenceHash;  // SHA-256 file chứng cứ
    private String evidenceUri;   // IPFS CID: "ipfs://Qm..."

    private Map<String, String> metadata; // Dữ liệu nghiệp vụ theo type
}
```

---

## 3. Metadata Theo Loại Batch

```java
// HARVEST
{
  "farmLocation":  "Cầu Đất, Đà Lạt",
  "harvestDate":   "2024-03-15",
  "coffeeVariety": "Arabica Bourbon",
  "weightKg":      "500"
}

// PROCESSED
{
  "processingMethod": "Washed",
  "startDate":        "2024-03-18",
  "endDate":          "2024-03-25",
  "facilityName":     "Xưởng Đà Lạt",
  "weightKg":         "480"
}

// ROAST
{
  "roastProfile":         "Medium-Light",
  "roastDate":            "2024-04-01",
  "roastDurationMinutes": "12",
  "weightKg":             "420"
}

// PACKAGED
{
  "packageWeight": "250g",
  "packageCount":  "100",
  "packagedDate":  "2024-04-03",
  "expiryDate":    "2025-04-03",
  "qrUrl":         "https://trace.example.com/trace/PKG-20240403-001"
}
```

---

## 4. Status & Chuyển Trạng Thái

### Sơ Đồ

```
              ┌──────────┐
              │ CREATED  │  ← HARVEST / PROCESSED / ROAST bắt đầu ở đây
              └────┬─────┘
                   │ updateBatchStatus
              ┌────▼──────┐
              │IN_PROCESS │  optional trong V1 (có thể skip)
              └────┬──────┘
                   │ updateBatchStatus
              ┌────▼──────┐
              │ COMPLETED │  ← PACKAGED khởi tạo thẳng ở đây
              └────┬──────┘
                   │ requestTransfer (OR Org1MSP.peer)
         ┌─────────▼──────────┐
         │  TRANSFER_PENDING  │
         └─────────┬──────────┘
                   │ acceptTransfer (AND Org1+Org2)
              ┌────▼──────┐
              │TRANSFERRED│  ownerMSP đã đổi sang org nhận
              └────┬──────┘
                   │ updateBatchStatus — PACKAGED only (RETAILER)
              ┌────▼──────┐
              │ IN_STOCK  │
              └────┬──────┘
                   │ updateBatchStatus — PACKAGED only (RETAILER)
              ┌────▼──────┐
              │   SOLD    │
              └───────────┘
```

### Quy Tắc Theo Loại Batch

| Batch type | Status hợp lệ |
|------------|---------------|
| HARVEST | `CREATED → (IN_PROCESS) → COMPLETED → TRANSFER_PENDING → TRANSFERRED` |
| PROCESSED | `CREATED → (IN_PROCESS) → COMPLETED → TRANSFER_PENDING → TRANSFERRED` |
| ROAST | `CREATED → (IN_PROCESS) → COMPLETED → TRANSFER_PENDING → TRANSFERRED` |
| PACKAGED | `COMPLETED` *(khởi tạo)* `→ TRANSFER_PENDING → TRANSFERRED → IN_STOCK → SOLD` |

> **[A] IN_PROCESS là optional trong V1:**
> `CREATED → COMPLETED` được phép để giảm thao tác demo.
> Mọi thay đổi status đều emit event → vẫn truy được trách nhiệm
> qua event log dù bỏ qua IN_PROCESS.

> **[B] `TRANSFER_PENDING → TRANSFERRED` KHÔNG nằm trong `updateBatchStatus`:**
> Chỉ xảy ra trong `acceptTransfer` (AND endorsement).
> Nếu để `updateBatchStatus` làm được, 1 bên có thể tự chuyển
> mà không cần sự đồng ý của bên kia.

> **[C] IN_STOCK và SOLD chỉ dành cho PACKAGED:**
> `validateStatusTransition` nhận `batchType` và enforce điều này.
> Chỉ role RETAILER mới được gọi hai transition này.

---

## 5. Farm Activity — Event Only

### Assumption V1

Farm activity được ghi **sau khi tạo HarvestBatch**.
`activityDate` là ngày thực tế — có thể là ngày quá khứ
(nông dân ghi chép lại theo tuần hoặc theo đợt).
`recordedAt` là timestamp blockchain tại thời điểm submit.

### Loại Activity

| activityType | Mô tả |
|---|---|
| `IRRIGATION` | Tưới nước |
| `FERTILIZATION` | Bón phân |
| `PEST_CONTROL` | Phun thuốc bảo vệ thực vật |
| `PRUNING` | Tỉa cành |
| `SHADE_MANAGEMENT` | Quản lý che bóng |
| `SOIL_TEST` | Kiểm tra đất |
| `OTHER` | Khác (ghi rõ trong note) |

### Event Payload — FARM_ACTIVITY_RECORDED

```json
{
  "eventType":      "FARM_ACTIVITY_RECORDED",
  "harvestBatchId": "uuid-harvest-batch",
  "activityType":   "FERTILIZATION",
  "activityDate":   "2024-02-15",
  "note":           "NPK 16-16-8, 200g/cây, toàn vườn lô A",
  "evidenceHash":   "sha256abc...",
  "evidenceUri":    "ipfs://QmXyz...",
  "recordedBy":     "farmer_alice",
  "recordedAt":     "2024-03-16T08:30:00Z",
  "txId":           "abc123..."
}
```

---

## 6. Toàn Bộ Events On-Chain

| Event | Khi nào emit | Payload chính |
|-------|-------------|---------------|
| `BATCH_CREATED` | Tạo bất kỳ loại batch | batchId, type, ownerMSP, publicCode, txId |
| `BATCH_STATUS_UPDATED` | updateBatchStatus (trừ IN_STOCK/SOLD) | batchId, oldStatus, newStatus, txId |
| `BATCH_IN_STOCK` | updateBatchStatus → IN_STOCK | batchId, txId |
| `BATCH_SOLD` | updateBatchStatus → SOLD | batchId, txId |
| `TRANSFER_REQUESTED` | requestTransfer | batchId, fromMSP, toMSP, txId |
| `TRANSFER_ACCEPTED` | acceptTransfer | batchId, fromMSP, toMSP, txId, blockNumber |
| `EVIDENCE_ADDED` | addEvidence | batchId, hash, uri, txId |
| `FARM_ACTIVITY_RECORDED` | recordFarmActivity | harvestBatchId, activityType, activityDate, note, txId |

> `txId` và `blockNumber` được đính kèm mọi event.
> Đây là cơ sở của `verifiedOnChain: true` trong TraceResponse.

---

## 7. Schema PostgreSQL (Off-chain)

```sql
-- Mirror world state
CREATE TABLE batches (
    batch_id        VARCHAR PRIMARY KEY,
    public_code     VARCHAR UNIQUE,
    doc_type        VARCHAR DEFAULT 'batch',
    type            VARCHAR,        -- HARVEST|PROCESSED|ROAST|PACKAGED
    parent_batch_id VARCHAR,
    owner_msp       VARCHAR,
    owner_user_id   VARCHAR,
    status          VARCHAR,
    pending_to_msp  VARCHAR,
    evidence_hash   VARCHAR,
    evidence_uri    VARCHAR,
    metadata        JSONB,
    created_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ
);

-- Farm activities (từ FARM_ACTIVITY_RECORDED event)
CREATE TABLE farm_activities (
    id              BIGSERIAL PRIMARY KEY,
    harvest_batch_id VARCHAR NOT NULL,
    activity_type   VARCHAR,
    activity_date   DATE,
    note            TEXT,
    evidence_hash   VARCHAR,
    evidence_uri    VARCHAR,
    recorded_by     VARCHAR,
    recorded_at     TIMESTAMPTZ,
    tx_id           VARCHAR,
    block_number    BIGINT
);

-- Ledger references (txId + blockNumber per event type per batch)
CREATE TABLE ledger_refs (
    id           BIGSERIAL PRIMARY KEY,
    batch_id     VARCHAR NOT NULL,
    event_type   VARCHAR,   -- batchCreated|transferAccepted|latestStatusUpdate
    tx_id        VARCHAR,
    block_number BIGINT,
    recorded_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_batches_public_code  ON batches(public_code);
CREATE INDEX idx_batches_owner_msp    ON batches(owner_msp);
CREATE INDEX idx_batches_status       ON batches(status);
CREATE INDEX idx_farm_harvest_batch   ON farm_activities(harvest_batch_id);
CREATE INDEX idx_ledger_refs_batch    ON ledger_refs(batch_id);
```

---

## 8. CouchDB Rich Query — Quy Tắc

```javascript
// ✅ ĐÚNG — bắt buộc có docType để tránh lẫn document khác
{ "selector": { "docType": "batch", "status": "IN_STOCK" } }
{ "selector": { "docType": "batch", "publicCode": "PKG-20240403-001" } }
{ "selector": { "docType": "batch", "ownerMSP": "Org2MSP" } }

// ❌ SAI — thiếu docType, có thể trả về document sai type
{ "selector": { "status": "IN_STOCK" } }
```