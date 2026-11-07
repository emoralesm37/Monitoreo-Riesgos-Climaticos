package com.climateguard.alert.service;

import java.math.BigDecimal;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Component
public class RuleProvider {
    private final RestClient client;
    public RuleProvider(@Value("${alert.rules-url:http://localhost:5147/api/alert-rules/evaluation}") String url) {
        var factory = new JdkClientHttpRequestFactory();
        factory.setReadTimeout(Duration.ofSeconds(8));
        client = RestClient.builder().baseUrl(url).requestFactory(factory).build();
    }
    public Rule[] get(String bearer) {
        try {
            Rule[] rules = client.get().header(HttpHeaders.AUTHORIZATION, bearer).retrieve().body(Rule[].class);
            if (rules == null) throw new IllegalStateException();
            return rules;
        } catch (Exception ignored) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "No se pudieron consultar las reglas activas.");
        }
    }
    public record Rule(int alertRuleId, int sensorTypeId, String sensorTypeCode, String sensorTypeUnit,
        BigDecimal minimumValue, BigDecimal maximumValue, String alertSeverityName,
        String phenomenonTypeName, String message, boolean isActive) { }
}
