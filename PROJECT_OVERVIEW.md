# 🎓 COFFEECHAIN - CÔNG TRÌNH HỌC TẬP NHÓM

**Dự Án: Blockchain Truy Vết Nguồn Gốc Cà Phê** ☕🔗

---

## 📌 THÔNG TIN DỰ ÁN

| Thông Số | Nội Dung |
|---------|---------|
| **Môn Học** | An Toàn Bảo Mật Thông Tin (Information Security) |
| **Loại Bài Tập** | Bài Tập Lớn (Group Project) |
| **Số Thành Viên** | 5 người |
| **Công Nghệ Chính** | Blockchain (Hyperledger Fabric) |
| **Mục Tiêu** | Tìm hiểu bảo mật, chaincode, cryptography, role-based access |

---

## 👥 PHÂN CÔNG 5 THÀNH VIÊN

### 📋 TABLE PHÂN CÔNG

| TT | Thành Viên | Module | Vai Trò | File Giao | Files Liên Quan |
|----|-----------|--------|--------|-----------|-----------------|
| **1** | Student 1 | 🌱 FARMER (Nông Dân) | Tạo harvest batch, ghi farm activity | `MEMBER_1_FARMER.md` | FarmerController, FarmActivityEntity |
| **2** | Student 2 | 🏭 PROCESSOR (Xử Lý) | Tiếp nhận farm batch, tạo processed batch | `MEMBER_2_PROCESSOR.md` | ProcessorController |
| **3** | Student 3 | 🔥 ROASTER (Rang) | Rang cà phê, upload evidence, request transfer (AND endorsement) | `MEMBER_3_ROASTER.md` | RoasterController, EvidenceService, requestTransfer() |
| **4** | Student 4 | 📦 PACKAGER (Đóng Gói) | Accept transfer (AND endorsement), đóng gói, sinh QR code | `MEMBER_4_PACKAGER.md` | PackagerController, QrCodeService, acceptTransfer() |
| **5** | Student 5 | 🛒 RETAILER & TRACE | Bán lẻ, cung cấp public trace (không cần auth) | `MEMBER_5_RETAILER_TRACE.md` | RetailerController, TraceController, TraceService |

---

## 🎯 BUSINESS FLOW (Quy Trình Kinh Doanh)

```
Member 1 (Farmer)          Member 2 (Processor)     Member 3 (Roaster)
   ↓ Harvest                   ↓ Process                 ↓ Roast
HARVEST_BATCH (created)   PROCESSED_BATCH         ROAST_BATCH
   │ [Farm Activities]       (parent: HARVEST)     (parent: PROCESSED)
   │ Status: COMPLETED       Status: COMPLETED     + Evidence (SHA-256)
   │                                                Status: COMPLETED
   │                                                + Request Transfer (AND)
   └─────────────────────────────────────────────────────┘
                          Farmer → Processor → Roaster

                           Member 4 (Packager)
                           ↓ Accept (AND endorsement)
                        PACKAGED_BATCH
                        Status: COMPLETED → IN_STOCK
                        + QR Code (traceability)

                           Member 5 (Retailer)
                           ↓ Sell
                           Status: SOLD
                           ↓
                        PUBLIC TRACE
                        (no auth, full chain visibility)
```

---

## 🔐 SECURITY CONCEPTS

### Bảo Mật Cấp Module (Mỗi Thành Viên Đảm Nhiệm)

| Concept | Member | Chi Tiết |
|---------|--------|---------|
| **Role-Based Access** | All | Mỗi người có role (FARMER/PROCESSOR/ROASTER/PACKAGER/RETAILER) gắn trên X.509 cert |
| **AND Endorsement** | 3 + 4 | State-Based Endorsement: Member 3 set SBE, Member 4 phải accept với cả 2 org endorsement |
| **Evidence Verification** | 3 + 5 | Member 3: SHA-256 trên backend, Member 5: verify client-side |
| **Chain Traversal** | 5 | Build full chain từ Packaged → Harvest, hiển thị public (NO AUTH) |
| **Farm Activity Audit** | 1 + 5 | Audit trail: who did what, when, at what farm |
| **Immutable Ledger** | All | Tất cả transactions ghi lên blockchain, không thể sửa |

---

## 📚 TÀI LIỆU CHÍNH

### 🚀 Bắt Đầu Đây

| File | Mục Đích | Thời Gian | Bắt Buộc |
|------|---------|----------|---------|
| **INDEX.md** | File này - Navigation map | 5 min | 🔴 YES |
| **START_HERE.md** | Quick start + Setup | 10 min | 🔴 YES |
| **ASSIGNMENT_FOR_TEAM.md** | Architecture + modules | 30 min | 🔴 YES |

### 👤 Tài Liệu Cá Nhân (Mỗi Thành Viên)

```
MEMBER_1_FARMER.md              → 14.4 KB (Backend, Frontend, Chaincode)
MEMBER_2_PROCESSOR.md           → 10.2 KB
MEMBER_3_ROASTER.md             → 13.9 KB (AND endorsement, Evidence)
MEMBER_4_PACKAGER.md            → 13.9 KB (AND endorsement, QR)
MEMBER_5_RETAILER_TRACE.md      → 18.4 KB (Public trace, Chain traversal)
```

### 📋 Tài Liệu Phụ

| File | Mục Đích |
|------|---------|
| **TEAM_SUMMARY.md** | Tóm tắt nhanh, file inventory |
| **CHECKLIST.md** | Tracking tiến độ, final submission |
| **RUN_AND_TEST_FROM_SCRATCH.md** | Setup & deployment |
| **INDEX.md** | This file - Navigation |

---

## 🛠️ CÁCH DÙNG TÀI LIỆU

### Scenario 1: Bạn Mới Vào Dự Án

**Thực Hiện:**
1. Đọc `INDEX.md` (file này) — 5 min
2. Đọc `START_HERE.md` — 10 min
3. Đọc `ASSIGNMENT_FOR_TEAM.md` — 30 min
4. Tìm số thành viên của bạn (1-5)
5. Đọc `MEMBER_X_*.md` tương ứng — 1 hour
6. Bắt đầu coding!

### Scenario 2: Bạn Đã Hiểu Architecture

**Thực Hiện:**
1. Mở `MEMBER_X_*.md` của bạn
2. Tìm section "Tasks" hoặc "Implementation"
3. Follow checklist + code examples
4. Test theo "Testing Checklist"
5. Prepare slides theo "Q&A for Presentation"

### Scenario 3: Bạn Đang Stuck

**Thực Hiện:**
1. Kiểm tra lại `MEMBER_X_*.md` section liên quan
2. Xem code examples trong file
3. Kiểm tra `START_HERE.md` § Troubleshooting
4. Run `RUN_AND_TEST_FROM_SCRATCH.md` để reset environment
5. Hỏi team hoặc instructor

---

## 📂 DIRECTORY STRUCTURE

```
CoffeeChain/
├── INDEX.md                      ← YOU ARE HERE
├── START_HERE.md                 ← Read next
├── ASSIGNMENT_FOR_TEAM.md        ← System architecture
├── TEAM_SUMMARY.md               ← Quick reference
├── MEMBER_1_FARMER.md            ← Student 1
├── MEMBER_2_PROCESSOR.md         ← Student 2
├── MEMBER_3_ROASTER.md           ← Student 3
├── MEMBER_4_PACKAGER.md          ← Student 4
├── MEMBER_5_RETAILER_TRACE.md    ← Student 5
├── CHECKLIST.md                  ← Progress tracking
├── RUN_AND_TEST_FROM_SCRATCH.md  ← Setup guide
│
├── backend/                      ← Spring Boot
│   ├── src/main/java/
│   │   └── com/coffeechain/
│   │       ├── controller/       ← FarmerController, ProcessorController, ...
│   │       ├── service/          ← EvidenceService, TraceService, ...
│   │       ├── entity/           ← FarmActivityEntity, ...
│   │       └── dto/              ← CreateHarvestBatchRequest, ...
│   └── pom.xml
│
├── frontend/                     ← Next.js
│   ├── app/
│   │   └── dashboard/
│   │       ├── farmer/           ← Member 1
│   │       ├── processor/        ← Member 2
│   │       ├── roaster/          ← Member 3
│   │       ├── packager/         ← Member 4
│   │       ├── retailer/         ← Member 5
│   │       └── trace/[publicCode]/ ← Member 5 (PUBLIC)
│   └── components/
│       ├── FarmActivityLog.tsx   ← Member 1
│       ├── EvidenceVerifier.tsx  ← Member 3 + 5
│       ├── TraceTimeline.tsx     ← Member 5
│       └── QrCode.tsx            ← Member 4
│
├── chaincode/                    ← Hyperledger Fabric (Java)
│   └── src/main/java/
│       └── org/coffeechain/contract/
│           ├── HarvestContract   ← Member 1
│           ├── ProcessorContract ← Member 2
│           ├── RoasterContract   ← Member 3
│           ├── PackagerContract  ← Member 4
│           └── RetailerContract  ← Member 5
│
├── network/                      ← Docker Compose + Fabric setup
│   ├── docker-compose.yml        ← Shared
│   ├── crypto-config/            ← Shared
│   └── scripts/                  ← Shared
│
├── README.md                     ← Current project overview
└── aidlc-docs/                   ← AI-DLC workflow artifacts and audit trail
```

---

## ⏱️ TIMELINE SUGGESTION

### Week 1: Learning & Setup
- [ ] Days 1-2: Read all documentation (INDEX → START_HERE → ASSIGNMENT → Your MEMBER)
- [ ] Days 3-4: Setup environment (`RUN_AND_TEST_FROM_SCRATCH.md`)
- [ ] Days 5-7: Each member studies their assigned module

### Week 2: Development
- [ ] Days 1-3: Implement backend + frontend for your module
- [ ] Days 4-5: Implement chaincode for your module
- [ ] Days 6-7: Testing + bug fixes

### Week 3: Integration & Demo
- [ ] Days 1-3: Team integration testing (full flow)
- [ ] Days 4-5: Bug fixes + performance tuning
- [ ] Days 6-7: Prepare presentation slides + live demo script

### Demo Day
- [ ] Final checks (all services running)
- [ ] Live demo (5-10 min per member)
- [ ] Q&A (2-5 min per member)

---

## ✅ SUBMISSION CHECKLIST

### Before Demo Day

**Code Quality:**
- [ ] No compilation errors
- [ ] All tests passing
- [ ] No console warnings/errors
- [ ] Code reviewed by team member

**Documentation:**
- [ ] Slides prepared (5-10 slides per member)
- [ ] Live demo script written
- [ ] Q&A answers prepared
- [ ] Code comments for complex logic

**Deployment:**
- [ ] Docker compose working
- [ ] Backend running on port 8080
- [ ] Frontend running on port 3000
- [ ] Fabric network initialized
- [ ] Test data loaded

**Testing:**
- [ ] All module tests passing
- [ ] Integration tests passing
- [ ] End-to-end flow tested
- [ ] Public trace tested (no auth)

---

## 🎯 KEY LEARNING OBJECTIVES

**Mỗi Thành Viên Sẽ Học:**

1. **Blockchain Fundamentals**
   - Chaincode development (smart contracts)
   - State transitions & immutable ledger
   - Event emissions & indexing

2. **Cryptography & Security**
   - X.509 certificates & PKI
   - Role-based access control (RBAC)
   - State-Based Endorsement (SBE) policies
   - Hash verification (SHA-256)

3. **Authorization & Access Control**
   - Role extraction from certificates
   - Endorsement policies (AND, OR)
   - Org-based access restrictions

4. **Distributed Systems**
   - Multi-org blockchain setup
   - Consensus mechanisms
   - Chain traversal & ledger queries

5. **Full-Stack Development**
   - Backend: Spring Boot, REST APIs
   - Frontend: Next.js, UI components
   - Blockchain: Hyperledger Fabric, Chaincode
   - Database: PostgreSQL, CouchDB

---

## 🚀 GETTING STARTED (RIGHT NOW!)

### Step 1: Read This File (INDEX.md)
✅ You're doing this now!

### Step 2: Open START_HERE.md
👉 Next step

### Step 3: Setup Environment
Follow `RUN_AND_TEST_FROM_SCRATCH.md`

### Step 4: Read Your Assignment
Each member reads `MEMBER_X_*.md`

### Step 5: Start Coding
Use checklist in `CHECKLIST.md` to track

### Step 6: Prepare Presentation
Follow guidelines in your `MEMBER_X_*.md`

---

## 📞 IF YOU NEED HELP

**Q: Where do I start?**
A: Read `START_HERE.md`

**Q: What should I do?**
A: Read your `MEMBER_X_*.md`

**Q: How do I setup the environment?**
A: Follow `RUN_AND_TEST_FROM_SCRATCH.md`

**Q: I'm stuck on a task.**
A: Check `CHECKLIST.md` § "IF STUCK"

**Q: What files should I edit?**
A: Your `MEMBER_X_*.md` lists all files

**Q: How do I test my module?**
A: Your `MEMBER_X_*.md` § "TESTING CHECKLIST"

**Q: How do I prepare for demo?**
A: Your `MEMBER_X_*.md` § "Q&A for Presentation"

---

## 📊 SUCCESS METRICS

### For Each Member:
- ✅ Code compiles & passes tests
- ✅ Can explain every line
- ✅ Presentation: 5-10 slides, 10-15 minutes
- ✅ Live demo works
- ✅ Answers Q&A confidently

### For Team:
- ✅ All 5 modules integrated
- ✅ End-to-end flow: Farmer → Retailer → Public Trace
- ✅ AND endorsement working correctly
- ✅ Evidence verification working
- ✅ Public trace accessible (no auth)
- ✅ Full chain traceability visible
- ✅ All Q&A questions answered

---

## 🎉 YOU'RE READY TO START!

**Next Action:**
👉 Open `START_HERE.md` and read it

**Estimated Time:**
- Reading docs: 1-2 hours
- Setup environment: 1-2 hours
- Learning your module: 4-6 hours
- Implementation: 8-12 hours
- Testing & polish: 2-4 hours

**Total: ~20-30 hours per person**

---

## 📝 NOTES

- All files are in **project root** (`CoffeeChain/`)
- Files are **case-sensitive** on Linux/Mac
- Print or bookmark `START_HERE.md` for quick access
- Update this file if new documentation is added
- Share this file with all team members

---

## 🌟 GOOD LUCK! 🍀

**Team Project: CoffeeChain Blockchain Traceability**

Let's build something amazing! 🚀☕🔗

---

**Created:** 2026-05-08
**Status:** ✅ Ready to start
**Version:** 1.0
