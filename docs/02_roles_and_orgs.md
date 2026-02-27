# Roles, Organizations & Endorsement Policy

## 1. Mapping Role → Organization

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

---

## 2. Đăng Ký & Enroll User Với Fabric CA

```bash
# Đăng ký farmer — :ecert tự động nhúng attribute vào certificate
fabric-ca-client register --caname ca-org1 \
  --id.name farmer_alice --id.secret pw123 \
  --id.type client \
  --id.attrs "role=FARMER:ecert" \
  --tls.certfiles /crypto/org1/ca/ca.crt

# Enroll để lấy certificate thực sự
fabric-ca-client enroll \
  -u https://farmer_alice:pw123@ca.org1.example.com:7054 \
  --caname ca-org1 \
  -M /crypto/org1/users/farmer_alice/msp \
  --enrollment.attrs "role" \
  --tls.certfiles /crypto/org1/ca/ca.crt

# Tương tự cho processor_bob (role=PROCESSOR), roaster_charlie (role=ROASTER)
# Và packager_dave (role=PACKAGER), retailer_eve (role=RETAILER) trên Org2 CA
```

```java
// Chaincode đọc role từ certificate attribute
String role = ctx.getClientIdentity().getAttributeValue("role");
// → "FARMER" | "PROCESSOR" | "ROASTER" | "PACKAGER" | "RETAILER"
```

> ⚠️ **Backend phải load cert/key của từng user theo role**
> (farmer_alice, processor_bob, ...) — KHÔNG phải Admin cert.
> Xem chi tiết tại `05_backend.md` mục "Per-User Identity".
> Nếu dùng Admin cert, `ownerUserId` / `recordedBy` trên ledger
> sẽ là Admin, không phải tên user thực.

---

## 3. Endorsement Policy — Chaincode-Level vs Function-Level

### Vấn đề cốt lõi

Fabric áp **một policy chung** cho toàn bộ chaincode khi commit.
Nếu commit với `OR('Org1MSP.peer','Org2MSP.peer')`, thì MỌI function
chỉ cần 1 org endorse — kể cả `acceptTransfer`.

**Docs mô tả AND chỉ riêng `acceptTransfer`** — đây là mong muốn
nghiệp vụ, KHÔNG tự động thành ràng buộc crypto chỉ vì viết trong docs.

### Giải pháp: State-Based Endorsement (SBE)

SBE cho phép gắn endorsement policy **trực tiếp lên một key**
trong world state. Policy này được kiểm tra khi có write lên key đó.

```
Chaincode-level policy:  OR('Org1MSP.peer', 'Org2MSP.peer')
                         → đủ cho mọi thao tác thông thường

SBE trên key batchId:    set khi requestTransfer
                         → AND('Org1MSP.peer', 'Org2MSP.peer')
                         → chỉ acceptTransfer mới thỏa (vì write vào key)

Sau acceptTransfer:      xóa SBE hoặc set lại OR
                         → Org2 tiếp tục tự quản lý batch
```

### Bảng Policy Đầy Đủ

| Thao tác | Chaincode policy | SBE trên key | Kết quả thực tế |
|----------|-----------------|--------------|-----------------|
| `createHarvestBatch` | `OR(Org1,Org2)` | Không có | Org1 endorse đủ |
| `createProcessedBatch` | `OR(Org1,Org2)` | Không có | Org1 endorse đủ |
| `createRoastBatch` | `OR(Org1,Org2)` | Không có | Org1 endorse đủ |
| `createPackagedBatch` | `OR(Org1,Org2)` | Không có | Org2 endorse đủ |
| `recordFarmActivity` | `OR(Org1,Org2)` | Không có | Org1 endorse đủ |
| `requestTransfer` | `OR(Org1,Org2)` | **Set AND** trên batchId | Org1 endorse; SBE được ghi |
| `acceptTransfer` | `OR(Org1,Org2)` | **AND đã tồn tại** trên batchId | **Phải có cả Org1 + Org2** |
| `updateBatchStatus` | `OR(Org1,Org2)` | Không có (SBE đã xóa) | Org2 endorse đủ |

> **Tại sao SBE đảm bảo được AND?**
> Khi Fabric validate transaction write vào key `batchId`,
> nó kiểm tra cả chaincode policy VÀ SBE trên key đó.
> SBE = AND → cần cả 2 peer endorse mới commit được.

---

## 4. Quyền Theo Role — Tóm Tắt

| Role | Org | Được phép làm |
|------|-----|---------------|
| FARMER | Org1 | `createHarvestBatch`, `recordFarmActivity` |
| PROCESSOR | Org1 | `createProcessedBatch`, `updateBatchStatus` |
| ROASTER | Org1 | `createRoastBatch`, `addEvidence`, `requestTransfer` |
| PACKAGER | Org2 | `acceptTransfer`, `createPackagedBatch` |
| RETAILER | Org2 | `updateBatchStatus` (IN_STOCK, SOLD) |
| Tất cả | — | `getBatch`, `getTraceChain`, `queryBatch*` (evaluate only) |