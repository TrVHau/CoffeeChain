# Unit-5 FE Auth + Trace Test Guide

> Pham vi: frontend only, khong can chay backend day du.
> Dung cho Unit-5: auth, redirect, public trace, QR, va test component co ban.

---

## 1. Muc tieu

Kiem tra cac luong chinh cua FE:

- Dang nhap
- Bao ve dashboard theo auth cookie
- Public trace page
- UI demo va QR scanner
- Unit test / integration test cua FE

---

## 2. Cac duong dan can test

### Auth

- `/login`
- `/login?redirectTo=/dashboard/farmer`
- `/dashboard`

### Dashboard theo role

- `/dashboard/farmer`
- `/dashboard/processor`
- `/dashboard/roaster`
- `/dashboard/packager`
- `/dashboard/retailer`

### Trace cong khai

- `/trace/DEMO-001`
- `/trace/NOT-FOUND-999`

### Demo / QR

- `/demo`

---

## 3. Chay test tu dong

Mo terminal o thu muc frontend:

```bash
cd frontend
npm install
npm test -- --runInBand
```

Neu can xem chi tiet hon:

```bash
cd frontend
npx jest src/__tests__/app/login/LoginPage.test.tsx --runInBand
npx jest src/__tests__/app/trace/TracePage.test.tsx --runInBand
npx jest src/__tests__/components/QrScanner.test.tsx --runInBand
npx jest src/__tests__/components/TraceTimeline.test.tsx --runInBand
npx jest src/__tests__/lib/auth/AuthContext.test.tsx --runInBand
npx jest src/__tests__/middleware.test.ts --runInBand
```

---

## 4. Cach test thu cong tren trinh duyet

Chay app FE:

```bash
cd frontend
npm run dev
```

Sau do mo:

1. `/login`
2. Dang nhap bang `farmer_alice` / `demo` khi dung mock dev endpoint
3. Kiem tra redirect sang dashboard theo role
4. Mo `/trace/DEMO-001` de xem man truy xuat
5. Mo `/trace/NOT-FOUND-999` de xem trang 404 logic cua trace
6. Mo `/demo` de xem TraceTimeline va QR demo

---

## 5. Du lieu test dev

Neu frontend dang chay voi mock dev API:

- User: `farmer_alice`, `processor_bob`, `roaster_charlie`, `packager_dave`, `retailer_eve`
- Password: `demo`

Neu frontend dang noi voi backend that:

- Dung credentials theo BE local cua ban
- Kiem tra lai bien `NEXT_PUBLIC_API_BASE_URL`

---

## 6. Checklist nhanh

- `/login` render du form va nut submit
- Submit dang nhap co goi `/api/auth/login`
- `/dashboard/**` redirect khi chua co auth_token
- `/dashboard/**` vao duoc khi co auth_token
- `/trace/DEMO-001` load duoc timeline
- `/trace/NOT-FOUND-999` hien not found state
- `/demo` hien TraceTimeline va QR Scanner
- `npm test -- --runInBand` pass

---

## 7. File test lien quan

- [frontend/src/__tests__/app/login/LoginPage.test.tsx](../frontend/src/__tests__/app/login/LoginPage.test.tsx)
- [frontend/src/__tests__/app/trace/TracePage.test.tsx](../frontend/src/__tests__/app/trace/TracePage.test.tsx)
- [frontend/src/__tests__/components/QrScanner.test.tsx](../frontend/src/__tests__/components/QrScanner.test.tsx)
- [frontend/src/__tests__/components/TraceTimeline.test.tsx](../frontend/src/__tests__/components/TraceTimeline.test.tsx)
- [frontend/src/__tests__/lib/auth/AuthContext.test.tsx](../frontend/src/__tests__/lib/auth/AuthContext.test.tsx)
- [frontend/src/__tests__/middleware.test.ts](../frontend/src/__tests__/middleware.test.ts)
