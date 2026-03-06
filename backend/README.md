# CoffeeChain Backend — Unit-2

REST API for the CoffeeChain coffee supply-chain traceability platform.  
Built with **Spring Boot 3.3.4**, **Java 21**, **Hyperledger Fabric Gateway SDK 1.4.1**, and **PostgreSQL**.

---

## Prerequisites

| Tool                        | Version |
| --------------------------- | ------- |
| Java                        | 21      |
| Maven                       | 3.9+    |
| PostgreSQL                  | 15+     |
| Docker (for Fabric network) | 24+     |

---

## Environment Variables

Configure via `application.yaml` or override with environment variables:

| Variable                      | Description                              | Example                                        |
| ----------------------------- | ---------------------------------------- | ---------------------------------------------- |
| `SPRING_DATASOURCE_URL`       | PostgreSQL JDBC URL                      | `jdbc:postgresql://localhost:5432/coffeetrace` |
| `SPRING_DATASOURCE_USERNAME`  | DB username                              | `postgres`                                     |
| `SPRING_DATASOURCE_PASSWORD`  | DB password                              | `postgres`                                     |
| `JWT_SECRET`                  | HS256 signing secret (Base64, ≥32 bytes) | `your-very-secret-key-here`                    |
| `JWT_EXPIRATION_MS`           | Token TTL in milliseconds                | `86400000`                                     |
| `FABRIC_ORG1_PEER_ENDPOINT`   | Org1 peer gRPC address                   | `localhost:7051`                               |
| `FABRIC_ORG1_TLS_CERT_PATH`   | Org1 peer TLS CA cert path               | `/fabric/org1/tls-ca.pem`                      |
| `FABRIC_ORG1_ADMIN_CERT_PATH` | Org1 Admin identity cert                 | `/fabric/org1/admin.pem`                       |
| `FABRIC_ORG1_ADMIN_KEY_PATH`  | Org1 Admin identity private key          | `/fabric/org1/admin-key.pem`                   |
| `FABRIC_ORG1_MSP_ID`          | Org1 MSP ID                              | `Org1MSP`                                      |
| `FABRIC_ORG2_PEER_ENDPOINT`   | Org2 peer gRPC address                   | `localhost:9051`                               |
| `FABRIC_ORG2_TLS_CERT_PATH`   | Org2 peer TLS CA cert path               | `/fabric/org2/tls-ca.pem`                      |
| `FABRIC_ORG2_ADMIN_CERT_PATH` | Org2 Admin identity cert                 | `/fabric/org2/admin.pem`                       |
| `FABRIC_ORG2_ADMIN_KEY_PATH`  | Org2 Admin identity private key          | `/fabric/org2/admin-key.pem`                   |
| `FABRIC_ORG2_MSP_ID`          | Org2 MSP ID                              | `Org2MSP`                                      |
| `IPFS_API_URL`                | IPFS API URL (Unit-3)                    | `http://localhost:5001`                        |
| `TRACE_PUBLIC_BASE_URL`       | Public URL prefix in QR codes            | `https://coffeechain.example.com/trace`        |

---

## Build

```bash
cd backend
mvn clean package -DskipTests
```

---

## Run

```bash
# Start PostgreSQL (example with Docker)
docker run -d \
  --name coffeetrace-db \
  -e POSTGRES_DB=coffeetrace \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15

# Run the application
mvn spring-boot:run
```

The API will be available at `http://localhost:8080`.

---

## Demo Users

All demo users have password **`pw123`** (seeded by Flyway migration `V1__init_schema.sql`).

| userId            | Role      | Org     |
| ----------------- | --------- | ------- |
| `farmer_alice`    | FARMER    | Org1MSP |
| `processor_bob`   | PROCESSOR | Org1MSP |
| `roaster_charlie` | ROASTER   | Org1MSP |
| `packager_dave`   | PACKAGER  | Org2MSP |
| `retailer_eve`    | RETAILER  | Org2MSP |

Login:

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"farmer_alice","password":"pw123"}'
```

Use the returned `token` as `Authorization: Bearer <token>` for all authenticated requests.

---

## API Documentation

- **Swagger UI**: `http://localhost:8080/swagger-ui.html`
- **OpenAPI spec**: [`src/main/resources/openapi.yaml`](src/main/resources/openapi.yaml)

---

## Running Tests

```bash
mvn test
```

---

## Key Design Decisions

### Per-user Fabric wallet

Each of the 5 named users has their own X.509 identity loaded at startup in `FabricGatewayService`. JWT claims (`sub=userId`) are used to select the correct Fabric identity for every transaction submission.

### SBE AND policy for `acceptTransfer`

The `acceptTransfer` chaincode function requires endorsement from **both** Org1 and Org2 peers. The `submitAcceptTransfer()` method in `FabricGatewayService` connects to both peers to satisfy the State-Based Endorsement AND policy.

### PostgreSQL as read cache

All ledger writes are also mirrored into PostgreSQL (`batches`, `farm_activities`, `ledger_refs`) for fast, indexed queries. Pass `?source=chain` to `GET /api/batch/{id}` to force a live ledger read.

### Flyway migrations

All schema changes go through `src/main/resources/db/migration/`. Never modify `V1__init_schema.sql`; create a new versioned file instead.

---

## Inter-Unit Dependencies

| Unit                     | Dependency                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| Unit-3 (EvidenceService) | `QrCodeService` — injected into `PackagerController` and `TraceController` once Unit-3 is ready |
| Unit-4/5 (Frontend)      | Consume `openapi.yaml` for type generation                                                      |
