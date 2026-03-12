# CoffeeChain Network — Setup Guide

> **[Unit-3] BE-Member-3** — Maintained by BE-Member-3  
> This directory contains all Hyperledger Fabric 2.5 network configuration and DevOps scripts.

---

## Mục lục

1. [Kiểm tra điều kiện trước](#1-kiểm-tra-điều-kiện-trước)
2. [Chuẩn bị môi trường](#2-chuẩn-bị-môi-trường)
3. [Bước 1 — Khởi động mạng Fabric](#3-bước-1--khởi-động-mạng-fabric)
4. [Bước 2 — Deploy chaincode](#4-bước-2--deploy-chaincode)
5. [Bước 3 — Đăng ký người dùng](#5-bước-3--đăng-ký-người-dùng)
6. [Bước 4 — Khởi động backend và các dịch vụ còn lại](#6-bước-4--khởi-động-backend-và-các-dịch-vụ-còn-lại)
7. [Tắt hệ thống](#7-tắt-hệ-thống)
8. [Tham chiếu cổng dịch vụ](#8-tham-chiếu-cổng-dịch-vụ)
9. [Xử lý lỗi thường gặp](#9-xử-lý-lỗi-thường-gặp)

---

## 1. Kiểm tra điều kiện trước

### 1.1 Docker

Docker **phải đang chạy** trước khi làm bất kỳ bước nào. Kiểm tra:

```bash
docker info
```

- Nếu thấy thông tin engine → Docker đang chạy, tiếp tục.
- Nếu thấy `Cannot connect to the Docker daemon` → Mở Docker Desktop lên (hoặc chạy `sudo systemctl start docker` trên Linux).

Kiểm tra Docker Compose:

```bash
docker compose version
```

Phải ra phiên bản `v2.x` trở lên.

### 1.2 Java 21

```bash
java -version
```

Phải ra `openjdk 21` (hoặc tương đương). Nếu chưa có:

```bash
sudo apt install openjdk-21-jdk -y
```

### 1.3 curl

```bash
curl --version
```

Nếu chưa có: `sudo apt install curl -y`

---

## 2. Chuẩn bị môi trường

> **Lưu ý quan trọng:** Nếu project đang nằm trên ổ Windows (đường dẫn có `/media/...`), lệnh `chmod +x` sẽ không có tác dụng do filesystem NTFS không hỗ trợ Unix permission. Hãy dùng `bash script.sh` thay vì `./script.sh` như hướng dẫn bên dưới.

### 2.1 Tải Fabric binaries về thư mục `bin/`

Mở terminal, `cd` vào thư mục `network/`:

```bash
cd /đường/dẫn/đến/CoffeeChain/network
```

Tải Fabric binaries (cryptogen, configtxgen, peer, fabric-ca-client):

```bash
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.5 -d -s
```

> Lệnh này sẽ tạo thư mục `bin/` và tải các binary vào đó. Quá trình mất vài phút tùy tốc độ mạng.

Sau khi tải xong, kiểm tra:

```bash
ls bin/
# Phải thấy: cryptogen  configtxgen  peer  fabric-ca-client  ...
```

### 2.2 Thêm `bin/` vào PATH

```bash
export PATH="$PWD/bin:$PATH"
```

Kiểm tra:

```bash
cryptogen version
configtxgen --version
```

Cả hai phải in ra version mà không báo lỗi `command not found`.

> **Lưu ý:** `export PATH` chỉ có hiệu lực trong terminal hiện tại. Mỗi lần mở terminal mới trong thư mục `network/`, phải chạy lại lệnh này.

---

## 3. Bước 1 — Khởi động mạng Fabric

Chạy script khởi động mạng:

```bash
bash scripts/setup-network.sh
```

Script này thực hiện theo thứ tự:

1. `cryptogen generate` — tạo thư mục `crypto-config/` với toàn bộ certificates và keys
2. `configtxgen` — tạo `channel-artifacts/genesis.block`, `channel.tx`, anchor peer updates
3. `docker compose up` — khởi động orderer, 2 peers, 2 CAs, 2 CouchDB
4. `peer channel create` — tạo channel `coffee-traceability-channel`
5. Cả 2 peers join channel
6. Cập nhật anchor peers cho cả 2 org (cần thiết cho endorsement policy)

**Thời gian chờ:** khoảng 1–3 phút.

**Kiểm tra sau khi xong:**

```bash
docker ps
```

Phải thấy các container đang chạy (STATUS = `Up`):

```
orderer.example.com
peer0.org1.example.com
peer0.org2.example.com
ca.org1.example.com
ca.org2.example.com
couchdb0
couchdb1
```

---

## 4. Bước 2 — Deploy chaincode

> **Yêu cầu:** Java 21 và Gradle wrapper đã sẵn sàng (Gradle tự tải về, không cần cài thêm).

```bash
bash scripts/deploy-chaincode.sh
```

Script này thực hiện:

1. `./gradlew shadowJar` (trong thư mục `chaincode/`) — build file JAR
2. `peer lifecycle chaincode package` — đóng gói thành `CoffeeTraceChaincode.tar.gz`
3. Cài chaincode lên `peer0.org1` và `peer0.org2`
4. Approve cho Org1MSP và Org2MSP
5. Commit chaincode lên channel với `--sequence 1`

**Thời gian chờ:** khoảng 2–5 phút (lần đầu Gradle tải dependencies).

**Kiểm tra sau khi xong:**

```bash
export PATH="$PWD/bin:$PATH"   # nếu chưa export trong terminal này
peer lifecycle chaincode querycommitted \
  -C coffee-traceability-channel \
  --output json \
  --tls \
  --cafile crypto-config/ordererOrganizations/example.com/orderer/tls/ca.crt
```

Phải thấy `"sequence": 1` trong kết quả.

---

## 5. Bước 3 — Đăng ký người dùng

```bash
bash scripts/register-users.sh
```

Script đăng ký và enroll 5 người dùng demo qua Fabric CA:

| User | Org | Role |
|------|-----|------|
| `farmer_alice` | Org1 | FARMER |
| `processor_bob` | Org1 | PROCESSOR |
| `roaster_charlie` | Org1 | ROASTER |
| `packager_dave` | Org2 | PACKAGER |
| `retailer_eve` | Org2 | RETAILER |

**Kiểm tra sau khi xong:**

```bash
ls crypto-config/peerOrganizations/org1.example.com/users/
# Phải thấy: farmer_alice  processor_bob  roaster_charlie
ls crypto-config/peerOrganizations/org2.example.com/users/
# Phải thấy: packager_dave  retailer_eve
```

---

## 6. Bước 4 — Khởi động backend và các dịch vụ còn lại

```bash
docker compose up -d postgres ipfs backend frontend
```

**Chờ khoảng 30 giây** rồi kiểm tra:

```bash
docker ps
```

Tất cả container phải ở trạng thái `Up` (không phải `Restarting`).

Kiểm tra backend đã sẵn sàng:

```bash
curl http://localhost:8080/actuator/health
# Kết quả mong đợi: {"status":"UP"}
```

Truy cập frontend: [http://localhost:3000](http://localhost:3000)

---

## 7. Tắt hệ thống

```bash
# Dừng tất cả container và xóa volumes
docker compose down -v

# Xóa crypto material và artifacts đã tạo (để reset hoàn toàn)
rm -rf crypto-config channel-artifacts
```

---

## 8. Tham chiếu cổng dịch vụ

| Dịch vụ | Cổng | Ghi chú |
|---------|------|---------|
| orderer.example.com | 7050 | gRPC |
| peer0.org1.example.com | 7051 | gRPC |
| peer0.org2.example.com | 9051 | gRPC |
| ca.org1.example.com | 7054 | HTTPS |
| ca.org2.example.com | 8054 | HTTPS |
| couchdb0 (Org1) | 5984 | HTTP UI tại http://localhost:5984/_utils |
| couchdb1 (Org2) | 7984 | HTTP UI tại http://localhost:7984/_utils |
| postgres | 5432 | |
| ipfs (API) | 5001 | |
| ipfs (Gateway) | 8081 | |
| backend | 8080 | REST API |
| frontend | 3000 | |

---

## 9. Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân | Cách xử lý |
|-----|-------------|------------|
| `Cannot connect to the Docker daemon` | Docker chưa chạy | Mở Docker Desktop hoặc `sudo systemctl start docker` |
| `chmod +x` không có tác dụng, `Permission denied` | Project trên ổ NTFS (Windows) | Dùng `bash scripts/setup-network.sh` thay vì `./scripts/setup-network.sh` |
| `bin/*: No such file or directory` | Chưa tải Fabric binaries | Chạy lại bước 2.1 |
| `cryptogen: command not found` | Chưa export PATH | Chạy `export PATH="$PWD/bin:$PATH"` |
| `Error: failed to create deliver client` | Orderer chưa sẵn sàng | Đợi thêm 30 giây rồi thử lại |
| `ENDORSEMENT_POLICY_FAILURE` | Anchor peers chưa cập nhật | Chạy lại `bash scripts/setup-network.sh` |
| PostgreSQL health check fails | Container khởi động chậm | Đợi thêm 30 giây sau `docker compose up` |
| IPFS CID trống | IPFS chưa khởi động xong | Đợi ~10 giây sau `docker compose up` |
| Backend không load được identity | Chưa chạy register-users.sh | Chạy bước 3, kiểm tra `fabric.org1.usersBasePath` trong `application.yaml` |
| `sequence` mismatch khi deploy chaincode | Đã deploy trước đó | Tăng `CHAINCODE_SEQUENCE` trong `deploy-chaincode.sh` rồi chạy lại |

---

## Cấu trúc thư mục

```
network/
├── configtx.yaml           ← định nghĩa channel + org (cho configtxgen)
├── crypto-config.yaml      ← spec tạo identity (cho cryptogen)
├── docker-compose.yaml     ← toàn bộ containers
├── scripts/
│   ├── setup-network.sh    ← Bước 1: tạo crypto + genesis + channel + peers join
│   ├── deploy-chaincode.sh ← Bước 2: build JAR, install, approve, commit
│   └── register-users.sh   ← Bước 3: CA register + enroll 5 người dùng demo
├── bin/                    ← Fabric binaries (tải về ở bước 2.1)
├── channel-artifacts/      ← tạo tự động bởi setup-network.sh
└── crypto-config/          ← tạo tự động bởi setup-network.sh
```
