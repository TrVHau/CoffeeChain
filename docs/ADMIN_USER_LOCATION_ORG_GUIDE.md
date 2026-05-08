# Hướng Dẫn Admin: Quản Lý User, Địa Điểm Theo Role, Và Mở Rộng Tổ Chức

## 1) Mục tiêu tài liệu
Tài liệu này dùng cho admin vận hành hệ thống CoffeeChain để:
- Thêm tài khoản người dùng mới.
- Gán role và tổ chức (Org1MSP, Org2MSP).
- Thêm địa điểm hoặc cơ sở theo role.
- Mở rộng thêm tổ chức mới theo định hướng hiện tại.

Tài liệu bám sát code hiện có trong dự án, không mô tả chung chung.

## 2) Kiến trúc hiện tại cần hiểu trước
Hệ thống đang có 2 lớp danh tính chạy song song:

- Lớp ứng dụng (JWT + DB users):
  - Đăng nhập đọc bảng users trong PostgreSQL.
  - File liên quan:
    - [backend/src/main/java/com/coffee/trace/entity/UserEntity.java](backend/src/main/java/com/coffee/trace/entity/UserEntity.java)
    - [backend/src/main/resources/db/migration/V1__init_schema.sql](backend/src/main/resources/db/migration/V1__init_schema.sql)

- Lớp blockchain (Fabric identity theo cert/key):
  - Submit transaction dùng identity từ thư mục crypto.
  - File liên quan:
    - [backend/src/main/java/com/coffee/trace/service/FabricGatewayService.java](backend/src/main/java/com/coffee/trace/service/FabricGatewayService.java)
    - [network/scripts/register-users.sh](network/scripts/register-users.sh)

Điểm quan trọng: user muốn thao tác đầy đủ phải tồn tại ở cả 2 lớp.

## 3) Quy trình thêm user mới cho Org1 hoặc Org2

### Bước 1: Chọn thông tin chuẩn
Chuẩn bị bộ thông tin:
- user_id: ví dụ farmer_hung
- role: FARMER hoặc PROCESSOR hoặc ROASTER hoặc PACKAGER hoặc RETAILER
- org: Org1MSP hoặc Org2MSP
- fabric_user_id: thường đặt giống user_id

Quy ước role hiện tại đang nằm trong comments schema users và dữ liệu seed.

### Bước 2: Đăng ký và enroll user ở Fabric CA
Script mẫu hiện có đang đăng ký 5 user demo:
- [network/scripts/register-users.sh](network/scripts/register-users.sh)

Cách làm cho user mới:
- Cách nhanh: thêm một dòng register_and_enroll theo đúng org + role + user_id.
- Cách chuẩn hơn: tách script theo tham số để tái sử dụng nhiều lần.

Sau khi enroll thành công, phải có thư mục:
- org1: /crypto/org1/users/<user_id>/msp/...
- org2: /crypto/org2/users/<user_id>/msp/...

### Bước 3: Đảm bảo backend Render có crypto mới
Nếu backend đang chạy ngoài VM, cần đồng bộ gói crypto mới sang backend.
Nếu đang dùng secret file/base64 thì phải refresh bundle và redeploy backend.

Nếu không đồng bộ bước này, backend sẽ báo kiểu:
- No Fabric identity loaded for user: <user_id>

### Bước 4: Thêm user vào PostgreSQL users
Bắt buộc thêm dòng trong bảng users.
Có thể dùng SQL dạng sau (mẫu):

INSERT INTO users (user_id, password, role, org, fabric_user_id)
VALUES ('farmer_hung', '<bcrypt_hash>', 'FARMER', 'Org1MSP', 'farmer_hung');

Lưu ý:
- password phải là BCrypt hash.
- org nên để dạng MSP (Org1MSP/Org2MSP) để đồng nhất với phần transfer target.

### Bước 5: Cập nhật backend để load user identity
Code hiện tại đang load user-level gateway theo danh sách cứng tại init():
- [backend/src/main/java/com/coffee/trace/service/FabricGatewayService.java](backend/src/main/java/com/coffee/trace/service/FabricGatewayService.java)

Nghĩa là thêm user mới thì cần cập nhật danh sách trong vòng lặp init(), nếu không backend sẽ không load identity cho user đó.

Ngoài ra còn hàm orgOfUser() cũng đang hardcode:
- packager_dave và retailer_eve thuộc Org2
- còn lại mặc định Org1

Nếu user mới thuộc Org2 mà không thêm vào mapping phù hợp, backend có thể đọc sai path cert.

Khuyến nghị nâng cấp sau này:
- Đọc org theo DB users thay vì hardcode orgOfUser().
- Load user identity động theo users đang active.

## 4) Thêm địa điểm theo role cho user

### Cách hiện tại theo code
Phần option địa điểm/cơ sở đang nằm trong service:
- [backend/src/main/java/com/coffee/trace/service/AccountOptionsService.java](backend/src/main/java/com/coffee/trace/service/AccountOptionsService.java)

Có 2 kiểu dữ liệu:
- Map theo user_id:
  - FARM_LOCATIONS_BY_USER
  - PROCESSING_FACILITIES_BY_USER
- Fallback theo role:
  - FARMER có DEFAULT_FARM_LOCATIONS
  - PROCESSOR có DEFAULT_PROCESSING_FACILITIES

### Cách thêm địa điểm cho user cụ thể
Ví dụ thêm địa điểm cho farmer_hung:
- Bổ sung vào FARM_LOCATIONS_BY_USER: farmer_hung -> danh sách địa điểm.

Ví dụ thêm cơ sở cho processor_minh:
- Bổ sung vào PROCESSING_FACILITIES_BY_USER: processor_minh -> danh sách cơ sở.

### Cách thêm mặc định cho cả role
- Sửa DEFAULT_FARM_LOCATIONS hoặc DEFAULT_PROCESSING_FACILITIES.

Lưu ý:
- AccountOptionsService đã normalize user_id về lowercase + trim.
- Nên lưu key map theo lowercase để tránh mismatch.

## 5) Vì sao tạo thành công nhưng danh sách không hiện
Đây là case vận hành rất hay gặp.

- Create harvest ghi lên Fabric thành công.
- API list batches lại đọc từ PostgreSQL cache.
- Nếu EventIndexer không chạy hoặc không sync được event, list sẽ rỗng.

File liên quan:
- [backend/src/main/java/com/coffee/trace/controller/BatchQueryController.java](backend/src/main/java/com/coffee/trace/controller/BatchQueryController.java)
- [backend/src/main/java/com/coffee/trace/indexer/EventIndexerService.java](backend/src/main/java/com/coffee/trace/indexer/EventIndexerService.java)

Kiểm tra nhanh:
- Biến FABRIC_EVENT_INDEXER_ENABLED có bật true chưa.
- Log backend có dòng EventIndexerService started chưa.

## 6) Mở rộng thêm tổ chức mới (ngoài Org1/Org2)

Hiện code và network đang thiết kế cứng cho 2 org, nên thêm org mới cần làm đủ cả blockchain + backend + dữ liệu.

### 6.1 Blockchain/network
Cần mở rộng:
- [network/crypto-config.yaml](network/crypto-config.yaml)
- [network/configtx.yaml](network/configtx.yaml)
- docker compose network (peer/ca/couchdb cho org mới)
- scripts setup/deploy/register tương ứng

### 6.2 Backend config
Cần thêm cấu hình org mới trong fabric.*:
- msp-id
- peer-endpoint
- tls-cert-path
- admin-cert-path
- admin-key-path
- users-base-path

File chính:
- [backend/src/main/resources/application.yaml](backend/src/main/resources/application.yaml)

### 6.3 Backend code hardcode 2 org
Các điểm cần sửa:
- Danh sách org trong init gatewayByOrg (đang List.of("Org1", "Org2")).
- ALL_ORG_MSPS trong AccountOptionsService.
- Hàm orgOfUser() trong FabricGatewayService.

## 7) Checklist sau mỗi lần admin cập nhật

### 7.1 Thêm user mới
- Có dòng trong bảng users.
- Có cert/key user trong crypto đúng org.
- Backend đã có bundle crypto mới.
- Backend đã load được identity user (không báo No Fabric identity loaded).
- Login thành công và thao tác role tương ứng chạy được.

### 7.2 Thêm địa điểm mới
- /api/account/options trả dữ liệu đúng cho user.
- Dropdown FE hiển thị đúng location/facility.
- Tạo batch không bị lỗi địa điểm không hợp lệ.

### 7.3 Thêm org mới
- Peer/CA/org mới chạy ổn trong network.
- Backend evaluate và submit tới org mới hoạt động.
- Transfer target hiển thị đúng.

## 8) Rủi ro hiện tại và hướng hoàn thiện product

Rủi ro hiện tại:
- Nhiều mapping hardcode trong backend (users, org, options).
- Mỗi lần thêm user/org thường phải sửa code và redeploy.

Đề xuất để product hóa:
- Tạo bảng user_locations, processing_facilities trong DB thay cho hardcode map.
- Tạo admin API để CRUD user/location/facility.
- Tạo bảng org_config trong DB hoặc config service để không hardcode Org1/Org2.
- Refactor FabricGatewayService để load identity động theo dữ liệu thực tế.

## 9) Gợi ý thứ tự triển khai an toàn
1. Chuẩn hóa user/org trong DB.
2. Chuẩn hóa options theo DB.
3. Refactor load identity động.
4. Bổ sung admin UI/API.
5. Sau đó mới mở rộng org thứ 3 trở lên.

---

Nếu cần, có thể tách tiếp tài liệu này thành 3 runbook nhỏ:
- Runbook thêm user vận hành nhanh.
- Runbook thêm location/facility theo role.
- Runbook mở rộng org mới end-to-end.
