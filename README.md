# CoffeeChain

CoffeeChain is a coffee traceability demo built with Hyperledger Fabric, Spring Boot, PostgreSQL, IPFS, and Next.js.

## Repository Map

| Path | Purpose |
| --- | --- |
| `chaincode/` | Fabric Java chaincode for coffee batch lifecycle, role checks, trace queries, and endorsement rules. |
| `backend/` | Spring Boot REST API, JWT auth, Fabric Gateway integration, PostgreSQL mirror, evidence upload, and QR generation. |
| `frontend/` | Next.js app with login, role dashboards, public trace pages, scanner, and evidence verifier. |
| `network/` | Docker Compose Fabric network, CA setup, crypto generation, chaincode deploy scripts, PostgreSQL, IPFS, backend, and frontend services. |
| `aidlc-docs/` | AI-DLC workflow artifacts and audit trail. |
| `MEMBER_*.md` | Team member assignment guides for the five vertical modules. |

## Start Here

1. Read `START_HERE.md` for the project walkthrough.
2. Read `ASSIGNMENT_FOR_TEAM.md` for the system architecture and team split.
3. Read your assigned `MEMBER_X_*.md` file.
4. Use `RUN_AND_TEST_FROM_SCRATCH.md` to run the full stack and test end to end.

## Main Flow

Farmer creates a harvest batch, Processor creates a processed batch, Roaster creates a roast batch and requests transfer, Packager accepts the transfer and creates packaged products with QR codes, and Retailer manages stock and public traceability.

## Common Commands

```bash
cd network
bash scripts/setup-network.sh
bash scripts/register-users.sh
bash scripts/deploy-chaincode.sh
docker compose up -d
```

```bash
cd backend
mvn test
```

```bash
cd frontend
npm test
npm run build
```
