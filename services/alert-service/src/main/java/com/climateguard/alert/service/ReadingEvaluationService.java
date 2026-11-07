package com.climateguard.alert.service;

import com.climateguard.alert.domain.Alert;
import com.climateguard.alert.domain.ReadingEvaluation;
import com.climateguard.alert.repository.AlertRepository;
import com.climateguard.alert.repository.ReadingEvaluationRepository;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.time.Instant;
import java.util.*;

@Service
public class ReadingEvaluationService {
    private final ReadingEvaluationRepository receipts;
    private final AlertRepository alerts;
    private final RuleProvider rules;
    public ReadingEvaluationService(ReadingEvaluationRepository receipts, AlertRepository alerts, RuleProvider rules) {
        this.receipts = receipts; this.alerts = alerts; this.rules = rules;
    }

    @Transactional
    public AlertService.EvaluationResult evaluate(Measurement m, String bearer) {
        String fingerprint = fingerprint(m);
        var previous = receipts.findById(m.measurementId());
        if (previous.isPresent()) {
            var receipt = previous.get();
            if (!receipt.fingerprint.equals(fingerprint))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "El identificador ya se uso con otra medicion.");
            if (receipt.processed) {
                var first = receipt.alertIds.isEmpty() ? null : alerts.findById(Long.valueOf(receipt.alertIds.split(",")[0]))
                    .map(AlertService.AlertResponse::from).orElse(null);
                return new AlertService.EvaluationResult(false, true, "Medicion ya evaluada; estado persistido conservado.", first);
            }
        }
        var receipt = previous.orElseGet(() -> {
            var row = new ReadingEvaluation(); row.measurementId = m.measurementId(); row.fingerprint = fingerprint;
            // Unique PK serializes initial concurrent requests. A conflicting insert rolls back, never duplicates alerts.
            return receipts.saveAndFlush(row);
        });
        List<Alert> generated = new ArrayList<>();
        for (var rule : rules.get(bearer)) {
            if (!rule.isActive() || rule.sensorTypeId() != m.sensorTypeId()) continue;
            if (!normalize(rule.sensorTypeCode()).equals(normalize(m.readingType())) || !rule.sensorTypeUnit().equals(m.unit()))
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Tipo o unidad incompatibles con la regla.");
            if (!outside(m.value(), rule.minimumValue(), rule.maximumValue())) continue;
            Alert alert = new Alert();
            alert.setSensorId(m.sensorId()); alert.setCommunityId(m.communityId());
            alert.setSensorName(m.sensorName()); alert.setCommunityName(m.communityName());
            alert.setSeverity(Alert.Severity.valueOf(normalize(rule.alertSeverityName())));
            alert.setPhenomenon(Alert.Phenomenon.valueOf(normalize(rule.phenomenonTypeName())));
            alert.setTriggerValue(m.value()); alert.setMessage(rule.message());
            alert.setMeasurementId(m.measurementId()); alert.setRuleId(rule.alertRuleId());
            alert.setUnit(m.unit()); alert.setCapturedAt(m.capturedAt());
            generated.add(alerts.saveAndFlush(alert));
        }
        receipt.alertIds = String.join(",", generated.stream().map(a -> a.getAlertId().toString()).toList());
        receipt.processed = true;
        receipts.save(receipt);
        return new AlertService.EvaluationResult(!generated.isEmpty(), false,
            generated.isEmpty() ? "Sin reglas activas incumplidas." : "Lectura evaluada con reglas activas.",
            generated.isEmpty() ? null : AlertService.AlertResponse.from(generated.get(0)));
    }

    public static boolean outside(BigDecimal value, BigDecimal minimum, BigDecimal maximum) {
        return value.compareTo(minimum) < 0 || value.compareTo(maximum) > 0;
    }
    private static String normalize(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
            .toUpperCase(Locale.ROOT).replace(' ', '_');
    }
    private static String fingerprint(Measurement m) {
        // Length-prefixed fields avoid ambiguous concatenation. Decimal scale is immaterial.
        var values = List.of(m.measurementId(), m.sensorId().toString(), m.sensorTypeId().toString(), m.readingType(),
            m.unit(), m.communityId().toString(), m.sensorName(), m.communityName(),
            m.value().stripTrailingZeros().toPlainString(), m.capturedAt().toString());
        var canonical = new StringBuilder();
        values.forEach(v -> canonical.append(v.length()).append(':').append(v));
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical.toString().getBytes(StandardCharsets.UTF_8))); }
        catch (Exception ex) { throw new IllegalStateException("Fingerprint unavailable"); }
    }
    public record Measurement(@NotBlank @Size(max=120) String measurementId,
        @NotNull @Positive Integer sensorId, @NotNull @Positive Integer sensorTypeId,
        @NotBlank @Size(max=100) String sensorName, @NotBlank @Size(max=40) String readingType,
        @NotBlank @Size(max=30) String unit, @NotNull @Positive Integer communityId,
        @NotBlank @Size(max=120) String communityName,
        @NotNull @Digits(integer=8, fraction=2) BigDecimal value, @NotNull Instant capturedAt) { }
}
