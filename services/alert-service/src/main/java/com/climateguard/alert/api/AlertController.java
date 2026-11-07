package com.climateguard.alert.api;

import com.climateguard.alert.domain.Alert;
import com.climateguard.alert.service.AlertService;
import com.climateguard.alert.service.AlertService.AlertResponse;
import com.climateguard.alert.service.AlertService.CreateAlertRequest;
import com.climateguard.alert.service.AlertService.EvaluationResult;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/alerts")
public class AlertController {

    private final AlertService alertService;
    private final com.climateguard.alert.service.ReadingEvaluationService evaluations;

    public AlertController(AlertService alertService, com.climateguard.alert.service.ReadingEvaluationService evaluations) {
        this.alertService = alertService;
        this.evaluations = evaluations;
    }

    @GetMapping
    public List<AlertResponse> getAll(
        @RequestParam(required = false)
        Alert.Status status,

        @RequestParam(required = false)
        Alert.Severity severity,

        @RequestParam(required = false)
        Alert.Phenomenon phenomenon,

        @RequestParam(required = false)
        Integer sensorId,

        @RequestParam(required = false)
        Integer communityId,

        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
        Instant from,

        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
        Instant to
    ) {
        return alertService.getAll(
            status,
            severity,
            phenomenon,
            sensorId,
            communityId,
            from,
            to
        );
    }

    @GetMapping("/{id}")
    public AlertResponse getById(
        @PathVariable Long id
    ) {
        return alertService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AlertResponse create(
        @Valid @RequestBody CreateAlertRequest request
    ) {
        return alertService.create(request);
    }

    @PostMapping("/evaluate")
    public EvaluationResult evaluate(
        @Valid @RequestBody com.climateguard.alert.service.ReadingEvaluationService.Measurement request,
        @org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt token
    ) {
        return evaluations.evaluate(request, "Bearer " + token.getTokenValue());
    }

    @PatchMapping("/{id}/resolve")
    public AlertResponse resolve(
        @PathVariable Long id,
        Principal principal
    ) {
        String userId = principal == null
            ? "system"
            : principal.getName();

        return alertService.resolve(id, userId);
    }
}
