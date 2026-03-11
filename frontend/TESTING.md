# Hướng Dẫn Test — CoffeeChain Frontend (Unit-5)

> Tài liệu này hướng dẫn test thủ công các chức năng đã implement trong Tuần 1–3.
> Có **2 chế độ test**: chỉ Frontend (không cần backend) và Full-stack (cần backend chạy).

---

## Tài Khoản Test

Tất cả tài khoản dùng chung mật khẩu: **`pw123`**

| userId | Mật khẩu | Role | Org |
|--------|---------|------|-----|
| `farmer_alice` | `pw123` | FARMER | Org1 |
| `processor_bob` | `pw123` | PROCESSOR | Org1 |
| `roaster_charlie` | `pw123` | ROASTER | Org1 |
| `packager_dave` | `pw123` | PACKAGER | Org2 |
| `retailer_eve` | `pw123` | RETAILER | Org2 |

---

## Phần 1 — Test Chỉ Frontend (Không Cần Backend)

Dùng cách này khi **backend chưa chạy** — test UI, routing, validation.

### Bước 1: Chạy Frontend

```bash
cd frontend
npm install        # lần đầu
npm run dev
```

Mở trình duyệt: **http://localhost:3000**

> Nếu thấy lỗi `EADDRINUSE`, đổi port: `npm run dev -- -p 3001`

---

### Bước 2: Test Trang Login (`/login`)

**Truy cập**: http://localhost:3000 → tự động redirect về http://localhost:3000/login

#### Test 2.1 — Form hiển thị đúng
- [ ] Hiển thị logo ☕ CoffeeChain
- [ ] Có 2 ô input: "Tên tài khoản" và "Mật khẩu"
- [ ] Có nút "Đăng nhập"

#### Test 2.2 — Validation ô trống
- [ ] Để trống cả 2 ô → nhấn Đăng nhập
- [ ] Trình duyệt tự báo lỗi "required" (HTML5 validation)

#### Test 2.3 — Lỗi kết nối (BE chưa chạy)
- [ ] Nhập `farmer_alice` / `pw123` → nhấn Đăng nhập
- [ ] ✅ Hiện thông báo lỗi màu đỏ: **"Không thể kết nối máy chủ. Vui lòng thử lại."**
- [ ] Loading spinner xuất hiện rồi tắt

#### Test 2.4 — Bảo vệ route (middleware)
- [ ] Đang ở `/login` → truy cập thẳng http://localhost:3000/dashboard/farmer
- [ ] ✅ Tự động redirect về `/login?redirectTo=%2Fdashboard%2Ffarmer`

---

### Bước 3: Test Trang Trace Công Khai (`/trace/[publicCode]`)

**Truy cập**: http://localhost:3000/trace/PKG-TEST-001

#### Test 3.1 — Hiển thị khi BE chưa chạy
- [ ] Hiển thị skeleton loading (3 dòng mờ nhấp nháy) (~1 giây)
- [ ] Sau đó hiển thị: ⚠️ **"Lỗi kết nối"** (màu cam)
- [ ] Không trắng trang, không crash

#### Test 3.2 — URL với mã khác
- [ ] http://localhost:3000/trace/FARM-20240315-001 → skeleton → lỗi kết nối (bình thường)
- [ ] http://localhost:3000/trace/ (không có mã) → Next.js 404 page

---

### Bước 4: Test Unit Tests (Không Cần BE)

```bash
cd frontend
npm test
```

Kết quả mong đợi:
```
PASS src/__tests__/middleware.test.ts
PASS src/__tests__/app/login/LoginPage.test.tsx
PASS src/__tests__/lib/auth/AuthContext.test.tsx

Test Suites: 3 passed
Tests:       X passed
```

---

## Phần 2 — Test Full-Stack (Cần Backend Chạy)

> Yêu cầu: Backend Spring Boot + PostgreSQL đã chạy.
> Hỏi thành viên Unit-2 (BE-Member-2) để lấy hướng dẫn chạy backend.

### Bước 1: Chạy Backend

```bash
cd backend
# Cần PostgreSQL đang chạy trên localhost:5432
# Database: coffeetrace | user: coffeetrace | password: coffeetrace
./mvnw spring-boot:run
# Backend chạy trên http://localhost:8080
```

Kiểm tra backend sống: http://localhost:8080/swagger-ui.html

---

### Bước 2: Cấu Hình Frontend

```bash
cd frontend
# Tạo file .env.local nếu chưa có
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8080" > .env.local
npm run dev
```

---

### Bước 3: Test Đăng Nhập Thật

**Truy cập**: http://localhost:3000/login

#### Test 3.1 — Đăng nhập thành công
| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-----------------|
| 1 | Nhập `farmer_alice` / `pw123` | — |
| 2 | Nhấn Đăng nhập | Loading spinner xuất hiện |
| 3 | — | ✅ Redirect về `/dashboard/farmer` |
| 4 | Mở DevTools → Application → Cookies | Cookie `auth_token` có giá trị JWT |
| 5 | Mở DevTools → Application → localStorage | Key `auth_user` có `{ userId, token, role }` |

#### Test 3.2 — Sai mật khẩu
| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-----------------|
| 1 | Nhập `farmer_alice` / `saiphau` → Đăng nhập | ✅ Lỗi màu đỏ, KHÔNG redirect |

#### Test 3.3 — Các role khác nhau
| userId | Sau đăng nhập redirect về |
|--------|--------------------------|
| `farmer_alice` | `/dashboard/farmer` |
| `processor_bob` | `/dashboard/processor` |
| `roaster_charlie` | `/dashboard/roaster` |
| `packager_dave` | `/dashboard/packager` |
| `retailer_eve` | `/dashboard/retailer` |

---

### Bước 4: Test Đăng Xuất & JWT Interceptor

#### Test 4.1 — Đăng xuất
Sau khi đăng nhập thành công:
- [ ] Mở DevTools → Console → chạy: `localStorage.clear()`
- [ ] Reload trang
- [ ] ✅ Tự động redirect về `/login`

#### Test 4.2 — JWT tự đính kèm
Sau khi đăng nhập:
- [ ] Mở DevTools → Network
- [ ] Thực hiện bất kỳ tác vụ nào gọi API
- [ ] Kiểm tra Request Headers: `Authorization: Bearer <jwt_token>`

---

### Bước 5: Test Trang Trace Công Khai (`/trace`)

> Yêu cầu: Đã có ít nhất 1 `PackagedBatch` trong hệ thống với publicCode biết trước.
> Lấy `publicCode` từ nhóm Unit-2/Unit-3, hoặc insert thẳng vào PostgreSQL (xem bên dưới).

#### Tạo dữ liệu test nhanh (SQL)

```sql
-- Chạy trong PostgreSQL (psql hoặc DBeaver)
-- Kết nối: localhost:5432/coffeetrace, user: coffeetrace, pass: coffeetrace

-- 1. Tạo HarvestBatch
INSERT INTO batches (batch_id, public_code, type, owner_msp, owner_user_id, status, metadata, created_at, updated_at)
VALUES ('batch-harvest-001', 'FARM-20240315-001', 'HARVEST', 'Org1MSP', 'farmer_alice', 'COMPLETED',
        '{"farmLocation":"Cầu Đất, Đà Lạt","harvestDate":"2024-03-15","coffeeVariety":"Arabica","weightKg":"500"}',
        NOW() - INTERVAL '30 days', NOW() - INTERVAL '20 days');

-- 2. Tạo ProcessedBatch
INSERT INTO batches (batch_id, public_code, type, parent_batch_id, owner_msp, owner_user_id, status, metadata, created_at, updated_at)
VALUES ('batch-processed-001', 'PROC-20240320-001', 'PROCESSED', 'batch-harvest-001', 'Org1MSP', 'processor_bob', 'COMPLETED',
        '{"processingMethod":"Washed","startDate":"2024-03-20","endDate":"2024-03-25","facilityName":"Nhà máy Cầu Đất","weightKg":"480"}',
        NOW() - INTERVAL '20 days', NOW() - INTERVAL '15 days');

-- 3. Tạo RoastBatch (có evidence)
INSERT INTO batches (batch_id, public_code, type, parent_batch_id, owner_msp, owner_user_id, status, evidence_hash, evidence_uri, metadata, created_at, updated_at)
VALUES ('batch-roast-001', 'ROAST-20240401-001', 'ROAST', 'batch-processed-001', 'Org1MSP', 'roaster_charlie', 'COMPLETED',
        'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
        'ipfs://QmTestHash123',
        '{"roastProfile":"Medium Roast","roastDate":"2024-04-01","roastDurationMinutes":"12","weightKg":"450"}',
        NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days');

-- 4. Tạo PackagedBatch (đây là batch người dùng quét QR)
INSERT INTO batches (batch_id, public_code, type, parent_batch_id, owner_msp, owner_user_id, status, metadata, created_at, updated_at)
VALUES ('batch-pkg-001', 'PKG-20240403-001', 'PACKAGED', 'batch-roast-001', 'Org2MSP', 'packager_dave', 'SOLD',
        '{"packageWeight":"0.25","packageDate":"2024-04-03","expiryDate":"2025-04-03","packageCount":"100"}',
        NOW() - INTERVAL '8 days', NOW() - INTERVAL '1 day');

-- 5. Thêm farm activities
INSERT INTO farm_activities (harvest_batch_id, activity_type, activity_date, note, tx_id, block_number, recorded_by, recorded_at, created_at)
VALUES
  ('batch-harvest-001', 'WATERING',    '2024-02-01', 'Tưới nước buổi sáng',   'tx-water-001',   100, 'farmer_alice', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
  ('batch-harvest-001', 'FERTILIZING', '2024-02-15', 'Bón phân NPK',           'tx-fert-001',    110, 'farmer_alice', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
  ('batch-harvest-001', 'PESTICIDE',   '2024-03-01', 'Phun thuốc trừ sâu',    'tx-pest-001',    120, 'farmer_alice', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
  ('batch-harvest-001', 'PRUNING',     '2024-01-10', 'Tỉa cành sau thu hoạch', 'tx-prune-001',  90,  'farmer_alice', NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days');

-- 6. Thêm ledger refs
INSERT INTO ledger_refs (batch_id, event_name, tx_id, block_number, created_at) VALUES
  ('batch-harvest-001',  'BATCH_CREATED',        'tx-harvest-create',   101, NOW() - INTERVAL '30 days'),
  ('batch-processed-001','BATCH_CREATED',        'tx-process-create',   111, NOW() - INTERVAL '20 days'),
  ('batch-roast-001',    'BATCH_CREATED',        'tx-roast-create',     121, NOW() - INTERVAL '10 days'),
  ('batch-roast-001',    'EVIDENCE_ADDED',       'tx-evidence-001',     122, NOW() - INTERVAL '9 days'),
  ('batch-pkg-001',      'BATCH_CREATED',        'tx-pkg-create',       131, NOW() - INTERVAL '8 days'),
  ('batch-pkg-001',      'BATCH_SOLD',           'tx-pkg-sold',         140, NOW() - INTERVAL '1 day');
```

#### Test Trace Page với dữ liệu thật

**Truy cập**: http://localhost:3000/trace/PKG-20240403-001

| Kết quả mong đợi | ✓ |
|-----------------|---|
| Tiêu đề hiển thị mã `PKG-20240403-001` | |
| Badge trạng thái hiện "Đã bán" (màu amber) | |
| Bước **ĐÓNG GÓI** hiển thị đầu tiên (newest) | |
| Bước **RANG** hiển thị tiếp theo + nút "🔍 Xác minh hash chứng cứ" | |
| Bước **SƠ CHẾ** với thông tin Cơ sở, Phương pháp | |
| Bước **THU HOẠCH** với nhật ký canh tác (4 dòng, accordion ▼) | |
| Mỗi bước hiển thị Block # và txId 8 ký tự | |
| Footer: "Dữ liệu được xác thực bởi Hyperledger Fabric" | |

#### Test 404 — Mã không tồn tại
**Truy cập**: http://localhost:3000/trace/KHONG-TON-TAI-999
- [ ] ✅ Hiện box đỏ: "Không tìm thấy sản phẩm"
- [ ] Hiện mã không tồn tại đúng

---

### Bước 6: Test EvidenceVerifier

> Yêu cầu: Có batch ROAST với `evidence_uri` là IPFS URI thật.
> Với dữ liệu test SQL trên thì `ipfs://QmTestHash123` là fake → sẽ lỗi fetch (bình thường).

Truy cập trace page, tìm bước RANG:
- [ ] Nút "🔍 Xác minh hash chứng cứ" hiển thị
- [ ] Nhấn vào → hiện "⏳ Đang tải & xác minh…"
- [ ] Nếu IPFS hash fake: hiện "⚠️ Lỗi: …" + nút "Thử lại" ✅ Bình thường
- [ ] Nếu IPFS hash thật + hash khớp: hiện "✅ Hash khớp"
- [ ] Nếu IPFS hash thật + hash sai: hiện "❌ Hash không khớp"

---

## Phần 3 — Test QrScanner

**Truy cập**: http://localhost:3000/trace/test-code (trang trace có QrScanner)

> **Lưu ý**: `QrScanner` là component độc lập — cần được nhúng vào 1 trang để test.
> Hiện tại component đã implement nhưng chưa được đặt vào trang nào (Tuần 3 xong).
> Test bằng cách tạm thời import vào `/trace/[publicCode]/page.tsx` hoặc test riêng.

#### Quyết định dùng QrScanner ở đâu (hỏi nhóm):
- Option A: Đặt button "Quét QR" trên landing page `/`
- Option B: Đặt trên trang `/trace` không có `publicCode`
- Option C: Chỉ dùng manual fallback input (đủ cho demo)

#### Test manual fallback (không cần camera):
- [ ] Nhập `PKG-20240403-001` vào ô text → nhấn "Tra cứu"
- [ ] ✅ Redirect về `/trace/PKG-20240403-001`

---

## Phần 4 — Checklist Nhanh (5 Phút)

Danh sách kiểm tra nhanh khi **không có thời gian**:

```
Frontend chạy được?
  ✅ cd frontend && npm run dev → http://localhost:3000 không báo lỗi

Redirect root hoạt động?
  ✅ http://localhost:3000 → tự redirect /login

Login page render được?
  ✅ Thấy form, logo ☕ CoffeeChain

Middleware bảo vệ route?
  ✅ http://localhost:3000/dashboard/farmer → redirect /login

Trace page render được (dù không có BE)?
  ✅ http://localhost:3000/trace/test → skeleton → lỗi kết nối (không crash)

Unit tests pass?
  ✅ npm test → tất cả PASS
```

---

## Phần 5 — Lỗi Thường Gặp

| Lỗi | Nguyên nhân | Giải pháp |
|-----|-------------|-----------|
| `Module not found: @zxing/browser` | Chưa install | `npm install` |
| `EADDRINUSE port 3000` | Port đang dùng | `npm run dev -- -p 3001` |
| Màn hình trắng sau login | Dashboard role chưa có page | Bình thường — Unit-4 chưa làm |
| `CORS error` trên Network tab | BE chưa config CORS | Hỏi Unit-2 |
| `/api/auth/login 404` | BE chưa chạy | Xem Phần 1 nếu test UI-only |
| Camera không bật | HTTPS required | Dùng localhost (không cần HTTPS) hoặc manual input |
