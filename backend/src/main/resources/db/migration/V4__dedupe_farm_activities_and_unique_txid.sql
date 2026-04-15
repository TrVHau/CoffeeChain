DELETE FROM farm_activities a
USING farm_activities b
WHERE a.tx_id = b.tx_id
  AND a.id > b.id;

ALTER TABLE farm_activities
    ADD CONSTRAINT uk_farm_activities_tx_id UNIQUE (tx_id);