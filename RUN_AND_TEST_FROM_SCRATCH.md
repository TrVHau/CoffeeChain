# CoffeeChain - Run & Test Tu Dau (May Moi)

Tai lieu nay la huong dan DUY NHAT de:
- Clean du an ve trang thai fresh
- Clone va chay tren may moi tu dau
- Test full bang Postman
- Biet ro data dang luu o dau de quan ly dung luong

## 1. Data Dang Luu O Dau?

### 1.1 Ma nguon (source code)
- Dang nam tren o share: `/media/sagito/SHARED/WINDOW/BTL/ATBM/CoffeeChain`
- Day la noi luu code + docs + scripts

### 1.2 Fabric crypto va channel artifacts runtime
- Luu o temp:
  - `/tmp/coffeechain-crypto`
  - `/tmp/coffeechain-artifacts`
- Duoc cau hinh trong file `network/.env`:
  - `CRYPTO_BASE=/tmp/coffeechain-crypto`
  - `ARTIFACTS_BASE=/tmp/coffeechain-artifacts`

### 1.3 Docker data (chiem dung luong lon nhat)
- Luu trong Docker local storage (thuong la `/var/lib/docker`)
- Cac volume quan trong cua project:
  - `network_orderer-data`
  - `network_peer0-org1-data`
  - `network_peer0-org2-data`
  - `network_postgres-data`
  - `network_ipfs-data`
- Images + build cache Docker cung chiem rat nhieu dung luong

### 1.4 Lenh kiem tra dung luong nhanh
```bash
# Tong dung luong workspace
cd /media/sagito/SHARED/WINDOW/BTL/ATBM/CoffeeChain
du -sh .

# Temp data cua project
du -sh /tmp/coffeechain-crypto /tmp/coffeechain-artifacts 2>/dev/null || true

# Tong quan Docker usage
docker system df

# Liet ke volume lien quan project
docker volume ls --format '{{.Name}}' | grep '^network_'
```

## 2. Clean Du An (Truoc Khi Chay Lai Tu Dau)

Chay tu root project:
```bash
cd /media/sagito/SHARED/WINDOW/BTL/ATBM/CoffeeChain
```

### 2.1 Stop va xoa container/volume cua stack
```bash
cd network
docker compose down -v
# Neu tung chay stack backend-only:
docker compose -f docker-compose.be-only.yaml down -v || true
```

### 2.2 Xoa temp runtime data
```bash
sudo rm -rf /tmp/coffeechain-crypto /tmp/coffeechain-artifacts /tmp/coffee-ca-client
```

### 2.3 Xoa build artifacts trong source tree
```bash
cd /media/sagito/SHARED/WINDOW/BTL/ATBM/CoffeeChain
rm -rf chaincode/build chaincode/.gradle backend/target frontend/.next
```

### 2.4 (Tuy chon) Don Docker cache de giai phong nhieu GB
```bash
# Can than: se xoa cache/image khong dung
docker system prune -a --volumes
```

## 3. Chay Tu Dau Tren May Moi (Fresh Clone)

## 3.1 Prerequisites
Can co:
- Docker + Docker Compose
- Java 11+ (khuyen nghi 17/21)
- Maven 3.6+
- Git
- curl, jq

Kiem tra:
```bash
docker --version
docker compose version
java -version
mvn -version
git --version
jq --version
```

## 3.2 Clone project
```bash
cd /duong-dan-ban-muon-luu-code
git clone <YOUR_REPO_URL> CoffeeChain
cd CoffeeChain
```

## 3.3 Download Fabric binaries (lan dau)
```bash
cd network
curl -sSL https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh | bash -s
ls bin
# Can thay: peer, configtxgen, cryptogen, orderer...
```

## 3.4 Setup network
```bash
cd /duong-dan/CoffeeChain/network
bash scripts/setup-network.sh
```

Neu script hoi `sudo password` khi copy crypto sang `/tmp`, nhap password binh thuong.

Xac minh:
```bash
docker ps | grep -E 'peer|orderer|ca|couchdb'
docker exec peer0.org1.example.com peer channel list
# Ky vong co channel: coffee-traceability-channel
```

## 3.5 Register demo users
```bash
cd /duong-dan/CoffeeChain/network
bash scripts/register-users.sh
```

Sau do fix permission de backend doc duoc key:
```bash
sudo chmod -R go+r /tmp/coffeechain-crypto
sudo find /tmp/coffeechain-crypto -type d -exec chmod go+rx {} \;
```

Kiem tra user MSP:
```bash
ls /tmp/coffeechain-crypto/peerOrganizations/org1.example.com/users/
ls /tmp/coffeechain-crypto/peerOrganizations/org2.example.com/users/
```

## 3.6 Deploy chaincode
```bash
cd /duong-dan/CoffeeChain/network
bash scripts/deploy-chaincode.sh
```

Xac minh chaincode commit:
```bash
docker exec -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/admin-msp \
  peer0.org1.example.com \
  peer lifecycle chaincode querycommitted \
  --channelID coffee-traceability-channel
```

## 3.7 Build backend
```bash
cd /duong-dan/CoffeeChain/backend
mvn clean package -DskipTests
```

## 3.8 Start backend + db + ipfs (khong can frontend)
Quan trong: frontend hien co the fail build trong mot so moi truong, khong anh huong API test.

```bash
cd /duong-dan/CoffeeChain/network
docker compose up -d postgres ipfs backend
```

Xac minh backend:
```bash
curl -s http://localhost:8080/swagger-ui.html | head -1
# Ky vong: HTML doctype

docker compose logs --tail 100 backend | grep -E 'Started CoffeeTraceApplication|ERROR'
```

## 4. Test Full Bang Postman (Chi Tiet)

## 4.1 Tao Postman Environment
Tao environment `CoffeeChain Local`:
- `base_url` = `http://localhost:8080`
- `token` = (de trong)
- `batchId` = (de trong)
- `publicCode` = (de trong)

## 4.2 Login (bat buoc)
Request:
- Method: `POST`
- URL: `{{base_url}}/api/auth/login`
- Body JSON:
```json
{
  "userId": "farmer_alice",
  "password": "pw123"
}
```

Test script (tab Tests) de luu token:
```javascript
const res = pm.response.json();
pm.environment.set("token", res.token);
```

## 4.3 Harvest - tao batch
Request:
- Method: `POST`
- URL: `{{base_url}}/api/harvest`
- Header: `Authorization: {{token}}`
- Body JSON:
```json
{
  "farmLocation": "Da Lat, Lam Dong",
  "harvestDate": "2026-03-21",
  "coffeeVariety": "Arabica",
  "weightKg": "500.0"
}
```

Test script de luu `batchId` + `publicCode`:
```javascript
const res = pm.response.json();
pm.environment.set("batchId", res.batchId);
pm.environment.set("publicCode", res.publicCode);
```

## 4.4 Processor receive
- `POST {{base_url}}/api/processing/receive/{{batchId}}`
- Login bang `processor_bob/pw123` truoc, cap nhat `token`

## 4.5 Processor process
- `POST {{base_url}}/api/processing/process/{{batchId}}`
- Body vi du:
```json
{
  "method": "Wet",
  "notes": "Washed and dried"
}
```

## 4.6 Roaster roast
- Login `roaster_charlie/pw123`
- `POST {{base_url}}/api/roasting/roast/{{batchId}}`
- Body vi du:
```json
{
  "roastLevel": "Medium",
  "temperature": "200C"
}
```

## 4.7 Packager package
- Login `packager_dave/pw123`
- `POST {{base_url}}/api/packaging/package/{{batchId}}`
- Body vi du:
```json
{
  "packageType": "Bag",
  "size": "500g"
}
```

## 4.8 Retailer receive
- Login `retailer_eve/pw123`
- `POST {{base_url}}/api/retail/receive/{{batchId}}`

## 4.9 Public trace
- `GET {{base_url}}/api/public/trace/{{publicCode}}`
- Ky vong thay full lifecycle cua batch

## 4.10 Kiem tra nhanh bang curl (khong can Postman)
```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"farmer_alice","password":"pw123"}' | jq -r '.token')

curl -s -X POST http://localhost:8080/api/harvest \
  -H "Content-Type: application/json" \
  -H "Authorization: $TOKEN" \
  -d '{"harvestDate":"2026-03-21","farmLocation":"Da Lat","coffeeVariety":"Arabica","weightKg":"500"}' | jq .
```

## 5. Loi Thuong Gap Va Cach Xu Ly

### 5.1 Loi: No Fabric identity loaded for user
Nguyen nhan: backend khong doc duoc key user MSP.

Fix:
```bash
sudo chmod -R go+r /tmp/coffeechain-crypto
sudo find /tmp/coffeechain-crypto -type d -exec chmod go+rx {} \;
cd /duong-dan/CoffeeChain/network
docker compose restart backend
```

### 5.2 Loi: chaincode not found / FAILED_PRECONDITION
Nguyen nhan: chua deploy chaincode hoac da xoa volume.

Fix:
```bash
cd /duong-dan/CoffeeChain/network
bash scripts/setup-network.sh
bash scripts/register-users.sh
bash scripts/deploy-chaincode.sh
```

### 5.3 Loi frontend build khi `docker compose up -d`
Khong can frontend de test backend API.

Dung lenh nay thay the:
```bash
docker compose up -d postgres ipfs backend
```

## 6. Bo Lenh "Reset va Chay Lai Tu Dau" (Copy-Paste)

```bash
cd /duong-dan/CoffeeChain/network

docker compose down -v
sudo rm -rf /tmp/coffeechain-crypto /tmp/coffeechain-artifacts /tmp/coffee-ca-client

bash scripts/setup-network.sh
bash scripts/register-users.sh
sudo chmod -R go+r /tmp/coffeechain-crypto
sudo find /tmp/coffeechain-crypto -type d -exec chmod go+rx {} \;
bash scripts/deploy-chaincode.sh

docker compose up -d postgres ipfs backend

curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"farmer_alice","password":"pw123"}' | jq .
```

Neu login ra token la he thong da san sang test Postman.
