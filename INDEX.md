# 📚 COFFEECHAIN PROJECT — FILE INDEX & NAVIGATION

**Hệ thống file tài liệu cho Dự Án Blockchain Truy Vết Nguồn Gốc Cà Phê**

---

## 🎯 ĐIỂM BẮT ĐẦU

### 🚀 Người Mới Vào Dự Án?

Đọc theo thứ tự này:

1. **`START_HERE.md`** ← 👈 **BẮT ĐẦU ĐÂY**
   - 10 phút để hiểu overview
   - Links tới các tài liệu tiếp theo

2. **`ASSIGNMENT_FOR_TEAM.md`**
   - 30 phút để hiểu toàn bộ hệ thống
   - Business flow + module dependencies
   - Role responsibilities

3. **Your `MEMBER_X_*.md`** (dựa vào số thành viên)
   - Chi tiết tasks của bạn
   - Code examples
   - Testing guide

4. **`RUN_AND_TEST_FROM_SCRATCH.md`**
   - Setup environment
   - Run tests

5. **`CHECKLIST.md`**
   - In hoặc bookmark
   - Track progress

---

## 📋 FILE ORGANIZATION

### 🎓 DOCUMENTATION (Team-wide)

| File | Mục Đích | Thời Gian | Priority |
|------|---------|----------|----------|
| `START_HERE.md` | Quick start guide | 10 min | 🔴 CRITICAL |
| `ASSIGNMENT_FOR_TEAM.md` | System architecture + assignments | 30 min | 🔴 CRITICAL |
| `TEAM_SUMMARY.md` | Summary + dependencies | 10 min | 🟡 HIGH |
| `CHECKLIST.md` | Completion tracking | ongoing | 🟡 HIGH |
| `RUN_AND_TEST_FROM_SCRATCH.md` | Setup + deployment | 1-2 hours | 🟢 MEDIUM |
| `README.md` | Project overview | 5 min | 🟢 MEDIUM |

### 👤 INDIVIDUAL ASSIGNMENTS (Role-specific)

| Thành Viên | File | Module | Scope |
|-----------|------|--------|-------|
| **1** | `MEMBER_1_FARMER.md` | 🌱 FARMER | Harvest, Farm Activities |
| **2** | `MEMBER_2_PROCESSOR.md` | 🏭 PROCESSOR | Process Batch |
| **3** | `MEMBER_3_ROASTER.md` | 🔥 ROASTER | Roast, Evidence, Transfer |
| **4** | `MEMBER_4_PACKAGER.md` | 📦 PACKAGER | Accept Transfer, QR Code |
| **5** | `MEMBER_5_RETAILER_TRACE.md` | 🛒 RETAILER & TRACE | Retail, Public Trace |

### 📂 CODEBASE DIRECTORIES

| Directory | Content | Owner(s) |
|-----------|---------|---------|
| `backend/` | Spring Boot API Server | All members |
| `frontend/` | Next.js Web Application | All members |
| `chaincode/` | Hyperledger Fabric Contracts | All members |
| `network/` | Fabric Network Setup | Shared |
| `aidlc-docs/` | System generated docs | - |

---

## 🗺️ CONTENT MAPS

### By Member

**👤 Member 1 (Farmer)**
- Read: `START_HERE.md` → `ASSIGNMENT_FOR_TEAM.md` → `MEMBER_1_FARMER.md` → `CHECKLIST.md`
- Files to edit:
  - Backend: FarmerController, FarmActivityEntity, FarmActivityRepository
  - Frontend: /dashboard/farmer/*, FarmActivityLog.tsx
  - Chaincode: createHarvestBatch(), recordFarmActivity()

**👤 Member 2 (Processor)**
- Read: `START_HERE.md` → `ASSIGNMENT_FOR_TEAM.md` → `MEMBER_2_PROCESSOR.md` → `CHECKLIST.md`
- Files to edit:
  - Backend: ProcessorController
  - Frontend: /dashboard/processor/*
  - Chaincode: createProcessedBatch()

**👤 Member 3 (Roaster)**
- Read: `START_HERE.md` → `ASSIGNMENT_FOR_TEAM.md` → `MEMBER_3_ROASTER.md` → `CHECKLIST.md`
- Files to edit:
  - Backend: RoasterController, EvidenceService
  - Frontend: /dashboard/roaster/*, EvidenceVerifier.tsx
  - Chaincode: createRoastBatch(), addEvidence(), requestTransfer()

**👤 Member 4 (Packager)**
- Read: `START_HERE.md` → `ASSIGNMENT_FOR_TEAM.md` → `MEMBER_4_PACKAGER.md` → `CHECKLIST.md`
- Files to edit:
  - Backend: PackagerController, QrCodeService
  - Frontend: /dashboard/packager/*
  - Chaincode: acceptTransfer(), createPackagedBatch()

**👤 Member 5 (Retailer & Trace)**
- Read: `START_HERE.md` → `ASSIGNMENT_FOR_TEAM.md` → `MEMBER_5_RETAILER_TRACE.md` → `CHECKLIST.md`
- Files to edit:
  - Backend: RetailerController, TraceController, TraceService
  - Frontend: /dashboard/retailer/*, /trace/[publicCode]/*, TraceTimeline.tsx
  - Chaincode: updateBatchStatus(), queryBatchByPublicCode(), getTraceChain()

### By Use Case

**Use Case: New Team Member?**
1. `START_HERE.md` — overview
2. `ASSIGNMENT_FOR_TEAM.md` — architecture
3. Your assigned `MEMBER_X_*.md` — specific tasks
4. `CHECKLIST.md` — track progress

**Use Case: Setting up Environment?**
1. `RUN_AND_TEST_FROM_SCRATCH.md` — step by step
2. `START_HERE.md` § "SETUP ENVIRONMENT" — quick reference

**Use Case: Understanding Architecture?**
1. `ASSIGNMENT_FOR_TEAM.md` — overview
2. `TEAM_SUMMARY.md` § "Flow Diagram" — module dependencies

**Use Case: Stuck on Specific Task?**
1. Your `MEMBER_X_*.md` — detailed guidance
2. `CHECKLIST.md` § "IF STUCK" — troubleshooting

**Use Case: Preparing Presentation?**
1. Your `MEMBER_X_*.md` § "Q&A for Presentation"
2. `CHECKLIST.md` § "PRESENTATION CHECKLIST"

**Use Case: Testing Module?**
1. Your `MEMBER_X_*.md` § "TESTING CHECKLIST"
2. `CHECKLIST.md` § "Testing section"

---

## 🔗 QUICK LINKS

### 📌 MUST READ

- 🚀 **New to project?** → `START_HERE.md`
- 🏗️ **System architecture?** → `ASSIGNMENT_FOR_TEAM.md`
- 📚 **Your tasks?** → `MEMBER_X_*.md` (replace X with your number)
- ✅ **Track progress?** → `CHECKLIST.md`

### 🔧 TECHNICAL REFERENCES

- 🌐 **Deploy/Setup?** → `RUN_AND_TEST_FROM_SCRATCH.md`
- 📂 **What's where?** → This file (INDEX.md)
- 📖 **Project overview?** → `README.md`

### 🎯 FOR EACH ROLE

- 🌱 **Member 1** → `MEMBER_1_FARMER.md`
- 🏭 **Member 2** → `MEMBER_2_PROCESSOR.md`
- 🔥 **Member 3** → `MEMBER_3_ROASTER.md`
- 📦 **Member 4** → `MEMBER_4_PACKAGER.md`
- 🛒 **Member 5** → `MEMBER_5_RETAILER_TRACE.md`

---

## 📊 DOCUMENT RELATIONSHIPS

```
START_HERE.md (entry point)
    ↓
ASSIGNMENT_FOR_TEAM.md (architecture overview)
    ├─ MEMBER_1_FARMER.md
    ├─ MEMBER_2_PROCESSOR.md
    ├─ MEMBER_3_ROASTER.md
    ├─ MEMBER_4_PACKAGER.md
    └─ MEMBER_5_RETAILER_TRACE.md
    
TEAM_SUMMARY.md (quick reference)
    ↓
CHECKLIST.md (progress tracking)
    ↓
RUN_AND_TEST_FROM_SCRATCH.md (deployment guide)

README.md (current project overview)
aidlc-docs/* (AI-DLC workflow artifacts)
```

---

## 📄 FILE DESCRIPTIONS

### `START_HERE.md`
- **Who:** Everyone
- **When:** First thing to read
- **What:** Quick-start guide, setup steps, troubleshooting
- **Time:** 10 minutes

### `ASSIGNMENT_FOR_TEAM.md`
- **Who:** Everyone
- **When:** After START_HERE
- **What:** Full system architecture, module descriptions, Q&A
- **Time:** 30 minutes

### `TEAM_SUMMARY.md`
- **Who:** Everyone
- **When:** Quick reference
- **What:** Summary, file listing, success criteria
- **Time:** 10 minutes

### `MEMBER_X_*.md` (5 files)
- **Who:** Individual member (X = 1-5)
- **When:** After architecture files
- **What:** Detailed tasks, code examples, testing guide, Q&A
- **Time:** 30-60 minutes per file

### `CHECKLIST.md`
- **Who:** Everyone (ongoing)
- **When:** Track progress throughout project
- **What:** Completion checklist per member, presentation prep, final checklist
- **Time:** Ongoing

### `RUN_AND_TEST_FROM_SCRATCH.md`
- **Who:** Everyone
- **When:** When setting up environment
- **What:** Setup steps, deployment guide, troubleshooting
- **Time:** 1-2 hours to execute

### `README.md`
- **Who:** Everyone (optional)
- **When:** Project overview
- **What:** Existing project documentation
- **Time:** 5 minutes

## 🎯 RECOMMENDED READING PATH

### Path A: New Team Member
```
1. START_HERE.md (10 min)
2. ASSIGNMENT_FOR_TEAM.md (30 min)
3. Your MEMBER_X_*.md (1 hour)
4. RUN_AND_TEST_FROM_SCRATCH.md (1-2 hours to execute)
5. Begin coding!
6. Check CHECKLIST.md regularly
```

### Path B: Team Lead / Reviewer
```
1. START_HERE.md (10 min)
2. ASSIGNMENT_FOR_TEAM.md (30 min)
3. All MEMBER_X_*.md files (3-4 hours)
4. TEAM_SUMMARY.md (10 min)
5. CHECKLIST.md (10 min)
```

### Path C: Troubleshooting
```
1. START_HERE.md § "TROUBLESHOOTING"
2. RUN_AND_TEST_FROM_SCRATCH.md § "Troubleshooting"
3. Your MEMBER_X_*.md § "Testing"
4. CHECKLIST.md § "IF STUCK"
```

---

## 📞 GETTING HELP

**Problem:** Don't know where to start
**Solution:** Read `START_HERE.md`

**Problem:** Don't understand architecture
**Solution:** Read `ASSIGNMENT_FOR_TEAM.md`

**Problem:** Don't know your tasks
**Solution:** Read your `MEMBER_X_*.md`

**Problem:** Need to setup environment
**Solution:** Follow `RUN_AND_TEST_FROM_SCRATCH.md`

**Problem:** Network not working
**Solution:** Check `START_HERE.md` § "Troubleshooting"

**Problem:** Don't know what to do next
**Solution:** Check `CHECKLIST.md` for your member

**Problem:** Still stuck
**Solution:** Ask team (Slack/Discord)

---

## 🎉 YOU'RE READY!

**Next step:** 👉 Open `START_HERE.md` and begin!

---

## 📝 NOTES

- All files are in the project root (`CoffeeChain/`)
- Print or bookmark this INDEX for easy reference
- Share this INDEX with team members
- Update this file if new documentation is added
- All file names are case-sensitive on Linux/Mac

---

**Last Updated:** 2026-05-08
**Status:** Complete ✅

💡 **Tip:** Bookmark `START_HERE.md` in your browser for quick access!
