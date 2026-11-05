package com.climateguard.alert.service;

import com.climateguard.alert.domain.Alert;
import com.climateguard.alert.domain.SensorReadingType;
import com.climateguard.alert.repository.AlertRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class AlertService {

    private final AlertRepository alertRepository;
    private final BigDecimal riverLevelThreshold;
    private final BigDecimal rainfallThreshold;
    private final BigDecimal highTemperatureThreshold;
    private final BigDecimal lowTemperatureThreshold;
    private final BigDecimal lowHumidityThreshold;
    private final BigDecimal lowSoilHumidityThreshold;
    private final BigDecimal windSpeedThreshold;

    public AlertService(
        AlertRepository alertRepository,
        @Value("${alert.thresholds.river-level:8.0}")
        BigDecimal riverLevelThreshold,
        @Value("${alert.thresholds.rainfall:100.0}")
        BigDecimal rainfallThreshold,
        @Value("${alert.thresholds.high-temperature:40.0}")
        BigDecimal highTemperatureThreshold,
        @Value("${alert.thresholds.low-temperature:2.0}")
        BigDecimal lowTemperatureThreshold,
        @Value("${alert.thresholds.low-humidity:20.0}")
        BigDecimal lowHumidityThreshold,
        @Value("${alert.thresholds.low-soil-humidity:20.0}")
        BigDecimal lowSoilHumidityThreshold,
        @Value("${alert.thresholds.wind-speed:80.0}")
        BigDecimal windSpeedThreshold
    ) {
        this.alertRepository = alertRepository;
        this.riverLevelThreshold = riverLevelThreshold;
        this.rainfallThreshold = rainfallThreshold;
        this.highTemperatureThreshold =
            highTemperatureThreshold;
        this.lowTemperatureThreshold =
            lowTemperatureThreshold;
        this.lowHumidityThreshold = lowHumidityThreshold;
        this.lowSoilHumidityThreshold =
            lowSoilHumidityThreshold;
        this.windSpeedThreshold = windSpeedThreshold;
    }

    @Transactional(readOnly = true)
    public List<AlertResponse> getAll(
        Alert.Status status,
        Alert.Severity severity,
        Alert.Phenomenon phenomenon,
        Integer sensorId,
        Integer communityId,
        Instant from,
        Instant to
    ) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "La fecha inicial no puede ser posterior a la final."
            );
        }

        Specification<Alert> specification =
            (root, query, builder) -> {
                List<jakarta.persistence.criteria.Predicate> predicates =
                new ArrayList<>();

                if (status != null) {
                    predicates.add(
                        builder.equal(root.get("status"), status)
                    );
                }

                if (severity != null) {
                    predicates.add(
                        builder.equal(root.get("severity"), severity)
                    );
                }

                if (phenomenon != null) {
                    predicates.add(
                        builder.equal(
                            root.get("phenomenon"),
                            phenomenon
                        )
                    );
                }

                if (sensorId != null) {
                    predicates.add(
                        builder.equal(
                            root.get("sensorId"),
                            sensorId
                        )
                    );
                }

                if (communityId != null) {
                    predicates.add(
                        builder.equal(
                            root.get("communityId"),
                            communityId
                        )
                    );
                }

                if (from != null) {
                    predicates.add(
                        builder.greaterThanOrEqualTo(
                            root.get("createdAt"),
                            from
                        )
                    );
                }

                if (to != null) {
                    predicates.add(
                        builder.lessThanOrEqualTo(
                            root.get("createdAt"),
                            to
                        )
                    );
                }

                return builder.and(
                    predicates.toArray(
                        jakarta.persistence.criteria.Predicate[]::new
                    )
                );
            };

        return alertRepository.findAll(
                specification,
                Sort.by(
                    Sort.Direction.DESC,
                    "createdAt"
                )
            )
            .stream()
            .map(AlertResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public AlertResponse getById(Long id) {
        return AlertResponse.from(findAlert(id));
    }

    @Transactional
    public AlertResponse create(CreateAlertRequest request) {
        Alert alert = buildAlert(
            request.sensorId(),
            request.communityId(),
            request.sensorName(),
            request.communityName(),
            request.severity(),
            request.phenomenon(),
            request.triggerValue(),
            request.message()
        );

        return AlertResponse.from(
            alertRepository.save(alert)
        );
    }

    @Transactional
    public EvaluationResult evaluate(
        EvaluateReadingRequest request
    ) {
        RuleMatch rule = evaluateRule(
            request.readingType(),
            request.value()
        );

        if (rule == null) {
            return new EvaluationResult(
                false,
                false,
                "La lectura no supera ningún umbral.",
                null
            );
        }

        var existingAlert =
            alertRepository
                .findFirstBySensorIdAndPhenomenonAndStatusOrderByCreatedAtDesc(
                    request.sensorId(),
                    rule.phenomenon(),
                    Alert.Status.ACTIVA
                );

        if (existingAlert.isPresent()) {
            return new EvaluationResult(
                false,
                true,
                "Ya existe una alerta activa equivalente.",
                AlertResponse.from(existingAlert.get())
            );
        }

        String message = String.format(
            "Umbral superado para %s: %s",
            request.readingType(),
            request.value()
        );

        Alert alert = buildAlert(
            request.sensorId(),
            request.communityId(),
            request.sensorName(),
            request.communityName(),
            rule.severity(),
            rule.phenomenon(),
            request.value(),
            message
        );

        Alert savedAlert = alertRepository.save(alert);

        return new EvaluationResult(
            true,
            false,
            "Alerta generada correctamente.",
            AlertResponse.from(savedAlert)
        );
    }

    @Transactional
    public AlertResponse resolve(Long id, String userId) {
        Alert alert = findAlert(id);
        alert.resolve(userId);

        return AlertResponse.from(
            alertRepository.save(alert)
        );
    }

    private RuleMatch evaluateRule(
        SensorReadingType readingType,
        BigDecimal value
    ) {
        return switch (readingType) {
            case NIVEL_RIO ->
                value.compareTo(riverLevelThreshold) >= 0
                    ? new RuleMatch(
                        Alert.Severity.ROJO,
                        Alert.Phenomenon.INUNDACION
                    )
                    : null;

            case NIVEL_LLUVIA ->
                value.compareTo(rainfallThreshold) >= 0
                    ? new RuleMatch(
                        Alert.Severity.NARANJA,
                        Alert.Phenomenon.INUNDACION
                    )
                    : null;

            case TEMPERATURA -> {
                if (
                    value.compareTo(
                        highTemperatureThreshold
                    ) >= 0
                ) {
                    yield new RuleMatch(
                        Alert.Severity.ROJO,
                        Alert.Phenomenon.INCENDIO_FORESTAL
                    );
                }

                if (
                    value.compareTo(
                        lowTemperatureThreshold
                    ) <= 0
                ) {
                    yield new RuleMatch(
                        Alert.Severity.NARANJA,
                        Alert.Phenomenon.HELADA
                    );
                }

                yield null;
            }

            case HUMEDAD ->
                value.compareTo(lowHumidityThreshold) <= 0
                    ? new RuleMatch(
                        Alert.Severity.AMARILLO,
                        Alert.Phenomenon.SEQUIA
                    )
                    : null;

            case HUMEDAD_SUELO ->
                value.compareTo(
                    lowSoilHumidityThreshold
                ) <= 0
                    ? new RuleMatch(
                        Alert.Severity.NARANJA,
                        Alert.Phenomenon.SEQUIA
                    )
                    : null;

            case VELOCIDAD_VIENTO ->
                value.compareTo(windSpeedThreshold) >= 0
                    ? new RuleMatch(
                        Alert.Severity.NARANJA,
                        Alert.Phenomenon.TORMENTA
                    )
                    : null;
        };
    }

    private Alert buildAlert(
        Integer sensorId,
        Integer communityId,
        String sensorName,
        String communityName,
        Alert.Severity severity,
        Alert.Phenomenon phenomenon,
        BigDecimal triggerValue,
        String message
    ) {
        Alert alert = new Alert();

        alert.setSensorId(sensorId);
        alert.setCommunityId(communityId);
        alert.setSensorName(sensorName);
        alert.setCommunityName(communityName);
        alert.setSeverity(severity);
        alert.setPhenomenon(phenomenon);
        alert.setTriggerValue(triggerValue);
        alert.setMessage(message.trim());

        return alert;
    }

    private Alert findAlert(Long id) {
        return alertRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "No se encontró la alerta con id " + id
            ));
    }

    private record RuleMatch(
        Alert.Severity severity,
        Alert.Phenomenon phenomenon
    ) {
    }

    public record EvaluateReadingRequest(
        @NotNull
        Integer sensorId,

        Integer communityId,

        @Size(max = 100)
        String sensorName,

        @Size(max = 120)
        String communityName,

        @NotNull
        SensorReadingType readingType,

        @NotNull
        BigDecimal value
    ) {
    }

    public record EvaluationResult(
        boolean alertGenerated,
        boolean duplicatePrevented,
        String message,
        AlertResponse alert
    ) {
    }

    public record CreateAlertRequest(
        Integer sensorId,
        Integer communityId,

        @Size(max = 100)
        String sensorName,

        @Size(max = 120)
        String communityName,

        @NotNull
        Alert.Severity severity,

        Alert.Phenomenon phenomenon,

        BigDecimal triggerValue,

        @NotBlank
        @Size(max = 300)
        String message
    ) {
    }

    public record AlertResponse(
        Long alertId,
        Integer sensorId,
        Integer communityId,
        String sensorName,
        String communityName,
        Alert.Severity severity,
        Alert.Phenomenon phenomenon,
        BigDecimal triggerValue,
        String message,
        Alert.Status status,
        Instant createdAt,
        Instant resolvedAt,
        String resolvedByUserId
    ) {
        static AlertResponse from(Alert alert) {
            return new AlertResponse(
                alert.getAlertId(),
                alert.getSensorId(),
                alert.getCommunityId(),
                alert.getSensorName(),
                alert.getCommunityName(),
                alert.getSeverity(),
                alert.getPhenomenon(),
                alert.getTriggerValue(),
                alert.getMessage(),
                alert.getStatus(),
                alert.getCreatedAt(),
                alert.getResolvedAt(),
                alert.getResolvedByUserId()
            );
        }
    }
}