# Kiến Trúc Hệ Thống

## 1. Sơ Đồ Kiến Trúc Tổng Thể

```
┌──────────────────────────────────────────────────────────────────┐
│                          FRONTEND                                 │
│  ┌───────────────────────┐    ┌──────────────────────────────┐   │
│  │  Dashboard (by role)  │    │  Public Trace Page /trace/   │   │
│  └──────────┬────────────┘    └──────────────┬───────────────┘   │
└─────────────┼───────────────────────────────-┼───────────────────┘
              │ REST API call                   │ REST API call
              ▼                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                     BACKEND (API Server)                          │
│                                                                   │
│  - Nhận request từ Frontend                                       │
│  - Submit transaction lên Fabric qua Gateway SDK                  │
│    (backend là client ký tx — KHÔNG phải source of truth,        │
│     không thể sửa dữ liệu đã commit trên ledger)                 │
│  - Index event từ Fabric → lưu DB off-chain                      │
│  - Cung cấp REST API truy xuất nhanh                             │
│  - Upload file chứng cứ → tính SHA-256 → trả hash cho Frontend   │
│  - Tạo & quản lý QR code                                         │
└─────��────────────┬───────────────────────────────────────────────┘
                   │ Fabric Gateway SDK (gRPC)
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                  HYPERLEDGER FABRIC NETWORK                       │
│                                                                   │
│  Channel: coffee-traceability-channel                             │
│  Chaincode: CoffeeTraceChaincode (Java)                          │
│                                                                   │
│  ┌──────────────────────┐      ┌──────────────────────────┐      │
│  │        Org1          │      │          Org2            │      │
│  │   (Producer side)    │      │   (Commercial side)      │      │
│  │                      │      │                          │      │
│  │  Roles (cert attr):  │      │  Roles (cert attr):      │      │
│  │  - FARMER            │      │  - PACKAGER              │      │
│  │  - PROCESSOR         │      │  - RETAILER              │      │
│  │  - ROASTER           │      │                          │      │
│  │                      │      │                          │      │
│  │  peer0.org1          │      │  peer0.org2              │      │
│  │  └─ CouchDB          │      │  └─ CouchDB              │      │
│  │  ca.org1             │      │  ca.org2                 │      │
│  └──────────────────────┘      └──────────────────────────┘      │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │            Orderer (Raft — 1 node, demo)                │     │
│  └─────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
                   │ emit events / getState
                   ▼
┌──────────────────────────────┐   ┌────────────────────────────┐
│  Off-chain Index DB          │   │  IPFS / File Server        │
│  (PostgreSQL / MongoDB)      │   │  - Lưu file PDF/ảnh        │
│  - Timeline đã index         │   │  - Chỉ hash ghi on-chain   │
│  - Phục vụ API truy xuất     │   └────────────────────────────┘
└──────────────────────────────┘
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

5 role nghiệp vụ được phân vào 2 org. Role lưu dưới dạng
**X.509 Certificate Attribute** — do **Fabric CA cấp khi đăng ký user**.

```
Org1 (Org1MSP) — Producer Side
  ├── farmer_alice    │ role=FARMER
  ├── processor_bob   │ role=PROCESSOR
  └── roaster_charlie │ role=ROASTER

Org2 (Org2MSP) — Commercial Side
  ├── packager_dave   │ role=PACKAGER
  └── retailer_eve    │ role=RETAILER
```

### Cách Fabric CA cấp attribute role

Khi đăng ký user, admin gọi lệnh:

```bash
# Đăng ký farmer_alice với attribute role=FARMER
fabric-ca-client register \
  --id.name farmer_alice \
  --id.secret pw123 \
  --id.type client \
  --id.attrs "role=FARMER:ecert" \  # :ecert → attribute được nhúng vào cert
  --tls.certfiles /path/to/ca-cert.pem
```

Chaincode đọc attribute từ cert của caller:

```java
String role = ctx.getClientIdentity().getAttributeValue("role");
// → "FARMER", "PROCESSOR", "ROASTER", "PACKAGER", hoặc "RETAILER"
```

> **Lưu ý `:ecert`**: khi đăng ký attribute với hậu tố `:ecert`,
> Fabric CA tự động nhúng attribute đó vào certificate được cấp.
> Chaincode có thể đọc trực tiếp — không cần lookup thêm.

## 4. Endorsement Policy

| Loại thao tác | Policy | Lý do |
|---|---|---|
| Tạo batch mới (nội bộ Org1) | `OR('Org1MSP.peer')` | Thao tác nội bộ, Org1 tự chịu trách nhiệm |
| Tạo batch mới (nội bộ Org2) | `OR('Org2MSP.peer')` | Thao tác nội bộ, Org2 tự chịu trách nhiệm |
| `requestTransfer` | `OR('Org1MSP.peer')` | Org1 khởi tạo yêu cầu bàn giao |
| `acceptTransfer` | `AND('Org1MSP.peer', 'Org2MSP.peer')` | Cả 2 bên xác nhận — owner thực sự chuyển |
| Cập nhật trạng thái IN_STOCK / SOLD | `OR('Org2MSP.peer')` | Org2 tự quản lý bán lẻ |
| Query (read-only) | Không cần endorsement | Truy vấn CouchDB trực tiếp |

> **Tại sao `acceptTransfer` cần AND?**
> Org1 không thể tự ý "đẩy" lô sang Org2.
> Org2 không thể tự ý "kéo" lô từ Org1.
> Cả hai cùng ký → đảm bảo bàn giao có sự đồng thuận rõ ràng.

## 5. Luồng Dữ Liệu Tổng Thể

### Write Flow — Ghi nhận nghiệp vụ

```
1. User nhập thông tin trên Dashboard
2. (Nếu có file) Upload → Backend tính SHA-256 → trả {hash, uri}
3. Frontend gọi Backend REST API
4. Backend submit transaction proposal lên Fabric qua Gateway SDK
5. Peer(s) endorse theo policy → Backend gửi lên Orderer
6. Orderer commit vào ledger
7. Chaincode cập nhật world state (CouchDB) + emit Event
8. Backend Indexer lắng nghe Event → cập nhật DB off-chain
```

> Backend là **client submit tx**, không phải source of truth.
> Dữ liệu đã commit trên ledger là bất biến — backend không thể sửa.

### Transfer Flow — Bàn giao giữa 2 Org

```
Bước 1 — Org1 khởi tạo:
  Roaster gọi POST /api/transfer/request
  → Backend (Org1 identity) submit requestTransfer(batchId, toMSP="Org2MSP")
  → Chaincode lưu status = TRANSFER_PENDING, pendingTo = Org2MSP
  → Emit event TRANSFER_REQUESTED

Bước 2 — Org2 xác nhận:
  Packager gọi POST /api/transfer/accept
  → Backend (Org2 identity) submit acceptTransfer(batchId)
  → Endorsement AND(Org1, Org2) → cả 2 peer endorse
  → Chaincode cập nhật ownerMSP = Org2MSP, status = TRANSFERRED
  → Emit event TRANSFER_ACCEPTED
```

> Chaincode chỉ chuyển owner khi `acceptTransfer` được cả 2 peer endorse.
> `requestTransfer` đơn giản chỉ đánh dấu `TRANSFER_PENDING`.

### Read Flow — Truy xuất cho người tiêu dùng

```
1. Người tiêu dùng quét QR trên bao bì
2. QR → URL: /trace/<publicCode>
3. Frontend gọi GET /api/trace/<publicCode>
4. Backend query DB off-chain index → trả JSON timeline
5. Frontend render timeline đầy đủ
6. (Tùy chọn) Người dùng verify hash chứng cứ so với on-chain
```