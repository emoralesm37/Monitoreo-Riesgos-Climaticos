package com.climateguard.alert.service;

import com.climateguard.alert.domain.Alert;
import com.climateguard.alert.repository.AlertRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Service
public class AlertService {

    private final AlertRepository alertRepository;

    public AlertService(AlertRepository alertRepository) {
        this.alertRepository = alertRepository;
    }

    @Transactional(readOnly = true)
    public List<AlertResponse> getAll(Alert.Status status) {
        List<Alert> alerts = status == null
            ? alertRepository.findAllByOrderByCreatedAtDesc()
            : alertRepository.findByStatusOrderByCreatedAtDesc(status);

        return alerts.stream()
            .map(AlertResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public AlertResponse getById(Long id) {
        return AlertResponse.from(findAlert(id));
    }

    @Transactional
    public AlertResponse create(CreateAlertRequest request) {
        Alert alert = new Alert();

        alert.setSensorId(request.sensorId());
        alert.setCommunityId(request.communityId());
        alert.setSensorName(request.sensorName());
        alert.setCommunityName(request.communityName());
        alert.setSeverity(request.severity());
        alert.setPhenomenon(request.phenomenon());
        alert.setTriggerValue(request.triggerValue());
        alert.setMessage(request.message().trim());

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

    private Alert findAlert(Long id) {
        return alertRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "No se encontró la alerta con id " + id
            ));
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