CREATE TABLE reading_evaluations (
    measurement_id VARCHAR(120) PRIMARY KEY,
    fingerprint VARCHAR(64) NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    alert_ids VARCHAR(2000) NOT NULL DEFAULT '',
    received_at TIMESTAMP WITH TIME ZONE NOT NULL
);
ALTER TABLE alerts ADD COLUMN measurement_id VARCHAR(120);
ALTER TABLE alerts ADD COLUMN rule_id INTEGER;
ALTER TABLE alerts ADD COLUMN unit VARCHAR(30);
ALTER TABLE alerts ADD COLUMN captured_at TIMESTAMP WITH TIME ZONE;
CREATE UNIQUE INDEX ux_alert_reading_rule ON alerts(measurement_id, rule_id);
