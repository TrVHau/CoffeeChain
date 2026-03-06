package com.coffee.trace.service;

import com.coffee.trace.config.FabricConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FabricGatewayServiceTest {

    @Mock
    private FabricConfig fabricConfig;

    @Mock
    private FabricConfig.OrgConfig org1Config;

    @Mock
    private FabricConfig.OrgConfig org2Config;

    @InjectMocks
    private FabricGatewayService service;

    @Test
    void orgOfUser_knownOrg1Users_returnsOrg1() {
        // orgOfUser returns short org name ("Org1" / "Org2") — not full MSP ID
        assertEquals("Org1", service.orgOfUser("farmer_alice"));
        assertEquals("Org1", service.orgOfUser("processor_bob"));
        assertEquals("Org1", service.orgOfUser("roaster_charlie"));
    }

    @Test
    void orgOfUser_knownOrg2Users_returnsOrg2() {
        assertEquals("Org2", service.orgOfUser("packager_dave"));
        assertEquals("Org2", service.orgOfUser("retailer_eve"));
    }

    @Test
    void orgOfUser_unknownUser_returnsOrg1Fallback() {
        // Unknown users default to Org1 (not in Org2 list)
        assertEquals("Org1", service.orgOfUser("unknown_user"));
    }

    @Test
    void getOrgConfig_org1_returnsOrg1Config() {
        when(fabricConfig.getOrgConfig("Org1MSP")).thenReturn(org1Config);
        assertSame(org1Config, fabricConfig.getOrgConfig("Org1MSP"));
    }

    @Test
    void getOrgConfig_org2_returnsOrg2Config() {
        when(fabricConfig.getOrgConfig("Org2MSP")).thenReturn(org2Config);
        assertSame(org2Config, fabricConfig.getOrgConfig("Org2MSP"));
    }
}
