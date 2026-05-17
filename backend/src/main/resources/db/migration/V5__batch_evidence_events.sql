CREATE TABLE IF NOT EXISTS batch_evidence_events (
    id              BIGSERIAL    PRIMARY KEY,
    batch_id        VARCHAR(64)  NOT NULL REFERENCES batches(batch_id) ON DELETE CASCADE,
    batch_type      VARCHAR(32),
    evidence_hash   VARCHAR(128),
    evidence_uri    TEXT,
    recorded_by     VARCHAR(128),
    tx_id           VARCHAR(128),
    block_number    BIGINT,
    recorded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_evidence_events_batch_id ON batch_evidence_events(batch_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_batch_evidence_events_tx_id
    ON batch_evidence_events(tx_id)
    WHERE tx_id IS NOT NULL;
