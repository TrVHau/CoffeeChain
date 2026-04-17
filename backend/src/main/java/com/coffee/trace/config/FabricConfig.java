package com.coffee.trace.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "fabric")
@Data
public class FabricConfig {

    private String channelName;
    private String chaincodeName;
    private OrgConfig org1 = new OrgConfig();
    private OrgConfig org2 = new OrgConfig();

    public OrgConfig getOrgConfig(String org) {
        return "Org1".equals(org) ? org1 : org2;
    }

    @Data
    public static class OrgConfig {
        private String mspId;
        private String peerEndpoint;
        private String peerHostOverride;
        private String tlsCertPath;
        private String adminCertPath;
        private String adminKeyPath;
        private String usersBasePath;
    }
}
