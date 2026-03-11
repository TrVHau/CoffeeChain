#!/bin/bash
# network/scripts/deploy-chaincode.sh
# [Unit-3] BE-Member-3
#
# Fabric 2.x lifecycle chaincode deployment:
#   1. Build chaincode fat JAR (Gradle shadowJar)
#   2. Package chaincode
#   3. Install on both peers
#   4. Approve for both orgs
#   5. Commit to channel
#
# Prerequisites:
#   - setup-network.sh has been run successfully
#   - Fabric peer binary in PATH
#   - Gradle + Java 21 available
#
# Usage (from the network/ directory):
#   ./scripts/deploy-chaincode.sh

set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(cd "$SCRIPTS_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$NETWORK_DIR/.." && pwd)"
cd "$NETWORK_DIR"

CHANNEL_NAME="coffee-traceability-channel"
CHAINCODE_NAME="CoffeeTraceChaincode"
CHAINCODE_VERSION="1.0"
CHAINCODE_SEQUENCE=1

echo "======================================================"
echo " CoffeeChain — Chaincode Deployment"
echo "======================================================"

# ── Step 1: Build fat JAR ─────────────────────────────────
echo ""
echo "[1/5] Building chaincode fat JAR..."
cd "$PROJECT_ROOT/chaincode"
./gradlew shadowJar -q
CHAINCODE_JAR=$(ls build/libs/*.jar | head -1)
echo "  > Built: $CHAINCODE_JAR"
cd "$NETWORK_DIR"

# ── Step 2: Package chaincode ─────────────────────────────
echo "[2/5] Packaging chaincode..."
PACKAGE_FILE="${CHAINCODE_NAME}.tar.gz"

peer lifecycle chaincode package "$PACKAGE_FILE" \
  --path "$PROJECT_ROOT/chaincode/build/libs" \
  --lang java \
  --label "${CHAINCODE_NAME}_${CHAINCODE_VERSION}"

echo "  > Package: $PACKAGE_FILE"

# ── Step 3: Install on both peers ─────────────────────────
echo "[3/5] Installing chaincode on Org1 peer..."
docker cp "$PACKAGE_FILE" peer0.org1.example.com:/tmp/

docker exec \
  -e CORE_PEER_LOCALMSPID=Org1MSP \
  peer0.org1.example.com \
  peer lifecycle chaincode install /tmp/$PACKAGE_FILE

echo "[3/5] Installing chaincode on Org2 peer..."
docker cp "$PACKAGE_FILE" peer0.org2.example.com:/tmp/

docker exec \
  -e CORE_PEER_LOCALMSPID=Org2MSP \
  peer0.org2.example.com \
  peer lifecycle chaincode install /tmp/$PACKAGE_FILE

# ── Extract Package ID ────────────────────────────────────
echo "  > Fetching package ID..."
PACKAGE_ID=$(docker exec \
  -e CORE_PEER_LOCALMSPID=Org1MSP \
  peer0.org1.example.com \
  peer lifecycle chaincode queryinstalled 2>&1 \
  | grep "Package ID:" \
  | sed 's/Package ID: //' \
  | sed 's/, Label.*//' \
  | tr -d '[:space:]')

if [[ -z "$PACKAGE_ID" ]]; then
  echo "ERROR: Could not determine package ID. Check peer logs."
  exit 1
fi

echo "  > Package ID: $PACKAGE_ID"
export PACKAGE_ID

# ── Step 4: Approve for both orgs ─────────────────────────
echo "[4/5] Approving chaincode for Org1..."
docker exec \
  -e CORE_PEER_LOCALMSPID=Org1MSP \
  peer0.org1.example.com \
  peer lifecycle chaincode approveformyorg \
  -o orderer.example.com:7050 \
  --channelID "$CHANNEL_NAME" \
  --name "$CHAINCODE_NAME" \
  --version "$CHAINCODE_VERSION" \
  --package-id "$PACKAGE_ID" \
  --sequence $CHAINCODE_SEQUENCE \
  --tls \
  --cafile /etc/hyperledger/fabric/tls/ca.crt

echo "[4/5] Approving chaincode for Org2..."
docker exec \
  -e CORE_PEER_LOCALMSPID=Org2MSP \
  peer0.org2.example.com \
  peer lifecycle chaincode approveformyorg \
  -o orderer.example.com:7050 \
  --channelID "$CHANNEL_NAME" \
  --name "$CHAINCODE_NAME" \
  --version "$CHAINCODE_VERSION" \
  --package-id "$PACKAGE_ID" \
  --sequence $CHAINCODE_SEQUENCE \
  --tls \
  --cafile /etc/hyperledger/fabric/tls/ca.crt

# ── Step 5: Commit chaincode ──────────────────────────────
echo "[5/5] Committing chaincode to channel..."
docker exec \
  -e CORE_PEER_LOCALMSPID=Org1MSP \
  peer0.org1.example.com \
  peer lifecycle chaincode commit \
  -o orderer.example.com:7050 \
  --channelID "$CHANNEL_NAME" \
  --name "$CHAINCODE_NAME" \
  --version "$CHAINCODE_VERSION" \
  --sequence $CHAINCODE_SEQUENCE \
  --peerAddresses peer0.org1.example.com:7051 \
  --peerAddresses peer0.org2.example.com:9051 \
  --tls \
  --cafile /etc/hyperledger/fabric/tls/ca.crt

echo ""
echo "======================================================"
echo " Chaincode '$CHAINCODE_NAME' deployed successfully!"
echo " Version: $CHAINCODE_VERSION  Sequence: $CHAINCODE_SEQUENCE"
echo ""
echo " Verify with:"
echo "   docker exec peer0.org1.example.com peer lifecycle chaincode querycommitted --channelID $CHANNEL_NAME"
echo "======================================================"
