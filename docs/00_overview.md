# Hệ Thống Truy Xuất Nguồn Gốc Cà Phê — Tổng Quan Dự Án

## 1. Bối Cảnh & Vấn Đề

Cà phê là mặt hàng nông sản có chuỗi cung ứng dài, nhiều trung gian.
Người tiêu dùng hiện không có khả năng xác minh độc lập:

- Vùng trồng, ngày thu hoạch, giống cà phê
- Quá trình chăm sóc vườn: bón phân, phun thuốc, tưới nước
- Phương pháp sơ chế (washed / natural / honey)
- Thời điểm rang, profile rang, đóng gói, hạn sử dụng
- Sản phẩm có bị pha trộn hay làm giả nguồn gốc không

Thông tin hiện tại chủ yếu qua nhãn in, website — dễ chỉnh sửa,
thiếu cơ chế kiểm chứng độc lập.

## 2. Mục Tiêu

- Ghi nhận toàn bộ quá trình hình thành sản phẩm:
  từ **nhật ký canh tác vườn** đến khi **bán cho người tiêu dùng**
- Đảm bảo dữ liệu **không thể bị sửa đổi** sau khi đã ghi nhận
- Cho phép người tiêu dùng xác minh thông tin **chỉ bằng quét QR**
- Phân định rõ **vai trò và trách nhiệm** từng bên trong chuỗi cung ứng

## 3. Phạm Vi Truy Xuất

Hệ thống truy xuất theo **lô sản xuất (Batch)**, không theo từng hạt.
Mỗi gói cà phê bán ra gắn với một `PackagedBatch`, từ đó truy ngược
toàn bộ chuỗi — bao gồm cả nhật ký chăm sóc vườn trước thu hoạch.

### Chuỗi Truy Xuất Đầy Đủ

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

> **Nhật ký canh tác** được ghi nhận là các sự kiện (event) liên kết
> với `HarvestBatch`. Không tạo entity mới — kiến trúc không thay đổi,
> timeline phong phú hơn đáng kể.
>
> **Assumption (V1):** Farm activity được ghi sau khi tạo HarvestBatch.
> `activityDate` là ngày thực tế diễn ra (có thể là ngày trong quá khứ —
> nông dân ghi chép lại). Tách entity FarmPlot/Season để log trước
> thu hoạch là hướng mở rộng V2.

## 4. Luồng Nghiệp Vụ Tổng Quát

1. **Farmer (Org1)** tạo `HarvestBatch` và ghi farm activities
   bằng event `FARM_ACTIVITY_RECORDED` (không lưu state).
2. **Processor (Org1)** tạo `ProcessedBatch` liên kết với HarvestBatch,
   cập nhật trạng thái theo tiến trình sơ chế.
3. **Roaster (Org1)** tạo `RoastBatch` từ ProcessedBatch, có thể
   upload chứng cứ — backend tính SHA-256 + lưu IPFS, chaincode lưu
   `evidenceHash/Uri` trong state và emit `EVIDENCE_ADDED`.
4. **Bàn giao Org1 → Org2** theo 2 bước:
   - Org1 `requestTransfer` → status `TRANSFER_PENDING`
   - Org2 `acceptTransfer` → AND endorsement → `ownerMSP = Org2`, status `TRANSFERRED`
5. **Packager (Org2)** nhận lô sau khi `acceptTransfer` thành công
   (lúc này `ownerMSP` đã là Org2MSP), tạo `PackagedBatch` với
   status khởi tạo là **COMPLETED** (đóng gói xong ngay khi tạo).
6. **Retailer (Org2)** cập nhật `IN_STOCK` và `SOLD` cho PackagedBatch.
7. **Người tiêu dùng** quét QR → backend trả timeline đầy đủ
   được build từ ledger events + mirror state.

## 5. Giá Trị Mang Lại

| Đối tượng | Lợi ích |
|---|---|
| Người tiêu dùng | Xem toàn bộ hành trình từ vườn đến tay qua QR |
| Nông dân | Chứng minh quy trình canh tác an toàn, xây dựng uy tín |
| Nhà rang xay | Minh bạch chất lượng, tạo lợi thế thương hiệu |
| Toàn chuỗi | Giảm gian lận, rõ trách nhiệm từng khâu |

## 6. Công Nghệ Nền Tảng

| Thành phần | Công nghệ |
|---|---|
| Blockchain | **Hyperledger Fabric 2.5** |
| Chaincode | **Java** (Fabric Contract API) |
| State Database | **CouchDB** (rich query theo field) |
| Client SDK | **Fabric Gateway SDK** (gRPC — Fabric 2.4+) |
| Backend | **Java Spring Boot** (REST API + Event Indexer) |
| Frontend | React / Next.js |
| Storage chứng cứ | IPFS (file) + hash SHA-256 on-chain |
| Deploy (demo) | **Docker Compose** |
| Deploy (production) | Kubernetes (kế hoạch mở rộng) |

> **Lý do chọn Spring Boot cho backend:**
> Team đã làm việc với Java qua chaincode. Dùng cùng ngôn ngữ
> cho cả chaincode lẫn backend giúp tái sử dụng model class
> (`Batch.java`, enum, util), giảm context switching và
> dễ debug end-to-end hơn.

## 7. Vai Trò Các Thành Phần

| Thành phần | Vai trò | Ghi chú |
|---|---|---|
| Chaincode | Kiểm soát quyền, cập nhật state, emit event | **Source of truth duy nhất** |
| Blockchain ledger | Lưu trữ bất biến toàn bộ giao dịch | Không thể sửa sau khi commit |
| Backend (Spring Boot) | Submit tx, index event, cung cấp API | Không thể sửa dữ liệu đã commit |
| Frontend | Giao diện nhập liệu theo role + trang trace công khai | Không lưu dữ liệu nghiệp vụ |
| CouchDB (on-chain) | World state — truy vấn nhanh state hiện tại | Đồng bộ tự động bởi Fabric |
| IPFS | Lưu file chứng cứ off-chain | Chỉ hash được ghi on-chain |