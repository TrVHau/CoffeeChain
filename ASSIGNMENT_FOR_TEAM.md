# CoffeeChain — Phân Công Nhóm 5 Thành Viên
**Bài tập lớn: An Toàn Bảo Mật Thông Tin — Blockchain Truy Vết Nguồn Gốc Cà Phê**

---

## 📊 Tổng Quan Hệ Thống

Dự án này là hệ thống **truy xuất nguồn gốc cà phê end-to-end** sử dụng Hyperledger Fabric blockchain.
Mỗi thành viên sẽ đảm nhận 1 **module dọc** (vertical slice) — từ business logic → backend → frontend → chaincode → deployment.

```
┌─────────────────────────────────────────────────────────────────┐
│                     CHUỖI CUNG ỨNG CÀ PHÊ                      │
├─────────────────────────────────────────────────────────────────┤
│  🌱 FARMER (Thành viên 1)                                      │
│     → Tạo HarvestBatch, ghi nhật ký canh tác                  │
│     → Backend: FarmerController, EventIndexer                  │
│                                                                 │
│  🏭 PROCESSOR (Thành viên 2)                                   │
│     → Tạo ProcessedBatch từ HarvestBatch                      │
│     → Backend: ProcessorController                             │
│                                                                 │
│  🔥 ROASTER (Thành viên 3)                                     │
│     → Tạo RoastBatch, upload chứng cứ, yêu cầu bàn giao      │
│     → Backend: RoasterController, EvidenceService             │
│                                                                 │
│  📦 PACKAGER (Thành viên 4)                                    │
│     → Chấp nhận bàn giao, tạo PackagedBatch, sinh QR          │
│     → Backend: PackagerController, QrCodeService              │
│                                                                 │
│  🛒 RETAILER (Thành viên 5)                                    │
│     → Nhập kho, bán hàng, truy xuất công khai                 │
│     → Backend: RetailerController, TraceController            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  🔧 INFRASTRUCTURE (Shared responsibility)                     │
│     → Network setup, Chaincode deployment                      │
│     → Docker, Fabric, Deployment scripts                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 👤 THÀNH VIÊN 1: FARMER MODULE

**Trách Nhiệm:** Quản lý khâu thu hoạch, ghi nhật ký canh tác, tạo HarvestBatch

### Nhiệm Vụ

1. **Hiểu luồng nghiệp vụ Farmer:**
   - Tạo HarvestBatch (farm location, harvest date, variety, weight)
   - Ghi nhật ký canh tác (farm activities: tưới, bón phân, phun thuốc, tỉa cành...)
   - Cập nhật status: CREATED → IN_PROCESS → COMPLETED

2. **Backend (Spring Boot + Fabric):**
   - `FarmerController.java` — REST endpoints cho farmer
   - `FarmActivityEntity.java` — lưu farm activities
   - `FarmActivityRepository.java` — query farm activities
   - Logic validate weight, công khai code
   - Gọi `FabricGatewayService` submit transaction

3. **Frontend (Next.js):**
   - `/dashboard/farmer/page.tsx` — danh sách batch và form tạo
   - `/dashboard/farmer/[id]/page.tsx` — chi tiết batch
   - `/dashboard/farmer/update/page.tsx` — cập nhật status
   - Component "Thêm nhật ký canh tác" (farm activity log)

4. **Chaincode (Java):**
   - Function `createHarvestBatch()` — tạo batch trên ledger
   - Function `recordFarmActivity()` — emit FARM_ACTIVITY_RECORDED event
   - Kiểm tra role=FARMER, validate metadata

5. **Deployment / Testing:**
   - Hiểu cách register user `farmer_alice` với role=FARMER
   - Test API endpoint create harvest + farm activity

### Files Chính

**Backend:**
- `backend/src/main/java/com/coffee/trace/controller/FarmerController.java`
- `backend/src/main/java/com/coffee/trace/entity/FarmActivityEntity.java`
- `backend/src/main/java/com/coffee/trace/repository/FarmActivityRepository.java`

**Frontend:**
- `frontend/src/app/dashboard/farmer/page.tsx`
- `frontend/src/app/dashboard/farmer/[id]/page.tsx`
- `frontend/src/app/dashboard/farmer/update/page.tsx`
- `frontend/src/components/FarmActivityLog.tsx`

**Chaincode:**
- `chaincode/src/main/java/com/coffee/trace/chaincode/CoffeeTraceChaincode.java` — hàm `createHarvestBatch()`, `recordFarmActivity()`

**Network & Config:**
- `network/scripts/register-users.sh` — đăng ký farmer_alice user
- `network/crypto-config.yaml`

### Câu Hỏi Vấn Đáp

- Tại sao cần ghi nhật ký canh tác riêng (FARM_ACTIVITY_RECORDED events)?
- Làm sao để verify farm activities liên kết với HarvestBatch?
- Công khai code (public code) được sinh như thế nào?
- Metadata của HarvestBatch lưu những gì?
- Người dùng có thể ghi lại nhật ký ngày quá khứ không?

---

## 👤 THÀNH VIÊN 2: PROCESSOR MODULE

**Trách Nhiệm:** Quản lý khâu sơ chế cà phê, tạo ProcessedBatch

### Nhiệm Vụ

1. **Hiểu luồng nghiệp vụ Processor:**
   - Lấy HarvestBatch đã COMPLETED từ Farmer
   - Tạo ProcessedBatch (method, start/end date, facility, weight)
   - Cập nhật status: CREATED → IN_PROCESS → COMPLETED

2. **Backend (Spring Boot + Fabric):**
   - `ProcessorController.java` — REST endpoints
   - Logic truy vấn HarvestBatch parent (on-chain)
   - Logic validate parent batch status
   - Gọi `FabricGatewayService` submit transaction

3. **Frontend (Next.js):**
   - `/dashboard/processor/page.tsx` — danh sách HarvestBatch available
   - Form tạo ProcessedBatch
   - Component cập nhật status

4. **Chaincode (Java):**
   - Function `createProcessedBatch()` — validate parent batch status, tạo batch mới
   - Event BATCH_CREATED

5. **Testing:**
   - Test flow: HarvestBatch (COMPLETED) → ProcessedBatch (CREATED) → COMPLETED

### Files Chính

**Backend:**
- `backend/src/main/java/com/coffee/trace/controller/ProcessorController.java`
- Query parent batch logic

**Frontend:**
- `frontend/src/app/dashboard/processor/page.tsx`
- `frontend/src/app/dashboard/processor/update/page.tsx`

**Chaincode:**
- `chaincode/src/main/java/com/coffee/trace/chaincode/CoffeeTraceChaincode.java` — hàm `createProcessedBatch()`

### Câu Hỏi Vấn Đáp

- Làm sao validate parent batch từ on-chain?
- Metadata ProcessedBatch lưu gì (method, dates, facility)?
- Weight có thể nhỏ hơn parent batch được không? (Validation)
- Làm sao trace ngược từ ProcessedBatch tới HarvestBatch?

---

## 👤 THÀNH VIÊN 3: ROASTER MODULE

**Trách Nhiệm:** Quản lý khâu rang cà phê, upload chứng cứ, yêu cầu bàn giao

### Nhiệm Vụ

1. **Hiểu luồng nghiệp vụ Roaster:**
   - Lấy ProcessedBatch đã COMPLETED
   - Tạo RoastBatch (profile, date, duration, weight)
   - Upload file chứng cứ (PDF, ảnh) — tính SHA-256 hash, lưu IPFS
   - Cập nhật status: CREATED → IN_PROCESS → COMPLETED
   - **requestTransfer** sang Org2 (PackagerMSP)

2. **Backend (Spring Boot + Fabric):**
   - `RoasterController.java` — REST endpoints
   - `EvidenceService.java` — upload file to IPFS, compute SHA-256
   - Function `addEvidence()` — ghi hash + URI on-chain
   - Function `requestTransfer()` — set State-Based Endorsement (SBE)
   - Validate ProcessedBatch parent

3. **Frontend (Next.js):**
   - `/dashboard/roaster/page.tsx` — danh sách ProcessedBatch available
   - Form tạo RoastBatch + upload evidence file
   - Component xác minh hash file
   - Button "Yêu cầu bàn giao sang Org2"

4. **Chaincode (Java):**
   - Function `createRoastBatch()`
   - Function `addEvidence()` — lưu hash + URI, emit EVIDENCE_ADDED
   - Function `requestTransfer()` — set SBE (AND endorsement trên key)

5. **Testing:**
   - Test upload file, compute hash
   - Test set SBE trên key
   - Test transfer request

### Files Chính

**Backend:**
- `backend/src/main/java/com/coffee/trace/controller/RoasterController.java`
- `backend/src/main/java/com/coffee/trace/service/EvidenceService.java`

**Frontend:**
- `frontend/src/app/dashboard/roaster/page.tsx`
- `frontend/src/components/EvidenceVerifier.tsx` — verify hash

**Chaincode:**
- `chaincode/src/main/java/com/coffee/trace/chaincode/CoffeeTraceChaincode.java` — hàm `createRoastBatch()`, `addEvidence()`, `requestTransfer()`
- `chaincode/src/main/java/com/coffee/trace/chaincode/util/LedgerUtils.java` — set SBE

### Câu Hỏi Vấn Đáp

- File chứng cứ lưu ở đâu (IPFS)? Hash được tính như thế nào?
- State-Based Endorsement là gì? Tại sao dùng cho transfer?
- Người dùng có thể verify file chứng cứ từ phía client được không?
- `requestTransfer()` thay đổi status thành gì (TRANSFER_PENDING)?
- Chaincode phải set SBE = AND('Org1MSP.peer', 'Org2MSP.peer') cho acceptTransfer

---

## 👤 THÀNH VIÊN 4: PACKAGER MODULE

**Trách Nhiệm:** Quản lý khâu đóng gói, chấp nhận bàn giao, sinh QR code

### Nhiệm Vụ

1. **Hiểu luồng nghiệp vụ Packager:**
   - Chấp nhận bàn giao từ Roaster (**acceptTransfer** — AND endorsement)
   - Tạo PackagedBatch (weight, count, date, expiry)
   - Sinh QR code — lưu vào RoastBatch
   - Status: COMPLETED (khởi tạo thẳng, không qua CREATED)

2. **Backend (Spring Boot + Fabric):**
   - `PackagerController.java` — REST endpoints
   - `QrCodeService.java` — sinh QR code (ZXing library)
   - Function `acceptTransfer()` — **AND endorsement** (Org1 + Org2)
   - Function `createPackagedBatch()` — ownerMSP = Org2MSP

3. **Frontend (Next.js):**
   - `/dashboard/packager/page.tsx` — danh sách RoastBatch TRANSFER_PENDING
   - Button "Chấp nhận bàn giao"
   - Form tạo PackagedBatch
   - Component tải QR code

4. **Chaincode (Java):**
   - Function `acceptTransfer()` — **yêu cầu AND endorsement**
   - Function `createPackagedBatch()` — ownerMSP từ ctx đổi sang Org2

5. **Testing:**
   - Test AND endorsement (2 peer phải endorse)
   - Test QR code generation
   - Test PackagedBatch creation

### Files Chính

**Backend:**
- `backend/src/main/java/com/coffee/trace/controller/PackagerController.java`
- `backend/src/main/java/com/coffee/trace/service/QrCodeService.java`

**Frontend:**
- `frontend/src/app/dashboard/packager/page.tsx`

**Chaincode:**
- `chaincode/src/main/java/com/coffee/trace/chaincode/CoffeeTraceChaincode.java` — hàm `acceptTransfer()`, `createPackagedBatch()`

### Câu Hỏi Vấn Đáp

- Tại sao `acceptTransfer()` cần AND endorsement từ cả 2 org?
- QR code chứa thông tin gì (public code, trace URL)?
- ownerMSP thay đổi sau acceptTransfer, có ảnh hưởng gì đến quyền hạn sau này?
- PackagedBatch khởi tạo ở status COMPLETED, tại sao không CREATED?
- Người tiêu dùng scan QR sẽ trỏ tới URL nào?

---

## 👤 THÀNH VIÊN 5: RETAILER & TRACE MODULE

**Trách Nhiệm:** Quản lý khâu bán lẻ, truy xuất công khai, verification

### Nhiệm Vụ

1. **Hiểu luồng nghiệp vụ Retailer:**
   - Nhận PackagedBatch đã TRANSFERRED
   - Cập nhật status: TRANSFERRED → IN_STOCK → SOLD
   - Quản lý tồn kho

2. **Hiểu luồng Trace công khai:**
   - API GET `/api/trace/{publicCode}` — **không cần đăng nhập**
   - Lấy toàn bộ chain (Packaged ← Roast ← Processed ← Harvest)
   - Lấy farm activities từ PostgreSQL
   - Lấy ledger references (txId, blockNumber)
   - Verify trên blockchain

3. **Backend (Spring Boot + Fabric):**
   - `RetailerController.java` — update status IN_STOCK, SOLD
   - `TraceController.java` — query trace công khai
   - `BatchQueryController.java` — query batch khác
   - `PublicFeedController.java` — optional, public feed
   - Logic build trace chain từ DB
   - Logic fallback evaluateTransaction nếu DB lag

4. **Frontend (Next.js):**
   - `/dashboard/retailer/page.tsx` — danh sách hàng tồn kho
   - `/trace/[publicCode]/page.tsx` — trang trace công khai
   - `TraceTimeline.tsx` — hiển thị timeline end-to-end
   - `EvidenceVerifier.tsx` — verify hash file chứng cứ
   - `FarmActivityLog.tsx` — hiển thị nhật ký canh tác

5. **Chaincode (Java):**
   - Function `updateBatchStatus()` — validate role (RETAILER), validate transition
   - Function `getBatch()`, `getTraceChain()` — evaluate (read-only)

6. **Testing:**
   - Test flow: PackagedBatch TRANSFERRED → IN_STOCK → SOLD
   - Test public trace endpoint
   - Test evidence verification

### Files Chính

**Backend:**
- `backend/src/main/java/com/coffee/trace/controller/RetailerController.java`
- `backend/src/main/java/com/coffee/trace/controller/TraceController.java`
- `backend/src/main/java/com/coffee/trace/controller/BatchQueryController.java`
- `backend/src/main/java/com/coffee/trace/repository/BatchRepository.java`

**Frontend:**
- `frontend/src/app/dashboard/retailer/page.tsx`
- `frontend/src/app/trace/[publicCode]/page.tsx`
- `frontend/src/components/TraceTimeline.tsx`
- `frontend/src/components/EvidenceVerifier.tsx`
- `frontend/src/components/FarmActivityLog.tsx`

**Chaincode:**
- `chaincode/src/main/java/com/coffee/trace/chaincode/CoffeeTraceChaincode.java` — hàm `updateBatchStatus()`, `getBatch()`, `getTraceChain()`

### Câu Hỏi Vấn Đáp

- Trang trace công khai có cần authentication không?
- Làm sao xây dựng trace chain từ PackagedBatch ngược lên Harvest?
- Farm activities được lấy từ đâu (on-chain hay PostgreSQL)?
- Verify evidence hash — hash nào đúng? (on-chain vs computed từ client)
- Nếu PostgreSQL lag, fallback chiến lược gì?
- Ledger references (txId, blockNumber) dùng để làm gì?

---

## 🔧 SHARED: INFRASTRUCTURE & DEPLOYMENT

**Trách Nhiệm:** Setup network, deploy chaincode, cấu hình environment

### Nhiệm Vụ

1. **Hyperledger Fabric Network Setup:**
   - Hiểu `docker-compose.yaml` — orderer, peer0.org1, peer0.org2, CA, CouchDB
   - Script `setup-network.sh` — sinh crypto materials, channel artifacts
   - Script `deploy-chaincode.sh` — package + install + instantiate

2. **Chaincode Packaging & Deployment:**
   - Build chaincode: `./gradlew build` (Java)
   - Package & deploy trên fabric network
   - Verify chaincode installed & committed

3. **User Registration:**
   - `register-users.sh` — đăng ký 5 user (farmer, processor, roaster, packager, retailer)
   - Gắn role vào certificate attribute

4. **Database & Services:**
   - PostgreSQL setup — schema, migrations
   - IPFS setup (Kubo)
   - Backend Spring Boot — environment variables

5. **Documentation & Testing:**
   - Cập nhật RUN_AND_TEST_FROM_SCRATCH.md
   - Test từ 0: clean → setup → register → deploy → run backend + frontend
   - Postman collection hoặc curl scripts

### Files Chính

**Network:**
- `network/docker-compose.yaml`
- `network/scripts/setup-network.sh`
- `network/scripts/deploy-chaincode.sh`
- `network/scripts/register-users.sh`
- `network/configtx.yaml`
- `network/crypto-config.yaml`

**Backend Config:**
- `backend/src/main/resources/application.yml`
- `backend/pom.xml` (dependencies)

**Deployment:**
- `RUN_AND_TEST_FROM_SCRATCH.md` — hướng dẫn fresh clone, setup, test
- `run.sh` — quick start script

### Câu Hỏi Vấn Đáp

- Làm sao setup channel từ 0?
- Chaincode phải được install trên mấy peer?
- Role được gắn vào certificate ở đâu? (Fabric CA)
- Crypto materials (MSP) cần setup những gì?
- Endorsement policy là gì? (OR vs AND)
- Làm sao verify network running sau docker compose up?

---

## 📋 QUYÊN TRÁCH & GIAO TIẾP

### Bảng Tóm Tắt Phụ Trách

| Thành Viên | Module | Backend | Frontend | Chaincode | Config |
|-----------|--------|---------|----------|-----------|--------|
| 1 | Farmer | FarmerController | /farmer pages | createHarvestBatch | - |
| 2 | Processor | ProcessorController | /processor pages | createProcessedBatch | - |
| 3 | Roaster | RoasterController | /roaster pages | createRoastBatch, addEvidence, requestTransfer | - |
| 4 | Packager | PackagerController | /packager pages | acceptTransfer, createPackagedBatch | - |
| 5 | Retailer & Trace | RetailerController, TraceController | /retailer, /trace pages | updateBatchStatus, getBatch | - |
| Shared | Infrastructure | FabricGatewayService, Config | - | Deploy, Register users | docker-compose.yaml |

### Giao Tiếp Giữa Các Module

```
Farmer (1)
   ↓ HarvestBatch COMPLETED
Processor (2)
   ↓ ProcessedBatch COMPLETED
Roaster (3)
   ↓ requestTransfer + RoastBatch COMPLETED
Packager (4)
   ↓ acceptTransfer (AND endorsement) + PackagedBatch COMPLETED
Retailer (5)
   ↓ IN_STOCK → SOLD
   ↓ (anyone can) → Trace công khai
```

---

## 🚀 BƯỚC ĐẦU TIÊN (CÓ THỂ CHẠY SONG SONG)

1. **Thành viên Shared (Infrastructure):**
   - Setup network: `bash network/scripts/setup-network.sh`
   - Verify peers + orderer running: `docker ps`

2. **Tất cả thành viên:**
   - Clone repo + read này
   - Xác định files của mình (Backend, Frontend, Chaincode)
   - Review Chaincode functions

3. **Parallel work (các thành viên 1-5):**
   - Mỗi người implement module dọc của họ
   - Test end-to-end flow cho module: input → backend → chaincode → database → frontend
   - Chuẩn bị vấn đáp: 5-10 slides, giải thích business logic + code flow

---

## 📚 TÀI LIỆU THAM KHẢO

- **Backend:**
  - `backend/pom.xml` — dependencies
  - Spring Boot docs
  - Fabric Gateway Java SDK
  - IPFS integration

- **Frontend:**
  - `frontend/package.json` — dependencies
  - Next.js docs
  - QR code generation (ZXing)
  - React hooks

- **Chaincode:**
  - `chaincode/build.gradle`
  - Fabric Contract API (Java)
  - State-Based Endorsement (SBE)

- **Network:**
  - Hyperledger Fabric docs
  - Docker Compose
  - Fabric CA enrollment

---

## ✅ CHECKLIST VẤN ĐÁP

Mỗi thành viên chuẩn bị:

- [ ] Hiểu rõ business flow của module
- [ ] Có thể giải thích mỗi line code backend → frontend → chaincode
- [ ] Có thể trace một transaction từ front-end → blockchain → database
- [ ] Hiểu transaction signature, endorsement policy (nếu liên quan)
- [ ] Hiểu role-based access control (RBAC)
- [ ] Có thể deploy chaincode, run test manual
- [ ] Chuẩn bị 5-10 slides vấn đáp + live demo

---

## 📞 Q&A VÀ SUPPORT

- Code review có vấn đề gì → push branch riêng
- Merge main khi review xong
- Hỏi đội hình khác nếu dependency chưa ready
- Check RUN_AND_TEST_FROM_SCRATCH.md nếu stuck

**Good luck! 🚀☕**
