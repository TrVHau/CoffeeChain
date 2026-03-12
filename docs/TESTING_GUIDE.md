# CoffeeChain Backend — Hướng Dẫn Test Endpoint

> **Môi trường**: Docker Desktop + Postman  
> **Backend URL**: `http://localhost:8080`  
> **Swagger UI**: `http://localhost:8080/swagger-ui.html`

---

## MỤC LỤC

1. [Yêu cầu cài đặt](#1-yêu-cầu-cài-đặt)
2. [Khởi động stack Docker](#2-khởi-động-stack-docker)
3. [Thiết lập Postman](#3-thiết-lập-postman)
4. [Tài khoản demo](#4-tài-khoản-demo)
5. [Nhóm 1 — Auth (không cần Fabric)](#5-nhóm-1--auth-không-cần-fabric)
6. [Nhóm 2 — Query & Read-model (không cần Fabric)](#6-nhóm-2--query--read-model-không-cần-fabric)
7. [Nhóm 3 — Farmer endpoints (cần Fabric)](#7-nhóm-3--farmer-endpoints-cần-fabric)
8. [Nhóm 4 — Processor endpoints (cần Fabric)](#8-nhóm-4--processor-endpoints-cần-fabric)
9. [Nhóm 5 — Roaster + Transfer endpoints (cần Fabric)](#9-nhóm-5--roaster--transfer-endpoints-cần-fabric)
10. [Nhóm 6 — Packager endpoints (cần Fabric)](#10-nhóm-6--packager-endpoints-cần-fabric)
11. [Nhóm 7 — Retailer endpoints (cần Fabric)](#11-nhóm-7--retailer-endpoints-cần-fabric)
12. [Nhóm 8 — Public Trace & QR (không cần Fabric, không cần auth)](#12-nhóm-8--public-trace--qr-không-cần-fabric-không-cần-auth)
13. [Dừng và reset stack](#13-dừng-và-reset-stack)
14. [Xử lý lỗi thường gặp](#14-xử-lý-lỗi-thường-gặp)

---

## 1. Yêu cầu cài đặt

| Phần mềm | Version | Ghi chú |
|---|---|---|
| **Docker Desktop** | 4.x trở lên | Phải đang chạy (icon xanh ở taskbar) |
| **Postman** | Bất kỳ | Hoặc dùng Swagger UI thay thế |

---

## 2. Khởi động stack Docker

Mở terminal tại thư mục gốc dự án:

```powershell
cd e:\WINDOW\BTL\ATBM\CoffeeChain\network
```

### Lần đầu (build image từ source):

```powershell
docker compose -f docker-compose.be-only.yaml up --build
```

> Maven sẽ download dependency và compile — mất khoảng 3–5 phút.  
> Các lần sau dùng cache, chỉ ~30 giây.

### Từ lần 2 trở đi:

```powershell
docker compose -f docker-compose.be-only.yaml up -d
```

### Kiểm tra trạng thái:

```powershell
docker compose -f docker-compose.be-only.yaml ps
```

Kết quả mong đợi — **3 container đều `Up`**:

```
NAME       STATUS
postgres   Up (healthy)
ipfs       Up (healthy)
backend    Up
```

### Xác nhận backend sẵn sàng:

```powershell
docker logs backend 2>&1 | Select-String "Started CoffeeTraceApplication"
```

Hoặc mở trình duyệt: **http://localhost:8080/swagger-ui.html**

> **Lưu ý**: Các `WARN` về Fabric/EventIndexer trong log là **bình thường** — backend vẫn chạy đầy đủ tính năng không cần Fabric.

---

## 3. Thiết lập Postman

### 3.1 Tạo Environment

1. Mở Postman → click **Environments** (icon bánh răng hoặc cửa sổ) → **New Environment**
2. Đặt tên: `CoffeeChain Local`
3. Thêm 2 biến:

| Variable | Initial Value | Current Value |
|---|---|---|
| `base_url` | `http://localhost:8080` | `http://localhost:8080` |
| `token` | *(để trống)* | *(để trống — sẽ điền sau khi login)* |

4. **Save** và **chọn environment này** ở dropdown góc phải trên của Postman.

### 3.2 Cách thêm Authorization vào request

> **Lưu ý quan trọng**: Response login trả về token đã có sẵn `Bearer ` ở đầu (`"token": "Bearer eyJ..."`). Vì vậy **KHÔNG** dùng Authorization type "Bearer Token" trong Postman (sẽ bị thêm `Bearer ` lần nữa → thành `Bearer Bearer eyJ...` → 403).

Với mọi endpoint cần auth, thêm **Header thủ công**:

| Key | Value |
|---|---|
| `Authorization` | `{{token}}` |

*(Vào tab **Headers** → thêm dòng trên. Không dùng tab Authorization → Bearer Token.)*

---

## 4. Tài khoản demo

> **Password tất cả đều là `pw123`**

| userId | Role | Org | Quyền |
|---|---|---|---|
| `farmer_alice` | FARMER | Org1MSP | Tạo HarvestBatch, ghi Farm Activity |
| `processor_bob` | PROCESSOR | Org1MSP | Tạo ProcessedBatch |
| `roaster_charlie` | ROASTER | Org1MSP | Tạo RoastBatch, add Evidence, request Transfer |
| `packager_dave` | PACKAGER | Org2MSP | Accept Transfer, tạo PackagedBatch |
| `retailer_eve` | RETAILER | Org2MSP | Cập nhật status IN_STOCK / SOLD |

---

## 5. Nhóm 1 — Auth (không cần Fabric)

### 5.1 Đăng nhập

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

> **Quan trọng**: Copy toàn bộ chuỗi `Bearer eyJ...` (**bao gồm chữ `Bearer ` ở đầu**) và paste vào biến `{{token}}` trong Environment.

**Test sai credentials (HTTP 401):**
```json
{
  "userId": "farmer_alice",
  "password": "wrong"
}
```

**Test thiếu field (HTTP 400):**
```json
{
  "userId": "farmer_alice"
}
```

---

## 6. Nhóm 2 — Query & Read-model (không cần Fabric)

> Cần header: `Authorization: Bearer {{token}}`  
> Khi DB còn trống, các endpoint trả về `[]` hoặc `404` — đây là kết quả **đúng**.

### 6.1 Lấy tất cả batches

```
GET {{base_url}}/api/batches
Authorization: Bearer {{token}}
```

**Response (HTTP 200):** `[]` *(khi DB trống)*

### 6.2 Lọc batches theo type

```
GET {{base_url}}/api/batches?type=HARVEST
GET {{base_url}}/api/batches?type=PROCESSED
GET {{base_url}}/api/batches?type=ROAST
GET {{base_url}}/api/batches?type=PACKAGED
```

### 6.3 Lọc batches theo status

```
GET {{base_url}}/api/batches?status=COMPLETED
GET {{base_url}}/api/batches?status=IN_PROCESS
GET {{base_url}}/api/batches?status=TRANSFER_PENDING
```

### 6.4 Lọc batches theo ownerMSP

```
GET {{base_url}}/api/batches?ownerMSP=Org1MSP
GET {{base_url}}/api/batches?ownerMSP=Org2MSP
```

### 6.5 Lấy chi tiết 1 batch (từ PostgreSQL)

```
GET {{base_url}}/api/batch/{batchId}
Authorization: Bearer {{token}}
```

Thay `{batchId}` bằng ID thực từ kết quả của POST tạo batch.  
**Response (HTTP 404)** khi DB trống — expected.

### 6.6 Lấy chi tiết 1 batch trực tiếp từ Fabric ledger

```
GET {{base_url}}/api/batch/{batchId}?source=chain
Authorization: Bearer {{token}}
```

> Sẽ trả về **HTTP 500** khi không có Fabric network — expected.

---

## 7. Nhóm 3 — Farmer endpoints (cần Fabric)

> Login với `farmer_alice` trước.  
> Không có Fabric → trả về **HTTP 500** — kết quả đúng logic, endpoint hoạt động.

### 7.1 Tạo HarvestBatch

```
POST {{base_url}}/api/harvest
Authorization: Bearer {{token}}
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

**Response mong đợi (khi có Fabric, HTTP 200):**
```json
{
  "batchId": "HARVEST-xxxx-xxxx",
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

### 7.2 Ghi Farm Activity

```
POST {{base_url}}/api/harvest/{batchId}/activity
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body (có evidence):**
```json
{
  "harvestBatchId": "HARVEST-xxxx-xxxx",
  "activityType": "FERTILIZATION",
  "activityDate": "2026-03-05",
  "note": "Bón phân NPK lần 1",
  "evidenceHash": "abc123def456...",
  "evidenceUri": "ipfs://QmXxx..."
}
```

**Body (không có evidence):**
```json
{
  "harvestBatchId": "HARVEST-xxxx-xxxx",
  "activityType": "IRRIGATION",
  "activityDate": "2026-03-06",
  "note": "Tưới nước buổi sáng"
}
```

> `activityType` hợp lệ: `IRRIGATION`, `FERTILIZATION`, `PESTICIDE`, `PRUNING`, `OTHER`

### 7.3 Cập nhật status HarvestBatch

```
PATCH {{base_url}}/api/harvest/{batchId}/status
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body:**
```json
{
  "newStatus": "COMPLETED"
}
```

---

## 8. Nhóm 4 — Processor endpoints (cần Fabric)

> Login với `processor_bob` trước.

### 8.1 Tạo ProcessedBatch

```
POST {{base_url}}/api/process
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body:**
```json
{
  "parentBatchId": "HARVEST-xxxx-xxxx",
  "processingMethod": "Washed",
  "startDate": "2026-03-03",
  "endDate": "2026-03-08",
  "facilityName": "Nhà Máy Sơ Chế Đà Lạt",
  "weightKg": "480.0"
}
```

> `processingMethod` hợp lệ: `Washed`, `Natural`, `Honey`

### 8.2 Cập nhật status ProcessedBatch

```
PATCH {{base_url}}/api/process/{batchId}/status
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body:**
```json
{
  "newStatus": "COMPLETED"
}
```

---

## 9. Nhóm 5 — Roaster + Transfer endpoints (cần Fabric)

> Login với `roaster_charlie` trước.

### 9.1 Tạo RoastBatch

```
POST {{base_url}}/api/roast
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body:**
```json
{
  "parentBatchId": "PROCESSED-xxxx-xxxx",
  "roastProfile": "Medium",
  "roastDate": "2026-03-10",
  "roastDurationMinutes": "15",
  "weightKg": "460.0"
}
```

> `roastProfile` hợp lệ: `Light`, `Medium-Light`, `Medium`, `Dark`

### 9.2 Thêm Evidence vào batch

> Evidence thường được upload lên IPFS trước (qua `POST /api/evidence/upload`), sau đó dùng hash + URI ở đây.

```
POST {{base_url}}/api/roast/{batchId}/evidence
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body:**
```json
{
  "evidenceHash": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "evidenceUri": "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"
}
```

> `evidenceHash` là SHA-256 hexadecimal (64 ký tự).  
> `evidenceUri` là IPFS URI của file evidence đã upload.

### 9.3 Yêu cầu Transfer sang Org2 (Packager)

```
POST {{base_url}}/api/transfer/request
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body:**
```json
{
  "batchId": "ROAST-xxxx-xxxx",
  "toMSP": "Org2MSP"
}
```

---

## 10. Nhóm 6 — Packager endpoints (cần Fabric)

> Login với `packager_dave` trước.

### 10.1 Chấp nhận Transfer (SBE AND — Org1+Org2 endorsement)

```
POST {{base_url}}/api/transfer/accept/{batchId}
Authorization: Bearer {{token}}
```

> Đây là endpoint đặc biệt — chaincode yêu cầu cả 2 tổ chức đồng ký (State-Based Endorsement). Cần Fabric network đầy đủ.

### 10.2 Tạo PackagedBatch

```
POST {{base_url}}/api/package
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body:**
```json
{
  "parentBatchId": "ROAST-xxxx-xxxx",
  "packageWeight": "250",
  "packageDate": "2026-03-11",
  "expiryDate": "2027-03-11",
  "packageCount": "50"
}
```

> `packageWeight` tính bằng gram/gói.

### 10.3 Lấy QR code của batch (PNG image)

```
GET {{base_url}}/api/package/{batchId}/qr
Authorization: Bearer {{token}}
```

**Response**: File PNG của QR code chứa URL trace công khai.

> Trong Postman: chuyển tab **Body** → chọn **Visualize** hoặc lưu file để xem QR.

---

## 11. Nhóm 7 — Retailer endpoints (cần Fabric)

> Login với `retailer_eve` trước.

### 11.1 Cập nhật status batch (IN_STOCK / SOLD)

```
PATCH {{base_url}}/api/retail/{batchId}/status
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Đưa vào kho:**
```json
{
  "newStatus": "IN_STOCK"
}
```

**Đã bán:**
```json
{
  "newStatus": "SOLD"
}
```

---

## 12. Nhóm 8 — Public Trace & QR (không cần Fabric, không cần auth)

> Các endpoint này **mở hoàn toàn** — không cần token, không cần Fabric. Dùng để người tiêu dùng tra cứu nguồn gốc.

### 12.1 Tra cứu nguồn gốc theo publicCode

```
GET {{base_url}}/api/trace/{publicCode}
```

**Response mong đợi (khi có data, HTTP 200):**
```json
{
  "batch": {
    "batchId": "PACKAGED-xxxx",
    "publicCode": "COFFEE-2026-ABC123",
    "type": "PACKAGED",
    "ownerMsp": "Org2MSP",
    "status": "IN_STOCK",
    "metadata": { ... }
  },
  "parentChain": [
    { "type": "ROAST", ... },
    { "type": "PROCESSED", ... },
    { "type": "HARVEST", ... }
  ],
  "farmActivities": [
    {
      "activityType": "FERTILIZATION",
      "activityDate": "2026-03-05",
      "note": "Bón phân NPK",
      "recordedAt": "2026-03-05T08:00:00Z"
    }
  ],
  "ledgerRefs": [
    {
      "eventName": "BATCH_CREATED",
      "txId": "abc123...",
      "blockNumber": 5
    }
  ]
}
```

**Response khi không tìm thấy (HTTP 404):** expected khi DB trống.

### 12.2 Lấy QR code PNG theo publicCode

```
GET {{base_url}}/api/qr/{publicCode}
```

**Response**: File PNG (Content-Type: `image/png`)  
Quét QR code sẽ dẫn đến URL: `http://localhost:3000/trace/{publicCode}`

---

## 13. Dừng và reset stack

### Dừng (giữ data):
```powershell
docker compose -f docker-compose.be-only.yaml stop
```

### Khởi động lại (không build lại):
```powershell
docker compose -f docker-compose.be-only.yaml start
```

### Dừng và **xóa toàn bộ data** (reset DB về trạng thái seed ban đầu):
```powershell
docker compose -f docker-compose.be-only.yaml down -v
```

> Sau `down -v`, lần `up` tiếp theo Flyway sẽ tạo lại schema + seed 5 user.

### Xem log realtime:
```powershell
docker logs -f backend
docker logs -f postgres
```

---

## 14. Xử lý lỗi thường gặp

### Container `backend` không xuất hiện trong `ps`

```powershell
docker compose -f docker-compose.be-only.yaml logs backend
```

Xem error message ở cuối log để chẩn đoán.

---

### HTTP 401 Unauthorized

- Token chưa được set vào biến `{{token}}`
- Token đã hết hạn (mặc định 24 giờ) → Login lại
- Gửi request với user không có quyền đúng role (VD: `farmer_alice` gọi endpoint của PROCESSOR)

---

### HTTP 403 Forbidden

- Đúng token nhưng sai role. Ví dụ:
  - `farmer_alice` (FARMER) gọi `POST /api/process` → 403
  - `processor_bob` (PROCESSOR) gọi `POST /api/harvest` → 403

---

### HTTP 400 Bad Request

- Thiếu field bắt buộc trong body (các field có `@NotBlank`)
- Kiểm tra lại JSON body, đảm bảo đúng tên field

---

### HTTP 500 từ endpoint cần Fabric

- **Bình thường** khi chạy `docker-compose.be-only.yaml` vì không có Fabric network
- Message: `"No Fabric identity loaded for user: ..."` → xác nhận đúng endpoint, chỉ thiếu Fabric

---

### Port 8080 đã bị chiếm

```powershell
netstat -ano | findstr :8080
```

Tìm PID và kill, hoặc đổi port trong `docker-compose.be-only.yaml`:
```yaml
ports:
  - "8090:8080"   # đổi 8080 bên trái thành port khác
```

---

### Swagger UI không load

Kiểm tra backend đang chạy:
```powershell
docker logs backend 2>&1 | Select-String "Started"
```

Nếu chưa thấy dòng `Started CoffeeTraceApplication`, đợi thêm 10–15 giây.

---

## Luồng test đầy đủ (khi có Fabric network)

```
1. Login farmer_alice          → lấy token FARMER
2. POST /api/harvest           → tạo HarvestBatch → ghi batchId vào biến {{harvestId}}
3. POST /api/harvest/{id}/activity  → ghi farm activity
4. PATCH /api/harvest/{id}/status   → status = COMPLETED

5. Login processor_bob         → lấy token PROCESSOR
6. POST /api/process           → tạo ProcessedBatch, parentBatchId = {{harvestId}}
7. PATCH /api/process/{id}/status  → status = COMPLETED

8. Login roaster_charlie       → lấy token ROASTER
9. POST /api/roast             → tạo RoastBatch
10. POST /api/roast/{id}/evidence  → đính kèm evidence
11. POST /api/transfer/request → yêu cầu chuyển sang Org2MSP

12. Login packager_dave        → lấy token PACKAGER
13. POST /api/transfer/accept/{id} → chấp nhận transfer
14. POST /api/package          → tạo PackagedBatch → response có publicCode
15. GET /api/package/{id}/qr   → lấy QR code PNG

16. Login retailer_eve         → lấy token RETAILER
17. PATCH /api/retail/{id}/status  → status = IN_STOCK

18. GET /api/trace/{publicCode}    → xem full provenance chain (không cần auth)
19. GET /api/qr/{publicCode}       → xem QR PNG (không cần auth)
```
