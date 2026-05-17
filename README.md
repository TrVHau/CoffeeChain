# CoffeeChain — Enterprise-Grade Traceability Platform

CoffeeChain is a full-stack coffee traceability platform demonstrating a production-oriented architecture built with Hyperledger Fabric, Spring Boot, PostgreSQL, IPFS, and Next.js. This repository contains the full stack required to run, test, and extend the system for research, teaching, or pilot deployments.

Phiên bản tóm tắt bằng tiếng Việt: CoffeeChain là hệ thống truy xuất nguồn gốc cà phê, bao gồm chaincode Fabric, API backend, giao diện Next.js, cơ sở dữ liệu và hạ tầng mạng Fabric.

---

## Table of Contents

- Project Overview
- Technology & Architecture
- Repository Layout
- Quick Start (10–30 minutes)
- Developer Setup
- Running the Full Stack
- Testing & CI
- Security Considerations
- Contribution Guidelines
- Contact & Credits

---

## Project Overview

Purpose: Provide an end-to-end demonstration of traceability for coffee supply chains where each participant (Farmer, Processor, Roaster, Packager, Retailer) records events and evidence on a permissioned ledger. The platform supports evidence uploads (IPFS), SHA‑256 verification, QR‑based public traceability, and state-based endorsement (AND policies) for sensitive transfers.

Primary audience: students, researchers, and teams building PoCs for supply-chain traceability and blockchain-integrated systems.

Key capabilities:

- Role-based workflows and access control
- Chaincode (Java) implementing lifecycle operations and trace traversal
- Spring Boot backend with Fabric Gateway integration, REST APIs, and PostgreSQL
- Next.js frontend with public trace pages and evidence verification utilities
- Local Fabric network orchestration for end-to-end testing

---

## Technology & Architecture

- Hyperledger Fabric — permissioned ledger and chaincode (Java)
- Spring Boot — backend REST API, JWT-based auth, Fabric Gateway SDK
- Next.js (React) — frontend UI and public trace pages
- PostgreSQL — relational mirror for fast queries and joins
- IPFS — optional evidence storage for large artifacts; hash stored on-chain
- Docker & Docker Compose — local Fabric network and service composition

High-level flow: Farmer → Processor → Roaster (upload evidence) → Packager (AND endorsement accept) → Retailer (public trace)

---

## Repository Layout

- `chaincode/` — Fabric Java contracts, endorsement logic, and unit tests
- `backend/` — Spring Boot service, OpenAPI spec, database migrations, and integration code
- `frontend/` — Next.js app (role dashboards, public trace, scanner, evidence verification)
- `network/` — Docker Compose profiles, CA scripts, and chaincode deployment helpers
- Documentation (root): `START_HERE.md`, `RUN_AND_TEST_FROM_SCRATCH.md`, `INDEX.md`, `PROJECT_OVERVIEW.md`, `MEMBER_*.md`

Refer to the per-member docs for module responsibilities and file lists.

---

## Quick Start (recommended)

Prerequisites: `docker`, `docker-compose`, `node >= 18`, `npm` or `pnpm`, `mvn` (Maven), and a UNIX-like shell (Git Bash, WSL, or macOS/Linux).

1. Read the quick guide: `START_HERE.md` and `RUN_AND_TEST_FROM_SCRATCH.md`.
2. Start the local Fabric network and supporting services (Postgres, IPFS):

```bash
cd network
bash scripts/setup-network.sh
bash scripts/register-users.sh
bash scripts/deploy-chaincode.sh
docker compose up -d
```

3. Start the backend API:

```bash
cd backend
mvn spring-boot:run
```

4. Start the frontend (development):

```bash
cd frontend
npm install
npm run dev
```

5. Open the UI at `http://localhost:3000` and verify public trace pages at `/trace/{publicCode}`.

See `RUN_AND_TEST_FROM_SCRATCH.md` for alternative flows (CI, containerized runs, and production notes).

---

## Developer Setup

Backend

- Java 21 (project configured for Java 21)
- Build & test:

```bash
cd backend
mvn clean package
mvn test
```

Frontend

- Node (recommended v18+)
- Build & test:

```bash
cd frontend
npm install
npm test
npm run build
```

Configuration

- Default app configuration is provided in `backend/src/main/resources/application.yaml` and `target/classes/application.yaml` (runtime-specific values should be set with environment variables or a local `application-local.yaml`).
- Fabric connection profiles and crypto material live under `network/` — follow `network/README.md` for details.

API clients

- The frontend can generate types from the backend OpenAPI spec: `npm run generate:api` (see `frontend/package.json`).

---

## Running the Full Stack (containerized)

The repository contains `Dockerfile` for `backend` and `frontend` plus Compose manifests under `network/`. For a container-first run:

```bash
cd network
docker compose -f docker-compose.yaml up --build -d
```

Monitor logs with `docker compose logs -f backend` and `docker compose logs -f frontend`.

---

## Testing & CI

- Unit & integration tests are located in each module (`backend/src/test`, `frontend/__tests__`).
- Suggested CI steps for a pipeline:
  1.  Checkout
  2.  Build & test `backend` (Maven)
  3.  Build & test `frontend` (Node + Jest)
  4.  Start minimal Fabric network for integration tests (optional)
  5.  Linting and security scans

Add your CI configuration under `.github/workflows/` to enable automated runs.

---

## Security Considerations

- Role-based access relies on X.509 certificate attributes and JWTs — verify your CA and token issuance process before production use.
- Evidence files are stored on IPFS; only SHA‑256 hashes are recorded on-chain. Ensure secure handling of upload endpoints and CORS policies.
- State-based endorsement (AND) is used for transfer acceptance — carefully review the `setStateValidationParameter` usages in chaincode.

---

## Contribution & Development Guidelines

- Read `CONTRIBUTING.md` and `CHECKLIST.md` before submitting changes.
- Keep modules and responsibilities aligned with `MEMBER_*.md`.
- Follow the repository code style and run linters/tests locally before creating pull requests.

Recommended branch strategy: `main` (stable) + `feature/*` branches per-ticket.

---

## Contact & Credits

Project: CoffeeChain — Blockchain Coffee Traceability System
Course: Information Security & Cryptography
Team: 5 members (Farmer, Processor, Roaster, Packager, Retailer)

For questions or access requests, see `PROJECT_OVERVIEW.md` and `TEAM_SUMMARY.md` or contact the repository owner.

---

## License

This repository does not include a license file by default. Add `LICENSE` at the repo root to clarify usage and redistribution rules.

---

Thank you for using CoffeeChain. If you want, I can also:

- Add CI workflow templates for build/test
- Generate badges (build, test coverage)
- Produce a Vietnamese-only README translation

Would you like me to commit these additional items now?
