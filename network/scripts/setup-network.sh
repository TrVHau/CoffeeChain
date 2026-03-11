#!/bin/bash
# network/scripts/setup-network.sh
# [Unit-3] BE-Member-3
#
# One-shot script to bring up the full CoffeeChain Fabric network:
#   1. Generate crypto material (cryptogen)
#   2. Generate genesis block + channel artifacts (configtxgen)
#   3. Start Docker Compose services
#   4. Create channel, join both peers, update anchor peers
#
# Prerequisites (installed on host):
#   - hyperledger/fabric-samples binaries (cryptogen, configtxgen, peer) in PATH
#   - Docker + Docker Compose
#   - fabric-ca-client in PATH (for register-users.sh step)
#
# Usage (from the network/ directory):
#   chmod +x scripts/*.sh
#   ./scripts/setup-network.sh

set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(cd "$SCRIPTS_DIR/.." && pwd)"
cd "$NETWORK_DIR"

CHANNEL_NAME="coffee-traceability-channel"

echo "======================================================"
echo " CoffeeChain — Network Setup"
echo "======================================================"

# ── Step 1: Clean previous artifacts ──────────────────────
echo ""
echo "[1/6] Cleaning previous crypto and channel artifacts..."
rm -rf crypto-config channel-artifacts
mkdir -p channel-artifacts

# ── Step 2: Generate crypto material ──────────────────────
echo "[2/6] Generating crypto material..."
cryptogen generate --config=./crypto-config.yaml --output=./crypto-config

# ── Step 3: Generate channel artifacts ────────────────────
echo "[3/6] Generating genesis block and channel transactions..."

export FABRIC_CFG_PATH="$NETWORK_DIR"

configtxgen -profile TwoOrgsOrdererGenesis \
  -channelID system-channel \
  -outputBlock ./channel-artifacts/genesis.block

configtxgen -profile TwoOrgsChannel \
  -outputCreateChannelTx ./channel-artifacts/channel.tx \
  -channelID "$CHANNEL_NAME"

configtxgen -profile TwoOrgsChannel \
  -outputAnchorPeersUpdate ./channel-artifacts/Org1MSPanchors.tx \
  -channelID "$CHANNEL_NAME" \
  -asOrg Org1MSP

configtxgen -profile TwoOrgsChannel \
  -outputAnchorPeersUpdate ./channel-artifacts/Org2MSPanchors.tx \
  -channelID "$CHANNEL_NAME" \
  -asOrg Org2MSP

echo "  > Genesis block and channel artifacts ready."

# ── Step 4: Start Docker Compose ──────────────────────────
echo "[4/6] Starting Docker Compose services..."
docker compose up -d orderer.example.com couchdb0 couchdb1 \
  peer0.org1.example.com peer0.org2.example.com \
  ca.org1.example.com ca.org2.example.com

echo "  > Waiting 15s for containers to initialise..."
sleep 15

# ── Step 5: Create and join channel ───────────────────────
echo "[5/6] Creating channel '$CHANNEL_NAME'..."

# Create channel from Org1 peer
docker exec peer0.org1.example.com peer channel create \
  -o orderer.example.com:7050 \
  -c "$CHANNEL_NAME" \
  -f /channel-artifacts/channel.tx \
  --tls \
  --cafile /etc/hyperledger/fabric/tls/ca.crt

# Wait for block to be committed
sleep 3

# Org1 joins
docker exec peer0.org1.example.com peer channel join \
  -b "/channel-artifacts/${CHANNEL_NAME}.block"

# Copy channel block to Org2 peer container, then join
docker cp "$(docker inspect --format='{{.Id}}' peer0.org1.example.com):/channel-artifacts/${CHANNEL_NAME}.block" \
  /tmp/${CHANNEL_NAME}.block 2>/dev/null || true

# Use CLI approach: fetch block from orderer for Org2
docker exec \
  -e CORE_PEER_LOCALMSPID=Org2MSP \
  -e CORE_PEER_ADDRESS=peer0.org2.example.com:9051 \
  -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp \
  peer0.org2.example.com \
  peer channel fetch 0 "/channel-artifacts/${CHANNEL_NAME}.block" \
  -o orderer.example.com:7050 \
  -c "$CHANNEL_NAME" \
  --tls \
  --cafile /etc/hyperledger/fabric/tls/ca.crt

docker exec \
  -e CORE_PEER_LOCALMSPID=Org2MSP \
  peer0.org2.example.com \
  peer channel join -b "/channel-artifacts/${CHANNEL_NAME}.block"

echo "  > Both peers joined channel."

# ── Step 6: Update anchor peers ───────────────────────────
echo "[6/6] Updating anchor peers..."

docker exec peer0.org1.example.com peer channel update \
  -o orderer.example.com:7050 \
  -c "$CHANNEL_NAME" \
  -f /channel-artifacts/Org1MSPanchors.tx \
  --tls \
  --cafile /etc/hyperledger/fabric/tls/ca.crt

docker exec \
  -e CORE_PEER_LOCALMSPID=Org2MSP \
  peer0.org2.example.com \
  peer channel update \
  -o orderer.example.com:7050 \
  -c "$CHANNEL_NAME" \
  -f /channel-artifacts/Org2MSPanchors.tx \
  --tls \
  --cafile /etc/hyperledger/fabric/tls/ca.crt

echo ""
echo "======================================================"
echo " Network setup COMPLETE."
echo " Next steps:"
echo "   ./scripts/deploy-chaincode.sh    — deploy CoffeeTraceChaincode"
echo "   ./scripts/register-users.sh      — register demo users"
echo "   docker compose up -d backend      — start backend + infra"
echo "======================================================"
