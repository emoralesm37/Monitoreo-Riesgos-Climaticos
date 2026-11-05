package com.climateguard.alert.api;

import com.climateguard.alert.domain.Alert;
import com.climateguard.alert.repository.AlertRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request
    .SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request
    .MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result
    .MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class AlertControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AlertRepository alertRepository;

    @BeforeEach
    void cleanDatabase() {
        alertRepository.deleteAll();
    }

    @Test
    void getAlertsWithoutTokenReturns401() throws Exception {
        mockMvc.perform(get("/api/alerts"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void administratorCanCreateAlert() throws Exception {
        String body = """
            {
              "sensorId": 1,
              "communityId": 1,
              "sensorName": "Sensor de río",
              "communityName": "Comunidad El Progreso",
              "severity": "ROJO",
              "phenomenon": "INUNDACION",
              "triggerValue": 8.75,
              "message": "Nivel del río fuera del rango seguro"
            }
            """;

        mockMvc.perform(
                post("/api/alerts")
                    .with(jwt()
                        .jwt(token ->
                            token.subject("admin-user")
                        )
                        .authorities(
                            new SimpleGrantedAuthority(
                                "ROLE_Administrador"
                            )
                        )
                    )
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body)
            )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.alertId").isNumber())
            .andExpect(jsonPath("$.severity").value("ROJO"))
            .andExpect(jsonPath("$.status").value("ACTIVA"));
    }

    @Test
    void viewerCannotCreateAlert() throws Exception {
        String body = """
            {
              "severity": "AMARILLO",
              "phenomenon": "TORMENTA",
              "message": "Ráfagas de viento detectadas"
            }
            """;

        mockMvc.perform(
                post("/api/alerts")
                    .with(jwt()
                        .jwt(token ->
                            token.subject("viewer-user")
                        )
                        .authorities(
                            new SimpleGrantedAuthority(
                                "ROLE_VIEWER"
                            )
                        )
                    )
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body)
            )
            .andExpect(status().isForbidden());
    }

    @Test
    void operatorCanResolveAlert() throws Exception {
        Alert alert = new Alert();

        alert.setSensorId(1);
        alert.setCommunityId(1);
        alert.setSensorName("Sensor de temperatura");
        alert.setCommunityName("Comunidad El Progreso");
        alert.setSeverity(Alert.Severity.NARANJA);
        alert.setPhenomenon(
            Alert.Phenomenon.INCENDIO_FORESTAL
        );
        alert.setMessage(
            "Temperatura elevada y humedad baja"
        );

        alert = alertRepository.saveAndFlush(alert);

        mockMvc.perform(
                patch(
                    "/api/alerts/{id}/resolve",
                    alert.getAlertId()
                )
                    .with(jwt()
                        .jwt(token ->
                            token.subject("operator-user")
                        )
                        .authorities(
                            new SimpleGrantedAuthority(
                                "ROLE_Operador"
                            )
                        )
                    )
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("RESUELTA"))
            .andExpect(
                jsonPath("$.resolvedByUserId")
                    .value("operator-user")
            )
            .andExpect(jsonPath("$.resolvedAt").exists());
    }
}