package com.climateguard.alert.api;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestControllerAdvice
public class EvaluationConflictHandler {
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<?> concurrentDelivery() {
        return ResponseEntity.status(409).body(Map.of("message", "Conflicto de entrega; reintente la misma lectura."));
    }
}
