package com.climateguard.alert.domain;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "alerts")
public class Alert {

    public enum Severity {
        VERDE, AMARILLO, NARANJA, ROJO
    }

    public enum Phenomenon {
        INUNDACION,
        SEQUIA,
        TORMENTA,
        HELADA,
        INCENDIO_FORESTAL,
        SISTEMA
    }

    public enum Status {
        ACTIVA, RESUELTA
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "alert_id")
    private Long alertId;

    @Column(name = "sensor_id")
    private Integer sensorId;

    @Column(name = "community_id")
    private Integer communityId;

    @Column(name = "sensor_name", length = 100)
    private String sensorName;

    @Column(name = "community_name", length = 120)
    private String communityName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Severity severity;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private Phenomenon phenomenon;

    @Column(name = "trigger_value", precision = 10, scale = 2)
    private BigDecimal triggerValue;

    @Column(nullable = false, length = 300)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.ACTIVA;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "resolved_by_user_id", length = 100)
    private String resolvedByUserId;

    public Alert() {
    }

    @PrePersist
    void beforeInsert() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }

        if (status == null) {
            status = Status.ACTIVA;
        }
    }

    public void resolve(String userId) {
        if (status == Status.RESUELTA) {
            throw new IllegalStateException(
                "La alerta ya se encuentra resuelta."
            );
        }

        status = Status.RESUELTA;
        resolvedAt = Instant.now();
        resolvedByUserId = userId;
    }

    public Long getAlertId() {
        return alertId;
    }

    public Integer getSensorId() {
        return sensorId;
    }

    public void setSensorId(Integer sensorId) {
        this.sensorId = sensorId;
    }

    public Integer getCommunityId() {
        return communityId;
    }

    public void setCommunityId(Integer communityId) {
        this.communityId = communityId;
    }

    public String getSensorName() {
        return sensorName;
    }

    public void setSensorName(String sensorName) {
        this.sensorName = sensorName;
    }

    public String getCommunityName() {
        return communityName;
    }

    public void setCommunityName(String communityName) {
        this.communityName = communityName;
    }

    public Severity getSeverity() {
        return severity;
    }

    public void setSeverity(Severity severity) {
        this.severity = severity;
    }

    public Phenomenon getPhenomenon() {
        return phenomenon;
    }

    public void setPhenomenon(Phenomenon phenomenon) {
        this.phenomenon = phenomenon;
    }

    public BigDecimal getTriggerValue() {
        return triggerValue;
    }

    public void setTriggerValue(BigDecimal triggerValue) {
        this.triggerValue = triggerValue;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Status getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }

    public String getResolvedByUserId() {
        return resolvedByUserId;
    }
}