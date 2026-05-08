# 📌 TEAM ASSIGNMENT SUMMARY
**CoffeeChain - Blockchain Truy Vết Nguồn Gốc Cà Phê**

---

## ✅ CÁC FILE ĐÃ ĐƯỢC TẠO

### 📖 File Hướng Dẫn Chính

| File | Nội Dung | Người Đọc |
|------|---------|----------|
| **START_HERE.md** | 🚀 Bắt đầu nhanh - đọc trước tiên | **TẤT CẢ** |
| **ASSIGNMENT_FOR_TEAM.md** | 📊 Tổng quan hệ thống + phân công chi tiết | **TẤT CẢ** |
| **RUN_AND_TEST_FROM_SCRATCH.md** | 🔧 Setup environment, test e2e | **TẤT CẢ** |

### 👤 File Assignment Từng Thành Viên

| Thành Viên | Module | File | Trọng Tâm |
|-----------|--------|------|----------|
| **1** | 🌱 FARMER | `MEMBER_1_FARMER.md` | Tạo HarvestBatch, farm activities |
| **2** | 🏭 PROCESSOR | `MEMBER_2_PROCESSOR.md` | Tạo ProcessedBatch từ Harvest |
| **3** | 🔥 ROASTER | `MEMBER_3_ROASTER.md` | RoastBatch, evidence, transfer request |
| **4** | 📦 PACKAGER | `MEMBER_4_PACKAGER.md` | Accept transfer (AND endorsement), QR code |
| **5** | 🛒 RETAILER & TRACE | `MEMBER_5_RETAILER_TRACE.md` | Bán lẻ, trace công khai, verify |

---

## 🎯 CẤU TRÚC MỖI FILE ASSIGNMENT

Mỗi file `MEMBER_X_*.md` chứa:

```
1. 📌 BUSINESS FLOW
   → Luồng nghiệp vụ từng bước
   
2. 💼 BACKEND TASKS
   → Controller endpoints
   → Request/Response DTOs
   → Service logic
   → Repository/Entity
   
3. 🎨 FRONTEND TASKS
   → Pages + Components
   → Forms + User interactions
   
4. ⛓️ CHAINCODE TASKS
   → Smart contract functions
   → Validation logic
   → Event emission
   
5. 🧪 TESTING CHECKLIST
   → Cách test module
   → API endpoints cần verify
   
6. 🎓 Q&A FOR PRESENTATION
   → 5-10 câu hỏi thường gặp
   → Cách trả lời
   
7. 📎 FILES CHÍNH
   → Danh sách files cần implement
   → Link tới các files liên quan
```

---

## 🚀 BƯỚC ĐẦU TIÊN (CẢ TEAM)

### 1️⃣ Đọc Hướng Dẫn (30 phút)

```
START_HERE.md
   ↓
ASSIGNMENT_FOR_TEAM.md
   ↓
YOUR_MEMBER_X_*.md
```

### 2️⃣ Setup Environment (1-2 giờ)

```bash
cd CoffeeChain/network
bash scripts/setup-network.sh          # Sinh crypto + channel
bash scripts/register-users.sh         # Tạo 5 users
bash scripts/deploy-chaincode.sh       # Deploy contract

docker compose up -d                   # Start all services
curl http://localhost:8080/swagger-ui.html  # Verify backend
```

### 3️⃣ Implement Module Của Bạn (Parallel)

Mỗi thành viên:
```
1. Đọc MEMBER_X_*.md kỹ
2. Implement backend (Controllers, Services)
3. Implement frontend (Pages, Components)
4. Implement chaincode (Smart contract functions)
5. Test end-to-end
6. Chuẩn bị presentation
```

---

## 🔄 LUỒNG MODULES (Dependencies)

```
┌─────────────────────────────────────────────────────────┐
│ Thành Viên 1: FARMER (🌱)                              │
│ - Tạo HarvestBatch                                      │
│ - Ghi farm activities                                   │
│ - Status: CREATED → COMPLETED                           │
└────────────────┬────────────────────────────────────────┘
                 ↓ (parent batch COMPLETED)
┌─────────────────────────────────────────────────────────┐
│ Thành Viên 2: PROCESSOR (🏭)                           │
│ - Tạo ProcessedBatch từ HARVEST                         │
│ - Status: CREATED → COMPLETED                           │
└────────────────┬────────────────────────────────────────┘
                 ↓ (parent batch COMPLETED)
┌─────────────────────────────────────────────────────────┐
│ Thành Viên 3: ROASTER (🔥)                             │
│ - Tạo RoastBatch từ PROCESSED                           │
│ - Upload evidence + hash                                │
│ - requestTransfer → Org2 (SET SBE)                      │
└────────────────┬────────────────────────────────────────┘
                 ↓ (TRANSFER_PENDING + SBE set)
┌─────────────────────────────────────────────────────────┐
│ Thành Viên 4: PACKAGER (📦) — Org2                     │
│ - acceptTransfer (AND endorsement!)                     │
│ - Tạo PackagedBatch                                     │
│ - Sinh QR code                                          │
└────────────────┬────────────────────────────────────────┘
                 ↓ (COMPLETED)
┌─────────────────────────────────────────────────────────┐
│ Thành Viên 5: RETAILER & TRACE (🛒)                    │
│ - Update status: IN_STOCK → SOLD                        │
│ - PUBLIC TRACE (no auth) → xem full chain              │
│ - Verify evidence hash                                  │
└─────────────────────────────────────────────────────────┘
```

---

## 📂 FILES CẬN THIẾT CHO MỖI THÀNH VIÊN

### 👤 Thành Viên 1 (FARMER)

**Backend:**
- `backend/.../controller/FarmerController.java`
- `backend/.../entity/FarmActivityEntity.java`
- `backend/.../repository/FarmActivityRepository.java`
- `backend/.../dto/request/CreateHarvestBatchRequest.java`
- `backend/.../dto/request/RecordFarmActivityRequest.java`

**Frontend:**
- `frontend/src/app/dashboard/farmer/page.tsx`
- `frontend/src/app/dashboard/farmer/[id]/page.tsx`
- `frontend/src/app/dashboard/farmer/update/page.tsx`
- `frontend/src/components/FarmActivityLog.tsx`

**Chaincode:**
- `chaincode/.../CoffeeTraceChaincode.java` → `createHarvestBatch()`, `recordFarmActivity()`

---

### 👤 Thành Viên 2 (PROCESSOR)

**Backend:**
- `backend/.../controller/ProcessorController.java`
- `backend/.../dto/request/CreateProcessedBatchRequest.java`

**Frontend:**
- `frontend/src/app/dashboard/processor/page.tsx`
- `frontend/src/app/dashboard/processor/update/page.tsx`

**Chaincode:**
- `chaincode/.../CoffeeTraceChaincode.java` → `createProcessedBatch()`

---

### 👤 Thành Viên 3 (ROASTER)

**Backend:**
- `backend/.../controller/RoasterController.java`
- `backend/.../service/EvidenceService.java`
- `backend/.../dto/request/CreateRoastBatchRequest.java`
- `backend/.../dto/request/TransferRequest.java`

**Frontend:**
- `frontend/src/app/dashboard/roaster/page.tsx`
- `frontend/src/app/dashboard/roaster/[id]/page.tsx`
- `frontend/src/components/EvidenceVerifier.tsx`

**Chaincode:**
- `chaincode/.../CoffeeTraceChaincode.java` → `createRoastBatch()`, `addEvidence()`, `requestTransfer()`

---

### 👤 Thành Viên 4 (PACKAGER)

**Backend:**
- `backend/.../controller/PackagerController.java`
- `backend/.../service/QrCodeService.java`
- `backend/.../dto/request/CreatePackagedBatchRequest.java`

**Frontend:**
- `frontend/src/app/dashboard/packager/page.tsx`
- `frontend/src/app/dashboard/packager/[id]/page.tsx`

**Chaincode:**
- `chaincode/.../CoffeeTraceChaincode.java` → `acceptTransfer()` (**AND endorsement!**), `createPackagedBatch()`

---

### 👤 Thành Viên 5 (RETAILER & TRACE)

**Backend:**
- `backend/.../controller/RetailerController.java`
- `backend/.../controller/TraceController.java` ← **PUBLIC**
- `backend/.../service/TraceService.java`
- `backend/.../dto/response/TraceResponse.java`

**Frontend:**
- `frontend/src/app/dashboard/retailer/page.tsx`
- `frontend/src/app/trace/[publicCode]/page.tsx` ← **PUBLIC**
- `frontend/src/components/TraceTimeline.tsx` ← **MAIN**
- `frontend/src/components/EvidenceVerifier.tsx` (shared)
- `frontend/src/components/FarmActivityLog.tsx` (shared)

**Chaincode:**
- `chaincode/.../CoffeeTraceChaincode.java` → `updateBatchStatus()`, `queryBatchByPublicCode()`, `getTraceChain()`

---

## 🧩 SHARED / INFRASTRUCTURE (All members need this working)

**Network Setup:**
- `network/docker-compose.yaml`
- `network/scripts/setup-network.sh`
- `network/scripts/deploy-chaincode.sh`
- `network/scripts/register-users.sh`

**Backend Shared Services:**
- `backend/.../service/FabricGatewayService.java` (call chaincode)
- `backend/.../service/JwtService.java` (auth)
- `backend/.../config/SecurityConfig.java`
- `backend/.../config/FabricConfig.java`
- `backend/.../repository/BatchRepository.java`
- `backend/.../repository/LedgerRefRepository.java`

**Frontend Shared:**
- `frontend/src/lib/api/client.ts` (API calls)
- `frontend/src/lib/auth/AuthContext.tsx`
- `frontend/src/components/TraceTimeline.tsx` (used by Roaster + Trace)
- `frontend/src/components/EvidenceVerifier.tsx` (used by Roaster + Trace)

---

## 🎓 PRESENTATION STRUCTURE (5-10 slides per member)

```
Slide 1: Title + Module Overview
  → "Tôi chịu trách nhiệm module X"
  → "Luồng: [input] → [xử lý] → [output]"

Slide 2-3: Backend Architecture
  → Controllers + endpoints
  → DTOs + validation
  → Service logic

Slide 4-5: Frontend Architecture
  → Pages + components
  → User interactions
  → API integration

Slide 6-7: Chaincode Design
  → Smart contract functions
  → Event emission
  → Validation logic

Slide 8: Security & Authorization
  → Role-based access control
  → Endorsement policy (nếu có)

Slide 9: Testing & Demo
  → Test cases
  → Live demo script

Slide 10: Q&A
  → Top questions + answers
```

---

## ✅ SUBMISSION REQUIREMENTS

### Code Quality
- [ ] No TODOs or temporary code
- [ ] Proper error handling (try-catch, validation)
- [ ] Comments cho complex logic
- [ ] Follows project conventions
- [ ] No console.log() in production code

### Testing
- [ ] Backend: `mvn test` passing
- [ ] Frontend: `npm test` passing
- [ ] E2E: Manual test with Postman/curl
- [ ] Test different roles + permissions

### Presentation
- [ ] 5-10 slides with visuals
- [ ] Live demo (not pre-recorded)
- [ ] Can explain every line of code
- [ ] Can answer Q&A confidently
- [ ] Time: 15-20 minutes

### Deployment
- [ ] All services running
- [ ] Backend: http://localhost:8080 ✅
- [ ] Frontend: http://localhost:3000 ✅
- [ ] Fabric network healthy
- [ ] Postman collection ready

---

## 🎯 SUCCESS CRITERIA

**Individual:**
- ✅ Module implementation complete (Backend + Frontend + Chaincode)
- ✅ All unit/integration tests passing
- ✅ Can explain architecture + code flow
- ✅ Can answer technical Q&A

**Team:**
- ✅ All 5 modules integrated end-to-end
- ✅ Role-based access control working
- ✅ Public trace page working (no auth)
- ✅ Evidence verification working
- ✅ Full workflow: Farmer → Retailer → Public Trace

---

## 🚀 TIMELINE SUGGESTION

**Week 1:**
- Day 1: Read assignments + setup environment
- Day 2-3: Implement backend + chaincode
- Day 4-5: Implement frontend + test

**Week 2:**
- Day 1-2: Integration + end-to-end testing
- Day 3-4: Prepare presentations + slides
- Day 5: Demo day! 🎉

---

## 📞 SUPPORT

**If blocked:**
1. Check your `MEMBER_X_*.md` — detailed guidance
2. Check `RUN_AND_TEST_FROM_SCRATCH.md` — setup issues
3. Check `ASSIGNMENT_FOR_TEAM.md` — architecture questions
4. Ask team → unblock fast

**Common issues:**
- Network: See "Troubleshooting" section in START_HERE.md
- Build: Check pom.xml + package.json dependencies
- Code: Review sample code in assignment files

---

## 🎉 FINAL WORDS

**Bạn được giao:** ✅ Clear architecture
✅ Detailed tasks breakdown
✅ Code examples + patterns
✅ Testing guide
✅ Q&A preparation

**Bây giờ là:** 🚀 Implementation time
🤝 Teamwork time
💪 Demo time

**Let's build something awesome together! ☕🚀**

---

**Questions?** Re-read files. Still confused? Ask team.

**Ready?** Open your `MEMBER_X_*.md` and start coding! 💻

**Next Step:** → `START_HERE.md` → Your `MEMBER_X_*.md` → Code! 🎯
