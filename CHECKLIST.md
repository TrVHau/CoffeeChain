# ✅ ASSIGNMENT CHECKLIST & QUICK REFERENCE

Mỗi thành viên in hoặc bookmark file này để theo dõi tiến độ.

---

## 📋 TEAM QUICK LINKS

| Tài Liệu | Mục Đích | Link |
|---------|---------|------|
| 🚀 **Bắt Đầu** | Đọc trước tiên | `START_HERE.md` |
| 📊 **Tổng Quan** | Hiểu hệ thống | `ASSIGNMENT_FOR_TEAM.md` |
| 📌 **Tóm Tắt** | Bảng tham chiếu | `TEAM_SUMMARY.md` |
| 🔧 **Setup** | Cách setup môi trường | `RUN_AND_TEST_FROM_SCRATCH.md` |

---

## 👤 MEMBER 1: FARMER

**File Assignment:** `MEMBER_1_FARMER.md`

**Completion Checklist:**

### Backend (Spring Boot)
- [ ] FarmerController.java
  - [ ] POST /api/harvest — tạo batch
  - [ ] GET /api/harvest — danh sách
  - [ ] GET /api/harvest/{id} — chi tiết
  - [ ] PATCH /api/harvest/{id}/status — update status
  - [ ] POST /api/harvest/{id}/activity — ghi farm activity
  - [ ] GET /api/harvest/{id}/activities — lấy activities
- [ ] CreateHarvestBatchRequest.java
- [ ] RecordFarmActivityRequest.java
- [ ] FarmActivityEntity.java
- [ ] FarmActivityRepository.java

### Frontend (Next.js)
- [ ] /dashboard/farmer/page.tsx — list batches
- [ ] /dashboard/farmer/[id]/page.tsx — batch detail
- [ ] /dashboard/farmer/update/page.tsx — create form
- [ ] FarmActivityLog.tsx — component

### Chaincode (Java)
- [ ] createHarvestBatch() — tạo HARVEST batch
- [ ] recordFarmActivity() — emit event, không lưu state
- [ ] updateBatchStatus() — FARMER can update HARVEST status

### Testing
- [ ] POST /api/harvest ✓
- [ ] POST /api/harvest/{id}/activity ✓
- [ ] PATCH /api/harvest/{id}/status ✓
- [ ] GET activities ✓
- [ ] E2E: create → add activity → complete ✓

### Presentation (5-10 slides)
- [ ] Slide 1-2: Overview + Flow
- [ ] Slide 3-4: Backend
- [ ] Slide 5-6: Frontend
- [ ] Slide 7: Chaincode
- [ ] Slide 8: Q&A + Demo script

---

## 👤 MEMBER 2: PROCESSOR

**File Assignment:** `MEMBER_2_PROCESSOR.md`

**Completion Checklist:**

### Backend
- [ ] ProcessorController.java
  - [ ] POST /api/process — tạo batch
  - [ ] GET /api/process — danh sách
  - [ ] GET /api/process/{id} — chi tiết
  - [ ] PATCH /api/process/{id}/status — update
- [ ] CreateProcessedBatchRequest.java

### Frontend
- [ ] /dashboard/processor/page.tsx — list parent batches
- [ ] /dashboard/processor/update/page.tsx — create form
- [ ] /dashboard/processor/[id]/page.tsx — detail

### Chaincode
- [ ] createProcessedBatch() — validate parent HARVEST COMPLETED
- [ ] Validate weight < parent weight
- [ ] getAvailableHarvestBatches() — query available parents

### Testing
- [ ] Get available parent batches ✓
- [ ] POST /api/process ✓
- [ ] Validate weight ✓
- [ ] Validate parent status ✓
- [ ] E2E: Farmer COMPLETED → Processor create → complete ✓

### Presentation
- [ ] 5-10 slides
- [ ] Live demo

---

## 👤 MEMBER 3: ROASTER

**File Assignment:** `MEMBER_3_ROASTER.md`

**Completion Checklist:**

### Backend
- [ ] RoasterController.java
  - [ ] POST /api/roast — tạo batch
  - [ ] GET /api/roast — danh sách
  - [ ] GET /api/roast/{id} — chi tiết
  - [ ] PATCH /api/roast/{id}/status — update
  - [ ] POST /api/roast/{id}/evidence — upload file
  - [ ] POST /api/transfer/request — yêu cầu bàn giao
- [ ] EvidenceService.java
  - [ ] uploadToIPFS() — lưu file
  - [ ] computeSHA256() — tính hash
- [ ] CreateRoastBatchRequest.java
- [ ] TransferRequest.java

### Frontend
- [ ] /dashboard/roaster/page.tsx — list batches
- [ ] /dashboard/roaster/update/page.tsx — create form
- [ ] /dashboard/roaster/[id]/page.tsx — detail + upload evidence
- [ ] EvidenceVerifier.tsx — verify hash component

### Chaincode
- [ ] createRoastBatch() — tạo ROAST batch
- [ ] addEvidence() — lưu hash + URI
- [ ] requestTransfer() — **SET SBE = AND**
  - [ ] Validate batch type + status
  - [ ] Set SBE trên key (critical!)

### Testing
- [ ] Create RoastBatch ✓
- [ ] Upload evidence ✓
- [ ] Compute + store hash ✓
- [ ] requestTransfer sets SBE ✓
- [ ] Verify evidence hash (client-side SHA-256) ✓
- [ ] E2E: Processor COMPLETED → Roaster create → evidence → transfer ✓

### Presentation
- [ ] Explain SBE
- [ ] Explain evidence verification
- [ ] Live demo with file upload + hash verification

---

## 👤 MEMBER 4: PACKAGER

**File Assignment:** `MEMBER_4_PACKAGER.md`

**Completion Checklist:**

### Backend
- [ ] PackagerController.java
  - [ ] GET /api/package/pending — list pending transfers
  - [ ] POST /api/transfer/accept/{batchId} — accept (**AND endorsement**)
  - [ ] POST /api/package — tạo packaged batch
  - [ ] GET /api/package — danh sách
  - [ ] GET /api/package/{id} — chi tiết
  - [ ] POST /api/package/{id}/qr/generate — sinh QR
  - [ ] GET /api/qr/{batchId} — lấy QR image
- [ ] QrCodeService.java
  - [ ] generateQr() — ZXing library

### Frontend
- [ ] /dashboard/packager/page.tsx — list pending + packaged batches
- [ ] Accept transfer button + confirmation
- [ ] /dashboard/packager/create/page.tsx — create form
- [ ] /dashboard/packager/[id]/page.tsx — detail + QR
- [ ] QR download functionality

### Chaincode
- [ ] acceptTransfer() — **AND endorsement**
  - [ ] Verify caller is Org2
  - [ ] Verify TRANSFER_PENDING status
  - [ ] Update ownerMSP to Org2MSP
  - [ ] Remove SBE (set back to OR)
  - [ ] Emit TRANSFER_ACCEPTED event
- [ ] createPackagedBatch() — tạo batch with status=COMPLETED

### Testing
- [ ] Get pending transfers ✓
- [ ] acceptTransfer requires AND endorsement ✓
  - [ ] Verify 2 peer endorsement
  - [ ] Verify ownerMSP changed
- [ ] createPackagedBatch ✓
- [ ] Generate QR code ✓
- [ ] QR download PNG ✓
- [ ] E2E: Roaster TRANSFER_PENDING → Packager accept → create packaged → QR ✓

### Presentation
- [ ] Explain AND endorsement (critical!)
- [ ] Explain SBE removal after transfer
- [ ] Live demo with acceptTransfer + QR generation

---

## 👤 MEMBER 5: RETAILER & TRACE

**File Assignment:** `MEMBER_5_RETAILER_TRACE.md`

**Completion Checklist:**

### Backend
- [ ] RetailerController.java
  - [ ] GET /api/retail — danh sách
  - [ ] GET /api/retail/{id} — chi tiết
  - [ ] PATCH /api/retail/{id}/status — update to IN_STOCK / SOLD
- [ ] TraceController.java (PUBLIC — no auth!)
  - [ ] GET /api/trace/{publicCode} — public trace
  - [ ] GET /api/batch/{batchId}?source=chain — evaluate from chain
- [ ] TraceService.java
  - [ ] buildTrace() — build full chain from Packaged to Harvest
  - [ ] Fetch farm activities từ PostgreSQL
  - [ ] Fetch ledger references
- [ ] TraceResponse.java DTO

### Frontend
- [ ] /dashboard/retailer/page.tsx — inventory management
- [ ] /app/trace/[publicCode]/page.tsx (PUBLIC!)
  - [ ] No authentication needed
  - [ ] Full chain timeline
- [ ] TraceTimeline.tsx — main component
  - [ ] Render all batch types
  - [ ] Show metadata per batch
  - [ ] Link to parent batches
- [ ] EvidenceVerifier.tsx — verify hash button
- [ ] FarmActivityLog.tsx — expandable activities

### Chaincode
- [ ] updateBatchStatus() — RETAILER can update PACKAGED
  - [ ] Validate PACKAGED type
  - [ ] Validate role=RETAILER
  - [ ] Valid transitions: IN_STOCK, SOLD
  - [ ] Emit BATCH_IN_STOCK, BATCH_SOLD events
- [ ] queryBatchByPublicCode() — evaluate for public trace
- [ ] getTraceChain() — build chain by parent traversal

### Testing
- [ ] Get retailer batches ✓
- [ ] Update status: TRANSFERRED → IN_STOCK → SOLD ✓
- [ ] GET /api/trace/{publicCode} (no auth) ✓
  - [ ] Returns full chain
  - [ ] Returns farm activities
  - [ ] Returns ledger refs
- [ ] Verify evidence hash ✓
- [ ] Farm activity display ✓
- [ ] E2E full flow: Farmer → Processor → Roaster → Packager → Retailer → Public trace ✓

### Presentation
- [ ] Explain public trace (no auth)
- [ ] Explain chain traversal logic
- [ ] Explain evidence verification
- [ ] Live demo: scan QR → public trace page

---

## 🧩 SHARED / INFRASTRUCTURE

**Who's responsible?** Team (shared effort)

**Checklist:**

### Network Setup
- [ ] Fabric network running
  - [ ] Orderer
  - [ ] peer0.org1
  - [ ] peer0.org2
  - [ ] CA for Org1 + Org2
  - [ ] CouchDB for peers

### User Registration
- [ ] farmer_alice (FARMER, Org1)
- [ ] processor_bob (PROCESSOR, Org1)
- [ ] roaster_charlie (ROASTER, Org1)
- [ ] packager_dave (PACKAGER, Org2)
- [ ] retailer_eve (RETAILER, Org2)

### Chaincode Deployment
- [ ] Chaincode packaged
- [ ] Installed on peers
- [ ] Committed to channel
- [ ] Endorsed correctly

### Backend Services
- [ ] Spring Boot running (port 8080)
- [ ] PostgreSQL connected
- [ ] IPFS running
- [ ] Fabric Gateway connected

### Frontend
- [ ] Next.js running (port 3000)
- [ ] Login page working
- [ ] Role-based dashboards working

### Database
- [ ] PostgreSQL schema created
- [ ] Tables: batches, farm_activities, ledger_refs
- [ ] EventIndexer running → indexing events

---

## 🎓 PRESENTATION CHECKLIST

**Each member prepares:**

### Slides (5-10)
- [ ] Slide 1: Title + module name
- [ ] Slide 2: Business flow (diagram)
- [ ] Slide 3: Backend architecture (endpoints + DTOs)
- [ ] Slide 4: Frontend architecture (pages + components)
- [ ] Slide 5: Chaincode design (functions + events)
- [ ] Slide 6: Security & authorization (role-based)
- [ ] Slide 7: Testing (test cases)
- [ ] Slide 8: Live demo script
- [ ] Slide 9-10: Q&A + answers

### Live Demo
- [ ] Postman collection or curl scripts ready
- [ ] All services running
- [ ] Test data prepared
- [ ] Screenshot backup (in case of issues)

### Documentation
- [ ] Code comments (complex logic)
- [ ] README for your module (optional)
- [ ] API documentation (Swagger)

### Q&A Preparation
- [ ] Know 5-10 potential questions
- [ ] Prepare answers
- [ ] Know architecture trade-offs
- [ ] Know security implications

---

## 🚀 FINAL DAY CHECKLIST

**Day Before Demo:**
- [ ] All code merged to main
- [ ] All tests passing (`mvn test`, `npm test`)
- [ ] Docker images built
- [ ] Database schema up-to-date

**Demo Day Morning:**
- [ ] `docker compose up -d` running
- [ ] Backend http://localhost:8080 ✓
- [ ] Frontend http://localhost:3000 ✓
- [ ] Fabric network healthy
- [ ] Chaincode deployed

**Demo Time:**
- [ ] Slides ready + presenter notes
- [ ] Demo script tested
- [ ] Postman collection imported
- [ ] Test data loaded
- [ ] Internet stable
- [ ] Time limit: 15-20 minutes per member

---

## 📞 IF STUCK

**Checklist before asking for help:**

1. ✅ Read your `MEMBER_X_*.md` again (carefully!)
2. ✅ Check error messages (copy-paste to search)
3. ✅ Check logs:
   ```bash
   docker compose logs backend
   docker compose logs chaincode
   ```
4. ✅ Check dependencies:
   ```bash
   mvn dependency:tree
   npm list
   ```
5. ✅ Try clean rebuild:
   ```bash
   mvn clean package -DskipTests
   npm install && npm build
   ```
6. ✅ Ask team (Slack / Discord / group chat)

**Common Issues:**
- "Port already in use" → kill existing process or change port
- "Chaincode not found" → redeploy using scripts/deploy-chaincode.sh
- "No Fabric identity loaded" → check crypto files + permissions
- "Module not found" → npm install or mvn install
- "Serialization error" → check JSON format in DTOs

---

## 🎯 SUCCESS METRICS

**Individual:**
- ✅ Code quality: 0 warnings, proper error handling
- ✅ Tests: 100% passing
- ✅ Knowledge: Can explain every line
- ✅ Presentation: 15-20 minutes, engaging

**Team:**
- ✅ All modules integrated
- ✅ End-to-end flow working
- ✅ All 5 roles functional
- ✅ Public trace working
- ✅ Evidence verification working

---

## 🎉 DONE!

When you finish:

1. ✅ Mark items complete in this checklist
2. ✅ Push code to Git
3. ✅ Merge PR with review
4. ✅ Update slides
5. ✅ Test with team
6. ✅ Demo day! 🎊

---

**Print this page or bookmark it!** 📌
You'll refer to it throughout the project.

**Let's build! 🚀☕**
