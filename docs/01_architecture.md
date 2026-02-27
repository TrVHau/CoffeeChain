# Kiến Trúc Hệ Thống

## 1. Sơ Đồ Kiến Trúc Tổng Thể

```
┌──────────────────────────────────────────────────────────────────┐
│                          FRONTEND                                 │
│  ┌───────────────────────┐    ┌──────────────────────────────┐   │
│  │  Dashboard (by role)  │    │  Public Trace Page /trace/   │   │
│  └──────────┬────────────┘    └──────────────┬───────────────┘   │
└─────────────┼────────────────────────────────┼───────────────────┘
              │ REST API                        │ REST API
              ▼                                 ▼
┌────────────────────────────────────────────────────���─────────────┐
│              BACKEND — Spring Boot (API Server + Indexer)         │
│                                                                   │
│  - Submit transaction lên Fabric qua Gateway SDK                  │
│    (client ký tx — KHÔNG phải source of truth,                   │
│     không thể sửa dữ liệu đã commit trên ledger)                 │
│  - Lắng nghe & index event từ Fabric → DB off-chain              │
│  - Cung cấp REST API truy xuất nhanh                             │
│  - Upload file chứng cứ → tính SHA-256                           │
│  - Tạo & quản lý QR code                                         │
│  - Tái sử dụng model class từ chaincode (Batch.java, ...)        │
└──────────────────┬───────────────────────────────────────────────┘
                   │ Fabric Gateway SDK (gRPC)
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                  HYPERLEDGER FABRIC NETWORK                       │
│  Channel: coffee-traceability-channel                             │
│  Chaincode: CoffeeTraceChaincode (Java)                          │
│                                                                   │
│  ┌──────────────────────┐      ┌────────────────────────────┐   │
│  │        Org1          │      │          Org2              │   │
│  │   (Producer side)    │      │   (Commercial side)        │   │
│  │                      │      │                            │   │
│  │  Roles (cert attr):  │      │  Roles (cert attr):        │   │
│  │  - FARMER            │      │  - PACKAGER                │   │
│  │  - PROCESSOR         │      │  - RETAILER                │   │
│  │  - ROASTER           │      │                            │   │
│  │                      │      │                            │   │
│  │  peer0.org1          │      │  peer0.org2                │   │
│  │  └─ CouchDB          │      │  └─ CouchDB                │   │
│  │  ca.org1             │      │  ca.org2                   │   │
│  └──────────────────────┘      └────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            Orderer (Raft — 1 node, demo)                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
         │ events + getState
         ▼
┌─────────────────────────┐    ┌────────────────────────────────┐
│  Off-chain Index DB      │    │  IPFS / File Server            │
│  (PostgreSQL)            │    │  - Lưu file PDF/ảnh            │
│  - batches               │    │  - Chỉ hash ghi on-chain       │
│  - farm_activities       │    └────────────────────────────────┘
│  - timeline_cache        │
└─────────────────────────┘
```

## 2. Fabric Network Topology

### Demo — Docker Compose

| Thành phần | Số lượng | Chi tiết |
|---|---|---|
| Organization | 2 | Org1 (Producer), Org2 (Commercial) |
| Peer | 1 mỗi org | peer0.org1, peer0.org2 |
| Orderer | 1 (Raft) | orderer.example.com |
| State DB | CouchDB | Mỗi peer một CouchDB riêng |
| Channel | 1 | coffee-traceability-channel |
| CA | 2 | ca.org1, ca.org2 |

### Production — Kubernetes (kế hoạch mở rộng)

| Thành phần | Mở rộng |
|---|---|
| Organization | N org (mỗi doanh nghiệp 1 org) |
| Peer | 2+ mỗi org (High Availability) |
| Orderer | 3 node Raft cluster |
| State DB | CouchDB cluster |

## 3. Mapping Role → Organization

5 role nghiệp vụ phân vào 2 org.
Role lưu dưới dạng **X.509 Certificate Attribute** — Fabric CA cấp
khi đăng ký user.

```
Org1 (Org1MSP) — Producer Side
  ├── farmer_alice      role=FARMER
  ├── processor_bob     role=PROCESSOR
  └── roaster_charlie   role=ROASTER

Org2 (Org2MSP) — Commercial Side
  ├── packager_dave     role=PACKAGER
  └── retailer_eve      role=RETAILER
```

### Fabric CA cấp attribute role

```bash
# Hậu tố :ecert → attribute tự động nhúng vào certificate
# Chaincode đọc trực tiếp, không cần lookup thêm
fabric-ca-client register \
  --id.name farmer_alice \
  --id.secret pw123 \
  --id.type client \
  --id.attrs "role=FARMER:ecert" \
  --tls.certfiles /path/to/ca-cert.pem
```

```java
// Chaincode đọc role từ cert
String role = ctx.getClientIdentity().getAttributeValue("role");
```

## 4. Endorsement Policy

| Loại thao tác | Policy | Lý do |
|---|---|---|
| Tạo batch nội bộ Org1 (Harvest / Processed / Roast) | `OR('Org1MSP.peer')` | Thao tác nội bộ Org1 |
| Tạo PackagedBatch (Org2 nội bộ) | `OR('Org2MSP.peer')` | Org2 đã là owner sau `acceptTransfer`; thao tác nội bộ trên tài sản họ sở hữu |
| `recordFarmActivity` | `OR('Org1MSP.peer')` | Farmer Org1 ghi nhật ký |
| `requestTransfer` | `OR('Org1MSP.peer')` | Org1 khởi tạo yêu cầu bàn giao |
| `acceptTransfer` | `AND('Org1MSP.peer', 'Org2MSP.peer')` | Cả 2 bên xác nhận — owner thực sự chuyển |
| `updateBatchStatus` (IN_STOCK / SOLD) | `OR('Org2MSP.peer')` | Chỉ PackagedBatch; Org2 tự quản lý bán lẻ |
| Query (`evaluateTransaction`) | Không theo endorsement policy write | `evaluateTransaction` không qua ordering; peer trả dữ liệu trực tiếp từ world state |

> **Lưu ý PackagedBatch:**
> `createPackagedBatch` validate `parentBatchId` (RoastBatch) phải có
> `ownerMSP = Org2MSP` — chỉ có sau khi `acceptTransfer` thành công.
> Endorsement `OR Org2` là hợp lý vì đây là thao tác nội bộ Org2
> trên tài sản Org2 đang sở hữu.

## 5. Luồng Dữ Liệu Tổng Thể

### Write Flow

```
1. User nhập thông tin trên Dashboard
2. (Nếu có file) Upload → Backend tính SHA-256 → {hash, uri}
3. Frontend gọi Backend REST API (Spring Boot)
4. Backend submit transaction proposal lên Fabric (Gateway SDK)
5. Peer(s) endorse theo policy → Orderer commit vào ledger
6. Chaincode cập nhật world state (CouchDB) + emit Event
7. Backend EventListener bắt Event → cập nhật DB off-chain
```

### Farm Activity Flow

```
1. Farmer vào Dashboard → chọn HarvestBatch → "Thêm hoạt động"
2. Nhập: activityType, activityDate (ngày thực tế, có thể quá khứ),
         note, (tùy chọn) file chứng cứ
3. Backend submit recordFarmActivity(...)
4. Chaincode: kiểm tra role=FARMER + type=HARVEST + ownerMSP khớp
5. Emit FARM_ACTIVITY_RECORDED — KHÔNG lưu world state
6. Indexer bắt event → lưu bảng farm_activities off-chain
```

### Transfer Flow

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
  (đóng gói xong ngay, không qua IN_PROCESS)
  Retailer cập nhật TRANSFERRED → IN_STOCK → SOLD
```

### Read Flow

```
1. Quét QR → /trace/<publicCode>
2. GET /api/trace/<publicCode>
3. Backend:
   a. Query DB index: chain [Packaged→Roast→Processed→Harvest]
   b. Query farm_activities theo harvestBatchId
   c. Gắn ledgerRefs (txId + blockNumber) vào response
4. Frontend render timeline + EvidenceVerifier
```

## 6. Timeline Hiển Thị Cho Người Tiêu Dùng

```
/trace/PKG-20240403-001

📦 [03/04] ĐÓNG GÓI       Org2 — Đà Lạt Coffee Packager
🔥 [01/04] RANG            Org1 — Roastery Cầu Đất  📎 [verify]
🌿 [25/03] SƠ CHẾ          Org1 — Xưởng sơ chế Đà Lạt
🌱 [15/03] THU HOẠCH       Org1 — farmer_alice, Cầu Đất

   └─ 🌾 NHẬT KÝ CANH TÁC
        [01/03] 🐛 Phun thuốc  [tx]
        [15/02] 🌿 Bón phân    [tx]
        [01/02] 🚿 Tưới nước   [tx]
        [10/01] ✂️  Tỉa cành   [tx]

🔗 Dữ liệu nguồn từ Hyperledger Fabric ledger events
   Block #1247 | Tx: abc123...
```