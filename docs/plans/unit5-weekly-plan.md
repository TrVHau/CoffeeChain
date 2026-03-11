# Unit-5 Weekly Plan — FE Auth + Public Trace

> **Thành viên**: FE-Member-2 (Unit-5)
> **Scope**: Auth layer, `/trace` public page, API integration layer
> **Phụ thuộc**: OpenAPI spec từ Unit-2 (~Tuần 4)
> **Cung cấp cho**: Unit-4 dùng `lib/auth/` + `lib/api/client.ts`

---

## Tổng Quan Timeline

```
Tuần 1  — Bootstrap + Auth layer (✅ Hoàn thành)
Tuần 2  — API client + EvidenceVerifier + TraceTimeline (mock)
Tuần 3  — Trace page + QrScanner + Handoff cho Unit-4
Tuần 4+ — Nhận openapi.yaml → generate → wiring thật
```

---

## Tuần 1 — Bootstrap & Auth Infrastructure

**Trạng thái**: ✅ Hoàn thành

### Mục tiêu
Dự án khởi chạy được, Auth layer hoàn thiện, login page render được.

### Checklist

- [x] Khởi tạo cấu trúc Next.js 14 project (TypeScript + Tailwind + App Router)
- [x] Cấu hình `@/` alias, ESLint, `tsconfig.json`, `tailwind.config.ts`
- [x] `src/lib/auth/AuthContext.tsx` — `AuthProvider` + `useAuthContext` + `ROLE_DASHBOARD`
- [x] `src/lib/auth/useAuth.ts` — hook wrapper (Unit-4 import từ đây)
- [x] `src/middleware.ts` — bảo vệ `/dashboard/**`, redirect `/login` nếu chưa có `auth_token` cookie
- [x] `src/app/login/page.tsx` — form đăng nhập, gọi `POST /api/auth/login`, redirect theo role
- [x] `src/app/layout.tsx` — root layout bọc toàn app bằng `AuthProvider`
- [x] `src/app/dashboard/page.tsx` — redirect sang `/dashboard/{role}` sau login
- [x] Tạo đủ cấu trúc thư mục + stub files cho tuần 2–3

### Files tạo ra tuần này

| File | Trạng thái |
|------|-----------|
| `package.json`, `tsconfig.json`, `next.config.ts` | ✅ |
| `tailwind.config.ts`, `postcss.config.js` | ✅ |
| `src/app/globals.css`, `layout.tsx`, `page.tsx` | ✅ |
| `src/lib/auth/AuthContext.tsx` | ✅ Full |
| `src/lib/auth/useAuth.ts` | ✅ Full |
| `src/middleware.ts` | ✅ Full |
| `src/app/login/page.tsx` | ✅ Full |
| `src/app/dashboard/page.tsx` | ✅ Full |
| `src/lib/api/client.ts` | 🔲 Stub |
| `src/lib/api/types.ts` | 🔲 Stub |
| `src/components/TraceTimeline.tsx` | 🔲 Stub |
| `src/components/EvidenceVerifier.tsx` | 🔲 Stub |
| `src/app/trace/[publicCode]/page.tsx` | 🔲 Stub |

---

## Tuần 2 — API Client Layer & Standalone Components

**Trạng thái**: ✅ Hoàn thành

> Unit-2 đã merge xong → đã đọc `openapi.yaml` và align types chính xác.

### Mục tiêu
`client.ts` sẵn sàng cho Unit-4 dùng. `EvidenceVerifier` hoàn thiện (độc lập 100% với BE).

### Checklist

- [x] `src/lib/api/client.ts` — axios instance đầy đủ:
  - Base URL từ `NEXT_PUBLIC_API_BASE_URL`
  - Request interceptor đính kèm `Authorization: Bearer <token>` từ localStorage
  - Response interceptor xử lý 401 (clear auth + redirect `/login`)
- [x] `src/lib/api/types.ts` — align với `openapi.yaml` Unit-2:
  - `AuthResponse`, `BatchResponse` (`ownerMsp`, `pendingToMsp` theo spec)
  - `FarmActivityItem`, `LedgerRefItem`, `TraceResponse`, `TraceStep`
- [x] `src/components/EvidenceVerifier.tsx` — hoàn thiện hoàn toàn:
  - Download file từ `evidenceUri` (IPFS → HTTP gateway)
  - Tính SHA-256 bằng `crypto.subtle.digest('SHA-256', buffer)`
  - So sánh với `onChainHash` từ ledger
  - Hiển thị ✅ Khớp / ❌ Không khớp / ⚠️ Lỗi + Thử lại
- [x] `src/components/TraceTimeline.tsx` — full UI:
  - Render từng step newest-first: PACKAGED → ROAST → PROCESSED → HARVEST
  - FarmActivityLog accordion (expand/collapse) ở step HARVEST
  - Block # + TxId (8 ký tự) từ `ledgerRefs`
  - Tích hợp `EvidenceVerifier` cho step ROAST
- [x] **Handoff cho Unit-4**: `lib/auth/` + `client.ts` sẵn sàng

### Files sửa/thêm

| File | Việc cần làm |
|------|-------------|
| `src/lib/api/client.ts` | Implement đầy đủ |
| `src/lib/api/types.ts` | Hoàn thiện interfaces |
| `src/components/EvidenceVerifier.tsx` | Implement đầy đủ |
| `src/components/TraceTimeline.tsx` | Implement với mock data |

---

## Tuần 3 — Public Trace Page & Handoff Chuẩn Bị

**Trạng thái**: ✅ Hoàn thành (2026-03-11)

### Mục tiêu
`/trace` page hoàn thiện với real API call. Sẵn sàng swap sang generated client ngay khi Unit-3 hoàn thành.

### Checklist

- [x] `src/app/trace/[publicCode]/page.tsx` — implement đầy đủ:
  - Gọi `GET /api/trace/{publicCode}` qua `apiClient`
  - Loading skeleton (animated pulse, 3 rows)
  - Not found state (404)
  - Error state (network/server error)
  - Render `<TraceTimeline batches farmActivities ledgerRefs />`
  - Status badge (màu theo trạng thái)
  - Footer: "Dữ liệu xác thực bởi Hyperledger Fabric"
- [x] `src/components/QrScanner.tsx` — webcam QR scan bằng `@zxing/browser`:
  - `BrowserMultiFormatReader.decodeFromVideoDevice` → auto redirect `/trace/{code}`
  - Hỗ trợ URL đầy đủ và publicCode thuần túy
  - Fallback: manual input form
  - Overlay viewfinder + success/error states
- [x] Cài `@zxing/browser` vào `package.json`
- [x] Hoàn thiện `frontend/README.md` — cập nhật trạng thái Tuần 3

### Files sửa/thêm

| File | Việc cần làm |
|------|-------------|
| `src/app/trace/[publicCode]/page.tsx` | Implement đầy đủ |
| `src/components/QrScanner.tsx` | Implement (webcam + manual fallback) |
| `frontend/README.md` | Cập nhật trạng thái |

---

## Tuần 4+ — Nhận OpenAPI Spec & Tích Hợp Thật

**Trạng thái**: ⏳ Chờ Unit-2 (`openapi.yaml`)

### Điều kiện bắt đầu
`backend/src/main/resources/openapi.yaml` đã được Unit-2 push lên repo.

### Checklist

- [ ] Chạy `npm run generate:api` → `src/lib/api/generated/` được tạo tự động
- [ ] Swap import `TraceTimeline.tsx` và `trace/[publicCode]/page.tsx` từ `types.ts` → `generated/`
- [ ] Wire `apiClient` với generated API functions (thay thế mock calls)
- [ ] Update `client.ts` nếu có cấu hình đặc thù từ generated code
- [ ] Phối hợp Unit-2 fix mismatch response schema (nếu có)
- [ ] End-to-end test cơ bản: login → `/trace/{code}` hiển thị đúng

---

## Dependency Tracking

| Phụ thuộc vào | Cần gì | Dự kiến | Tác động nếu trễ |
|--------------|--------|---------|-----------------|
| Unit-2 (BE-Member-2) | `openapi.yaml` hoàn chỉnh | ~Tuần 4 | Tuần 4+ bị block; mock types dùng tạm |
| Unit-3 (BE-Member-3) | Docker Compose + BE chạy được | ~Tuần 3 | Không test end-to-end được |
| — | Unit-4 dùng `lib/auth/` + `client.ts` của mình | Tuần 2 handoff | Unit-4 không bắt đầu được |

---

## Ghi Chú Kỹ Thuật

### Auth Flow
```
Login form → POST /api/auth/login
         ← { token, role }
         → localStorage.setItem('auth_user', ...)
         → document.cookie = 'auth_token=...; auth_role=...'
         → router.push(ROLE_DASHBOARD[role])

middleware.ts: đọc cookie 'auth_token' → nếu không có → redirect /login
```

### Generate API Client
```bash
# Sau khi Unit-2 push openapi.yaml:
npm run generate:api
# Output: src/lib/api/generated/ — đầy đủ interfaces + API functions
```

### Env Variables
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```
