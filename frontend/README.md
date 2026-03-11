# CoffeeChain Frontend

Next.js 14 (App Router) — Giao diện người dùng cho hệ thống truy xuất nguồn gốc cà phê.  
**Unit-5**: FE-Member-2 — Auth + Public Trace + API Integration Layer.

> **Trạng thái**: Tuần 3 hoàn thành — `/trace` page, QrScanner, API client layer

---

## Yêu Cầu

- Node.js 20+
- npm 10+

---

## Cài Đặt & Chạy

```bash
# 1. Cài dependencies
npm install

# 2. Tạo file env
cp .env.example .env.local
# Sửa NEXT_PUBLIC_API_BASE_URL nếu BE chạy cổng khác

# 3. Chạy dev server
npm run dev
# → http://localhost:3000
```

---

## Biến Môi Trường

| Biến | Mô tả | Mặc định |
|------|-------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | URL của Spring Boot Backend | `http://localhost:8080` |

---

## Generate API Client

Sau khi Unit-2 (BE-Member-2) publish `openapi.yaml`:

```bash
npm run generate:api
# Output: src/lib/api/generated/ — interfaces + API functions tự động
```

---

## Cấu Trúc Thư Mục

```
src/
├── app/
│   ├── layout.tsx              ← Root layout (AuthProvider)
│   ├── page.tsx                ← Redirect → /login
│   ├── login/
│   │   └── page.tsx            ← Trang đăng nhập (Unit-5) ✅
│   ├── dashboard/
│   │   ├── page.tsx            ← Redirect theo role (Unit-5) ✅
│   │   ├── farmer/             ← Unit-4 implement
│   │   ├── processor/          ← Unit-4 implement
│   │   ├── roaster/            ← Unit-4 implement
│   │   ├── packager/           ← Unit-4 implement
│   │   └── retailer/           ← Unit-4 implement
│   └── trace/
│       └── [publicCode]/
│           └── page.tsx        ← Public trace page (Unit-5, Tuần 3)
├── components/
│   ├── TraceTimeline.tsx       ← Timeline truy xuất (Unit-5, Tuần 2)
│   ├── EvidenceVerifier.tsx    ← Xác minh SHA-256 (Unit-5, Tuần 2)
│   └── QrScanner.tsx           ← Webcam QR scan (Unit-5, Tuần 3, optional)
├── lib/
│   ├── api/
│   │   ├── generated/          ← Auto-generated từ openapi.yaml (Tuần 4+)
│   │   ├── client.ts           ← Axios instance + JWT interceptor (Tuần 2)
│   │   └── types.ts            ← Manual types tạm (thay bằng generated ở Tuần 4)
│   └── auth/
│       ├── AuthContext.tsx     ← AuthProvider + useAuthContext ✅
│       └── useAuth.ts          ← Hook (Unit-4 dùng) ✅
└── middleware.ts               ← Route protection /dashboard/** ✅
```

---

## Test Users (khi BE sẵn sàng)

| User ID | Mật khẩu | Role | Org |
|---------|---------|------|-----|
| `farmer_alice` | `pw123` | FARMER | Org1 |
| `processor_bob` | `pw123` | PROCESSOR | Org1 |
| `roaster_charlie` | `pw123` | ROASTER | Org1 |
| `packager_dave` | `pw123` | PACKAGER | Org2 |
| `retailer_eve` | `pw123` | RETAILER | Org2 |

> Mật khẩu mặc định theo `network/scripts/register-users.sh` (Unit-3).

---

## Hướng Dẫn Cho Unit-4 (FE-Member-1)

Unit-4 implement các dashboard pages, sử dụng shared code từ Unit-5:

```typescript
// 1. Auth hook
import { useAuth } from '@/lib/auth/useAuth';
const { user, isAuthenticated, logout } = useAuth();

// 2. API client (sau Tuần 2)
import { apiClient } from '@/lib/api/client';
const res = await apiClient.get('/api/harvest');

// 3. Types (tạm dùng, sau Tuần 4 dùng generated)
import type { BatchResponse } from '@/lib/api/types';
```

---

## Auth Flow

```
/login → POST /api/auth/login
       ← { token, role }
       → localStorage + cookie (auth_token, user_role)
       → redirect /dashboard/{role}

middleware.ts: /dashboard/** → kiểm tra cookie auth_token
             → không có → redirect /login?redirectTo=<path>
```
