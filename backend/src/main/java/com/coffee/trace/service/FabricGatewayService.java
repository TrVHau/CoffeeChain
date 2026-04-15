package com.coffee.trace.service;

import com.coffee.trace.config.FabricConfig;
import io.grpc.ManagedChannel;
import io.grpc.netty.shaded.io.grpc.netty.GrpcSslContexts;
import io.grpc.netty.shaded.io.grpc.netty.NettyChannelBuilder;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.hyperledger.fabric.client.*;
import org.hyperledger.fabric.client.identity.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class FabricGatewayService {

    private static final Logger log = LoggerFactory.getLogger(FabricGatewayService.class);

    private final Map<String, Gateway> gatewayByUser = new ConcurrentHashMap<>();
    private final Map<String, Gateway> gatewayByOrg  = new ConcurrentHashMap<>();

    @Value("${fabric.channel-name}")
    private String channelName;

    @Value("${fabric.chaincode-name}")
    private String chaincodeName;

    @Autowired
    private FabricConfig fabricConfig;

    @PostConstruct
    public void init() throws Exception {
        // Org-level gateways (Admin cert) — used for evaluate + event subscription
        for (String org : List.of("Org1", "Org2")) {
            try {
                IdentityWithKey id = loadAdminIdentity(org);
                gatewayByOrg.put(org, buildGateway(org, id.identity(), id.privateKey()));
                log.info("Org-level gateway initialized for {}", org);
            } catch (Exception e) {
                log.warn("Could not initialize org gateway for {}: {}", org, e.getMessage());
            }
        }

        // User-level gateways (per-user cert) — used for submit tx
        for (String userId : List.of(
                "farmer_alice", "processor_bob", "roaster_charlie",
                "packager_dave", "retailer_eve")) {
            try {
                IdentityWithKey id = loadUserIdentity(userId);
                gatewayByUser.put(userId, buildGateway(orgOfUser(userId), id.identity(), id.privateKey()));
                log.info("User-level gateway initialized for {}", userId);
            } catch (Exception e) {
                log.warn("Could not load identity for {}: {}", userId, e.getMessage());
            }
        }
    }

    /**
     * Submit transaction under a specific user identity.
     * ownerUserId on ledger will be the CN of that user's certificate.
     */
    public byte[] submitAs(String userId, String fnName, String... args) throws Exception {
        Gateway gw = gatewayByUser.get(userId);
        if (gw == null) {
            throw new IllegalArgumentException("No Fabric identity loaded for user: " + userId);
        }
        return getContract(gw).submitTransaction(fnName, args);
    }

    /**
     * Submit acceptTransfer — requires SBE AND endorsement from both Org1 + Org2.
     * Force the proposal to target both organizations so endorsement does not depend on discovery.
     */
    public byte[] submitAcceptTransfer(String userId, String batchId) throws Exception {
        Gateway gw = gatewayByUser.get(userId);
        if (gw == null) {
            throw new IllegalArgumentException("No Fabric identity loaded for user: " + userId);
        }
        return getContract(gw)
                .newProposal("acceptTransfer")
                .addArguments(batchId)
                .setEndorsingOrganizations("Org1MSP", "Org2MSP")
                .build()
                .endorse()
                .submit();
    }

    /**
     * Evaluate (read-only query) via org-level Admin gateway.
     */
    public byte[] evaluateTransaction(String org, String fnName, String... args) throws Exception {
        return getContract(gatewayByOrg.get(org)).evaluateTransaction(fnName, args);
    }

    public Network getNetwork(String org) {
        return gatewayByOrg.get(org).getNetwork(channelName);
    }

    public String getChaincodeName() {
        return chaincodeName;
    }

    // ── Private helpers ────────────────────────────────────────────────────

    private Contract getContract(Gateway gw) {
        return gw.getNetwork(channelName).getContract(chaincodeName);
    }

    private Gateway buildGateway(String org, Identity identity, PrivateKey privateKey) throws Exception {
        FabricConfig.OrgConfig cfg = fabricConfig.getOrgConfig(org);
        byte[] tlsCert = Files.readAllBytes(Paths.get(cfg.getTlsCertPath()));
        ManagedChannel channel = NettyChannelBuilder
                .forTarget(cfg.getPeerEndpoint())
                .sslContext(GrpcSslContexts.forClient()
                        .trustManager(new ByteArrayInputStream(tlsCert))
                        .build())
                .build();
        return Gateway.newInstance()
                .identity(identity)
                .signer(Signers.newPrivateKeySigner(privateKey))
                .hash(Hash.SHA256)
                .connection(channel)
                .connect();
    }

    private IdentityWithKey loadUserIdentity(String userId) throws Exception {
        String org  = orgOfUser(userId);
        String base = fabricConfig.getOrgConfig(org).getUsersBasePath();
        X509Certificate cert = loadCert(base + "/" + userId + "/msp/signcerts/cert.pem");
        PrivateKey key = loadKey(base + "/" + userId + "/msp/keystore/");
        return new IdentityWithKey(new X509Identity(mspIdOf(org), cert), key);
    }

    private IdentityWithKey loadAdminIdentity(String org) throws Exception {
        FabricConfig.OrgConfig cfg = fabricConfig.getOrgConfig(org);
        X509Certificate cert = loadCert(cfg.getAdminCertPath());
        PrivateKey key = loadKey(cfg.getAdminKeyPath());
        return new IdentityWithKey(new X509Identity(mspIdOf(org), cert), key);
    }

    private record IdentityWithKey(Identity identity, PrivateKey privateKey) {}

    private X509Certificate loadCert(String path) throws Exception {
        try (Reader r = Files.newBufferedReader(Paths.get(path))) {
            return Identities.readX509Certificate(r);
        }
    }

    private PrivateKey loadKey(String keyDir) throws Exception {
        Path keyFile = Files.list(Paths.get(keyDir))
                .filter(p -> p.toString().endsWith("_sk"))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No private key in: " + keyDir));
        try (Reader r = Files.newBufferedReader(keyFile)) {
            return Identities.readPrivateKey(r);
        }
    }

    public String orgOfUser(String userId) {
        return List.of("packager_dave", "retailer_eve").contains(userId) ? "Org2" : "Org1";
    }

    private String mspIdOf(String org) {
        return org + "MSP";
    }

    @PreDestroy
    public void shutdown() {
        gatewayByUser.values().forEach(Gateway::close);
        gatewayByOrg.values().forEach(Gateway::close);
        log.info("All Fabric gateways closed.");
    }
}
