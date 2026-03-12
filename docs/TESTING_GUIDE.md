# CoffeeChain — Hướng Dẫn Test Endpoint (Postman / curl)

> **Backend URL**: `http://localhost:8080`  
> **Swagger UI**: `http://localhost:8080/swagger-ui.html`  
> **Project path**: `/media/sagito/SHARED/WINDOW/BTL/ATBM/CoffeeChain`  
> **Môi trường đã kiểm tra**: Ubuntu 22.04, Docker Engine 24+

---

## MỤC LỤC

1. [Thiết lập Postman](#1-thiết-lập-postman)
2. [Tài khoản demo](#2-tài-khoản-demo)
3. [Nhóm 1 — Auth (không cần Fabric)](#3-nhóm-1--auth-không-cần-fabric)
4. [Nhóm 2 — Query & Read-model (không cần Fabric)](#4-nhóm-2--query--read-model-không-cần-fabric)
5. [Nhóm 3 — Farmer endpoints (cần Fabric)](#5-nhóm-3--farmer-endpoints-cần-fabric)
6. [Nhóm 4 — Processor endpoints (cần Fabric)](#6-nhóm-4--processor-endpoints-cần-fabric)
7. [Nhóm 5 — Roaster + Transfer endpoints (cần Fabric)](#7-nhóm-5--roaster--transfer-endpoints-cần-fabric)
8. [Nhóm 6 — Packager endpoints (cần Fabric)](#8-nhóm-6--packager-endpoints-cần-fabric)
9. [Nhóm 7 — Retailer endpoints (cần Fabric)](#9-nhóm-7--retailer-endpoints-cần-fabric)
10. [Nhóm 8 — Public Trace & QR (không cần auth, không cần Fabric)](#10-nhóm-8--public-trace--qr-không-cần-auth-không-cần-fabric)
11. [Luồng test đầy đủ — copy-paste 1 lần](#11-luồng-test-đầy-đủ--copy-paste-1-lần)
12. [Xử lý lỗi thường gặp](#12-xử-lý-lỗi-thường-gặp)

---

## 1. Thiết lập Postman

### 1.1 Tạo Environment

1. Mở Postman → **Environments** → **New Environment**
2. Đặt tên: `CoffeeChain Local`
3. Thêm 2 biến:

| Variable | Initial Value |
|---|---|
| `base_url` | `http://localhost:8080` |
| `token` | *(để trống — điền sau khi login)* |

4. **Save** và **chọn environment này** ở dropdown góc phải trên.

### 1.2 Cách gắn token (quan trọng)

> Response login trả về `"token": "Bearer eyJ..."` — đã có sẵn `Bearer ` ở đầu.  
> **KHÔNG** dùng tab **Authorization → Bearer Token** trong Postman (sẽ bị thêm `Bearer ` lần 2 → 403).

Với **mọi request cần auth**, vào tab **Headers** và thêm thủ công:

| Key | Value |
|---|---|
| `Authorization` | `{{token}}` |

### 1.3 Chuẩn bị biến shell TOKEN (cho curl)

```bash
# Chạy 1 lần, dùng được cho toàn bộ session
RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"farmer_alice","password":"pw123"}')

TOKEN=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "Token: ${TOKEN:0:50}..."
```

---

## 2. Tài khoản demo

> Password đăng nhập API tất cả là **`pw123`**

| userId | Role | Org | Quyền chính |
|---|---|---|---|
| `farmer_alice` | FARMER | Org1MSP | Tạo HarvestBatch, ghi Farm Activity |
| `processor_bob` | PROCESSOR | Org1MSP | Tạo ProcessedBatch |
| `roaster_charlie` | ROASTER | Org1MSP | Tạo RoastBatch, thêm Evidence, yêu cầu Transfer |
| `packager_dave` | PACKAGER | Org2MSP | Accept Transfer, tạo PackagedBatch |
| `retailer_eve` | RETAILER | Org2MSP | Cập nhật status IN_STOCK / SOLD |

---

## 3. Nhóm 1 — Auth (không cần Fabric)

### 3.1 Đăng nhập

```
POST {{base_url}}/api/auth/login
Content-Type: application/json
```

**Body:**
```json
{
  "userId": "farmer_alice",
  "password": "pw123"
}
```

**Response mong đợi (HTTP 200):**
```json
{
  "token": "Bearer eyJhbGciOiJIUzM4NiJ9...",
  "userId": "farmer_alice",
  "role": "FARMER",
  "org": "Org1MSP"
}
```

> Copy toàn bộ chuỗi `Bearer eyJ...` (bao gồm chữ `Bearer `) paste vào biến `{{token}}`.

**curl — lưu token tự động:**
```bash
RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"farmer_alice","password":"pw123"}')
echo $RESPONSE | python3 -m json.tool
TOKEN=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
```

**Test sai credentials (HTTP 401):**
```bash
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"farmer_alice","password":"wrong"}' | python3 -m json.tool
```

**Test thiếu field (HTTP 400):**
```bash
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"farmer_alice"}' | python3 -m json.tool
```

---

## 4. Nhóm 2 — Query & Read-model (không cần Fabric)

> Cần header `Authorization: {{token}}`.  
> DB trống sẽ trả về `[]` hoặc `HTTP 404` — **đây là kết quả đúng**.

### 4.1 Lấy tất cả batches

```
GET {{base_url}}/api/batches
Authorization: {{token}}
```

```bash
curl -s http://localhost:8080/api/batches \
  -H "Authorization: $TOKEN" | python3 -m json.tool
```

**Response (HTTP 200):** `[]` khi DB chưa có data.

### 4.2 Lọc batches theo type

```bash
# type: HARVEST | PROCESSED | ROAST | PACKAGED
curl -s "http://localhost:8080/api/batches?type=HARVEST" -H "Authorization: $TOKEN" | python3 -m json.tool
curl -s "http://localhost:8080/api/batches?type=PROCESSED" -H "Authorization: $TOKEN" | python3 -m json.tool
curl -s "http://localhost:8080/api/batches?type=ROAST" -H "Authorization: $TOKEN" | python3 -m json.tool
curl -s "http://localhost:8080/api/batches?type=PACKAGED" -H "Authorization: $TOKEN" | python3 -m json.tool
```

### 4.3 Lọc batches theo status

```bash
# status: CREATED | IN_PROCESS | COMPLETED | TRANSFER_PENDING | IN_STOCK | SOLD
curl -s "http://localhost:8080/api/batches?status=COMPLETED" -H "Authorization: $TOKEN" | python3 -m json.tool
curl -s "http://localhost:8080/api/batches?status=TRANSFER_PENDING" -H "Authorization: $TOKEN" | python3 -m json.tool
```

### 4.4 Lọc batches theo ownerMSP

```bash
curl -s "http://localhost:8080/api/batches?ownerMSP=Org1MSP" -H "Authorization: $TOKEN" | python3 -m json.tool
curl -s "http://localhost:8080/api/batches?ownerMSP=Org2MSP" -H "Authorization: $TOKEN" | python3 -m json.tool
```

### 4.5 Lấy chi tiết 1 batch (từ PostgreSQL read-model)

```
GET {{base_url}}/api/batch/{batchId}
Authorization: {{token}}
```

```bash
# Thay HARVEST-xxxx-xxxx bằng ID thực
curl -s http://localhost:8080/api/batch/HARVEST-xxxx-xxxx \
  -H "Authorization: $TOKEN" | python3 -m json.tool
```

**Response (HTTP 404)** khi không có data — expected.

### 4.6 Lấy chi tiết 1 batch trực tiếp từ Fabric ledger

```
GET {{base_url}}/api/batch/{batchId}?source=chain
Authorization: {{token}}
```

```bash
curl -s "http://localhost:8080/api/batch/HARVEST-xxxx-xxxx?source=chain" \
  -H "Authorization: $TOKEN" | python3 -m json.tool
```

> Trả về **HTTP 500** khi không có Fabric network (Chế độ A) — expected.

---

## 5. Nhóm 3 — Farmer endpoints (cần Fabric)

> Login với `farmer_alice` trước.  
> **Chế độ A (be-only)**: trả về HTTP 500 — bình thường.  
> **Chế độ B (full-stack)**: trả về HTTP 200.

```bash
RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"farmer_alice","password":"pw123"}')
TOKEN=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
```

### 5.1 Tạo HarvestBatch

```
POST {{base_url}}/api/harvest
Authorization: {{token}}
Content-Type: application/json
```

**Body:**
```json
{
  "farmLocation": "Đà Lạt, Lâm Đồng",
  "harvestDate": "2026-03-01",
  "coffeeVariety": "Arabica",
  "weightKg": "500.0"
}
```

**curl:**
```bash
HARVEST_RESP=$(curl -s -X POST http://localhost:8080/api/harvest \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "farmLocation": "Đà Lạt, Lâm Đồng",
    "harvestDate": "2026-03-01",
    "coffeeVariety": "Arabica",
    "weightKg": "500.0"
  }')
echo $HARVEST_RESP | python3 -m json.tool

HARVEST_ID=$(echo $HARVEST_RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['batchId'])")
echo "HarvestBatch ID: $HARVEST_ID"
```

**Response mong đợi (HTTP 200, khi có Fabric):**
```json
{
  "batchId": "HARVEST-abc123-def456",
  "type": "HARVEST",
  "ownerMsp": "Org1MSP",
  "status": "CREATED",
  "metadata": {
    "farmLocation": "Đà Lạt, Lâm Đồng",
    "harvestDate": "2026-03-01",
    "coffeeVariety": "Arabica",
    "weightKg": "500.0"
  }
}
```

### 5.2 Ghi Farm Activity

```
POST {{base_url}}/api/harvest/{batchId}/activity
Authorization: {{token}}
Content-Type: application/json
```

**Body (có evidence):**
```json
{
  "harvestBatchId": "HARVEST-abc123-def456",
  "activityType": "FERTILIZATION",
  "activityDate": "2026-03-05",
  "note": "Bón phân NPK lần 1",
  "evidenceHash": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "evidenceUri": "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"
}
```

**Body (không có evidence):**
```json
{
  "harvestBatchId": "HARVEST-abc123-def456",
  "activityType": "IRRIGATION",
  "activityDate": "2026-03-06",
  "note": "Tưới nước buổi sáng"
}
```

> `activityType` hợp lệ: `IRRIGATION`, `FERTILIZATION`, `PESTICIDE`, `PRUNING`, `OTHER`

**curl:**
```bash
curl -s -X POST http://localhost:8080/api/harvest/$HARVEST_ID/activity \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "harvestBatchId": "'"$HARVEST_ID"'",
    "activityType": "FERTILIZATION",
    "activityDate": "2026-03-05",
    "note": "Bón phân NPK lần 1"
  }' | python3 -m json.tool
```

### 5.3 Cập nhật status HarvestBatch

```
PATCH {{base_url}}/api/harvest/{batchId}/status
Authorization: {{token}}
Content-Type: application/json
```

```bash
curl -s -X PATCH http://localhost:8080/api/harvest/$HARVEST_ID/status \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newStatus": "COMPLETED"}' | python3 -m json.tool
```

> `newStatus` hợp lệ cho HARVEST: `IN_PROCESS`, `COMPLETED`

---

## 6. Nhóm 4 — Processor endpoints (cần Fabric)

> Login với `processor_bob` trước.

```bash
RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"processor_bob","password":"pw123"}')
TOKEN=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
```

### 6.1 Tạo ProcessedBatch

```
POST {{base_url}}/api/process
Authorization: {{token}}
Content-Type: application/json
```

**Body:**
```json
{
  "parentBatchId": "HARVEST-abc123-def456",
  "processingMethod": "Washed",
  "startDate": "2026-03-03",
  "endDate": "2026-03-08",
  "facilityName": "Nhà Máy Sơ Chế Đà Lạt",
  "weightKg": "480.0"
}
```

> `processingMethod` hợp lệ: `Washed`, `Natural`, `Honey`

**curl:**
```bash
PROCESS_RESP=$(curl -s -X POST http://localhost:8080/api/process \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parentBatchId": "'"$HARVEST_ID"'",
    "processingMethod": "Washed",
    "startDate": "2026-03-03",
    "endDate": "2026-03-08",
    "facilityName": "Nhà Máy Sơ Chế Đà Lạt",
    "weightKg": "480.0"
  }')
echo $PROCESS_RESP | python3 -m json.tool
PROCESS_ID=$(echo $PROCESS_RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['batchId'])")
echo "ProcessedBatch ID: $PROCESS_ID"
```

### 6.2 Cập nhật status ProcessedBatch

```bash
curl -s -X PATCH http://localhost:8080/api/process/$PROCESS_ID/status \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newStatus": "COMPLETED"}' | python3 -m json.tool
```

---

## 7. Nhóm 5 — Roaster + Transfer endpoints (cần Fabric)

> Login với `roaster_charlie` trước.

```bash
RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"roaster_charlie","password":"pw123"}')
TOKEN=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
```

### 7.1 Tạo RoastBatch

```
POST {{base_url}}/api/roast
Authorization: {{token}}
Content-Type: application/json
```

**Body:**
```json
{
  "parentBatchId": "PROCESSED-xxx-yyy",
  "roastProfile": "Medium",
  "roastDate": "2026-03-10",
  "roastDurationMinutes": "15",
  "weightKg": "460.0"
}
```

> `roastProfile` hợp lệ: `Light`, `Medium-Light`, `Medium`, `Dark`

**curl:**
```bash
ROAST_RESP=$(curl -s -X POST http://localhost:8080/api/roast \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parentBatchId": "'"$PROCESS_ID"'",
    "roastProfile": "Medium",
    "roastDate": "2026-03-10",
    "roastDurationMinutes": "15",
    "weightKg": "460.0"
  }')
echo $ROAST_RESP | python3 -m json.tool
ROAST_ID=$(echo $ROAST_RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['batchId'])")
echo "RoastBatch ID: $ROAST_ID"
```

### 7.2 Thêm Evidence vào RoastBatch

```
POST {{base_url}}/api/roast/{batchId}/evidence
Authorization: {{token}}
Content-Type: application/json
```

**Body:**
```json
{
  "evidenceHash": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "evidenceUri": "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"
}
```

> `evidenceHash` = SHA-256 hex (64 ký tự).  
> `evidenceUri` = IPFS URI sau khi upload file lên IPFS (qua `POST /api/evidence/upload`).

**curl:**
```bash
curl -s -X POST http://localhost:8080/api/roast/$ROAST_ID/evidence \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "evidenceHash": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "evidenceUri": "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"
  }' | python3 -m json.tool
```

### 7.3 Upload Evidence lên IPFS (tùy chọn)

```
POST {{base_url}}/api/evidence/upload
Authorization: {{token}}
Content-Type: multipart/form-data
```

**Postman**: Body → form-data → thêm key `file`, chọn Type = File, chọn file từ máy.

**curl:**
```bash
curl -s -X POST http://localhost:8080/api/evidence/upload \
  -H "Authorization: $TOKEN" \
  -F "file=@/path/to/your/evidence-file.pdf" | python3 -m json.tool
```

**Response mong đợi:**
```json
{
  "cid": "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
  "uri": "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
  "sha256": "a1b2c3d4e5f6..."
}
```

### 7.4 Yêu cầu Transfer sang Org2

```
POST {{base_url}}/api/transfer/request
Authorization: {{token}}
Content-Type: application/json
```

**Body:**
```json
{
  "batchId": "ROAST-xxx-yyy",
  "toMSP": "Org2MSP"
}
```

**curl:**
```bash
curl -s -X POST http://localhost:8080/api/transfer/request \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "'"$ROAST_ID"'",
    "toMSP": "Org2MSP"
  }' | python3 -m json.tool
```

**Response mong đợi (HTTP 200):**
```json
{
  "batchId": "ROAST-xxx-yyy",
  "status": "TRANSFER_PENDING",
  "toMSP": "Org2MSP"
}
```

---

## 8. Nhóm 6 — Packager endpoints (cần Fabric)

> Login với `packager_dave` trước.

```bash
RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"packager_dave","password":"pw123"}')
TOKEN=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
```

### 8.1 Chấp nhận Transfer

```
POST {{base_url}}/api/transfer/accept/{batchId}
Authorization: {{token}}
```

```bash
curl -s -X POST http://localhost:8080/api/transfer/accept/$ROAST_ID \
  -H "Authorization: $TOKEN" | python3 -m json.tool
```

> Endpoint này yêu cầu endorsement từ cả 2 org (State-Based Endorsement AND policy).  
> Chỉ hoạt động ở Chế độ B — sẽ fail HTTP 500 ở chế độ be-only.

### 8.2 Tạo PackagedBatch

```
POST {{base_url}}/api/package
Authorization: {{token}}
Content-Type: application/json
```

**Body:**
```json
{
  "parentBatchId": "ROAST-xxx-yyy",
  "packageWeight": "250",
  "packageDate": "2026-03-11",
  "expiryDate": "2027-03-11",
  "packageCount": "50"
}
```

> `packageWeight`: gram/gói. `packageCount`: số lượng gói.

**curl:**
```bash
PACKAGE_RESP=$(curl -s -X POST http://localhost:8080/api/package \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parentBatchId": "'"$ROAST_ID"'",
    "packageWeight": "250",
    "packageDate": "2026-03-11",
    "expiryDate": "2027-03-11",
    "packageCount": "50"
  }')
echo $PACKAGE_RESP | python3 -m json.tool

PACKAGE_ID=$(echo $PACKAGE_RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['batchId'])")
PUBLIC_CODE=$(echo $PACKAGE_RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['publicCode'])")
echo "PackagedBatch ID: $PACKAGE_ID"
echo "Public code: $PUBLIC_CODE"
```

**Response mong đợi (HTTP 200):**
```json
{
  "batchId": "PACKAGED-xxx-yyy",
  "publicCode": "COFFEE-2026-ABC123",
  "type": "PACKAGED",
  "ownerMsp": "Org2MSP",
  "status": "CREATED",
  "metadata": {
    "packageWeight": "250",
    "packageDate": "2026-03-11",
    "expiryDate": "2027-03-11",
    "packageCount": "50"
  }
}
```

### 8.3 Lấy QR code (PNG image)

```
GET {{base_url}}/api/package/{batchId}/qr
Authorization: {{token}}
```

**Postman**: Gửi request → tab **Body** → click **Send and Download** để lưu file PNG.

**curl:**
```bash
curl -s http://localhost:8080/api/package/$PACKAGE_ID/qr \
  -H "Authorization: $TOKEN" \
  --output qr_code.png && xdg-open qr_code.png 2>/dev/null || true
```

---

## 9. Nhóm 7 — Retailer endpoints (cần Fabric)

> Login với `retailer_eve` trước.

```bash
RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"retailer_eve","password":"pw123"}')
TOKEN=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
```

### 9.1 Cập nhật status batch (IN_STOCK / SOLD)

```
PATCH {{base_url}}/api/retail/{batchId}/status
Authorization: {{token}}
Content-Type: application/json
```

**Đưa vào kho:**
```bash
curl -s -X PATCH http://localhost:8080/api/retail/$PACKAGE_ID/status \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newStatus": "IN_STOCK"}' | python3 -m json.tool
```

**Đánh dấu đã bán:**
```bash
curl -s -X PATCH http://localhost:8080/api/retail/$PACKAGE_ID/status \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newStatus": "SOLD"}' | python3 -m json.tool
```

---

## 10. Nhóm 8 — Public Trace & QR (không cần auth, không cần Fabric)

> Các endpoint **hoàn toàn mở** — không cần token, không cần Fabric. Dành cho người tiêu dùng tra cứu.

### 10.1 Tra cứu nguồn gốc theo publicCode

```
GET {{base_url}}/api/trace/{publicCode}
```

```bash
curl -s http://localhost:8080/api/trace/$PUBLIC_CODE | python3 -m json.tool
```

**Response mong đợi (HTTP 200, khi có data):**
```json
{
  "batch": {
    "batchId": "PACKAGED-xxx",
    "publicCode": "COFFEE-2026-ABC123",
    "type": "PACKAGED",
    "ownerMsp": "Org2MSP",
    "status": "IN_STOCK"
  },
  "parentChain": [
    { "type": "ROAST", "batchId": "ROAST-...", "status": "COMPLETED" },
    { "type": "PROCESSED", "batchId": "PROCESSED-...", "status": "COMPLETED" },
    { "type": "HARVEST", "batchId": "HARVEST-...", "status": "COMPLETED" }
  ],
  "farmActivities": [
    {
      "activityType": "FERTILIZATION",
      "activityDate": "2026-03-05",
      "note": "Bón phân NPK lần 1",
      "recordedAt": "2026-03-05T08:00:00Z"
    }
  ],
  "ledgerRefs": [
    { "eventName": "BATCH_CREATED", "txId": "abc123", "blockNumber": 5 }
  ]
}
```

**HTTP 404** khi không có data — expected khi DB trống.

### 10.2 Lấy QR code PNG theo publicCode

```
GET {{base_url}}/api/qr/{publicCode}
```

```bash
curl -s "http://localhost:8080/api/qr/$PUBLIC_CODE" --output public_qr.png
xdg-open public_qr.png 2>/dev/null || true
```

> Quét QR code sẽ dẫn tới: `http://localhost:3000/trace/{publicCode}`

---

## 11. Luồng test đầy đủ — copy-paste 1 lần

> Chạy từng block theo thứ tự trong terminal bash.  
> **Yêu cầu**: Chế độ B đang chạy (setup-network + deploy-chaincode + register-users + backend up).

```bash
BASE="http://localhost:8080"

# ── 1. Farmer: tạo HarvestBatch ──────────────────────────────────────────
R=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"farmer_alice","password":"pw123"}')
TOKEN_FARMER=$(echo $R | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "[1] Farmer logged in"

R=$(curl -s -X POST $BASE/api/harvest \
  -H "Authorization: $TOKEN_FARMER" \
  -H "Content-Type: application/json" \
  -d '{"farmLocation":"Đà Lạt, Lâm Đồng","harvestDate":"2026-03-01","coffeeVariety":"Arabica","weightKg":"500.0"}')
HARVEST_ID=$(echo $R | python3 -c "import sys,json; print(json.load(sys.stdin)['batchId'])")
echo "[1] HarvestBatch: $HARVEST_ID"

curl -s -X POST $BASE/api/harvest/$HARVEST_ID/activity \
  -H "Authorization: $TOKEN_FARMER" \
  -H "Content-Type: application/json" \
  -d '{"harvestBatchId":"'"$HARVEST_ID"'","activityType":"FERTILIZATION","activityDate":"2026-03-05","note":"Bón phân NPK"}' > /dev/null
echo "[1] Farm activity recorded"

curl -s -X PATCH $BASE/api/harvest/$HARVEST_ID/status \
  -H "Authorization: $TOKEN_FARMER" \
  -H "Content-Type: application/json" \
  -d '{"newStatus":"COMPLETED"}' > /dev/null
echo "[1] HarvestBatch -> COMPLETED"

# ── 2. Processor: tạo ProcessedBatch ─────────────────────────────────────
R=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"processor_bob","password":"pw123"}')
TOKEN_PROC=$(echo $R | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "[2] Processor logged in"

R=$(curl -s -X POST $BASE/api/process \
  -H "Authorization: $TOKEN_PROC" \
  -H "Content-Type: application/json" \
  -d '{"parentBatchId":"'"$HARVEST_ID"'","processingMethod":"Washed","startDate":"2026-03-03","endDate":"2026-03-08","facilityName":"Nhà Máy Sơ Chế Đà Lạt","weightKg":"480.0"}')
PROCESS_ID=$(echo $R | python3 -c "import sys,json; print(json.load(sys.stdin)['batchId'])")
echo "[2] ProcessedBatch: $PROCESS_ID"

curl -s -X PATCH $BASE/api/process/$PROCESS_ID/status \
  -H "Authorization: $TOKEN_PROC" \
  -H "Content-Type: application/json" \
  -d '{"newStatus":"COMPLETED"}' > /dev/null
echo "[2] ProcessedBatch -> COMPLETED"

# ── 3. Roaster: tạo RoastBatch + yêu cầu Transfer ────────────────────────
R=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"roaster_charlie","password":"pw123"}')
TOKEN_ROAST=$(echo $R | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "[3] Roaster logged in"

R=$(curl -s -X POST $BASE/api/roast \
  -H "Authorization: $TOKEN_ROAST" \
  -H "Content-Type: application/json" \
  -d '{"parentBatchId":"'"$PROCESS_ID"'","roastProfile":"Medium","roastDate":"2026-03-10","roastDurationMinutes":"15","weightKg":"460.0"}')
ROAST_ID=$(echo $R | python3 -c "import sys,json; print(json.load(sys.stdin)['batchId'])")
echo "[3] RoastBatch: $ROAST_ID"

curl -s -X POST $BASE/api/transfer/request \
  -H "Authorization: $TOKEN_ROAST" \
  -H "Content-Type: application/json" \
  -d '{"batchId":"'"$ROAST_ID"'","toMSP":"Org2MSP"}' > /dev/null
echo "[3] Transfer request -> Org2MSP"

# ── 4. Packager: accept Transfer + tạo PackagedBatch ─────────────────────
R=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"packager_dave","password":"pw123"}')
TOKEN_PACK=$(echo $R | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "[4] Packager logged in"

curl -s -X POST $BASE/api/transfer/accept/$ROAST_ID \
  -H "Authorization: $TOKEN_PACK" > /dev/null
echo "[4] Transfer accepted"

R=$(curl -s -X POST $BASE/api/package \
  -H "Authorization: $TOKEN_PACK" \
  -H "Content-Type: application/json" \
  -d '{"parentBatchId":"'"$ROAST_ID"'","packageWeight":"250","packageDate":"2026-03-11","expiryDate":"2027-03-11","packageCount":"50"}')
PACKAGE_ID=$(echo $R | python3 -c "import sys,json; print(json.load(sys.stdin)['batchId'])")
PUBLIC_CODE=$(echo $R | python3 -c "import sys,json; print(json.load(sys.stdin)['publicCode'])")
echo "[4] PackagedBatch: $PACKAGE_ID"
echo "[4] Public code:   $PUBLIC_CODE"

# ── 5. Retailer: đưa vào kho ─────────────────────────────────────────────
R=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"retailer_eve","password":"pw123"}')
TOKEN_RETAIL=$(echo $R | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "[5] Retailer logged in"

curl -s -X PATCH $BASE/api/retail/$PACKAGE_ID/status \
  -H "Authorization: $TOKEN_RETAIL" \
  -H "Content-Type: application/json" \
  -d '{"newStatus":"IN_STOCK"}' > /dev/null
echo "[5] Status -> IN_STOCK"

# ── 6. Public trace (không cần auth) ─────────────────────────────────────
echo ""
echo "=== Provenance chain ==="
curl -s $BASE/api/trace/$PUBLIC_CODE | python3 -m json.tool

echo ""
echo "=== QR Code ==="
curl -s $BASE/api/qr/$PUBLIC_CODE --output ./coffee_qr.png
echo "QR code saved: ./coffee_qr.png"
xdg-open ./coffee_qr.png 2>/dev/null || true
```

---

## 12. Xử lý lỗi thường gặp

### HTTP 401 Unauthorized

- Token chưa được set vào `{{token}}`
- Token hết hạn (mặc định 24h) → Login lại
- Request gửi với user sai role

### HTTP 403 Forbidden

Đúng token nhưng sai role. Ví dụ:

| Endpoint | Role yêu cầu | Lỗi nếu dùng |
|---|---|---|
| `POST /api/harvest` | FARMER | 403 nếu dùng processor_bob |
| `POST /api/process` | PROCESSOR | 403 nếu dùng farmer_alice |
| `POST /api/roast` | ROASTER | 403 nếu dùng packager_dave |
| `POST /api/package` | PACKAGER | 403 nếu dùng farmer_alice |
| `PATCH /api/retail/*/status` | RETAILER | 403 nếu dùng roaster_charlie |

> **Đặc biệt**: Token trong Postman bị thêm `Bearer ` lần 2 nếu dùng Authorization tab → Bearer Token → sẽ thành `Bearer Bearer eyJ...` → 403. Dùng tab Headers thủ công.

### HTTP 400 Bad Request

Thiếu field bắt buộc hoặc giá trị không hợp lệ. Kiểm tra JSON body, đảm bảo đúng tên field.

### HTTP 500 từ endpoint cần Fabric (Chế độ A)

Bình thường khi chạy `docker-compose.be-only.yaml`. Message: `No Fabric identity loaded for user: ...`  
→ Switch sang Chế độ B để test các endpoint này.

### Container `backend` không start

```bash
docker compose -f docker-compose.be-only.yaml logs backend | tail -30
# Lỗi thường gặp: postgres chưa ready → đợi postgres healthy rồi restart backend
docker compose -f docker-compose.be-only.yaml restart backend
```

### Port 8080 đang bị chiếm

```bash
ss -tlnp | grep :8080
sudo kill -9 <PID>
```

### `python3 -m json.tool` báo lỗi / không có python3

```bash
sudo apt install -y python3
# Hoặc dùng jq:
sudo apt install -y jq
curl -s http://localhost:8080/api/batches -H "Authorization: $TOKEN" | jq .
```

### curl trả về HTML thay vì JSON

Thêm header `Accept: application/json`:
```bash
curl -s http://localhost:8080/api/batches \
  -H "Authorization: $TOKEN" \
  -H "Accept: application/json" | python3 -m json.tool
```

### `docker: permission denied` khi không dùng sudo

```bash
sudo usermod -aG docker $USER && newgrp docker
```

### `chmod +x` không có tác dụng (NTFS)

Project trên NTFS không hỗ trợ Unix execute bits. Luôn dùng:
```bash
bash scripts/setup-network.sh
bash scripts/deploy-chaincode.sh
bash scripts/register-users.sh
```
