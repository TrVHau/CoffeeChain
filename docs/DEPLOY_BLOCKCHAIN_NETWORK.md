# Deploy Blockchain Network

Tài liệu này hướng dẫn deploy phần blockchain network của CoffeeChain theo thứ tự an toàn. Mục tiêu là dựng đúng Fabric network trước, rồi mới lên chaincode, users và backend/frontend.

## 1) Nên deploy phần nào trước

Thứ tự khuyến nghị:

1. Fabric network
2. Chaincode
3. Demo users / identities
4. Backend Spring Boot
5. Frontend Next.js

Lý do:
- Backend cần Fabric network và identities để query/submit.
- Frontend chỉ là lớp UI, nên đi sau backend.
- QR/trace là public, nhưng vẫn phụ thuộc backend và frontend đã trỏ đúng URL.

## 2) Chuẩn bị môi trường

Bạn cần:
- Docker Engine và Docker Compose v2
- Java 21
- Git
- Terminal có `bash`

Nếu project nằm trên NTFS như workspace hiện tại, luôn chạy script bằng `bash ...`, không dùng `./...`.

## 3) Thiết lập biến môi trường deploy

Trước khi chạy docker compose, đặt các biến sau trong `network/.env` hoặc export trực tiếp:

```bash
export TRACE_PUBLIC_BASE_URL="https://<frontend-domain>/trace/"
export NEXT_PUBLIC_API_URL="https://<backend-domain>"
export JWT_SECRET="<secret-manh-it-nhat-32-ky-tu>"
```

Gợi ý:
- `TRACE_PUBLIC_BASE_URL` phải là URL public thật của trang trace.
- `NEXT_PUBLIC_API_URL` phải là URL public thật của backend.
- Không dùng giá trị mặc định localhost khi deploy.

## 4) Deploy Fabric network

Từ thư mục gốc project:

```bash
cd /media/sagito/SHARED/WINDOW/BTL/CoffeeChain/network
bash scripts/setup-network.sh
```

Script này sẽ:
- sinh crypto material
- tạo channel artifacts
- khởi động orderer, peers, CouchDB, CA
- tạo channel `coffee-traceability-channel`
- cho 2 peer join channel
- cập nhật anchor peers

Kiểm tra sau khi xong:

```bash
docker ps
```

Kỳ vọng thấy ít nhất:
- `orderer.example.com`
- `peer0.org1.example.com`
- `peer0.org2.example.com`
- `ca.org1.example.com`
- `ca.org2.example.com`
- `couchdb0`
- `couchdb1`

## 5) Deploy chaincode

Sau khi network chạy xong:

```bash
cd /media/sagito/SHARED/WINDOW/BTL/CoffeeChain/network
bash scripts/deploy-chaincode.sh
```

Script này sẽ:
- build chaincode Java jar
- package chaincode
- install lên cả 2 peer
- approve cho cả 2 org
- commit chaincode lên channel

Kiểm tra:

```bash
docker exec peer0.org1.example.com peer lifecycle chaincode querycommitted \
  --channelID coffee-traceability-channel
```

## 6) Đăng ký demo users

```bash
cd /media/sagito/SHARED/WINDOW/BTL/CoffeeChain/network
bash scripts/register-users.sh
```

Tài khoản demo:
- `farmer_alice`
- `processor_bob`
- `roaster_charlie`
- `packager_dave`
- `retailer_eve`

## 7) Khởi động backend và frontend

```bash
cd /media/sagito/SHARED/WINDOW/BTL/CoffeeChain/network
docker compose up -d backend frontend
```

Sau đó kiểm tra:

```bash
curl -I http://localhost:8080/swagger-ui.html
curl -I http://localhost:3000
```

## 8) Smoke test tối thiểu trước khi coi là xong

Luồng phải chạy được:

1. Farmer tạo Harvest và hoàn thành
2. Processor tạo Processed và hoàn thành
3. Roaster tạo Roast và hoàn thành
4. Packager nhận chuyển giao và đóng gói
5. Retailer cập nhật `IN_STOCK` rồi `SOLD`
6. Public trace trả về 200
7. QR của batch hoàn tất mở được trang trace tương ứng

## 9) Nếu deploy lên cloud free

Khuyến nghị:
- Frontend: Vercel Free
- Backend + Fabric network: Oracle Cloud Always Free VM
- DNS/SSL: Cloudflare Free

Cấu hình tối thiểu:
- `TRACE_PUBLIC_BASE_URL=https://<frontend-domain>/trace/`
- `NEXT_PUBLIC_API_URL=https://<backend-domain>`

## 9A) Nếu không có credit card

Nếu tài khoản Oracle/Cloud yêu cầu credit card mà nhóm chưa có, đừng cố đăng ký vòng qua. Với project bài tập, phương án khả thi nhất là:

1. Chạy toàn bộ Fabric network trên máy cá nhân mạnh hoặc máy lab của nhóm.
2. Dùng Docker Compose đúng theo `network/docker-compose.yaml` và `run.sh`.
3. Nếu cần public tạm cho demo, dùng Cloudflare Tunnel free hoặc ngrok free chỉ để expose frontend/backend, còn Fabric network vẫn nằm trong máy/lab.
4. Giữ `TRACE_PUBLIC_BASE_URL` và `NEXT_PUBLIC_API_URL` trỏ về domain/tunnel thật thay vì localhost.

Ưu điểm:
- Không cần credit card
- Không bị khóa bởi bước xác minh cloud
- Phù hợp với bài tập nhóm và demo nội bộ

Nhược điểm:
- Không phải hạ tầng cloud “chuẩn production” 24/7
- Phụ thuộc máy/lab của nhóm hoặc laptop phải bật khi demo

Nếu mục tiêu là nộp bài và demo, phương án này đủ dùng. Nếu mục tiêu là triển khai public thật sự, lúc đó mới cần một VM cloud có thẻ hoặc tài khoản tổ chức.

## 10) Rollback nhanh

Nếu deploy lỗi:

```bash
cd /media/sagito/SHARED/WINDOW/BTL/CoffeeChain/network
docker compose down
```

Nếu muốn xoá sạch network test:

```bash
cd /media/sagito/SHARED/WINDOW/BTL/CoffeeChain/network
docker compose down -v
rm -rf crypto-config channel-artifacts .env
```

## 11) Kết luận

Trước khi deploy production, luôn đảm bảo:
- chaincode đã commit thành công
- demo users đã enroll xong
- backend trỏ đúng Fabric identity paths
- public trace URL không còn localhost
- JWT secret không dùng mặc định
