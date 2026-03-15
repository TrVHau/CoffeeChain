# Demo va Test That - Runbook Nhanh

Tai lieu nay giup ban chuyen nhanh giua 2 che do:
- Demo UI khong can backend (BE)
- Test that voi backend dang chay

## 1. Demo UI (khong can BE)

Dung khi ban muon xem giao dien nhanh cho QrScanner, Dashboard, TraceTimeline.

### Cau hinh

Trong `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=
```

Gia tri rong (`""`) nghia la FE goi same-origin (`/api/...`) va su dung mock routes trong Next.js.

### Chay

```bash
cd frontend
npm run dev
```

### Tai khoan demo

- `farmer_alice`
- `processor_bob`
- `roaster_charlie`
- `packager_dave`
- `retailer_eve`

Mat khau demo cho tat ca: `demo`

### URL de xem nhanh

- `http://localhost:3000/demo`
- `http://localhost:3000/trace/DEMO-001`
- `http://localhost:3000/login`

## 2. Test that (co BE)

Dung khi ban muon test dung luong du lieu va auth that tu backend.

### Cau hinh

Trong `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

### Chay

1. Khoi dong backend o `http://localhost:8080`.
2. Khoi dong frontend:

```bash
cd frontend
npm run dev
```

3. Dang nhap bang tai khoan that cua backend (khong dung `demo`).

## 3. Chuyen doi nhanh giua 2 che do

Chi can doi 1 dong trong `.env.local` va restart FE:

- Demo: `NEXT_PUBLIC_API_BASE_URL=`
- Test that: `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080`

Sau khi sua env, luon tat va chay lai `npm run dev`.

## 4. Neu gap "Network Error"

Kiem tra theo thu tu:

1. FE dang doc dung gia tri trong `.env.local` chua.
2. Neu de `http://localhost:8080` thi BE co dang chay khong.
3. Restart FE sau moi lan doi env.
4. Mo truc tiep endpoint de test:
   - Demo mode: `http://localhost:3000/api/trace/DEMO-001`
   - Real mode: `http://localhost:8080/api/trace/<publicCode>`
