# Deployment

## 1. Docker Compose (Demo)

```yaml
# network/docker-compose.yaml
version: '3.8'

services:

  orderer.example.com:
    image: hyperledger/fabric-orderer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - ORDERER_GENERAL_LISTENADDRESS=0.0.0.0
      - ORDERER_GENERAL_LISTENPORT=7050
      - ORDERER_GENERAL_LOCALMSPID=OrdererMSP
      - ORDERER_GENERAL_LOCALMSPDIR=/var/hyperledger/orderer/msp
      - ORDERER_GENERAL_TLS_ENABLED=true
      - ORDERER_GENERAL_TLS_PRIVATEKEY=/var/hyperledger/orderer/tls/server.key
      - ORDERER_GENERAL_TLS_CERTIFICATE=/var/hyperledger/orderer/tls/server.crt
      - ORDERER_GENERAL_TLS_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_GENERAL_BOOTSTRAPMETHOD=file
      - ORDERER_GENERAL_BOOTSTRAPFILE=/var/hyperledger/orderer/genesis.block
      - ORDERER_GENERAL_CONSENSUS_TYPE=etcdraft
    volumes:
      - ./channel-artifacts/genesis.block:/var/hyperledger/orderer/genesis.block
      - ./crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/msp:/var/hyperledger/orderer/msp
      - ./crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tls:/var/hyperledger/orderer/tls
    ports:
      - "7050:7050"

  peer0.org1.example.com:
    image: hyperledger/fabric-peer:2.5
    environment:
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=coffee_network
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.org1.example.com
      - CORE_PEER_ADDRESS=peer0.org1.example.com:7051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:7051
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.org1.example.com:7051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.org1.example.com:7051
      - CORE_PEER_LOCALMSPID=Org1MSP
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb0:5984
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ./crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/msp:/etc/hyperledger/fabric/msp
      - ./crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls:/etc/hyperledger/fabric/tls
      - ./channel-artifacts:/channel-artifacts   # FIX-09: cần để peer join channel
    ports:
      - "7051:7051"
    depends_on:
      - couchdb0
      - orderer.example.com

  peer0.org2.example.com:
    image: hyperledger/fabric-peer:2.5
    environment:
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=coffee_network
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.org2.example.com
      - CORE_PEER_ADDRESS=peer0.org2.example.com:9051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:9051
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.org2.example.com:9051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.org2.example.com:9051
      - CORE_PEER_LOCALMSPID=Org2MSP
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb1:5984
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ./crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/msp:/etc/hyperledger/fabric/msp
      - ./crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls:/etc/hyperledger/fabric/tls
      - ./channel-artifacts:/channel-artifacts   # FIX-09: cần để peer join channel
    ports:
      - "9051:9051"
    depends_on:
      - couchdb1
      - orderer.example.com

  couchdb0:
    image: couchdb:3.3
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - "5984:5984"

  couchdb1:
    image: couchdb:3.3
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - "7984:5984"

  ca.org1.example.com:
    image: hyperledger/fabric-ca:1.5
    environment:
      - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server
      - FABRIC_CA_SERVER_CA_NAME=ca-org1
      - FABRIC_CA_SERVER_TLS_ENABLED=true
      - FABRIC_CA_SERVER_PORT=7054
    volumes:
      - ./crypto-config/peerOrganizations/org1.example.com/ca:/etc/hyperledger/fabric-ca-server
    ports:
      - "7054:7054"

  ca.org2.example.com:
    image: hyperledger/fabric-ca:1.5
    environment:
      - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server
      - FABRIC_CA_SERVER_CA_NAME=ca-org2
      - FABRIC_CA_SERVER_TLS_ENABLED=true
      - FABRIC_CA_SERVER_PORT=7054
    volumes:
      - ./crypto-config/peerOrganizations/org2.example.com/ca:/etc/hyperledger/fabric-ca-server
    ports:
      - "8054:7054"

  backend:
    build:
      context: ../backend
      dockerfile: Dockerfile
    environment:
      - SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/coffeetrace
      - SPRING_DATASOURCE_USERNAME=coffeetrace
      - SPRING_DATASOURCE_PASSWORD=secret
      - FABRIC_CHANNEL_NAME=coffee-traceability-channel
      - FABRIC_CHAINCODE_NAME=CoffeeTraceChaincode
      - FABRIC_ORG1_PEER_ENDPOINT=peer0.org1.example.com:7051
      - FABRIC_ORG2_PEER_ENDPOINT=peer0.org2.example.com:9051
    volumes:
      - ./crypto-config:/crypto
    ports:
      - "8080:8080"
    depends_on:
      - peer0.org1.example.com
      - peer0.org2.example.com
      - postgres

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=coffeetrace
      - POSTGRES_USER=coffeetrace
      - POSTGRES_PASSWORD=secret
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ../backend/src/main/resources/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "5432:5432"

  frontend:
    build:
      context: ../frontend
      dockerfile: Dockerfile
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8080
    ports:
      - "3000:3000"
    depends_on:
      - backend

  ipfs:
    image: ipfs/kubo:latest
    volumes:
      - ipfs-data:/data/ipfs
    ports:
      - "5001:5001"   # API
      - "8081:8080"   # Gateway

networks:
  default:
    name: coffee_network

volumes:
  postgres-data:
  ipfs-data:
```

---

## 2. setup-network.sh

```bash
#!/bin/bash
set -e

CHANNEL_NAME="coffee-traceability-channel"
CHAINCODE_NAME="CoffeeTraceChaincode"
CHAINCODE_PATH="../chaincode"
CHAINCODE_VERSION="1.0"

echo "==> Generating crypto material..."
cryptogen generate --config=./crypto-config.yaml --output=./crypto-config

echo "==> Generating genesis block and channel tx..."
configtxgen -profile TwoOrgsOrdererGenesis \
  -channelID system-channel \
  -outputBlock ./channel-artifacts/genesis.block

configtxgen -profile TwoOrgsChannel \
  -outputCreateChannelTx ./channel-artifacts/channel.tx \
  -channelID $CHANNEL_NAME

configtxgen -profile TwoOrgsChannel \
  -outputAnchorPeersUpdate ./channel-artifacts/Org1MSPanchors.tx \
  -channelID $CHANNEL_NAME \
  -asOrg Org1MSP

configtxgen -profile TwoOrgsChannel \
  -outputAnchorPeersUpdate ./channel-artifacts/Org2MSPanchors.tx \
  -channelID $CHANNEL_NAME \
  -asOrg Org2MSP

echo "==> Starting Docker Compose..."
docker compose up -d

sleep 10  # Chờ các container khởi động

echo "==> Creating channel..."
docker exec peer0.org1.example.com peer channel create \
  -o orderer.example.com:7050 \
  -c $CHANNEL_NAME \
  -f /channel-artifacts/channel.tx \
  --tls --cafile /etc/hyperledger/fabric/tls/ca.crt

echo "==> Joining Org1 peer to channel..."
docker exec peer0.org1.example.com peer channel join \
  -b /channel-artifacts/${CHANNEL_NAME}.block

echo "==> Joining Org2 peer to channel..."
docker exec peer0.org2.example.com peer channel join \
  -b /channel-artifacts/${CHANNEL_NAME}.block

echo "==> Updating anchor peers..."
docker exec peer0.org1.example.com peer channel update \
  -o orderer.example.com:7050 \
  -c $CHANNEL_NAME \
  -f /channel-artifacts/Org1MSPanchors.tx \
  --tls --cafile /etc/hyperledger/fabric/tls/ca.crt

docker exec peer0.org2.example.com peer channel update \
  -o orderer.example.com:7050 \
  -c $CHANNEL_NAME \
  -f /channel-artifacts/Org2MSPanchors.tx \
  --tls --cafile /etc/hyperledger/fabric/tls/ca.crt

echo "==> Network setup complete!"
```

---

## 3. deploy-chaincode.sh

```bash
#!/bin/bash
set -e

CHANNEL_NAME="coffee-traceability-channel"
CHAINCODE_NAME="CoffeeTraceChaincode"
CHAINCODE_VERSION="1.0"
CHAINCODE_SEQUENCE=1

echo "==> Building chaincode..."
cd ../chaincode && ./gradlew shadowJar && cd ../network

echo "==> Packaging chaincode..."
peer lifecycle chaincode package ${CHAINCODE_NAME}.tar.gz \
  --path ../chaincode/build/libs/chaincode.jar \
  --lang java \
  --label ${CHAINCODE_NAME}_${CHAINCODE_VERSION}

echo "==> Installing on Org1 peer..."
docker cp ${CHAINCODE_NAME}.tar.gz peer0.org1.example.com:/tmp/
docker exec -e CORE_PEER_LOCALMSPID=Org1MSP peer0.org1.example.com \
  peer lifecycle chaincode install /tmp/${CHAINCODE_NAME}.tar.gz

echo "==> Installing on Org2 peer..."
docker cp ${CHAINCODE_NAME}.tar.gz peer0.org2.example.com:/tmp/
docker exec -e CORE_PEER_LOCALMSPID=Org2MSP peer0.org2.example.com \
  peer lifecycle chaincode install /tmp/${CHAINCODE_NAME}.tar.gz

# Lấy package ID
PACKAGE_ID=$(docker exec peer0.org1.example.com \
  peer lifecycle chaincode queryinstalled 2>&1 \
  | grep "Package ID" | sed 's/Package ID: //' | sed 's/, Label.*//')

echo "Package ID: $PACKAGE_ID"

echo "==> Approving for Org1..."
docker exec -e CORE_PEER_LOCALMSPID=Org1MSP peer0.org1.example.com \
  peer lifecycle chaincode approveformyorg \
  -o orderer.example.com:7050 \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --version $CHAINCODE_VERSION \
  --package-id $PACKAGE_ID \
  --sequence $CHAINCODE_SEQUENCE \
  --tls --cafile /etc/hyperledger/fabric/tls/ca.crt

echo "==> Approving for Org2..."
docker exec -e CORE_PEER_LOCALMSPID=Org2MSP peer0.org2.example.com \
  peer lifecycle chaincode approveformyorg \
  -o orderer.example.com:7050 \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --version $CHAINCODE_VERSION \
  --package-id $PACKAGE_ID \
  --sequence $CHAINCODE_SEQUENCE \
  --tls --cafile /etc/hyperledger/fabric/tls/ca.crt

echo "==> Committing chaincode..."
docker exec peer0.org1.example.com \
  peer lifecycle chaincode commit \
  -o orderer.example.com:7050 \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --version $CHAINCODE_VERSION \
  --sequence $CHAINCODE_SEQUENCE \
  --peerAddresses peer0.org1.example.com:7051 \
  --peerAddresses peer0.org2.example.com:9051 \
  --tls --cafile /etc/hyperledger/fabric/tls/ca.crt

echo "==> Chaincode deployed successfully!"
```

---

## 4. register-users.sh

```bash
#!/bin/bash
set -e

# ── Org1 Users ────────────────────────────────────────────────

export FABRIC_CA_CLIENT_HOME=/tmp/fabric-ca-client/org1

fabric-ca-client enroll \
  -u https://admin:adminpw@ca.org1.example.com:7054 \
  --caname ca-org1 --tls.certfiles /crypto/org1/ca/ca.crt

# Farmer
fabric-ca-client register --caname ca-org1 \
  --id.name farmer_alice --id.secret pw123 \
  --id.type client \
  --id.attrs "role=FARMER:ecert" \
  --tls.certfiles /crypto/org1/ca/ca.crt

fabric-ca-client enroll \
  -u https://farmer_alice:pw123@ca.org1.example.com:7054 \
  --caname ca-org1 -M /crypto/org1/users/farmer_alice/msp \
  --enrollment.attrs "role" \
  --tls.certfiles /crypto/org1/ca/ca.crt

# Processor
fabric-ca-client register --caname ca-org1 \
  --id.name processor_bob --id.secret pw123 \
  --id.type client \
  --id.attrs "role=PROCESSOR:ecert" \
  --tls.certfiles /crypto/org1/ca/ca.crt

fabric-ca-client enroll \
  -u https://processor_bob:pw123@ca.org1.example.com:7054 \
  --caname ca-org1 -M /crypto/org1/users/processor_bob/msp \
  --enrollment.attrs "role" \
  --tls.certfiles /crypto/org1/ca/ca.crt

# Roaster
fabric-ca-client register --caname ca-org1 \
  --id.name roaster_charlie --id.secret pw123 \
  --id.type client \
  --id.attrs "role=ROASTER:ecert" \
  --tls.certfiles /crypto/org1/ca/ca.crt

fabric-ca-client enroll \
  -u https://roaster_charlie:pw123@ca.org1.example.com:7054 \
  --caname ca-org1 -M /crypto/org1/users/roaster_charlie/msp \
  --enrollment.attrs "role" \
  --tls.certfiles /crypto/org1/ca/ca.crt

# ── Org2 Users ────────────────────────────────────────────────

export FABRIC_CA_CLIENT_HOME=/tmp/fabric-ca-client/org2

fabric-ca-client enroll \
  -u https://admin:adminpw@ca.org2.example.com:8054 \
  --caname ca-org2 --tls.certfiles /crypto/org2/ca/ca.crt

# Packager
fabric-ca-client register --caname ca-org2 \
  --id.name packager_dave --id.secret pw123 \
  --id.type client \
  --id.attrs "role=PACKAGER:ecert" \
  --tls.certfiles /crypto/org2/ca/ca.crt

fabric-ca-client enroll \
  -u https://packager_dave:pw123@ca.org2.example.com:8054 \
  --caname ca-org2 -M /crypto/org2/users/packager_dave/msp \
  --enrollment.attrs "role" \
  --tls.certfiles /crypto/org2/ca/ca.crt

# Retailer
fabric-ca-client register --caname ca-org2 \
  --id.name retailer_eve --id.secret pw123 \
  --id.type client \
  --id.attrs "role=RETAILER:ecert" \
  --tls.certfiles /crypto/org2/ca/ca.crt

fabric-ca-client enroll \
  -u https://retailer_eve:pw123@ca.org2.example.com:8054 \
  --caname ca-org2 -M /crypto/org2/users/retailer_eve/msp \
  --enrollment.attrs "role" \
  --tls.certfiles /crypto/org2/ca/ca.crt

echo "==> All users registered and enrolled!"
```

---

## 5. crypto-config.yaml

```yaml
# network/crypto-config.yaml
OrdererOrgs:
  - Name: Orderer
    Domain: example.com
    Specs:
      - Hostname: orderer

PeerOrgs:
  - Name: Org1
    Domain: org1.example.com
    EnableNodeOUs: true
    Template:
      Count: 1
    Users:
      Count: 5

  - Name: Org2
    Domain: org2.example.com
    EnableNodeOUs: true
    Template:
      Count: 1
    Users:
      Count: 3
```

---

## 6. configtx.yaml

```yaml
# network/configtx.yaml
Organizations:
  - &OrdererOrg
    Name: OrdererMSP
    ID: OrdererMSP
    MSPDir: crypto-config/ordererOrganizations/example.com/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('OrdererMSP.member')"
      Writers:
        Type: Signature
        Rule: "OR('OrdererMSP.member')"
      Admins:
        Type: Signature
        Rule: "OR('OrdererMSP.admin')"

  - &Org1
    Name: Org1MSP
    ID: Org1MSP
    MSPDir: crypto-config/peerOrganizations/org1.example.com/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('Org1MSP.admin', 'Org1MSP.peer', 'Org1MSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('Org1MSP.admin', 'Org1MSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('Org1MSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('Org1MSP.peer')"
    AnchorPeers:
      - Host: peer0.org1.example.com
        Port: 7051

  - &Org2
    Name: Org2MSP
    ID: Org2MSP
    MSPDir: crypto-config/peerOrganizations/org2.example.com/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('Org2MSP.admin', 'Org2MSP.peer', 'Org2MSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('Org2MSP.admin', 'Org2MSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('Org2MSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('Org2MSP.peer')"
    AnchorPeers:
      - Host: peer0.org2.example.com
        Port: 9051

Capabilities:
  Channel: &ChannelCapabilities
    V2_0: true
  Orderer: &OrdererCapabilities
    V2_0: true
  Application: &ApplicationCapabilities
    V2_5: true

Application: &ApplicationDefaults
  Organizations:
  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"
    LifecycleEndorsement:
      Type: ImplicitMeta
      Rule: "MAJORITY Endorsement"
    Endorsement:
      Type: ImplicitMeta
      Rule: "MAJORITY Endorsement"
  Capabilities:
    <<: *ApplicationCapabilities

Orderer: &OrdererDefaults
  OrdererType: etcdraft
  Addresses:
    - orderer.example.com:7050
  EtcdRaft:
    Consenters:
      - Host: orderer.example.com
        Port: 7050
        ClientTLSCert: crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.crt
        ServerTLSCert: crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.crt
  BatchTimeout: 2s
  BatchSize:
    MaxMessageCount: 10
    AbsoluteMaxBytes: 99 MB
    PreferredMaxBytes: 512 KB
  Organizations:
  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"
    BlockValidation:
      Type: ImplicitMeta
      Rule: "ANY Writers"
  Capabilities:
    <<: *OrdererCapabilities

Channel: &ChannelDefaults
  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"
  Capabilities:
    <<: *ChannelCapabilities

Profiles:
  TwoOrgsOrdererGenesis:
    <<: *ChannelDefaults
    Orderer:
      <<: *OrdererDefaults
      Organizations:
        - *OrdererOrg
    Consortiums:
      CoffeeConsortium:
        Organizations:
          - *Org1
          - *Org2

  TwoOrgsChannel:
    Consortium: CoffeeConsortium
    <<: *ChannelDefaults
    Application:
      <<: *ApplicationDefaults
      Organizations:
        - *Org1
        - *Org2
      Capabilities:
        <<: *ApplicationCapabilities
```

---

## 7. Dockerfile — Backend

```dockerfile
# backend/Dockerfile
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -q
COPY src ./src
RUN mvn package -DskipTests -q

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
VOLUME /crypto
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

---

## 8. Dockerfile — Frontend

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:8080
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

> **Yeu cau**: Them `output: 'standalone'` vao `next.config.js` de bat standalone mode.
