# Quy Chuẩn Phát Triển — CoffeeChain

> **Bắt buộc đọc trước khi code.**  
> Mọi code không tuân theo tài liệu này sẽ bị yêu cầu sửa lại khi review.

---

## 1. Quy Tắc Đặt Tên (Naming Conventions)

### 1.1 Java — Chaincode & Backend

| Loại | Quy tắc | Ví dụ đúng | Ví dụ SAI |
|------|---------|-----------|----------|
| Class | PascalCase | `FabricGatewayService` | `fabricGatewayService`, `fabric_gateway` |
| Interface | PascalCase + `I` prefix **không dùng** | `BatchRepository` | `IBatchRepository` |
| Method | camelCase, động từ | `createHarvestBatch()`, `getBatchById()` | `CreateBatch()`, `batch_create()` |
| Variable | camelCase | `ownerMsp`, `batchId` | `OwnerMsp`, `owner_msp` |
| Constant | UPPER_SNAKE_CASE | `ROLE_TO_MSP`, `MAX_RETRY` | `roleToMsp`, `maxretry` |
| Package | lowercase, không dấu | `com.coffee.trace.controller` | `com.Coffee.Trace` |
| Test class | `<TênClass>Test` | `FabricGatewayServiceTest` | `TestFabricGateway` |

#### Package structure bắt buộc

**Chaincode:**
```
com.coffee.trace.chaincode          ← main contract class
com.coffee.trace.chaincode.model    ← Batch.java
com.coffee.trace.chaincode.util     ← JSON, RoleChecker, LedgerUtils
```

**Backend:**
```
com.coffee.trace                    ← CoffeeTraceApplication.java
com.coffee.trace.config             ← FabricConfig, SecurityConfig, OpenApiConfig
com.coffee.trace.controller         ← *Controller.java
com.coffee.trace.service            ← FabricGatewayService, EvidenceService, QrCodeService
com.coffee.trace.indexer            ← EventIndexerService.java
com.coffee.trace.entity             ← *Entity.java (JPA)
com.coffee.trace.repository         ← *Repository.java
com.coffee.trace.dto.request        ← *Request.java
com.coffee.trace.dto.response       ← *Response.java
com.coffee.trace.exception          ← *Exception.java, GlobalExceptionHandler.java
```

#### Tên file quan trọng — KHÔNG được đổi

| Tên file | Package | Chủ sở hữu |
|---------|---------|-----------|
| `CoffeeTraceChaincode.java` | `chaincode` | Unit-1 |
| `Batch.java` | `chaincode.model` | Unit-1 |
| `FabricGatewayService.java` | `service` | Unit-2 |
| `EventIndexerService.java` | `indexer` | Unit-3 |
| `openapi.yaml` | `resources/` | Unit-2 |

---

### 1.2 TypeScript / React — Frontend

| Loại | Quy tắc | Ví dụ đúng | Ví dụ SAI |
|------|---------|-----------|----------|
| Component (file + function) | PascalCase | `TraceTimeline.tsx`, `function TraceTimeline()` | `traceTimeline.tsx` |
| Hook | camelCase, prefix `use` | `useAuth.ts`, `useBatchList.ts` | `AuthHook.ts` |
| Page (`app/` folder) | Tên thư mục lowercase | `farmer/page.tsx` | `Farmer/Page.tsx` |
| Type / Interface | PascalCase | `BatchResponse`, `TraceStep` | `batchResponse` |
| Enum | PascalCase | `BatchType`, `UserRole` | `BATCH_TYPE` |
| Variable / Function | camelCase | `const batchId`, `function formatDate()` | `BatchId`, `FormatDate` |
| CSS class (Tailwind) | kebab-case nếu custom | `trace-timeline` | `traceTimeline` |

#### Cấu trúc component bắt buộc

```typescript
// 1. Imports — external trước, internal sau, types cuối
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { BatchTable } from '@/components/tables/BatchTable';
import { useBatchList } from '@/lib/hooks/useBatchList';

import type { BatchResponse } from '@/lib/api/generated';

// 2. Types / Interfaces local
interface FarmerDashboardProps {
  userId: string;
}

// 3. Component — named export (không dùng default export cho components)
export function FarmerDashboard({ userId }: FarmerDashboardProps) {
  // ...
}
```

**Quy tắc import path:**
- Dùng alias `@/` (trỏ vào `src/`) — không dùng relative path `../../`
- Ví dụ: `import { apiClient } from '@/lib/api/client'` ✅
- Không làm: `import { apiClient } from '../../../lib/api/client'` ❌

---

### 1.3 Database

| Loại | Quy tắc | Ví dụ |
|------|---------|-------|
| Tên bảng | snake_case, số nhiều | `batches`, `farm_activities`, `ledger_refs` |
| Tên cột | snake_case | `batch_id`, `owner_msp`, `created_at` |
| Primary key | `id` (serial/bigserial) hoặc `<entity>_id` | `id`, `batch_id` |
| Khóa ngoại | `<bảng_tham_chiếu>_id` | `harvest_batch_id` |
| Index | `idx_<bảng>_<cột>` | `idx_batches_public_code` |
| Migration Flyway | `V<số>__<mô_tả>.sql` | `V1__create_batches.sql` |

---

### 1.4 REST API Endpoints

| Quy tắc | Đúng | SAI |
|---------|------|-----|
| kebab-case | `/api/farm-activities` | `/api/farmActivities`, `/api/farm_activities` |
| Danh từ, không dùng động từ trong path | `/api/harvest` (POST) | `/api/createHarvest` |
| ID trong path | `/api/batch/{batchId}` | `/api/batch/get/{batchId}` |
| Luôn có prefix `/api/` | `/api/trace/{code}` | `/trace/{code}` |

---

### 1.5 Chaincode Functions

| Quy tắc | Đúng | SAI |
|---------|------|-----|
| camelCase | `createHarvestBatch` | `CreateHarvestBatch`, `create_harvest_batch` |
| Động từ + danh từ | `createHarvestBatch`, `recordFarmActivity` | `harvestBatch`, `farmActivity` |
| Query functions prefix `query` hoặc `get` | `queryBatchByPublicCode`, `getBatch` | `fetchBatch`, `findBatch` |

### 1.6 Fabric Event Names

Tất cả event names: `SCREAMING_SNAKE_CASE`

| Đúng | SAI |
|------|-----|
| `BATCH_CREATED` | `batchCreated`, `BatchCreated` |
| `FARM_ACTIVITY_RECORDED` | `farmActivityRecorded` |
| `TRANSFER_ACCEPTED` | `TransferAccepted` |

---

## 2. Quy Tắc Code Từng Layer

### 2.1 Chaincode (Unit-1)

#### ✅ Bắt buộc làm

```java
// ĐÚNG: Luôn dùng TreeMap cho metadata
public void setMetadata(Map<String, String> v) {
    this.metadata = (v != null) ? new TreeMap<>(v) : new TreeMap<>();
}

// ĐÚNG: Validate role VÀ MSP binding
RoleChecker.require(ctx, "FARMER");   // checks cả role attribute + MSP

// ĐÚNG: Dùng LedgerUtils.now(ctx) cho timestamp (deterministic)
b.setCreatedAt(LedgerUtils.now(ctx));

// ĐÚNG: throw ChaincodeException với message rõ ràng
if (b == null) throw new ChaincodeException("Batch not found: " + batchId);

// ĐÚNG: Annotate transaction type
@Transaction(intent = Transaction.TYPE.EVALUATE)   // read-only
public Batch getBatch(Context ctx, String batchId) { ... }

@Transaction    // write (default = SUBMIT)
public void createHarvestBatch(Context ctx, ...) { ... }
```

#### ❌ KHÔNG được làm

```java
// SAI: Không dùng new Date(), System.currentTimeMillis() → non-deterministic
b.setCreatedAt(new Date().toString());  // ❌ mỗi peer ra kết quả khác nhau

// SAI: Không dùng HashMap cho metadata → endorsement mismatch
this.metadata = new HashMap<>(v);  // ❌

// SAI: Không để exception im lặng
try {
    // ...
} catch (Exception e) {
    // ❌ swallow exception
}

// SAI: Không dùng stub.getHistoryForKey() trong Submit transaction
// (non-deterministic history ordering)
```

---

### 2.2 Backend — FabricGatewayService (Unit-2)

#### ✅ Bắt buộc làm

```java
// ĐÚNG: Submit dùng per-user identity
public byte[] submitAs(String userId, String fnName, String... args) {
    Gateway gw = gatewayByUser.get(userId);
    if (gw == null) throw new IllegalArgumentException("No identity: " + userId);
    return getContract(gw).submitTransaction(fnName, args);
}

// ĐÚNG: acceptTransfer dùng method riêng vì SBE AND
public byte[] submitAcceptTransfer(String userId, String batchId) { ... }

// ĐÚNG: Evaluate dùng org-level gateway (không cần user cert)
public byte[] evaluateTransaction(String org, String fnName, String... args) {
    return getContract(gatewayByOrg.get(org)).evaluateTransaction(fnName, args);
}
```

#### ❌ KHÔNG được làm

```java
// SAI: Submit bằng Admin cert → ownerUserId trên ledger = Admin
return adminGateway.getNetwork(channelName)
    .getContract(chaincodeName)
    .submitTransaction("createHarvestBatch", ...);  // ❌

// SAI: Hardcode peer endpoint
.forTarget("localhost:7051")  // ❌ — phải đọc từ FabricConfig
```

---

### 2.3 Backend — Controllers (Unit-2)

#### Template controller chuẩn

```java
@RestController
@RequestMapping("/api/harvest")
@RequiredArgsConstructor
public class FarmerController {

    private final FabricGatewayService fabricGateway;

    @PostMapping
    public ResponseEntity<BatchResponse> createHarvestBatch(
            @RequestBody @Valid CreateHarvestBatchRequest req,
            @AuthenticationPrincipal UserDetails user) {

        // 1. Lấy userId từ JWT principal (KHÔNG lấy từ request body)
        String userId = user.getUsername();

        // 2. Gọi chaincode
        byte[] result = fabricGateway.submitAs(userId, "createHarvestBatch",
            req.getBatchId(), req.getPublicCode(),
            req.getFarmLocation(), req.getHarvestDate(),
            req.getCoffeeVariety(), String.valueOf(req.getWeightKg()));

        // 3. Parse + trả về response
        BatchResponse response = objectMapper.readValue(result, BatchResponse.class);
        return ResponseEntity.ok(response);
    }
}
```

#### Quy tắc bắt buộc

- **Không chứa business logic trong Controller** — chỉ gọi Service
- **Luôn dùng `@Valid`** cho request body
- **Không trả lỗi raw** — dùng `GlobalExceptionHandler` để chuẩn hóa
- **Không log sensitive data** (private key, password, JWT token)

---

### 2.4 Backend — EventIndexerService (Unit-3)

#### ✅ Bắt buộc làm

```java
// ĐÚNG: Lấy blockNumber từ event object, KHÔNG từ payload
String blockNumber = String.valueOf(event.getBlockNumber());
String txId = event.getTransactionId();

// ĐÚNG: Retry với exponential backoff
retryDelaySec = Math.min(retryDelaySec * 2, 60);

// ĐÚNG: Handle từng event bằng switch expression
switch (event.getEventName()) {
    case "BATCH_CREATED" -> { ... }
    case "FARM_ACTIVITY_RECORDED" -> { ... }
    default -> log.debug("Unhandled event: {}", event.getEventName());
}
```

#### ❌ KHÔNG được làm

```java
// SAI: Lấy blockNumber từ payload Chaincode (unreliable)
String blockNumber = payload.get("blockNumber");  // ❌

// SAI: Exception trong handleEvent() làm crash indexer thread
// Phải bọc try-catch để log và tiếp tục
```

---

### 2.5 Frontend — Pages (Unit-4)

#### Template page chuẩn

```typescript
// app/dashboard/farmer/page.tsx

import { BatchTable } from '@/components/tables/BatchTable';
import { apiClient } from '@/lib/api/client';

// Tên function = tên page theo Next.js convention
export default async function FarmerPage() {
  // Server Component: fetch data trực tiếp nếu cần
  // Client Component: dùng 'use client' + useEffect
  return (
    <main>
      <h1>Farmer Dashboard</h1>
      <BatchTable />
    </main>
  );
}

// Luôn export metadata
export const metadata = {
  title: 'Farmer Dashboard | CoffeeChain',
};
```

#### Quy tắc bắt buộc

- **Không gọi API trực tiếp trong component** — dùng custom hook hoặc server component
- **Không hardcode userId, token** — lấy từ `useAuth()` hook
- **Không dùng `any` type** — luôn khai báo type rõ ràng
- **Luôn có loading và error state** khi fetch data

---

### 2.6 Frontend — API Client (Unit-5 tạo, tất cả dùng)

```typescript
// lib/api/client.ts — KHÔNG sửa trực tiếp, chỉ Unit-5 maintain

// ✅ ĐÚNG: Dùng apiClient từ lib
import { apiClient } from '@/lib/api/client';
const batches = await apiClient.harvest.list();

// ❌ SAI: Gọi fetch trực tiếp
const res = await fetch('http://localhost:8080/api/harvest');  // ❌

// ❌ SAI: Hardcode base URL
const res = await fetch('http://localhost:8080/api/harvest', { ... });  // ❌

// ✅ ĐÚNG: Dùng generated types từ openapi.yaml
import type { BatchResponse } from '@/lib/api/generated';
```

---

## 3. Error Handling — Chuẩn Chung

### 3.1 Backend — HTTP Error Response Format

Mọi lỗi từ BE phải trả về format chuẩn:

```json
{
  "timestamp": "2026-03-02T10:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Batch not found: BATCH-001",
  "path": "/api/harvest/BATCH-001"
}
```

Implement bằng `@ControllerAdvice`:

```java
@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleBadRequest(
            IllegalArgumentException ex, HttpServletRequest req) {
        return ResponseEntity.badRequest()
            .body(new ErrorResponse(400, ex.getMessage(), req.getRequestURI()));
    }

    @ExceptionHandler(FabricException.class)
    public ResponseEntity<ErrorResponse> handleFabric(
            FabricException ex, HttpServletRequest req) {
        log.error("Fabric error: {}", ex.getMessage());
        return ResponseEntity.status(502)
            .body(new ErrorResponse(502, "Blockchain error: " + ex.getMessage(),
                req.getRequestURI()));
    }
}
```

### 3.2 Frontend — Error Handling

```typescript
// ✅ ĐÚNG: Xử lý lỗi rõ ràng
try {
  const result = await apiClient.harvest.create(data);
  // success
} catch (error) {
  if (error instanceof ApiError) {
    setErrorMessage(error.message);     // hiển thị cho user
  } else {
    setErrorMessage('Đã xảy ra lỗi, vui lòng thử lại.');
    console.error('Unexpected error:', error);   // log để debug
  }
}

// ❌ SAI: Bắt lỗi rồi không làm gì
try {
  await apiClient.harvest.create(data);
} catch (e) {}  // ❌ swallow
```

---

## 4. Anti-Patterns — Tuyệt Đối Không Làm

### 4.1 Chaincode

| Anti-pattern | Hậu quả | Cách đúng |
|------------|---------|----------|
| `new Date()` / `System.currentTimeMillis()` | Endorsement mismatch — tx bị reject | `LedgerUtils.now(ctx)` |
| `HashMap` cho metadata | Byte diff giữa peers | `TreeMap` |
| `Random`, `UUID.randomUUID()` | Non-deterministic | Dùng txId + timestamp |
| Bắt lỗi rồi im lặng | Bug ẩn | Re-throw hoặc log + `ChaincodeException` |
| Query on world state trong loop | Performance O(n²) | Rich query với index |

### 4.2 Backend

| Anti-pattern | Hậu quả | Cách đúng |
|------------|---------|----------|
| Submit tx bằng Admin cert | `ownerUserId = Admin` trên ledger | Per-user wallet |
| Hardcode `localhost:7051` | Không chạy trong Docker | Config trong `application.yml` |
| Secret trong code | Security leak | `${ENV_VAR}` trong yaml |
| Trả raw bytes về FE | FE không parse được | Deserialize → DTO → JSON |
| `@Transactional` wrap Fabric call | Fabric không support JPA TX | Tách riêng |

### 4.3 Frontend

| Anti-pattern | Hậu quả | Cách đúng |
|------------|---------|----------|
| `any` type | Mất type safety | Dùng generated types |
| `useEffect` fetch không có cleanup | Memory leak | Cancel fetch khi unmount |
| Token lưu trong `localStorage` | XSS risk | `httpOnly cookie` hoặc in-memory |
| Relative import `../../` | Break khi refactor | Alias `@/` |
| `default export` component | Khó đổi tên khi import | Named export |
| Gọi BE trực tiếp từ component | Logic phân tán | Custom hook hoặc service layer |

---

## 5. Quy Tắc Về Secrets & Configuration

### ❌ KHÔNG bao giờ commit

```
# .gitignore phải có:
*.pem
*.key
*_sk
crypto-config/
channel-artifacts/
.env
.env.local
network/crypto-config/
```

### ✅ Cách quản lý config

```yaml
# application.yml — commit được (không chứa secret)
db:
  password: ${DB_PASSWORD}          # đọc từ ENV

jwt:
  secret: ${JWT_SECRET}             # đọc từ ENV
```

```bash
# .env.local (không commit) — từng dev tự tạo local
DB_PASSWORD=dev_password_local
JWT_SECRET=dev_secret_at_least_32_chars
```

---

## 6. Quy Tắc Test

### 6.1 Chaincode (Unit-1)

```java
// Test mỗi function với mock Context
@Test
void createHarvestBatch_shouldCreateAndEmitEvent() {
    // arrange
    Context ctx = MockContext.asUser("farmer_alice", "Org1MSP", "FARMER");
    CoffeeTraceChaincode cc = new CoffeeTraceChaincode();

    // act
    cc.createHarvestBatch(ctx, "BATCH-001", "FARM-001", "Cầu Đất",
        "2026-03-01", "Arabica", "500");

    // assert
    assertThat(MockContext.getState(ctx, "BATCH-001")).isNotNull();
    assertThat(MockContext.getLastEvent(ctx).getName())
        .isEqualTo("BATCH_CREATED");
}
```

### 6.2 Backend (Unit-2, Unit-3)

- Unit test: mock `FabricGatewayService`, test controller logic
- Integration test: test EventIndexer với mock Fabric event

### 6.3 Frontend (Unit-4, Unit-5)

- Component test: `@testing-library/react`
- Unit test hook: `renderHook`
- Mock API: `msw` (Mock Service Worker)

---

## 7. Checklist Trước Khi Tạo Pull Request

- [ ] `git pull origin develop` và merge trước khi PR
- [ ] Code compile không lỗi (`./gradlew build` hoặc `mvn package` hoặc `npm run build`)
- [ ] File đặt đúng thư mục theo phần 4 của `CONTRIBUTING.md`
- [ ] Không có file `.env`, `*.pem`, `*_sk` trong commit
- [ ] Tên class/method/variable theo Quy tắc đặt tên (Mục 1)
- [ ] Không có `TODO` chưa giải quyết ở code critical path
- [ ] Error handling đủ (không swallow exception)
- [ ] Không có hardcoded URL, credential, secret
- [ ] PR description giải thích **tại sao** thay đổi, không chỉ **cái gì**
