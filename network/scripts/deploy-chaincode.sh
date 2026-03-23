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
CHAINCODE_VERSION="${CHAINCODE_VERSION:-1.0}"
CHAINCODE_SEQUENCE="${CHAINCODE_SEQUENCE:-1}"

echo "======================================================"
echo " CoffeeChain — Chaincode Deployment"
echo "======================================================"

# ── Step 1: Build fat JAR ─────────────────────────────────
echo ""
echo "[1/5] Building chaincode fat JAR..."
cd "$PROJECT_ROOT/chaincode"
bash gradlew shadowJar -q
CHAINCODE_JAR=$(ls build/libs/*.jar | head -1)
echo "  > Built: $CHAINCODE_JAR"
cd "$NETWORK_DIR"

# Orderer TLS CA cert (inside peer containers via /channel-artifacts mount)
ORDERER_CA="/channel-artifacts/orderer-tls-ca.crt"
ORG1_TLS_CA="/etc/hyperledger/fabric/tls/ca.crt"
# Org2 TLS CA must be Org2's own CA cert, not Org1's.
# It will be staged into channel-artifacts so peer0.org1 container can access it.
ORG2_TLS_CA="/channel-artifacts/org2-tls-ca.crt"

# Load CRYPTO_BASE / ARTIFACTS_BASE set by setup-network.sh
# shellcheck disable=SC1091
[[ -f "$NETWORK_DIR/.env" ]] && source "$NETWORK_DIR/.env"
CRYPTO_BASE="${CRYPTO_BASE:-$NETWORK_DIR/crypto-config}"
ARTIFACTS_BASE="${ARTIFACTS_BASE:-$NETWORK_DIR/channel-artifacts}"

# FABRIC_CFG_PATH must point to a directory containing core.yaml
# The peer binary needs this for 'peer lifecycle chaincode package' on host
FABRIC_SAMPLES_CONFIG="$HOME/fabric-samples/config"
NETWORK_CONFIG="$NETWORK_DIR/config"
if [[ -f "$NETWORK_CONFIG/core.yaml" ]]; then
  export FABRIC_CFG_PATH="$NETWORK_CONFIG"
elif [[ -f "$FABRIC_SAMPLES_CONFIG/core.yaml" ]]; then
  export FABRIC_CFG_PATH="$FABRIC_SAMPLES_CONFIG"
else
  echo "ERROR: core.yaml not found. Run from network/ after downloading Fabric binaries."
  echo "  Try: curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.5 -d -s"
  exit 1
fi
echo "  > FABRIC_CFG_PATH=$FABRIC_CFG_PATH"

# ── Step 2: Package chaincode ─────────────────────────────
echo "[2/5] Packaging chaincode..."
PACKAGE_FILE="${CHAINCODE_NAME}.tar.gz"

peer lifecycle chaincode package "$PACKAGE_FILE" \
  --path "$PROJECT_ROOT/chaincode/build/libs" \
  --lang java \
  --label "${CHAINCODE_NAME}_${CHAINCODE_VERSION}"

echo "  > Package: $PACKAGE_FILE"

# ── Step 3: Install on both peers ─────────────────────────
# Pre-pull the Java chaincode runtime image so peer doesn't have to pull at build time
echo "[3/5] Pulling fabric-javaenv image (needed by peer to build Java chaincode)..."
docker pull hyperledger/fabric-javaenv:2.5

echo "[3/5] Installing chaincode on Org1 peer..."
docker cp "$PACKAGE_FILE" peer0.org1.example.com:/tmp/

docker exec \
  -e CORE_PEER_LOCALMSPID=Org1MSP \
  -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/admin-msp \
  peer0.org1.example.com \
  peer lifecycle chaincode install /tmp/$PACKAGE_FILE

echo "[3/5] Installing chaincode on Org2 peer..."
docker cp "$PACKAGE_FILE" peer0.org2.example.com:/tmp/

docker exec \
  -e CORE_PEER_LOCALMSPID=Org2MSP \
  -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/admin-msp \
  peer0.org2.example.com \
  peer lifecycle chaincode install /tmp/$PACKAGE_FILE

# ── Extract Package ID ────────────────────────────────────
echo "  > Fetching package ID..."
PACKAGE_ID=$(docker exec \
  -e CORE_PEER_LOCALMSPID=Org1MSP \
  -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/admin-msp \
  peer0.org1.example.com \
  peer lifecycle chaincode queryinstalled 2>&1 \
  | grep "Package ID:.*${CHAINCODE_NAME}_${CHAINCODE_VERSION}" \
  | head -1 \
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
  -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/admin-msp \
  peer0.org1.example.com \
  peer lifecycle chaincode approveformyorg \
  -o orderer.example.com:7050 \
  --channelID "$CHANNEL_NAME" \
  --name "$CHAINCODE_NAME" \
  --version "$CHAINCODE_VERSION" \
  --package-id "$PACKAGE_ID" \
  --sequence $CHAINCODE_SEQUENCE \
  --tls \
  --cafile $ORDERER_CA

echo "[4/5] Approving chaincode for Org2..."
docker exec \
  -e CORE_PEER_LOCALMSPID=Org2MSP \
  -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/admin-msp \
  peer0.org2.example.com \
  peer lifecycle chaincode approveformyorg \
  -o orderer.example.com:7050 \
  --channelID "$CHANNEL_NAME" \
  --name "$CHAINCODE_NAME" \
  --version "$CHAINCODE_VERSION" \
  --package-id "$PACKAGE_ID" \
  --sequence $CHAINCODE_SEQUENCE \
  --tls \
  --cafile $ORDERER_CA

# ── Step 5: Commit chaincode ──────────────────────────────
echo "[5/5] Committing chaincode to channel..."
# Stage Org2 TLS CA into artifacts dir so peer0.org1 container can verify Org2 peer TLS.
# (commit runs inside peer0.org1 which only has its own TLS CA at /etc/hyperledger/fabric/tls/ca.crt)
cp "${CRYPTO_BASE}/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  "${ARTIFACTS_BASE}/org2-tls-ca.crt"
docker exec \
  -e CORE_PEER_LOCALMSPID=Org1MSP \
  -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/admin-msp \
  peer0.org1.example.com \
  peer lifecycle chaincode commit \
  -o orderer.example.com:7050 \
  --channelID "$CHANNEL_NAME" \
  --name "$CHAINCODE_NAME" \
  --version "$CHAINCODE_VERSION" \
  --sequence $CHAINCODE_SEQUENCE \
  --peerAddresses peer0.org1.example.com:7051 \
  --tlsRootCertFiles $ORG1_TLS_CA \
  --peerAddresses peer0.org2.example.com:9051 \
  --tlsRootCertFiles $ORG2_TLS_CA \
  --tls \
  --cafile $ORDERER_CA

echo ""
echo "======================================================"
echo " Chaincode '$CHAINCODE_NAME' deployed successfully!"
echo " Version: $CHAINCODE_VERSION  Sequence: $CHAINCODE_SEQUENCE"
echo ""
echo " Verify with:"
echo "   docker exec -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/admin-msp peer0.org1.example.com peer lifecycle chaincode querycommitted --channelID $CHANNEL_NAME"
echo "======================================================"
