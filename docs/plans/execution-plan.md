# Execution Plan — CoffeeChain

> **Tạo**: 2026-03-02 | **Phase**: INCEPTION — Workflow Planning
> **Dựa trên**: requirements.md + câu trả lời requirement-verification-questions.md

---

## 1. Tóm Tắt Quyết Định

| Câu hỏi | Quyết định |
|---------|-----------|
| Phân chia BE+Chaincode | 1 người Chaincode Java, 1 người Backend Core (Controllers + Gateway), 1 người Backend Infra + DevOps/Network |
| Phân chia FE | 1 người 5 dashboards CRUD, 1 người Auth + Public Trace + API Integration Layer |
| Network setup | Người BE Infra (BE3) phụ trách chính; BE2 hỗ trợ khi cần |
| Timeline | 2–3 tháng (≈ đến tháng 5–6/2026) |
| Tích hợp FE↔BE | OpenAPI contract first → 2 nhóm làm song song |
| Milestone | Không cần demo sớm; hoàn thiện end-to-end cuối kỳ; dùng unit test trong quá trình |

---

## 2. Risk Assessment

| Risk | Mức | Giải pháp |
|------|-----|----------|
| SBE AND policy cho acceptTransfer | Medium | BE2 test kỹ Docker Compose anchor peer + service discovery |
| Farm activity event chỉ qua EventIndexer | Medium | BE3 test EventIndexer trước khi BE2 dùng |
| OpenAPI contract bị lệch giữa BE và FE | Medium | Dùng Swagger UI (SpringDoc) để auto-generate; FE dùng openapi-typescript-codegen |
| Endorsement mismatch (TreeMap) | Low | Đã handle trong Batch.java; cần unit test chaincode |
| IPFS connectivity trong demo | Low | Dùng Kubo local container trong Docker Compose |

---

## 3. Phases Sẽ Thực Thi

| Phase / Stage | Thực thi? | Lý do |
|--------------|-----------|-------|
| Workspace Detection | ✅ Done | |
| Reverse Engineering | ⏭️ Skip | Greenfield |
| Requirements Analysis | ✅ Done | |
| User Stories | ⏭️ Skip | Tài liệu đã đủ chi tiết; không cần thêm story |
| Workflow Planning | ✅ Done (file này) | |
| Application Design | ⏭️ Skip | Thiết kế chi tiết đã có đầy đủ trong docs/ |
| Units Generation | ✅ Execute | Cần — chia việc rõ cho 5 người |
| Functional Design (per unit) | ✅ Execute | Data models + business rules cần document |
| NFR Requirements | ✅ Execute | Security (per-user cert), SBE policy, determinism |
| NFR Design | ✅ Execute | SBE pattern, TreeMap fix, per-user wallet |
| Infrastructure Design | ✅ Execute | Docker Compose network, IPFS, PostgreSQL schema |
| Code Generation | ✅ Execute | Sinh code cho từng unit |
| Build and Test | ✅ Execute | Build instructions + test scripts |

---

## 4. Thứ Tự Thực Thi Per-Unit

```
UNIT 1 (Chaincode)         UNIT 2 (BE Core)           UNIT 3 (BE Infra+DevOps)
─────────────────          ─────────────────          ────────────────────────
Functional Design          Functional Design          Functional Design
NFR Design (SBE, TreeMap)  NFR Design (per-user cert) Infra Design (Docker, DB)
Code Generation            Code Generation            Code Generation

UNIT 4 (FE Dashboards)     UNIT 5 (FE Auth+Trace)
────────────────────       ──────────────────────
[Sau khi OpenAPI spec có]  [Sau khi OpenAPI spec có]
Functional Design          Functional Design
Code Generation            Code Generation
```

**Thứ tự khởi động:**
1. **Tuần 1–2**: Unit 1 (Chaincode) + Unit 3 bắt đầu Docker Compose network
2. **Tuần 2–3**: Unit 2 bắt đầu song song sau khi chaincode function signatures rõ
3. **Tuần 3–4**: OpenAPI spec hoàn thiện → Unit 4 + Unit 5 bắt đầu song song
4. **Tuần 5+**: Tích hợp từng flow; build & test

---

## 5. 5 Units of Work

| Unit | Thành viên | Scope |
|------|-----------|-------|
| **Unit-1: Chaincode** | BE-Member-1 | CoffeeTraceChaincode.java, Batch.java, Util classes, SBE logic |
| **Unit-2: Backend Core** | BE-Member-2 | FabricGatewayService, REST Controllers (5 roles + trace), OpenAPI spec |
| **Unit-3: BE Infra + DevOps** | BE-Member-3 | EventIndexer, PostgreSQL, IPFS/Evidence, QR, Docker Compose network, scripts |
| **Unit-4: FE Dashboards** | FE-Member-1 | 5 role dashboards (CRUD forms, status updates) |
| **Unit-5: FE Auth + Public** | FE-Member-2 | Login, /trace page, QR display, EvidenceVerifier, API integration layer |

---

## 6. Dependency Flow

```
Unit-1 (Chaincode)
    ↓  function signatures + event names
Unit-2 (BE Core)  ─────────────────────── OpenAPI Spec ──┐
    ↓  evaluateTransaction results                        │
Unit-3 (BE Infra)                                         │
    ↓                                                     ↓
[Build & Test Integration]                Unit-4 + Unit-5 (FE — song song)
```

---

## 7. Checkpoint chính

| Thời điểm | Milestone |
|-----------|----------|
| ~Tuần 2 | Chaincode compile + basic unit test pass |
| ~Tuần 3 | Docker Compose network up, chaincode deploy thành công |
| ~Tuần 4 | OpenAPI spec hoàn chỉnh; BE REST API chạy được với test user |
| ~Tuần 6 | EventIndexer nhận event; PostgreSQL có data |
| ~Tuần 8 | FE dashboards kết nối BE thật |
| ~Tuần 10–12 | End-to-end flow: Farmer → Packager → QR → /trace hoạt động |
