# CoffeeChain — Hướng Dẫn Deploy Chi Tiết

> **Môi trường đã kiểm tra**: Ubuntu 22.04 LTS / Linux, Docker Engine 24+  
> **Project path**: `/media/sagito/SHARED/WINDOW/BTL/ATBM/CoffeeChain`  
> **Lưu ý NTFS**: Project nằm trên ổ Windows NTFS — dùng `bash scripts/...` thay vì `./scripts/...`

---

## MỤC LỤC

1. [Yêu cầu cài đặt](#1-yêu-cầu-cài-đặt)
2. [Chế độ A — Backend-only (không cần Fabric)](#2-chế-độ-a--backend-only-không-cần-fabric)
3. [Chế độ B — Full Fabric Stack (đầy đủ)](#3-chế-độ-b--full-fabric-stack-đầy-đủ)
4. [Khởi động lại sau reboot](#4-khởi-động-lại-sau-reboot)
5. [Dừng và reset](#5-dừng-và-reset)
6. [Kiểm tra sức khoẻ hệ thống](#6-kiểm-tra-sức-khoẻ-hệ-thống)
7. [Cổng và dịch vụ](#7-cổng-và-dịch-vụ)
8. [Biến môi trường quan trọng](#8-biến-môi-trường-quan-trọng)
9. [Xử lý lỗi deploy](#9-xử-lý-lỗi-deploy)

---

## 1. Yêu cầu cài đặt

### 1.1 Phần mềm bắt buộc

| Phần mềm | Version tối thiểu | Lệnh kiểm tra |
|---|---|---|
| **Docker Engine** | 24.x | `docker --version` |
| **Docker Compose** | v2.x (plugin) | `docker compose version` |
| **Java 21** | OpenJDK 21+ | `java -version` |
| **Gradle wrapper** | 8.x | `cd chaincode && bash gradlew --version` |
| **fabric-ca-client** | 1.5.x | `fabric-ca-client version` |

### 1.2 Phần mềm chỉ cần cho Chế độ B (Full Fabric)

| Phần mềm | Lệnh kiểm tra |
|---|---|
| `cryptogen` | `cryptogen version` |
| `configtxgen` | `configtxgen --version` |
| `peer` (CLI binary) | `peer version` |

### 1.3 Cài Docker Engine trên Ubuntu

```bash
sudo apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
sudo apt update && sudo apt install -y ca-certificates curl gnupg lsb-release
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Chạy Docker không cần sudo (logout/login lại sau lệnh này)
sudo usermod -aG docker $USER
newgrp docker
```

### 1.4 Cài Fabric binaries (chỉ cần Chế độ B)

```bash
cd /media/sagito/SHARED/WINDOW/BTL/ATBM/CoffeeChain/network

# Tải binaries vào bin/ (-d: chỉ binaries, -s: bỏ qua docker images)
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.5 -d -s

# Thêm vào PATH (cần chạy lại mỗi lần mở terminal mới)
export PATH="$PWD/bin:$PATH"

# Kiểm tra
cryptogen version && configtxgen --version && peer version
```

### 1.5 Cài fabric-ca-client (chỉ cần Chế độ B)

```bash
CA_VERSION="1.5.7"
curl -sSL "https://github.com/hyperledger/fabric-ca/releases/download/v${CA_VERSION}/hyperledger-fabric-ca-linux-amd64-${CA_VERSION}.tar.gz" \
  -o /tmp/fabric-ca.tar.gz
tar -xzf /tmp/fabric-ca.tar.gz -C /tmp/
sudo mv /tmp/bin/fabric-ca-client /usr/local/bin/
fabric-ca-client version
```

### 1.6 Thêm hostnames vào /etc/hosts (bắt buộc — làm 1 lần duy nhất)

```bash
echo "127.0.0.1 ca.org1.example.com ca.org2.example.com peer0.org1.example.com peer0.org2.example.com orderer.example.com" \
  | sudo tee -a /etc/hosts

# Kiểm tra
ping -c1 ca.org1.example.com
```

> **Lý do**: `fabric-ca-client` kết nối CA qua hostname. Docker CA container sinh TLS cert có SAN `ca.org1.example.com` — DNS phải resolve được hostname đó.

---

## 2. Chế độ A — Backend-only (không cần Fabric)

> Dùng để test auth, query read-model, trace API, Swagger UI.  
> Fabric-dependent endpoints (POST /api/harvest, /api/process...) trả `HTTP 500` — bình thường.

### 2.1 Build và khởi động

```bash
cd /media/sagito/SHARED/WINDOW/BTL/ATBM/CoffeeChain/network

# Lần đầu — build image + khởi động (mất 3-5 phút, Maven download deps)
docker compose -f docker-compose.be-only.yaml up --build -d

# Từ lần 2 trở đi
docker compose -f docker-compose.be-only.yaml up -d
```

### 2.2 Xác nhận backend sẵn sàng

```bash
# Đợi 30-60 giây rồi kiểm tra
docker logs backend 2>&1 | grep "Started CoffeeTraceApplication"

curl -s http://localhost:8080/actuator/health | python3 -m json.tool
```

Kết quả mong đợi: `{"status": "UP"}`

Swagger UI: **http://localhost:8080/swagger-ui.html**

### 2.3 Trạng thái containers mong đợi

```bash
docker compose -f docker-compose.be-only.yaml ps
```

| Container | Port | Trạng thái |
|---|---|---|
| `postgres` | 5432 | `Up (healthy)` |
| `ipfs` | 5001, 8081 | `Up` |
| `backend` | 8080 | `Up` |

---

## 3. Chế độ B — Full Fabric Stack (đầy đủ)

> Dùng khi test toàn bộ flow: harvest → process → roast → transfer → package → retail.

### Tổng quan 4 bước

```
B1. bash scripts/setup-network.sh    — Fabric network (orderer, peers, CAs, channel)
B2. bash scripts/deploy-chaincode.sh — Deploy chaincode lên channel
B3. bash scripts/register-users.sh   — Đăng ký 5 user demo trên Fabric CA
B4. docker compose up -d             — Khởi động backend + postgres + ipfs
```

---

### Bước B1 — Thiết lập Fabric network

```bash
cd /media/sagito/SHARED/WINDOW/BTL/ATBM/CoffeeChain/network
export PATH="$PWD/bin:$PATH"

bash scripts/setup-network.sh
```

**Những gì script làm:**

1. Xoá `network/crypto-config/` và `network/channel-artifacts/` cũ
2. `cryptogen generate` → sinh crypto material vào `network/crypto-config/`
3. Copy sang `/tmp/coffeechain-crypto/` (fix NTFS bind mount)
4. `configtxgen` sinh genesis block + channel.tx + anchor peer tx
5. Copy artifacts sang `/tmp/coffeechain-artifacts/`
6. Copy orderer TLS CA cert → `/tmp/coffeechain-artifacts/orderer-tls-ca.crt`
7. Ghi `network/.env`:
   ```
   CRYPTO_BASE=/tmp/coffeechain-crypto
   ARTIFACTS_BASE=/tmp/coffeechain-artifacts
   ```
8. `docker compose up -d` orderer + peers + CouchDBs + CAs
9. Đợi 15 giây cho containers init
10. `peer channel create` tạo channel `coffee-traceability-channel`
11. `peer channel join` cho Org1 peer
12. `peer channel fetch + join` cho Org2 peer
13. `peer channel update` anchor peers cho cả 2 org

**Kiểm tra:**
```bash
docker exec peer0.org1.example.com peer channel list
# → coffee-traceability-channel

docker ps --format "table {{.Names}}\t{{.Status}}"
# → 7 containers đều Up
```

---

### Bước B2 — Deploy chaincode

```bash
cd /media/sagito/SHARED/WINDOW/BTL/ATBM/CoffeeChain/network
export PATH="$PWD/bin:$PATH"

bash scripts/deploy-chaincode.sh
```

**Những gì script làm:**

1. `bash gradlew shadowJar` trong `chaincode/` → `build/libs/chaincode.jar`
2. `peer lifecycle chaincode package` → `CoffeeTraceChaincode.tar.gz`
3. `docker pull hyperledger/fabric-javaenv:2.5` (base image peer dùng để build Java cc)
4. `docker cp` + `peer lifecycle chaincode install` lên peer0.org1
5. `docker cp` + `peer lifecycle chaincode install` lên peer0.org2
6. Lấy `PACKAGE_ID` từ `queryinstalled`
7. `peer lifecycle chaincode approveformyorg` từ Org1
8. `peer lifecycle chaincode approveformyorg` từ Org2
9. `peer lifecycle chaincode commit` với endorsement cả 2 org

**Kiểm tra:**
```bash
docker exec peer0.org1.example.com peer lifecycle chaincode querycommitted \
  --channelID coffee-traceability-channel
# → Name: CoffeeTraceChaincode, Version: 1.0, Sequence: 1
```

---

### Bước B3 — Đăng ký user demo

```bash
cd /media/sagito/SHARED/WINDOW/BTL/ATBM/CoffeeChain/network

bash scripts/register-users.sh
```

Script kết nối Fabric CA, registering + enrolling 5 user:

| User | Password | Role | Org |
|---|---|---|---|
| `farmer_alice` | `farmer_alicepw` | FARMER | Org1MSP |
| `processor_bob` | `processor_bobpw` | PROCESSOR | Org1MSP |
| `roaster_charlie` | `roaster_charliepw` | ROASTER | Org1MSP |
| `packager_dave` | `packager_davepw` | PACKAGER | Org2MSP |
| `retailer_eve` | `retailer_evepw` | RETAILER | Org2MSP |

> **Lưu ý**: Password CA (`farmer_alicepw`) khác với password login API (`pw123`). API password được seed bởi Flyway, Fabric CA password chỉ dùng khi enroll.

**Kiểm tra:**
```bash
ls /tmp/coffeechain-crypto/peerOrganizations/org1.example.com/users/ | grep -v "Admin\|User"
# → farmer_alice  processor_bob  roaster_charlie

ls /tmp/coffeechain-crypto/peerOrganizations/org1.example.com/users/farmer_alice/msp/signcerts/
# → cert.pem
```

---

### Bước B4 — Khởi động backend + infra

```bash
cd /media/sagito/SHARED/WINDOW/BTL/ATBM/CoffeeChain/network

docker compose up -d postgres ipfs backend
```

**Đợi backend init (30-60 giây):**
```bash
docker logs -f backend 2>&1 | grep -m1 "Started CoffeeTraceApplication"
```

**Kiểm tra toàn bộ:**
```bash
# Health check
curl -s http://localhost:8080/actuator/health | python3 -m json.tool

# Login thử với farmer_alice
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"farmer_alice","password":"pw123"}' | python3 -m json.tool
```

Nếu login thành công trả về token → backend đã kết nối Fabric identity thành công.

---

## 4. Khởi động lại sau reboot

> `/tmp/` bị xoá sau reboot. Phải khởi tạo lại crypto materials.

### Chế độ A

```bash
cd /media/sagito/SHARED/WINDOW/BTL/ATBM/CoffeeChain/network
docker compose -f docker-compose.be-only.yaml up -d
```

### Chế độ B (toàn bộ)

```bash
cd /media/sagito/SHARED/WINDOW/BTL/ATBM/CoffeeChain/network
export PATH="$PWD/bin:$PATH"

docker compose down
sudo rm -rf /tmp/coffeechain-crypto /tmp/coffeechain-artifacts

bash scripts/setup-network.sh
bash scripts/deploy-chaincode.sh
bash scripts/register-users.sh
docker compose up -d postgres ipfs backend
```

---

## 5. Dừng và reset

```bash
cd /media/sagito/SHARED/WINDOW/BTL/ATBM/CoffeeChain/network

# Dừng giữ data
docker compose stop                                       # Chế độ B
docker compose -f docker-compose.be-only.yaml stop       # Chế độ A

# Khởi động lại
docker compose start
docker compose -f docker-compose.be-only.yaml start

# Reset hoàn toàn (xoá DB + Fabric data)
docker compose down -v
sudo rm -rf /tmp/coffeechain-crypto /tmp/coffeechain-artifacts
rm -f CoffeeTraceChaincode.tar.gz
```

---

## 6. Kiểm tra sức khoẻ hệ thống

```bash
# Backend
curl -s http://localhost:8080/actuator/health | python3 -m json.tool

# PostgreSQL
docker exec postgres pg_isready -U coffeetrace

# CouchDB Org1 (State DB)
curl -s http://admin:adminpw@localhost:5984/_up

# IPFS
curl -s -X POST http://localhost:5001/api/v0/id | python3 -m json.tool | grep "ID"

# Chaincode committed trên channel
docker exec peer0.org1.example.com \
  peer lifecycle chaincode querycommitted --channelID coffee-traceability-channel

# Log realtime
docker logs -f backend
docker logs -f peer0.org1.example.com
docker logs -f peer0.org2.example.com
```

---

## 7. Cổng và dịch vụ

| Service | Container | Host Port | URL |
|---|---|---|---|
| Backend REST API | `backend` | **8080** | `http://localhost:8080` |
| Swagger UI | `backend` | **8080** | `http://localhost:8080/swagger-ui.html` |
| API Docs (JSON) | `backend` | **8080** | `http://localhost:8080/api-docs` |
| PostgreSQL | `postgres` | 5432 | — |
| IPFS API | `ipfs` | 5001 | — |
| IPFS Gateway | `ipfs` | 8081 | `http://localhost:8081/ipfs/<CID>` |
| Orderer | `orderer.example.com` | 7050 | gRPC |
| Peer Org1 | `peer0.org1.example.com` | 7051 | gRPC |
| Peer Org2 | `peer0.org2.example.com` | 9051 | gRPC |
| CA Org1 | `ca.org1.example.com` | 7054 | HTTPS |
| CA Org2 | `ca.org2.example.com` | 8054 | HTTPS |
| CouchDB Org1 | `couchdb0` | 5984 | `http://localhost:5984/_utils` |
| CouchDB Org2 | `couchdb1` | 7984 | `http://localhost:7984/_utils` |

---

## 8. Biến môi trường quan trọng

### `network/.env` (tự sinh bởi `setup-network.sh`)

```env
CRYPTO_BASE=/tmp/coffeechain-crypto
ARTIFACTS_BASE=/tmp/coffeechain-artifacts
```

`docker-compose.yaml` dùng `${CRYPTO_BASE:-./crypto-config}` — nếu file `.env` không tồn tại, fallback về `./crypto-config`.

### Backend environment (trong `docker-compose.yaml`)

| Biến | Giá trị mặc định |
|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://postgres:5432/coffeetrace` |
| `SPRING_DATASOURCE_USERNAME` | `coffeetrace` |
| `DB_PASSWORD` | `secret` |
| `FABRIC_CHANNEL_NAME` | `coffee-traceability-channel` |
| `FABRIC_CHAINCODE_NAME` | `CoffeeTraceChaincode` |
| `FABRIC_ORG1_PEER_ENDPOINT` | `peer0.org1.example.com:7051` |
| `FABRIC_ORG2_PEER_ENDPOINT` | `peer0.org2.example.com:9051` |

---

## 9. Xử lý lỗi deploy

### `no such host` khi chạy register-users.sh

```
dial tcp: lookup ca.org1.example.com ... no such host
```

Fix: Xem mục 1.6 — thêm hostnames vào `/etc/hosts`.

---

### TLS verify failed: `certificate is valid for <container-id>, not ca.org1.example.com`

Fabric CA tự sinh TLS cert với container ID làm hostname. Cần thêm SAN `ca.org1.example.com` rồi regenerate:

```bash
# 1. Thêm hostname vào CSR config
CONT_ID=$(grep -A3 "hosts:" /tmp/coffeechain-crypto/peerOrganizations/org1.example.com/ca/fabric-ca-server-config.yaml \
  | grep -v "hosts:\|localhost" | tr -d ' -')
sudo sed -i "s/     - $CONT_ID/     - ca.org1.example.com\n     - $CONT_ID/" \
  /tmp/coffeechain-crypto/peerOrganizations/org1.example.com/ca/fabric-ca-server-config.yaml

CONT_ID2=$(grep -A3 "hosts:" /tmp/coffeechain-crypto/peerOrganizations/org2.example.com/ca/fabric-ca-server-config.yaml \
  | grep -v "hosts:\|localhost" | tr -d ' -')
sudo sed -i "s/     - $CONT_ID2/     - ca.org2.example.com\n     - $CONT_ID2/" \
  /tmp/coffeechain-crypto/peerOrganizations/org2.example.com/ca/fabric-ca-server-config.yaml

# 2. Xoá cert cũ (write-protected, cần sudo)
sudo rm -f /tmp/coffeechain-crypto/peerOrganizations/org1.example.com/ca/tls-cert.pem
sudo rm -f /tmp/coffeechain-crypto/peerOrganizations/org2.example.com/ca/tls-cert.pem

# 3. Restart để regenerate
sudo docker restart ca.org1.example.com ca.org2.example.com && sleep 6

# 4. Xác nhận
openssl x509 -in /tmp/coffeechain-crypto/peerOrganizations/org1.example.com/ca/tls-cert.pem \
  -noout -text 2>/dev/null | grep "DNS:"
# → DNS:ca.org1.example.com, DNS:<container-id>, DNS:localhost
```

---

### `Permission denied` khi xoá `/tmp/coffeechain-crypto/`

CA container chạy bằng root, tạo files owned by root:

```bash
sudo rm -rf /tmp/coffeechain-crypto /tmp/coffeechain-artifacts
```

---

### `./gradlew: Permission denied`

Project trên NTFS, dùng `bash`:
```bash
cd chaincode && bash gradlew shadowJar
```

---

### Port 8080 bị chiếm

```bash
ss -tlnp | grep :8080
sudo kill -9 <PID>
# Hoặc đổi port: sửa "8080:8080" → "9090:8080" trong docker-compose
```

---

### `docker: permission denied`

```bash
sudo usermod -aG docker $USER
newgrp docker
```
