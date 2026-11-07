package com.climateguard.alert.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "reading_evaluations")
public class ReadingEvaluation {
    @Id @Column(length = 120) public String measurementId;
    @Column(nullable = false, length = 64) public String fingerprint;
    @Column(nullable = false) public boolean processed;
    @Column(nullable = false, length = 2000) public String alertIds = "";
    @Column(nullable = false) public Instant receivedAt = Instant.now();
    public ReadingEvaluation() { }
}
