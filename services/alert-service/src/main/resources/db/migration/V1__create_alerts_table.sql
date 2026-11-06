CREATE TABLE alerts
(
    alert_id            BIGSERIAL PRIMARY KEY,
    sensor_id           INTEGER,
    community_id        INTEGER,
    sensor_name         VARCHAR(100),
    community_name      VARCHAR(120),
    severity            VARCHAR(20) NOT NULL,
    phenomenon          VARCHAR(30),
    trigger_value       NUMERIC(10, 2),
    message             VARCHAR(300) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL
                        DEFAULT CURRENT_TIMESTAMP,
    resolved_at         TIMESTAMP WITH TIME ZONE,
    resolved_by_user_id VARCHAR(100),

    CONSTRAINT ck_alert_severity CHECK
    (
        severity IN (
            'VERDE',
            'AMARILLO',
            'NARANJA',
            'ROJO'
        )
    ),

    CONSTRAINT ck_alert_status CHECK
    (
        status IN ('ACTIVA', 'RESUELTA')
    )
);

CREATE INDEX ix_alerts_created_at
    ON alerts (created_at DESC);

CREATE INDEX ix_alerts_sensor_id
    ON alerts (sensor_id);

CREATE INDEX ix_alerts_status
    ON alerts (status);