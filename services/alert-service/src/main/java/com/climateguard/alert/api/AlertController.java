package com.climateguard.alert.api;

import com.climateguard.alert.domain.Alert;
import com.climateguard.alert.service.AlertService;
import com.climateguard.alert.service.AlertService.AlertResponse;
import com.climateguard.alert.service.AlertService.CreateAlertRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/alerts")
public class AlertController {

    private final AlertService alertService;

    public AlertController(AlertService alertService) {
        this.alertService = alertService;
    }

    @GetMapping
    public List<AlertResponse> getAll(
        @RequestParam(required = false)
        Alert.Status status
    ) {
        return alertService.getAll(status);
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