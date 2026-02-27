# Hệ Thống Truy Xuất Nguồn Gốc Cà Phê

## 1. Bối Cảnh & Vấn Đề

Cà phê là mặt hàng nông sản có chuỗi cung ứng dài, nhiều trung gian.
Người tiêu dùng hiện **không có khả năng xác minh độc lập**:

- Vùng trồng, ngày thu hoạch, giống cà phê
- Quá trình chăm sóc vườn: bón phân, phun thuốc, tưới nước
- Phương pháp sơ chế (washed / natural / honey)
- Thời điểm rang, profile rang, đóng gói, hạn sử dụng
- Sản phẩm có bị pha trộn hay làm giả nguồn gốc không

Thông tin hiện tại chủ yếu qua nhãn in, website — dễ chỉnh sửa,
thiếu cơ chế kiểm chứng độc lập.

---

## 2. Mục Tiêu

- Ghi nhận toàn bộ quá trình hình thành sản phẩm:
  từ **nhật ký canh tác vườn** đến khi **bán cho người tiêu dùng**
- Đảm bảo dữ liệu **không thể bị sửa đổi** sau khi đã ghi nhận
- Cho phép người tiêu dùng xác minh thông tin **chỉ bằng quét QR**
- Phân định rõ **vai trò và trách nhiệm** từng bên trong chuỗi cung ứng

---

## 3. Chuỗi Truy Xuất

Hệ thống truy xuất theo **lô sản xuất (Batch)**, không theo từng hạt.
Mỗi gói cà phê bán ra gắn với một `PackagedBatch`, từ đó truy ngược
toàn bộ chuỗi — bao gồm cả nhật ký chăm sóc vườn trước thu hoạch.

```
[Nhật ký canh tác]  — Tưới, bón phân, phun thuốc, tỉa cành ...
        ↓  (gắn vào HarvestBatch)
[Farm]       → HarvestBatch     (vùng trồng, ngày thu hoạch, giống)
        ↓
[Processor]  → ProcessedBatch   (phương pháp sơ chế, thời gian)
        ↓
[Roastery]   → RoastBatch       (profile rang, ngày rang)
        ↓  (requestTransfer → acceptTransfer)
[Packager]   → PackagedBatch    (trọng lượng, QR, hạn dùng)
        ↓
[Retailer]   → Cập nhật IN_STOCK / SOLD
```

> **Nhật ký canh tác** được ghi là các sự kiện (event) liên kết với
> `HarvestBatch`. Không tạo entity mới — timeline phong phú hơn mà
> kiến trúc không thay đổi.
>
> **Assumption V1:** Farm activity được ghi sau khi tạo HarvestBatch.
> `activityDate` là ngày thực tế (có thể là ngày quá khứ — nông dân
> ghi chép lại). Tách entity FarmPlot/Season là hướng mở rộng V2.

---

## 4. Luồng Nghiệp Vụ Tổng Quát

| Bước | Actor | Hành động |
|------|-------|-----------|
| 1 | Farmer (Org1) | Tạo `HarvestBatch`, ghi farm activities |
| 2 | Processor (Org1) | Tạo `ProcessedBatch` liên kết HarvestBatch |
| 3 | Roaster (Org1) | Tạo `RoastBatch`, upload chứng cứ |
| 4a | Roaster (Org1) | `requestTransfer` → status `TRANSFER_PENDING` |
| 4b | Packager (Org2) | `acceptTransfer` → AND endorsement → `ownerMSP = Org2` |
| 5 | Packager (Org2) | Tạo `PackagedBatch` (status = `COMPLETED`) |
| 6 | Retailer (Org2) | Cập nhật `IN_STOCK` → `SOLD` |
| 7 | Người tiêu dùng | Quét QR → xem timeline đầy đủ |

---

## 5. Giá Trị Mang Lại

| Đối tượng | Lợi ích |
|-----------|---------|
| Người tiêu dùng | Xem toàn bộ hành trình từ vườn đến tay qua QR |
| Nông dân | Chứng minh quy trình canh tác an toàn, xây dựng uy tín |
| Nhà rang xay | Minh bạch chất lượng, tạo lợi thế thương hiệu |
| Toàn chuỗi | Giảm gian lận, rõ trách nhiệm từng khâu |

---

## 6. Công Nghệ Nền Tảng

| Thành phần | Công nghệ | Lý do chọn |
|------------|-----------|------------|
| Blockchain | Hyperledger Fabric 2.5 | Permissioned, multi-org, LTS |
| Chaincode | Java (Fabric Contract API) | Cùng ngôn ngữ với backend |
| State Database | CouchDB | Rich query theo field |
| Client SDK | Fabric Gateway SDK (gRPC) | Fabric 2.4+ recommended |
| Backend | Java Spring Boot 3.x | Tái sử dụng model từ chaincode |
| Frontend | React / Next.js | — |
| Storage chứng cứ | IPFS + SHA-256 on-chain | File off-chain, hash bất biến |
| Deploy (demo) | Docker Compose | Đơn giản, dễ chạy local |
| Deploy (production) | Kubernetes | Kế hoạch mở rộng |

> **Lý do Spring Boot:** Team đã làm việc với Java qua chaincode.
> Tái sử dụng được `Batch.java`, enum, util — giảm code trùng lặp,
> dễ debug end-to-end.

---

## 7. Vai Trò Các Thành Phần

| Thành phần | Vai trò | Ghi chú |
|------------|---------|---------|
| Chaincode | Kiểm soát quyền, cập nhật state, emit event | **Source of truth duy nhất** |
| Blockchain ledger | Lưu trữ bất biến toàn bộ giao dịch | Không thể sửa sau khi commit |
| Backend (Spring Boot) | Submit tx, index event, cung cấp API | Không thể sửa dữ liệu đã commit |
| Frontend | Giao diện nhập liệu theo role + trang trace công khai | Không lưu dữ liệu nghiệp vụ |
| CouchDB (on-chain) | World state — truy vấn nhanh state hiện tại | Đồng bộ tự động bởi Fabric |
| PostgreSQL (off-chain) | Mirror state + farm activities + ledger refs | Index cho API nhanh |
| IPFS | Lưu file chứng cứ off-chain | Chỉ hash được ghi on-chain |

---

## 8. Cấu Trúc Tài Liệu

| File | Nội dung |
|------|----------|
| `00_overview.md` | Bối cảnh, mục tiêu, công nghệ ← *file này* |
| `01_system_architecture.md` | Sơ đồ tổng thể, topology, luồng dữ liệu |
| `02_roles_and_orgs.md` | Org, role, CA, endorsement policy |
| `03_data_model.md` | Batch entity, metadata, status machine, events |
| `04_chaincode.md` | Chaincode Java đầy đủ + helper classes |
| `05_backend.md` | Spring Boot, API endpoints, EventIndexer |
| `06_frontend_qr.md` | Frontend pages, QR, Evidence verifier |
| `07_deployment.md` | Docker Compose, scripts, cấu hình |