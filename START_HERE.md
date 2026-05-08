# 📚 HƯỚNG DẪN NHANH CHO TEAM - CoffeeChain Project

Chào mừng bạn! 👋 Dự án này đã được chia thành 5 module dọc (vertical), mỗi thành viên sẽ chịu trách nhiệm hoàn chỉnh 1 module từ business logic → backend → frontend → chaincode → deployment.

---

## 🚀 BẮT ĐẦU NGAY

### Bước 1: Tìm file assignment của bạn

**👉 Mỗi thành viên hãy mở file tương ứng:**

| Thành Viên | Module | File Chính |
|-----------|--------|-----------|
| **1** | 🌱 FARMER (Thu Hoạch) | `MEMBER_1_FARMER.md` |
| **2** | 🏭 PROCESSOR (Sơ Chế) | `MEMBER_2_PROCESSOR.md` |
| **3** | 🔥 ROASTER (Rang Cà Phê) | `MEMBER_3_ROASTER.md` |
| **4** | 📦 PACKAGER (Đóng Gói) | `MEMBER_4_PACKAGER.md` |
| **5** | 🛒 RETAILER & TRACE (Bán Lẻ + Truy Xuất) | `MEMBER_5_RETAILER_TRACE.md` |

**File tổng quan:** `ASSIGNMENT_FOR_TEAM.md` — đọc cái này trước để hiểu toàn bộ hệ thống.

---

## 📂 CẤU TRÚC PROJECT

```
CoffeeChain/
├── ASSIGNMENT_FOR_TEAM.md         ← 📌 ĐỌCDẦN ĐẦU TIÊN
├── MEMBER_1_FARMER.md              ← Assign cho thành viên 1
├── MEMBER_2_PROCESSOR.md           ← Assign cho thành viên 2
├── MEMBER_3_ROASTER.md             ← Assign cho thành viên 3
├── MEMBER_4_PACKAGER.md            ← Assign cho thành viên 4
├── MEMBER_5_RETAILER_TRACE.md      ← Assign cho thành viên 5
│
├── backend/                         ← Spring Boot API Server
│   ├── src/main/java/com/coffee/trace/
│   │   ├── controller/             ← REST endpoints (1 per role)
│   │   ├── service/                ← Business logic (Fabric, Evidence, QR)
│   │   ├── entity/                 ← JPA entities (DB models)
│   │   ├── repository/             ← DB queries
│   │   └── dto/                    ← Request/Response models
│   └── pom.xml                     ← Dependencies
│
├── frontend/                        ← Next.js Web App
│   ├── src/app/
│   │   ├── dashboard/[role]/       ← Role-specific dashboards
│   │   ├── trace/[publicCode]/     ← Public trace page (no auth)
│   │   └── login/                  ← Login page
│   └── package.json
│
├── chaincode/                       ← Hyperledger Fabric Smart Contracts
│   ├── src/main/java/com/coffee/trace/chaincode/
│   │   ├── CoffeeTraceChaincode.java  ← Main contract
│   │   ├── model/Batch.java           ← Data model
│   │   └── util/                      ← Helpers
│   └── build.gradle
│
├── network/                         ← Fabric Network Setup
│   ├── docker-compose.yaml          ← Start Fabric network
│   ├── scripts/
│   │   ├── setup-network.sh         ← Create crypto + channel
│   │   ├── deploy-chaincode.sh      ← Deploy contract
│   │   └── register-users.sh        ← Register 5 users with roles
│   ├── configtx.yaml
│   └── crypto-config.yaml
│
├── aidlc-docs/                      ← AI-DLC workflow artifacts and audit trail
├── RUN_AND_TEST_FROM_SCRATCH.md    ← Setup + test guide
└── README.md                        ← Project overview
```

---

## 🔄 LUỒNG NGHIỆP VỤ TỔNG QUÁT

```
🌱 FARMER (Thành viên 1)
   └─ Tạo HarvestBatch
   └─ Ghi nhật ký canh tác
   └─ Status: CREATED → COMPLETED
      ↓
🏭 PROCESSOR (Thành viên 2)
   └─ Tạo ProcessedBatch (từ HARVEST)
   └─ Status: CREATED → COMPLETED
      ↓
🔥 ROASTER (Thành viên 3)
   └─ Tạo RoastBatch (từ PROCESSED)
   └─ Upload chứng cứ + hash
   └─ Status: CREATED → COMPLETED
   └─ requestTransfer → Org2 (SET SBE)
      ↓
📦 PACKAGER (Thành viên 4) — Org2
   └─ acceptTransfer (AND endorsement!)
   └─ Tạo PackagedBatch
   └─ Sinh QR code
      ↓
🛒 RETAILER (Thành viên 5) — Org2
   └─ Update status: IN_STOCK → SOLD
   └─ Quản lý tồn kho
      ↓
👤 ANYONE (không cần login)
   └─ Quét QR / nhập public code
   └─ Xem trace công khai (full chain)
   └─ Verify chứng cứ từ IPFS
```

---

## 📋 WHAT'S IN YOUR FILE?

Mỗi file assignment của bạn (MEMBER_X_*.md) chứa:

1. **Business Flow** — luồng nghiệp vụ của module
2. **Backend Tasks** — Controllers, Services, DTOs, Entities
3. **Frontend Tasks** — Pages, Components, Forms
4. **Chaincode Tasks** — Smart contract functions
5. **Testing Checklist** — cách test module
6. **Q&A for Presentation** — các câu hỏi thường gặp
7. **Files Chính** — danh sách files cần implement

**👉 Follow từng section theo thứ tự từ trên xuống dưới!**

---

## 🛠️ SETUP ENVIRONMENT (Shared by all)

### Prerequisites

```bash
# Check versions
docker --version
java -version
mvn -version
npm --version
git --version
```

### 1. Clone + Setup Network

```bash
cd E:\WINDOW\BTL\CoffeeChain
cd network

# Sinh crypto materials + channel artifacts
bash scripts/setup-network.sh

# Kiểm tra peers đang chạy
docker ps | grep -E 'peer|orderer|ca|couchdb'

# Đăng ký 5 users (farmer_alice, processor_bob, ...)
bash scripts/register-users.sh

# Deploy chaincode
bash scripts/deploy-chaincode.sh
```

### 2. Build Backend

```bash
cd E:\WINDOW\BTL\CoffeeChain\backend
mvn clean package -DskipTests
```

### 3. Start All Services

```bash
cd E:\WINDOW\BTL\CoffeeChain\network

# Start Fabric + PostgreSQL + IPFS + Backend + Frontend
docker compose up -d

# Kiểm tra backend
curl http://localhost:8080/swagger-ui.html

# Frontend
npm run dev  # http://localhost:3000
```

---

## ✅ SUBMISSION CHECKLIST

Mỗi thành viên chuẩn bị:

### Code
- [ ] Backend implementation (Controllers, Services)
- [ ] Frontend implementation (Pages, Components)
- [ ] Chaincode implementation (Smart contract functions)
- [ ] All tests passing (`mvn test`, `npm test`)
- [ ] Code pushed to branch hoặc PR

### Presentation (5-10 slides)
- [ ] Giải thích business flow của module
- [ ] Walk-through code từ frontend → backend → chaincode
- [ ] Trace 1 transaction end-to-end
- [ ] Giải thích role-based access control
- [ ] Giải thích transaction signature / endorsement (nếu liên quan)
- [ ] Live demo: tạo batch → submit tx → xem result

### Demo
- [ ] Có thể chạy module start-to-end
- [ ] Có thể giải thích từng line of code
- [ ] Có thể trả lời Q&A (5-10 câu hỏi trong file)

---

## 🧪 TESTING GUIDE

### Manual Testing (Postman / curl)

```bash
# 1. Login (farmer_alice / pw123)
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"farmer_alice","password":"pw123"}' | jq

# Save token to $TOKEN

# 2. Create HarvestBatch (Thành viên 1)
curl -X POST http://localhost:8080/api/harvest \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "farmLocation": "Đà Lạt",
    "harvestDate": "2026-03-21",
    "coffeeVariety": "Arabica",
    "weightKg": 500
  }' | jq

# 3. Continue với các role khác...
```

### Unit Tests

```bash
cd backend
mvn test

cd ../frontend
npm test
```

---

## 🎯 CRITICAL POINTS

### Security & Endorsement

1. **Role-Based Access Control:**
   - Mỗi user có certificate với role attribute (FARMER, PROCESSOR, ...)
   - Chaincode kiểm tra role từ certificate
   - Backend kiểm tra role từ JWT token

2. **State-Based Endorsement (SBE):**
   - `requestTransfer()` set SBE = AND trên key
   - `acceptTransfer()` cần AND endorsement (2 org)
   - Đảm bảo transfer không thể bị 1 bên làm single-handedly

3. **Off-chain vs On-chain:**
   - **On-chain:** Batch state, events, ledger (immutable)
   - **Off-chain:** PostgreSQL (mirror), IPFS (files)
   - Backend indexer bắt event → lưu PostgreSQL

### Performance

- Query từ PostgreSQL nhanh hơn on-chain
- Fallback to chain nếu DB lag
- Batch queries để giảm round-trips

---

## 📞 TROUBLESHOOTING

### Network Issues

```bash
# Kiểm tra peers running
docker ps | grep peer

# Kiểm tra chaincode installed
docker exec peer0.org1.example.com \
  peer lifecycle chaincode queryinstalled

# Fix: clean + rebuild
cd network
docker compose down -v
bash scripts/setup-network.sh
bash scripts/deploy-chaincode.sh
```

### Crypto Issues

```bash
# Permission denied for keys
sudo chmod -R go+r /tmp/coffeechain-crypto
sudo find /tmp/coffeechain-crypto -type d -exec chmod go+rx {} \;

# Restart backend
docker compose restart backend
```

### Build Errors

```bash
# Backend
mvn clean install
mvn dependency:tree | grep ERROR

# Frontend
rm -rf node_modules package-lock.json
npm install

# Chaincode
cd chaincode
./gradlew clean build
```

---

## 📚 QUICK LINKS

- **Assignment Tổng Quan:** `ASSIGNMENT_FOR_TEAM.md`
- **Setup & Test:** `RUN_AND_TEST_FROM_SCRATCH.md`
- **Project README:** `README.md`
- **AI-DLC artifacts:** `aidlc-docs/`

---

## 🤝 TEAMWORK

**Sự phụ thuộc giữa modules:**

```
Farmer (1) → Processor (2) → Roaster (3) → Packager (4) → Retailer (5)
```

**Lập kế hoạch:**
1. Farmer + Processor có thể code song song (không phụ thuộc)
2. Roaster phụ thuộc Processor COMPLETED
3. Packager phụ thuộc Roaster requestTransfer
4. Retailer + Trace phụ thuộc Packager COMPLETED + EventIndexer

**Communication:**
- Daily standup: status + blockers
- PR review: code quality + logic correctness
- Testing: verify dependencies ready

---

## 🎓 VẤN ĐÁP PRESENTATION TIPS

**Chuẩn bị cho mỗi câu hỏi:**
1. Tại sao thiết kế như vậy?
2. Làm sao implement?
3. Cách test nó?
4. Edge cases?
5. Security implications?

**Live demo tips:**
- Chuẩn bị script curl / Postman collection
- Tận dụng PostgreSQL queries để show data
- Dùng blockchain explorer (optional) để show tx + events
- Giải thích role-based permissions trực quan

---

## ✨ FINAL CHECKLIST

**Before Submission:**
- [ ] Read `ASSIGNMENT_FOR_TEAM.md`
- [ ] Read your own `MEMBER_X_*.md`
- [ ] Implement all tasks (Backend + Frontend + Chaincode)
- [ ] All tests passing
- [ ] Code quality: no TODOs, no console.log, proper error handling
- [ ] Presentation ready: slides + demo scripts
- [ ] Can explain every line of code
- [ ] Can answer 5-10 technical Q&A

**Demo day:**
- [ ] All services running (docker compose up -d)
- [ ] Postman collection ready
- [ ] Presentation slides ready
- [ ] Live demo scripts tested
- [ ] Team ready to answer questions

---

## 🚀 LET'S GO!

**Next steps:**

1. ✅ Đọc `ASSIGNMENT_FOR_TEAM.md`
2. ✅ Mở file assignment của bạn (`MEMBER_X_*.md`)
3. ✅ Setup environment (dùng `RUN_AND_TEST_FROM_SCRATCH.md`)
4. ✅ Start implementing theo tasks trong file của bạn
5. ✅ Test module end-to-end
6. ✅ Chuẩn bị presentation
7. ✅ Demo time! 🎉

**Questions? Blockers?** → Ask team immediately, don't wait.

**Good luck! ☕🚀**
