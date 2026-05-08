# CoffeeChain Production Deployment Runbook (Azure for Students)

This runbook is a strict phase-by-phase deployment guide for production-like rollout.
Do not move to the next phase until the current phase passes all checks.

## 1. Target Architecture (Recommended)

Use this layout for Azure for Students budget and operational simplicity:

1. Hyperledger Fabric network on 1 Azure Ubuntu VM (Docker Compose)
2. PostgreSQL Flexible Server managed by Azure
3. Backend on Azure Container Apps
4. Frontend on Vercel (recommended free tier) or Azure Static Web Apps
5. Optional IPFS on Azure Container Apps (or keep on Fabric VM for initial release)

Rationale:
- Fabric is stateful and easier to run with fixed host networking on a VM.
- Backend and frontend are stateless and easier to scale independently.
- Managed PostgreSQL removes data durability risk from VM disks.

## 2. Deployment Order (Mandatory)

1. Phase 1: Azure foundation and DNS
2. Phase 2: Fabric network deploy
3. Phase 3: Chaincode deploy and user registration
4. Phase 4: Data services (PostgreSQL and IPFS) production setup
5. Phase 5: Backend deploy
6. Phase 6: Frontend deploy
7. Phase 7: Hardening, backup, and smoke test

## 3. Phase 1 - Azure Foundation and DNS

### 3.1 Create baseline resources

1. Create Resource Group: `rg-coffeechain-prod`
2. Create Ubuntu VM (Standard B2s or B4ms): `vm-coffeechain-fabric`
3. Attach static public IP to VM
4. Create DNS A records:
   - `fabric.your-domain.com` -> VM public IP
   - `api.your-domain.com` -> backend endpoint (later)
   - `app.your-domain.com` -> frontend endpoint (later)

### 3.2 Open required ports on NSG

Only open what you need:

- 22/tcp from your IP only
- 7050/tcp (orderer) restricted to backend egress IP if possible
- 7051/tcp and 9051/tcp (peers) restricted to backend egress IP if possible
- 7054/tcp and 8054/tcp (Fabric CAs) restricted to admin IP only

### 3.3 VM bootstrap

On VM:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git jq

# Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Re-login SSH and verify:

```bash
docker --version
docker compose version
```

### 3.4 Phase 1 exit criteria

All conditions must be true:

- VM reachable by SSH
- Docker and Compose available
- DNS `fabric.your-domain.com` resolves to VM IP
- NSG rules applied

Stop here and continue only after Phase 1 is fully complete.

## 4. Phase 2 - Fabric Network Deploy

### 4.1 Clone project on VM

```bash
git clone <your-repo-url> CoffeeChain
cd CoffeeChain/network
```

### 4.2 Install Fabric binaries

```bash
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.5 -d -s
export PATH="$PWD/bin:$PATH"
cryptogen version
configtxgen --version
peer version
```

### 4.3 Set runtime mount strategy

For Linux VM, keep runtime under project local path:

```bash
cat > .env << 'EOF'
CRYPTO_BASE=./crypto-config
ARTIFACTS_BASE=./channel-artifacts
TRACE_PUBLIC_BASE_URL=https://app.your-domain.com/trace/
NEXT_PUBLIC_API_URL=https://api.your-domain.com
JWT_SECRET=replace-with-strong-secret-32-plus
EOF
```

### 4.4 Start Fabric network

```bash
bash scripts/setup-network.sh
docker ps --format "table {{.Names}}\t{{.Status}}"
docker exec peer0.org1.example.com peer channel list
```

### 4.5 Phase 2 exit criteria

- orderer, 2 peers, 2 couchdb, and 2 ca containers are Up
- channel `coffee-traceability-channel` exists

## 5. Phase 3 - Chaincode and Demo Identities

### 5.1 Deploy chaincode

```bash
export PATH="$PWD/bin:$PATH"
bash scripts/deploy-chaincode.sh
```

### 5.2 Register users

```bash
bash scripts/register-users.sh
```

### 5.3 Validate chaincode commit

```bash
docker exec -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/admin-msp \
  peer0.org1.example.com \
  peer lifecycle chaincode querycommitted --channelID coffee-traceability-channel
```

### 5.4 Phase 3 exit criteria

- chaincode committed on channel
- five demo users enrolled under users directories

## 6. Phase 4 - Data Services for Production

### 6.1 PostgreSQL

Recommended: Azure Database for PostgreSQL Flexible Server

1. Create server with zone redundancy disabled (cost saving)
2. Enable SSL required
3. Create database: `coffeetrace`
4. Create app user with least privileges
5. Allow backend egress IP in firewall

### 6.2 IPFS

Options:

1. Fast path: run `ipfs/kubo` in same Fabric VM
2. Better isolation: Azure Container Apps single replica

For first production rollout, option 1 is acceptable.

### 6.3 Phase 4 exit criteria

- backend can reach PostgreSQL over SSL
- backend can reach IPFS API endpoint

## 7. Phase 5 - Backend Deploy (Azure Container Apps)

### 7.1 Build and push image

Use Azure Container Registry (ACR):

```bash
# run from backend directory with your own names
az acr login --name <acr-name>
docker build -t <acr-name>.azurecr.io/coffeechain-backend:prod ./backend
docker push <acr-name>.azurecr.io/coffeechain-backend:prod
```

### 7.2 Configure backend environment

Use values from `backend/.env.production.template`.

Required critical values:

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `DB_PASSWORD`
- `JWT_SECRET`
- `TRACE_PUBLIC_BASE_URL`
- all `FABRIC_*` paths/endpoints

### 7.3 Mount Fabric credentials

Backend must access Fabric crypto materials.
Use one approach:

1. Keep backend on VM with direct bind mount from `network/crypto-config`
2. If backend runs on ACA, store crypto in Azure Files and mount volume

For Azure for Students, option 1 (backend on VM) is simpler and lower risk.

### 7.4 Phase 5 exit criteria

- `/actuator/health` returns UP
- `/swagger-ui.html` reachable via `https://api.your-domain.com`

## 8. Phase 6 - Frontend Deploy

### 8.1 Recommended (Vercel)

Set env vars:

- `NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com`
- `API_BASE_URL=https://api.your-domain.com`

### 8.2 Alternative (Azure Static Web Apps)

Use GitHub Actions deployment and same env values.

### 8.3 Phase 6 exit criteria

- Login works against production backend
- Trace page resolves data from API

## 9. Phase 7 - Hardening and Operations

1. Replace default secrets (`JWT_SECRET`, db passwords)
2. Enforce HTTPS everywhere
3. Lock NSG by source IP, no open wildcard admin ports
4. Enable periodic backup:
   - PostgreSQL automated backups
   - Fabric artifacts snapshot (`crypto-config`, `channel-artifacts`)
5. Add uptime checks for API and frontend

## 10. First-Day Smoke Test (Production)

Run end-to-end flow once:

1. login farmer
2. create harvest batch
3. process batch
4. roast batch
5. package batch
6. mark in stock and sold
7. trace by public code

Expected: final trace status is `SOLD`.

## 11. Rollback Strategy

1. Keep previous backend image tag available
2. Use immutable image tags per release (`prod-yyyymmdd-hhmm`)
3. If deployment fails:
   - rollback backend image tag
   - keep db schema backward compatible for one release window

## 12. Checkpoint Protocol

For your requested mode (one part finished before next):

1. Execute one phase only.
2. Collect evidence (commands and outputs).
3. Mark phase complete.
4. Then proceed to the next phase.
