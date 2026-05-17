# CoffeeChain Platform — Changelog & Bug Fix Summary

> Ngày cập nhật: 2026-05-17

---

## Tóm tắt 6 lỗi đã sửa

---

### 1. 📦 Giới hạn kích thước ảnh minh chứng (Bug #1)

**Vấn đề:** Ảnh quá lớn vẫn được ghi nhận vào DB dù hệ thống báo lỗi, vì kiểm tra kích thước không được thực thi trước khi gọi API.

**Đã sửa:**
- Tạo module mới: `src/lib/validation/file.ts`
  - Hằng số `MAX_EVIDENCE_FILE_SIZE = 10 MB`
  - Cho phép: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
  - Hàm `validateEvidenceFile(file)` trả về `{ ok, error }` trước khi gọi bất kỳ API nào
- Tích hợp kiểm tra vào **tất cả điểm upload**:
  - `farmer/page.tsx` — Tạo Harvest batch
  - `farmer/[id]/page.tsx` — Ghi nhật ký canh tác
  - `processor/page.tsx` — Tạo Processed batch
  - `roaster/page.tsx` — Tạo Roast batch
  - `[role]/update/page.tsx` — Cập nhật trạng thái, upload Roast evidence, Packaging evidence
- **Nếu file quá lớn hoặc sai định dạng → lỗi được hiển thị ngay, không gọi API, không ghi DB**
- File input nay hiển thị kích thước file đã chọn (MB) để người dùng biết

---

### 2. 🔢 Kiểm tra điều kiện nhập trường số (Bug #2)

**Vấn đề:** Các trường khối lượng, thời gian rang không giới hạn giá trị, có thể nhập chữ hoặc số siêu lớn.

**Đã sửa:**
- Cập nhật `src/lib/validation/weight.ts`:
  - Giới hạn khối lượng: `MIN = 0.001 kg`, `MAX = 100,000 kg`
  - Thêm hàm `getDurationValidationError()`: kiểm tra thời gian rang (số nguyên, 1–600 phút)
- Cập nhật tất cả `<input type="number">` liên quan:
  - Thêm `min`, `max`, `step`, `inputMode` attrs
  - Trường khối lượng: `min="0.001" max="100000" inputMode="decimal"`
  - Trường thời gian rang: `type="number" min="1" max="600" step="1" inputMode="numeric"`

---

### 3. 🔐 Bảo mật Cookie xác thực (Bug #3)

**Vấn đề:** Frontend tự set cookie `auth_token`, `user_role`, `user_org` qua `document.cookie` không có `HttpOnly` hay `Secure`, cho phép JS đọc/sửa cookie.

**Đã sửa:**
- Tạo Next.js API route mới: `src/app/api/auth/set-session/route.ts`
  - `POST /api/auth/set-session` → set `auth_token` với `HttpOnly; SameSite=Lax; Secure (production)`
  - `DELETE /api/auth/set-session` → xóa cookie khi logout
- Cập nhật `src/lib/auth/AuthContext.tsx`:
  - **Xóa** 3 dòng `document.cookie = "..."` trực tiếp
  - Thay bằng gọi route `POST /api/auth/set-session` — cookie được set từ server với HttpOnly
  - `user_role` và `user_org` giữ trong `localStorage` (UI state, không phải credential)
  - Fallback nếu route không khả dụng (dev mode)

> ⚠️ **Lưu ý quan trọng:** Backend production không dùng cookie để phân quyền — luôn verify JWT từ header `Authorization: Bearer`. Cookie `auth_token` chỉ dùng cho Next.js middleware redirect (kiểm tra đã đăng nhập chưa).

---

### 4. 📸 Chỉ yêu cầu ảnh minh chứng khi hoàn thành (Bug #4)

**Vấn đề:** Nhiều bước không cần ảnh (ví dụ: chuyển sang `IN_PROCESS`) nhưng vẫn bắt buộc ảnh và ghi nhận vào hệ thống.

**Đã sửa:**
- Sửa hàm `requiresStatusEvidence(batch, forStatus)` trong `[role]/update/page.tsx`:
  - **Chỉ yêu cầu ảnh khi** `forStatus === 'COMPLETED'`
  - Khi chuyển sang `IN_PROCESS`: không yêu cầu ảnh, không gọi `attachEvidenceForBatch`
- UI form chỉ hiển thị trường upload ảnh khi user chọn "Hoàn thành"
- File input trong trạng thái IN_PROCESS không còn hiển thị

---

### 5. 📋 Hiển thị minh chứng phi Farmer trong trace (Bug #5)

**Kiểm tra đã thực hiện:**
- `TraceTimeline.tsx` tại dòng 216–225 **đã hiển thị** `evidenceHash`/`evidenceUri` cho tất cả non-farmer batches qua component `EvidenceVerifier`
- Mỗi batch node (PROCESSED, ROAST, PACKAGED) đều có section "Minh chứng công đoạn" nếu `evidenceUri` tồn tại
- Farmer activities được hiển thị qua `FarmActivityLog` component riêng (dành cho HARVEST batch)

**Tình trạng:** Đã đúng, không cần sửa thêm. Lý do bạn không thấy evidence của non-farmer có thể do:
- Chưa upload evidence đủ lần (upload chỉ ghi đè `batch.evidenceUri`, không tạo lịch sử)
- Trace API chưa trả về dữ liệu mới nhất

---

### 6. ✅ Bắt buộc hoàn thành các bước con trước khi COMPLETE (Bug #6)

**Vấn đề:** Người dùng có thể đánh dấu COMPLETED mà không cần hoàn thành đủ các bước trong khâu.

**Đã sửa:**
- Thêm hàm `canCompleteBatch(batch)` trong `[role]/update/page.tsx`:

| Role | Điều kiện bắt buộc để COMPLETE |
|------|-------------------------------|
| **FARMER** | Phải có ít nhất **1 hoạt động canh tác** (không phải COMPLETE) |
| **PROCESSOR** | Phải có `batch.evidenceUri` (đã upload ảnh ít nhất 1 lần) |
| **ROASTER** | Phải có `batch.evidenceUri` (đã upload ảnh ít nhất 1 lần) |

- Kiểm tra này được gọi trong `updateWithWeight()` (main path khi COMPLETE)
- **UI Warning Banner** (màu vàng ⚠️) hiển thị lý do không thể hoàn thành khi user chọn "Hoàn thành"
- Nút Submit vẫn có thể click — validation sẽ chặn và hiển thị lỗi cụ thể

---

## Danh sách files đã thay đổi

| File | Thay đổi |
|------|----------|
| `src/lib/validation/file.ts` | **Mới** — Validation kích thước/định dạng ảnh |
| `src/lib/validation/weight.ts` | Thêm giới hạn min/max khối lượng, thêm `getDurationValidationError` |
| `src/app/api/auth/set-session/route.ts` | **Mới** — API route set HttpOnly cookie |
| `src/lib/auth/AuthContext.tsx` | Thay `document.cookie` bằng server-side cookie route |
| `src/app/dashboard/farmer/page.tsx` | Thêm file validation trước upload |
| `src/app/dashboard/farmer/[id]/page.tsx` | Thêm file validation, fix weight input attrs |
| `src/app/dashboard/processor/page.tsx` | Thêm file validation trước upload |
| `src/app/dashboard/roaster/page.tsx` | Thêm file validation trước upload |
| `src/app/dashboard/[role]/update/page.tsx` | Tất cả: file validation, sub-step check, evidence điều kiện, duration validation, UI warning |

---

## Kiến trúc bảo mật

```
Browser (User)
    │
    ├── localStorage: { userId, role, token, org }    ← UI state, không phải credential
    │
    └── Cookie: auth_token (HttpOnly, Secure)          ← Không đọc được từ JS
             ↑
             POST /api/auth/set-session (Next.js server)
```

---

## Cap nhat bo sung ngay 2026-05-17

### 7. Bat buoc upload anh truoc khi ghi nhan phase/trang thai

**Van de:** Mot so luong cap nhat phase/trang thai goi API ghi nhan truoc roi moi upload/gan anh minh chung. Neu upload hoac gan evidence loi sau do, he thong van co the da ghi nhan phase ma khong co anh.

**Da sua:**
- `src/app/dashboard/[role]/update/page.tsx`: validate file, upload anh va gan evidence vao batch truoc khi cap nhat trang thai/phase.
- Ap dung cho `HARVEST`, `PROCESSED`, `ROAST` khi cap nhat trang thai thuong va khi hoan thanh co khoi luong thuc te.
- Bo dieu kien hoan thanh dua tren `evidenceUri` cu cua `PROCESSED`/`ROAST`; moi lan ghi nhan trang thai van phai chon anh moi.
- Voi dong goi, anh dong goi duoc upload truoc khi tao Packaged batch va gan evidence ngay sau khi batch duoc tao.
- Voi cac man tao batch `farmer`, `processor`, `roaster`, file anh duoc validate va upload truoc khi tao ban ghi moi.

**Ket qua:** Cac phase con can minh chung se khong duoc ghi nhan neu nguoi dung chua chon anh hop le hoac buoc upload/gan evidence that bai.

---

## Cap nhat bo sung tiep theo ngay 2026-05-17

### 8. Hien thi day du lich su anh minh chung cho moi cong doan

**Van de:** `batches.evidence_uri` chi luu anh moi nhat, nen So che/Rang/Dong goi upload nhieu lan nhung trace chi hien 1 link.

**Da sua:**
- Them bang `batch_evidence_events` va migration `V5__batch_evidence_events.sql`.
- Event indexer luu moi su kien `EVIDENCE_ADDED` thanh mot dong lich su rieng, co `tx_id`, `block_number`, `recorded_at`.
- API trace tra them `batchEvidenceEvents`.
- `TraceTimeline` hien danh sach "Minh chung cong doan (N su kien)" cho tung batch, giong nhat ky canh tac cua Farmer.

### 9. Bat buoc du cac buoc con truoc khi Farmer complete

**Da sua:** Farmer khong con duoc `IRRIGATION` roi complete ngay. Truoc khi hoan thanh phai co du cac buoc:
`IRRIGATION`, `FERTILIZATION`, `PEST_CONTROL`, `PRUNING`, `SHADE_MANAGEMENT`, `SOIL_TEST`.
Cac buoc duoc lap lai, nhung moi loai bat buoc phai co it nhat mot lan.

### 10. Sua loi dang nhap phai F5 moi vao dashboard

**Van de:** Login chuyen trang ngay sau khi goi set cookie, trong khi cookie `auth_token` duoc set bat dong bo qua route server.

**Da sua:** `login()` nay la async; man login `await login(...)` truoc khi `router.replace(...)`, dong thoi dieu huong thang ve dashboard dung role.

Backend **luôn** verify JWT từ `Authorization: Bearer <token>` header — không tin vào cookie `user_role`.
