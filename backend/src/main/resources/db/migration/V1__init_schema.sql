-- ============================================================
-- V1__init_schema.sql  —  CoffeeChain initial schema
-- ============================================================

-- Users table (JWT auth, maps to Fabric identity)
CREATE TABLE IF NOT EXISTS users (
    user_id         VARCHAR(64)  PRIMARY KEY,
    password        VARCHAR(255) NOT NULL,        -- BCrypt hash
    role            VARCHAR(32)  NOT NULL,        -- FARMER | PROCESSOR | ROASTER | PACKAGER | RETAILER
    org             VARCHAR(64)  NOT NULL,        -- Org1MSP | Org2MSP
    fabric_user_id  VARCHAR(64)  NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Batches table (mirrors ledger state for fast reads)
CREATE TABLE IF NOT EXISTS batches (
    batch_id        VARCHAR(64)  PRIMARY KEY,
    public_code     VARCHAR(64)  UNIQUE,
    type            VARCHAR(32)  NOT NULL,        -- HARVEST | PROCESSED | ROAST | PACKAGED
    parent_batch_id VARCHAR(64),
    owner_msp       VARCHAR(64)  NOT NULL,
    owner_user_id   VARCHAR(64)  NOT NULL,
    status          VARCHAR(32)  NOT NULL,        -- CREATED | IN_PROCESS | COMPLETED | TRANSFER_PENDING | TRANSFERRED | IN_STOCK | SOLD
    pending_to_msp  VARCHAR(64),
    evidence_hash   VARCHAR(128),
    evidence_uri    TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Farm activities (linked to a HARVEST batch)
CREATE TABLE IF NOT EXISTS farm_activities (
    id               BIGSERIAL    PRIMARY KEY,
    harvest_batch_id VARCHAR(64)  NOT NULL REFERENCES batches(batch_id) ON DELETE CASCADE,
    activity_type    VARCHAR(64)  NOT NULL,
    activity_date    DATE         NOT NULL,
    note             TEXT,
    evidence_hash    VARCHAR(128),
    evidence_uri     TEXT,
    recorded_by      VARCHAR(128),           -- CN of submitting certificate
    recorded_at      TIMESTAMPTZ,            -- blockchain tx timestamp
    tx_id            VARCHAR(128),
    block_number     BIGINT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Ledger refs (blockchain event log per batch)
CREATE TABLE IF NOT EXISTS ledger_refs (
    id              BIGSERIAL    PRIMARY KEY,
    batch_id        VARCHAR(64)  NOT NULL REFERENCES batches(batch_id) ON DELETE CASCADE,
    event_name      VARCHAR(64)  NOT NULL,
    tx_id           VARCHAR(128) NOT NULL,
    block_number    BIGINT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_batches_public_code    ON batches(public_code);
CREATE INDEX IF NOT EXISTS idx_batches_owner_msp      ON batches(owner_msp);
CREATE INDEX IF NOT EXISTS idx_batches_status         ON batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_type_status    ON batches(type, status);
CREATE INDEX IF NOT EXISTS idx_farm_activities_harvest ON farm_activities(harvest_batch_id);
CREATE INDEX IF NOT EXISTS idx_ledger_refs_batch      ON ledger_refs(batch_id);

-- ============================================================
-- Demo seed data — 5 users, password = BCrypt('pw123')
-- Hash generated with rounds=10
-- ============================================================
INSERT INTO users (user_id, password, role, org, fabric_user_id) VALUES
    ('farmer_alice',    '$2a$10$7EqJtq98hPqEX7fNZaFWoOe2j8A/LNmA7OplWWnSEqM3n5y8F9cDm', 'FARMER',    'Org1MSP', 'farmer_alice'),
    ('processor_bob',   '$2a$10$7EqJtq98hPqEX7fNZaFWoOe2j8A/LNmA7OplWWnSEqM3n5y8F9cDm', 'PROCESSOR',  'Org1MSP', 'processor_bob'),
    ('roaster_charlie', '$2a$10$7EqJtq98hPqEX7fNZaFWoOe2j8A/LNmA7OplWWnSEqM3n5y8F9cDm', 'ROASTER',   'Org1MSP', 'roaster_charlie'),
    ('packager_dave',   '$2a$10$7EqJtq98hPqEX7fNZaFWoOe2j8A/LNmA7OplWWnSEqM3n5y8F9cDm', 'PACKAGER',  'Org2MSP', 'packager_dave'),
    ('retailer_eve',    '$2a$10$7EqJtq98hPqEX7fNZaFWoOe2j8A/LNmA7OplWWnSEqM3n5y8F9cDm', 'RETAILER',  'Org2MSP', 'retailer_eve')
ON CONFLICT (user_id) DO NOTHING;
