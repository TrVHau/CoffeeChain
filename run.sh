#!/bin/bash

# CoffeeChain — Full System Startup Script
# Usage: bash run.sh [setup|start|stop|clean]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
NETWORK_DIR="$PROJECT_ROOT/network"
BACKEND_DIR="$PROJECT_ROOT/backend"
CHAINCODE_DIR="$PROJECT_ROOT/chaincode"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Functions
print_header() {
  echo -e "\n${BLUE}════════════════════════════════════════${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}════════════════════════════════════════${NC}\n"
}

print_step() {
  echo -e "${YELLOW}→ $1${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

# Ensure containerized backend can traverse/read generated crypto material.
fix_crypto_permissions() {
  local crypto_path="/tmp/coffeechain-crypto"

  if [ ! -d "$crypto_path" ]; then
    print_step "Skipping crypto permission fix (not found: $crypto_path)"
    return
  fi

  print_step "Fixing crypto permissions for backend container access..."

  if command -v sudo &> /dev/null; then
    sudo chmod -R go+r "$crypto_path" || true
    sudo find "$crypto_path" -type d -exec chmod go+rx {} \; || true
  else
    chmod -R go+r "$crypto_path" || true
    find "$crypto_path" -type d -exec chmod go+rx {} \; || true
  fi

  print_success "Crypto permissions adjusted"
}

# Check prerequisites
check_prereqs() {
  print_header "Checking Prerequisites"
  
  # Check Docker
  if ! command -v docker &> /dev/null; then
    print_error "Docker not found. Please install Docker."
    exit 1
  fi
  print_success "Docker installed"
  
  # Check Docker Compose
  if ! command -v docker compose &> /dev/null; then
    print_error "Docker Compose not found. Please install Docker Compose."
    exit 1
  fi
  print_success "Docker Compose installed"
  
  # Check Java
  if ! command -v java &> /dev/null; then
    print_error "Java not found. Please install Java 11+"
    exit 1
  fi
  print_success "Java installed: $(java -version 2>&1 | head -1)"
  
  # Check Maven
  if ! command -v mvn &> /dev/null; then
    print_error "Maven not found. Please install Maven"
    exit 1
  fi
  print_success "Maven installed"
  
  print_success "All prerequisites met!\n"
}

# Full setup and start
setup() {
  check_prereqs
  
  print_header "STEP 1: Setup Fabric Network"
  print_step "Running setup-network.sh..."
  cd "$NETWORK_DIR"
  bash scripts/setup-network.sh
  print_success "Network setup complete"
  
  print_header "STEP 2: Register Demo Users"
  print_step "Running register-users.sh..."
  bash scripts/register-users.sh
  fix_crypto_permissions
  print_success "Users registered"
  
  print_header "STEP 3: Build & Deploy Chaincode"
  print_step "Building chaincode..."
  cd "$CHAINCODE_DIR"
  bash gradlew clean build > /dev/null 2>&1
  print_success "Chaincode built"
  
  print_step "Deploying chaincode..."
  cd "$NETWORK_DIR"
  bash scripts/deploy-chaincode.sh
  print_success "Chaincode deployed"
  
  print_header "STEP 4: Build Backend"
  print_step "Building backend..."
  cd "$BACKEND_DIR"
  mvn clean package -DskipTests > /dev/null 2>&1
  print_success "Backend built"
  
  print_header "STEP 5: Start All Services"
  print_step "Starting Docker containers..."
  cd "$NETWORK_DIR"
  docker compose up -d
  
  # Wait for backend to be ready
  print_step "Waiting for backend to start..."
  for i in {1..30}; do
    if curl -s http://localhost:8080/swagger-ui.html > /dev/null 2>&1; then
      print_success "Backend is ready!"
      break
    fi
    if [ $i -eq 30 ]; then
      print_error "Backend failed to start within 30 seconds"
      exit 1
    fi
    sleep 1
  done
  
  print_header "✓ SYSTEM READY!"
  echo -e "${GREEN}Backend API:${NC} http://localhost:8080"
  echo -e "${GREEN}Swagger UI:${NC} http://localhost:8080/swagger-ui.html"
  echo -e "${GREEN}PostgreSQL:${NC} localhost:5432"
  echo -e "${GREEN}IPFS:${NC} localhost:5001"
  echo ""
  echo -e "${YELLOW}Demo Users:${NC}"
  echo "  farmer_alice / pw123"
  echo "  processor_bob / pw123"
  echo "  roaster_charlie / pw123"
  echo "  packager_dave / pw123"
  echo "  retailer_eve / pw123"
  echo ""
  echo -e "${YELLOW}Next:${NC} See SETUP_GUIDE.md or POSTMAN_TESTING.md"
  echo ""
}

# Start existing setup
start() {
  check_prereqs
  
  print_header "Starting Services"
  
  cd "$NETWORK_DIR"
  
  # Check if setup was done
  if [ ! -d "crypto-config" ]; then
    print_error "Network not initialized. Run: bash run.sh setup"
    exit 1
  fi
  
  print_step "Starting Docker containers..."
  fix_crypto_permissions
  docker compose up -d
  
  # Wait for backend
  print_step "Waiting for backend to start..."
  for i in {1..30}; do
    if curl -s http://localhost:8080/swagger-ui.html > /dev/null 2>&1; then
      print_success "Backend is ready!"
      break
    fi
    sleep 1
  done
  
  print_success "All services started"
  echo ""
  echo -e "${GREEN}http://localhost:8080${NC} - Backend API"
}

# Stop services
stop() {
  print_header "Stopping Services"
  
  cd "$NETWORK_DIR"
  docker compose down
  
  print_success "Services stopped"
}

# Clean everything
clean() {
  print_header "Cleaning Up"
  
  cd "$NETWORK_DIR"
  
  print_step "Stopping containers..."
  docker compose down -v 2>/dev/null || true
  
  print_step "Removing artifacts..."
  rm -rf crypto-config channel-artifacts .env
  sudo rm -rf /tmp/coffeechain-crypto /tmp/coffee-ca-client 2>/dev/null || true
  
  print_step "Removing build artifacts..."
  cd "$CHAINCODE_DIR"
  rm -rf build .gradle
  
  cd "$BACKEND_DIR"
  rm -rf target
  
  print_success "Everything cleaned"
  echo -e "\n${YELLOW}To reset: bash run.sh setup${NC}"
}

# Status check
status() {
  print_header "System Status"
  
  echo -e "${YELLOW}Docker Containers:${NC}"
  docker ps | grep -E "peer|orderer|postgres|ipfs|backend" || echo "  None running"
  
  echo -e "\n${YELLOW}Backend:${NC}"
  if curl -s http://localhost:8080/swagger-ui.html > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Running${NC} (http://localhost:8080)"
  else
    echo -e "  ${RED}✗ Not responding${NC}"
  fi
  
  echo -e "\n${YELLOW}Database:${NC}"
  if docker exec postgres pg_isready -U coffeetrace 2>/dev/null | grep -q "accepting"; then
    echo -e "  ${GREEN}✓ PostgreSQL running${NC}"
  else
    echo -e "  ${RED}✗ PostgreSQL not responding${NC}"
  fi
  
  echo -e "\n${YELLOW}IPFS:${NC}"
  if curl -s http://localhost:5001/api/v0/version 2>/dev/null | grep -q "Version"; then
    echo -e "  ${GREEN}✓ IPFS running${NC}"
  else
    echo -e "  ${RED}✗ IPFS not responding${NC}"
  fi
  
  echo -e "\n${YELLOW}Chaincode:${NC}"
  if docker exec -e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/admin-msp \
    peer0.org1.example.com \
    peer lifecycle chaincode querycommitted \
    --channelID coffee-traceability-channel 2>/dev/null | grep -q "CoffeeTraceChaincode"; then
    echo -e "  ${GREEN}✓ CoffeeTraceChaincode deployed${NC}"
  else
    echo -e "  ${RED}✗ Chaincode not found${NC}"
  fi
}

# Test quick login
test_login() {
  print_header "Testing Authentication"
  
  print_step "Attempting login as farmer_alice..."
  RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"userId":"farmer_alice","password":"pw123"}')
  
  if echo "$RESPONSE" | grep -q "token"; then
    print_success "Authentication successful!"
    TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 | head -c 50)
    echo -e "Token: ${GREEN}$TOKEN...${NC}"
  else
    print_error "Authentication failed"
    echo "$RESPONSE"
  fi
}

# Main
case "${1:-setup}" in
  setup)
    setup
    ;;
  start)
    start
    ;;
  stop)
    stop
    ;;
  clean)
    clean
    ;;
  status)
    status
    ;;
  test)
    test_login
    ;;
  *)
    echo "CoffeeChain System Management"
    echo ""
    echo "Usage: bash run.sh [command]"
    echo ""
    echo "Commands:"
    echo "  setup   - Full setup and start (Fabric network + backend)"
    echo "  start   - Start existing setup"
    echo "  stop    - Stop all services"
    echo "  clean   - Remove all artifacts"
    echo "  status  - Check system status"
    echo "  test    - Quick login test"
    echo ""
    echo "Examples:"
    echo "  bash run.sh setup       # First time setup"
    echo "  bash run.sh start       # Resume from stop"
    echo "  bash run.sh status      # Check what's running"
    echo "  bash run.sh clean       # Complete cleanup"
    echo ""
    exit 1
    ;;
esac
