# Hướng Dẫn Đóng Góp — CoffeeChain

> Đọc kỹ trước khi bắt đầu code. Mọi thành viên **bắt buộc** tuân theo.  
> Tài liệu chuẩn chi tiết hơn: [`docs/DEV_STANDARDS.md`](docs/DEV_STANDARDS.md)

---

## 1. Phân Công & Nhánh Git

| Thành viên | Unit | Nhánh chính |
|-----------|------|------------|
| BE-Member-1 | Unit-1: Chaincode | `feature/unit1-chaincode` |
| BE-Member-2 | Unit-2: Backend Core | `feature/unit2-backend-core` |
| BE-Member-3 | Unit-3: BE Infra + DevOps | `feature/unit3-infra-devops` |
| FE-Member-1 | Unit-4: FE Dashboards | `feature/unit4-fe-dashboards` |
| FE-Member-2 | Unit-5: FE Auth + Trace | `feature/unit5-fe-auth-trace` |

---

## 2. Git Workflow

### Nhánh chính

```
main        ← chỉ merge khi milestone xác nhận hoạt động
develop     ← nhánh tích hợp; mọi feature branch merge vào đây
feature/*   ← nhánh làm việc của từng thành viên
```

### Quy trình làm việc hàng ngày

```bash
# 1. Lấy code mới nhất trước khi bắt đầu
git checkout develop
git pull origin develop

# 2. Cập nhật nhánh feature của mình
git checkout feature/unit1-chaincode
git merge develop          # hoặc git rebase develop

# 3. Code, commit thường xuyên (không commit code broken)
git add .
git commit -m "[UNIT-1] feat: implement createHarvestBatch"

# 4. Push và tạo Pull Request vào develop
git push origin feature/unit1-chaincode
# → Tạo PR trên GitHub/GitLab → yêu cầu 1 người review
```

### ⚠️ Quy tắc bắt buộc

- **KHÔNG push thẳng vào `main` hay `develop`** — tất cả phải qua PR
- **KHÔNG merge PR của chính mình** — ít nhất 1 người khác phải approve
- **Commit thường xuyên** — mỗi commit là 1 thay đổi có ý nghĩa, không commit 1 lần cả ngày
- **Code phải compile được** trước khi commit — nếu đang dở, dùng `git stash`
- **Kéo `develop` về mỗi ngày** để tránh conflict lớn

---

## 3. Quy Tắc Commit Message

### Format

```
[UNIT-X] <type>: <mô tả ngắn gọn (tiếng Anh hoặc tiếng Việt)>

[optional body: giải thích lý do nếu cần]
```

### Prefix type

| Type | Khi nào dùng |
|------|-------------|
| `feat` | Thêm tính năng mới |
| `fix` | Sửa bug |
| `refactor` | Tái cấu trúc code (không thêm feature, không fix bug) |
| `test` | Thêm/sửa test |
| `docs` | Cập nhật tài liệu |
| `config` | Thay đổi cấu hình (yaml, docker, gradle) |
| `chore` | Thay đổi build script, dependency, tooling |

### Ví dụ

```
[UNIT-1] feat: implement createHarvestBatch with SBE setup
[UNIT-2] feat: add FarmerController with POST /api/harvest
[UNIT-3] config: add PostgreSQL Flyway migration V1
[UNIT-4] feat: add HarvestBatchForm component
[UNIT-5] feat: implement AuthContext with JWT storage
[UNIT-1] fix: use TreeMap in Batch.setMetadata to prevent endorsement mismatch
[UNIT-2] refactor: extract FabricGatewayService from BatchController
```

---

## 4. Cấu Trúc Thư Mục Dự Án (Canonical)

```
coffee-traceability/              ← PROJECT ROOT
│
├── chaincode/                    ← [Unit-1] BE-Member-1
│   ├── src/
│   │   └── main/
│   │       ├── java/com/coffee/trace/chaincode/
│   │       │   ├── CoffeeTraceChaincode.java
│   │       │   ├── model/
│   │       │   │   └── Batch.java
│   │       │   └── util/
│   │       │       ├── JSON.java
│   │       │       ├── RoleChecker.java
│   │       │       └── LedgerUtils.java
│   │       └── resources/
│   │           └── META-INF/statedb/couchdb/indexes/
│   │               ├── indexPublicCode.json
│   │               ├── indexStatus.json
│   │               └── indexOwnerMSP.json
│   ├── src/test/java/com/coffee/trace/chaincode/
│   │   └── CoffeeTraceChaincodeTest.java
│   └── build.gradle
│
├── backend/                      ← [Unit-2] BE-Member-2 + [Unit-3] BE-Member-3
│   ├── src/
│   │   └── main/
│   │       ├── java/com/coffee/trace/
│   │       │   ├── CoffeeTraceApplication.java
│   │       │   ├── config/               ← [Unit-2]
│   │       │   │   ├── FabricConfig.java
│   │       │   │   ├── SecurityConfig.java
│   │       │   │   └── OpenApiConfig.java
│   │       │   ├── controller/           ← [Unit-2]
│   │       │   │   ├── FarmerController.java
│   │       │   │   ├── ProcessorController.java
│   │       │   │   ├── RoasterController.java
│   │       │   │   ├── PackagerController.java
│   │       │   │   ├── RetailerController.java
│   │       │   │   └── TraceController.java
│   │       │   ├── dto/                  ← [Unit-2]
│   │       │   │   ├── request/
│   │       │   │   └── response/
│   │       │   ├── service/              ← [Unit-2] FabricGatewayService
│   │       │   │   ├── FabricGatewayService.java
│   │       │   │   ├── EvidenceService.java        ← [Unit-3]
│   │       │   │   └── QrCodeService.java          ← [Unit-3]
│   │       │   ├── indexer/              ← [Unit-3]
│   │       │   │   └── EventIndexerService.java
│   │       │   ├── entity/               ← [Unit-3]
│   │       │   │   ├── BatchEntity.java
│   │       │   │   ├── FarmActivityEntity.java
│   │       │   │   └── LedgerRefEntity.java
│   │       │   └── repository/           ← [Unit-3]
│   │       │       ├── BatchRepository.java
│   │       │       ├── FarmActivityRepository.java
│   │       │       └── LedgerRefRepository.java
│   │       └── resources/
│   │           ├── application.yml
│   │           ├── application-local.yml
│   │           ├── openapi.yaml          ← [Unit-2] SOURCE OF TRUTH cho FE
│   │           └── db/migration/         ← [Unit-3]
│   │               ├── V1__create_batches.sql
│   │               ├── V2__create_farm_activities.sql
│   │               └── V3__create_ledger_refs.sql
│   ├── src/test/java/com/coffee/trace/
│   └── pom.xml
│
├── frontend/                     ← [Unit-4] FE-Member-1 + [Unit-5] FE-Member-2
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx                          ← [Unit-5]
│   │   │   ├── page.tsx                            ← redirect to /login
│   │   │   ├── login/
│   │   │   │   └── page.tsx                        ← [Unit-5]
│   │   │   ├── dashboard/
│   │   │   │   ├── layout.tsx                      ← [Unit-5] auth guard
│   │   │   │   ├── farmer/
│   │   │   │   │   ├── page.tsx                    ← [Unit-4]
│   │   │   │   │   ├── new/page.tsx                ← [Unit-4]
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── page.tsx                ← [Unit-4]
│   │   │   │   │       └── activity/new/page.tsx   ← [Unit-4]
│   │   │   │   ├── processor/                      ← [Unit-4]
│   │   │   │   ├── roaster/                        ← [Unit-4]
│   │   │   │   ├── packager/                       ← [Unit-4]
│   │   │   │   └── retailer/                       ← [Unit-4]
│   │   │   └── trace/
│   │   │       └── [publicCode]/
│   │   │           └── page.tsx                    ← [Unit-5]
│   │   ├── components/
│   │   │   ├── ui/                     ← shared UI primitives (cả 2 FE dùng)
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   └── LoadingSpinner.tsx
│   │   │   ├── forms/                  ← [Unit-4]
│   │   │   │   ├── HarvestBatchForm.tsx
│   │   │   │   ├── ProcessedBatchForm.tsx
│   │   │   │   ├── RoastBatchForm.tsx
│   │   │   │   ├── PackagedBatchForm.tsx
│   │   │   │   └── FarmActivityForm.tsx
│   │   │   ├── tables/                 ← [Unit-4]
│   │   │   │   └── BatchTable.tsx
│   │   │   ├── TraceTimeline.tsx       ← [Unit-5]
│   │   │   ├── EvidenceVerifier.tsx    ← [Unit-5]
│   │   │   └── FarmActivityLog.tsx     ← [Unit-5]
│   │   └── lib/
│   │       ├── api/
│   │       │   ├── generated/          ← [Unit-5] auto-gen từ openapi.yaml (git-ignored)
│   │       │   └── client.ts           ← [Unit-5] axios instance + auth header
│   │       ├── auth/
│   │       │   ├── AuthContext.tsx     ← [Unit-5]
│   │       │   └── useAuth.ts          ← [Unit-5]
│   │       └── utils/
│   │           └── hash.ts             ← [Unit-5] SHA-256 browser-side
│   ├── middleware.ts                   ← [Unit-5] route protection
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── package.json
│
├── network/                      ← [Unit-3] BE-Member-3
│   ├── configtx.yaml
│   ├── crypto-config.yaml
│   ├── docker-compose.yaml
│   └── scripts/
│       ├── setup-network.sh
│       ├── deploy-chaincode.sh
│       └── register-users.sh
│
├── docs/                         ← Tài liệu kỹ thuật (đọc không sửa)
│   ├── 00_overview.md
│   ├── 01_system_architecture.md
│   ├── 02_roles_and_orgs.md
│   ├── 03_data_model.md
│   ├── 04_chaincode.md
│   ├── 05_backend.md
│   ├── 06_frontend_qr.md
│   ├── 07_deployment.md
│   └── DEV_STANDARDS.md          ← ← Quy chuẩn (file này)
│
├── aidlc-docs/                   ← AI-DLC artifacts (không sửa thủ công)
├── CONTRIBUTING.md               ← File này
└── .gitignore
```

---

## 5. Quy Tắc "Ai Code Ở Đâu"

### ❌ KHÔNG được làm

| Không được | Lý do |
|-----------|-------|
| FE-Member tạo file trong `backend/` | Sẽ conflict với BE code |
| BE-Member tạo file trong `frontend/` | Conflict naming, import path |
| Ai cũng sửa `openapi.yaml` | Chỉ BE-Member-2 (Unit-2) maintain; FE chỉ consume |
| Ai cũng sửa `docker-compose.yaml` | Chỉ BE-Member-3 (Unit-3) maintain |
| Ai cũng sửa `CONTRIBUTING.md` | Chỉ cả nhóm đồng thuận mới sửa |
| Đặt code vào `aidlc-docs/` | Thư mục này chỉ chứa docs |

### ✅ Chia sẻ được (cần thông báo trước)

| File/thư mục | Ai có thể sửa | Phải báo ai |
|-------------|--------------|------------|
| `frontend/src/components/ui/` | FE1 + FE2 | Thông báo nhau trước |
| `frontend/src/lib/auth/` | Chỉ FE2 tạo, FE1 chỉ đọc | — |
| `frontend/src/lib/api/client.ts` | Chỉ FE2 tạo, FE1 chỉ đọc | — |
| `backend/src/main/resources/application.yml` | BE2 + BE3 | Thông báo nhau |
| `backend/pom.xml` | Bất kỳ BE | Thông báo cả nhóm BE |

---

## 6. Quy Tắc Tích Hợp FE ↔ BE

1. **OpenAPI spec là nguồn sự thật duy nhất** — `backend/src/main/resources/openapi.yaml`
2. BE-Member-2 cập nhật openapi.yaml → thông báo FE ngay trên group chat
3. FE regenerate API client: `cd frontend && npm run generate-api`
4. **Không hardcode URL** trong FE — tất cả dùng client trong `lib/api/client.ts`
5. **Không gọi Fabric trực tiếp từ FE** — mọi thứ qua BE REST API

---

## 7. Setup Môi Trường Local

Chi tiết tại:
- Network: [`network/README.md`](network/README.md)
- Backend: [`backend/README.md`](backend/README.md)
- Frontend: [`frontend/README.md`](frontend/README.md)

### Yêu cầu tối thiểu

| Tool | Version |
|------|---------|
| Java | 21 |
| Maven | 3.9+ |
| Node.js | 20 LTS |
| Docker Desktop | Latest |
| Git | 2.40+ |

---

## 8. Khi Gặp Conflict

1. **Đừng panic** — conflict khi merge là bình thường
2. **Liên hệ người kia trước khi tự resolve** nếu conflict ở file chung
3. Ưu tiên: giữ code của cả hai, không xóa của người khác
4. Sau khi resolve: **chạy lại test** trước khi push

---

## 9. Code Review Checklist (Bắt buộc trước khi approve PR)

- [ ] Code compile / build không lỗi
- [ ] Đặt file đúng thư mục theo phân công
- [ ] Đặt tên class/file/variable theo `docs/DEV_STANDARDS.md`
- [ ] Không có hardcoded credentials, secrets, hay localhost URL
- [ ] Không có debug code (`System.out.println`, `console.log` không cần thiết)
- [ ] Exception/error được handle, không để swallow lặng lẽ
- [ ] Commit message đúng format `[UNIT-X] type: description`
