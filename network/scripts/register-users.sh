#!/bin/bash
# network/scripts/register-users.sh
# [Unit-3] BE-Member-3
#
# Register and enroll 5 demo users using Fabric CA:
#   Org1: farmer_alice, processor_bob, roaster_charlie
#   Org2: packager_dave, retailer_eve
#
# Each user gets:
#   - A registered identity in the CA with role-based attributes
#   - An enrolled MSP folder under crypto-config/peerOrganizations/<org>/users/<userId>/
#   - The folder structure expected by FabricGatewayService in the backend
#
# Prerequisites:
#   - setup-network.sh completed (CAs running)
#   - fabric-ca-client binary in PATH
#
# Usage (from the network/ directory):
#   ./scripts/register-users.sh

set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(cd "$SCRIPTS_DIR/.." && pwd)"
cd "$NETWORK_DIR"

# Load .env if present (written by setup-network.sh, sets CRYPTO_BASE=/tmp/coffeechain-crypto)
# This ensures user certs are written to the same location containers mount
if [[ -f "$NETWORK_DIR/.env" ]]; then
  set -a; source "$NETWORK_DIR/.env"; set +a
fi
CRYPTO_HOME="${CRYPTO_BASE:-$NETWORK_DIR/crypto-config}"
echo "  > Using CRYPTO_HOME=$CRYPTO_HOME"

CA_CLIENT_BASE="/tmp/coffee-ca-client"

# ── Helpers ───────────────────────────────────────────────

enroll_admin() {
  local org="$1"       # Org1 | Org2
  local ca_host="$2"   # ca.org1.example.com:7054
  local admin_dir="$CA_CLIENT_BASE/$org/admin"
  local tls_cert="$CRYPTO_HOME/peerOrganizations/${org,,}.example.com/ca/ca-cert.pem"

  mkdir -p "$admin_dir"
  export FABRIC_CA_CLIENT_HOME="$admin_dir"

  fabric-ca-client enroll \
    -u "https://admin:adminpw@$ca_host" \
    --caname "ca-${org,,}" \
    --tls.certfiles "$tls_cert"
  echo "  > Admin enrolled for $org"
}

register_and_enroll() {
  local org="$1"       # Org1 | Org2
  local ca_host="$2"   # ca.org1.example.com:7054
  local user_id="$3"   # farmer_alice
  local role="$4"      # FARMER
  local msp_id="${org}MSP"
  local admin_dir="$CA_CLIENT_BASE/$org/admin"
  local user_dir="$CRYPTO_HOME/peerOrganizations/${org,,}.example.com/users/$user_id"
  local tls_cert="$CRYPTO_HOME/peerOrganizations/${org,,}.example.com/ca/ca-cert.pem"

  export FABRIC_CA_CLIENT_HOME="$admin_dir"

  # Register
  fabric-ca-client register \
    --caname "ca-${org,,}" \
    --id.name "$user_id" \
    --id.secret "${user_id}pw" \
    --id.type client \
    --id.attrs "role=${role}:ecert" \
    --tls.certfiles "$tls_cert" \
    2>&1 | grep -v "already registered" || true

  # Enroll
  mkdir -p "$user_dir/msp/signcerts" "$user_dir/msp/keystore"
  export FABRIC_CA_CLIENT_HOME="$user_dir"

  fabric-ca-client enroll \
    -u "https://${user_id}:${user_id}pw@$ca_host" \
    --caname "ca-${org,,}" \
    -M "$user_dir/msp" \
    --enrollment.attrs "role" \
    --csr.cn "$user_id" \
    --tls.certfiles "$tls_cert"

  echo "  > Registered and enrolled: $user_id ($role @ $msp_id)"
}

# ── Org1 Users ────────────────────────────────────────────
echo "======================================================"
echo " CoffeeChain — Registering Demo Users"
echo "======================================================"

echo ""
echo "[Org1] Enrolling CA admin..."
enroll_admin "Org1" "ca.org1.example.com:7054"

echo "[Org1] Registering application users..."
register_and_enroll "Org1" "ca.org1.example.com:7054" "farmer_alice"    "FARMER"
register_and_enroll "Org1" "ca.org1.example.com:7054" "processor_bob"  "PROCESSOR"
register_and_enroll "Org1" "ca.org1.example.com:7054" "roaster_charlie" "ROASTER"

# ── Org2 Users ────────────────────────────────────────────
echo ""
echo "[Org2] Enrolling CA admin..."
enroll_admin "Org2" "ca.org2.example.com:8054"

echo "[Org2] Registering application users..."
register_and_enroll "Org2" "ca.org2.example.com:8054" "packager_dave"  "PACKAGER"
register_and_enroll "Org2" "ca.org2.example.com:8054" "retailer_eve"   "RETAILER"

# ── Summary ───────────────────────────────────────────────
echo ""
echo "======================================================"
echo " Users registered successfully!"
echo ""
echo " Org1 (Org1MSP):"
echo "   farmer_alice   — FARMER"
echo "   processor_bob  — PROCESSOR"
echo "   roaster_charlie — ROASTER"
echo ""
echo " Org2 (Org2MSP):"
echo "   packager_dave  — PACKAGER"
echo "   retailer_eve   — RETAILER"
echo ""
echo " MSP folders created under:"
echo "   crypto-config/peerOrganizations/<org>/users/<userId>/msp/"
echo ""
echo " Backend FabricGatewayService reads these paths via application.yaml"
echo " fabric.org1.usersBasePath and fabric.org2.usersBasePath."
echo "======================================================"
