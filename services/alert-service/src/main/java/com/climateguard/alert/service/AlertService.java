package com.climateguard.alert.service;

import com.climateguard.alert.domain.Alert;
import com.climateguard.alert.repository.AlertRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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
    public AlertService(AlertRepository alertRepository) { this.alertRepository = alertRepository; }

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
    public AlertResponse resolve(Long id, String userId) {
        Alert alert = findAlert(id);
        alert.resolve(userId);

        return AlertResponse.from(
            alertRepository.save(alert)
        );
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
                "No se encontrÃ³ la alerta con id " + id
            ));
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
        String resolvedByUserId,
        String measurementId, Integer ruleId, String unit, Instant capturedAt
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
                alert.getResolvedByUserId(), alert.getMeasurementId(), alert.getRuleId(), alert.getUnit(), alert.getCapturedAt()
            );
        }
    }
}