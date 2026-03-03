package com.coffee.trace.chaincode.model;

import org.hyperledger.fabric.contract.annotation.DataType;
import org.hyperledger.fabric.contract.annotation.Property;
import java.util.Map;
import java.util.TreeMap;

@DataType
public class Batch {
    @Property private String batchId;
    @Property private String publicCode;
    @Property private String docType;
    @Property private String type;
    @Property private String parentBatchId;
    @Property private String ownerMSP;
    @Property private String ownerUserId;
    @Property private String status;
    @Property private String pendingToMSP;
    @Property private String createdAt;
    @Property private String updatedAt;
    @Property private String evidenceHash;
    @Property private String evidenceUri;
    // FIX-DETERMINISM: TreeMap → sorted keys → Gson serializes in consistent order
    // across all peers → prevents "endorsement mismatch" byte diff.
    @Property private TreeMap<String, String> metadata;

    public String getBatchId()                       { return batchId; }
    public void   setBatchId(String v)               { this.batchId = v; }
    public String getPublicCode()                    { return publicCode; }
    public void   setPublicCode(String v)            { this.publicCode = v; }
    public String getDocType()                       { return docType; }
    public void   setDocType(String v)               { this.docType = v; }
    public String getType()                          { return type; }
    public void   setType(String v)                  { this.type = v; }
    public String getParentBatchId()                 { return parentBatchId; }
    public void   setParentBatchId(String v)         { this.parentBatchId = v; }
    public String getOwnerMSP()                      { return ownerMSP; }
    public void   setOwnerMSP(String v)              { this.ownerMSP = v; }
    public String getOwnerUserId()                   { return ownerUserId; }
    public void   setOwnerUserId(String v)           { this.ownerUserId = v; }
    public String getStatus()                        { return status; }
    public void   setStatus(String v)                { this.status = v; }
    public String getPendingToMSP()                  { return pendingToMSP; }
    public void   setPendingToMSP(String v)          { this.pendingToMSP = v; }
    public String getCreatedAt()                     { return createdAt; }
    public void   setCreatedAt(String v)             { this.createdAt = v; }
    public String getUpdatedAt()                     { return updatedAt; }
    public void   setUpdatedAt(String v)             { this.updatedAt = v; }
    public String getEvidenceHash()                  { return evidenceHash; }
    public void   setEvidenceHash(String v)          { this.evidenceHash = v; }
    public String getEvidenceUri()                   { return evidenceUri; }
    public void   setEvidenceUri(String v)           { this.evidenceUri = v; }
    public TreeMap<String, String> getMetadata()              { return metadata; }
    // Setter wraps in TreeMap → sorted keys regardless of caller's map type.
    public void setMetadata(Map<String, String> v) {
        this.metadata = (v != null) ? new TreeMap<>(v) : new TreeMap<>();
    }
}