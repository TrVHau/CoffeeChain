# Hệ Thống Truy Xuất Nguồn Gốc Cà Phê — Tổng Quan Dự Án

## 1. Bối Cảnh & Vấn Đề

Cà phê là mặt hàng nông sản có chuỗi cung ứng dài, nhiều trung gian.
Người tiêu dùng hiện không có khả năng xác minh độc lập:

- Vùng trồng, ngày thu hoạch
- Phương pháp sơ chế (washed / natural / honey)
- Thời điểm rang, đóng gói, hạn sử dụng thực tế
- Sản phẩm có bị pha trộn hay làm giả nguồn gốc không

Thông tin hiện tại chủ yếu qua nhãn in, website — dễ chỉnh sửa,
thiếu cơ chế kiểm chứng độc lập.

## 2. Mục Tiêu

- Ghi nhận toàn bộ quá trình hình thành sản phẩm từ nông trại đến
  tay người tiêu dùng
- Đảm bảo dữ liệu **không thể bị sửa đổi** sau khi đã ghi nhận
- Cho phép người tiêu dùng xác minh thông tin **chỉ bằng quét QR**
- Phân định rõ **vai trò và trách nhiệm** từng bên trong chuỗi cung ứng

## 3. Phạm Vi

- Truy vết theo **lô sản xuất (Batch)**, không theo từng hạt cà phê
- Phù hợp quy trình thực tế của ngành cà phê
- Mỗi gói cà phê bán ra gắn với một **PackagedBatch** cụ thể
- Từ PackagedBatch có thể truy ngược toàn bộ chuỗi lên HarvestBatch

## 4. Chuỗi Quy Trình Được Truy Xuất

```
[Farm]       → HarvestBatch    (vùng trồng, ngày thu hoạch, loại cà phê)
[Processor]  → ProcessedBatch  (phương pháp sơ chế, thời gian)
[Roastery]   → RoastBatch      (profile rang, ngày rang)
[Packager]   → PackagedBatch   (trọng lượng, mã QR, ngày đóng gói)
[Retailer]   → Cập nhật trạng thái InStock / Sold
```

## 5. Giá Trị Mang Lại

| Đối tượng | Lợi ích |
|---|---|
| Người tiêu dùng | Tăng niềm tin, xác minh nguồn gốc qua QR |
| Nhà sản xuất / rang xay | Xây dựng uy tín thương hiệu qua minh bạch |
| Toàn chuỗi cung ứng | Giảm gian lận, sai lệch thông tin giữa các khâu |

## 6. Công Nghệ Nền Tảng

| Thành phần | Công nghệ |
|---|---|
| Blockchain | **Hyperledger Fabric 2.5** |
| Chaincode | **Java** (Fabric Contract API) |
| State Database | **CouchDB** (rich query theo field) |
| SDK | **Fabric Gateway SDK** (gRPC — hướng mới từ Fabric 2.4+) |
| Backend | Node.js + Express (API server + indexer) |
| Frontend | React / Next.js |
| Storage chứng cứ | IPFS (file) + hash SHA-256 on-chain |
| Deploy (demo) | **Docker Compose** |
| Deploy (production) | Kubernetes (kế hoạch mở rộng) |

## 7. Vai Trò Các Thành Phần

| Thành phần | Vai trò | Ghi chú |
|---|---|---|
| Chaincode | Kiểm soát quyền, cập nhật state, emit event | **Source of truth duy nhất** |
| Blockchain ledger | Lưu trữ bất biến toàn bộ giao dịch | Không thể sửa sau khi commit |
| Backend | Submit tx thay frontend, index event, cung cấp API | Không thể sửa dữ liệu đã commit |
| Frontend | Giao diện nhập liệu theo role + trang truy xuất công khai | Không lưu dữ liệu |
| CouchDB (on-chain) | World state — truy vấn nhanh state hiện tại | Đồng bộ tự động bởi Fabric |
| IPFS | Lưu file chứng cứ off-chain | Chỉ hash được ghi on-chain |