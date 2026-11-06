package com.climateguard.alert.api;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(IllegalStateException.class)
    public ProblemDetail handleConflict(
        IllegalStateException exception
    ) {
        ProblemDetail problem = ProblemDetail.forStatus(
            HttpStatus.CONFLICT
        );

        problem.setTitle("Operación no permitida");
        problem.setDetail(exception.getMessage());

        return problem;
    }
}