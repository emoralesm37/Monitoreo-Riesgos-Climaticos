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
    @Test
void dangerousReadingGeneratesAlert() throws Exception {
    String body = """
        {
          "sensorId": 10,
          "communityId": 1,
          "sensorName": "Sensor de nivel del río",
          "communityName": "Comunidad El Progreso",
          "readingType": "NIVEL_RIO",
          "value": 9.50
        }
        """;

    mockMvc.perform(
            post("/api/alerts/evaluate")
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
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$.alertGenerated").value(true)
        )
        .andExpect(
            jsonPath("$.duplicatePrevented").value(false)
        )
        .andExpect(
            jsonPath("$.alert.severity").value("ROJO")
        )
        .andExpect(
            jsonPath("$.alert.phenomenon")
                .value("INUNDACION")
        )
        .andExpect(
            jsonPath("$.alert.status").value("ACTIVA")
        );
}

@Test
void duplicateActiveAlertIsPrevented() throws Exception {
    String body = """
        {
          "sensorId": 20,
          "communityId": 1,
          "sensorName": "Sensor de lluvia",
          "communityName": "Comunidad El Progreso",
          "readingType": "NIVEL_LLUVIA",
          "value": 120.00
        }
        """;

    var administrator = jwt()
        .jwt(token -> token.subject("admin-user"))
        .authorities(
            new SimpleGrantedAuthority(
                "ROLE_Administrador"
            )
        );

    mockMvc.perform(
            post("/api/alerts/evaluate")
                .with(administrator)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
        )
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$.alertGenerated").value(true)
        );

    mockMvc.perform(
            post("/api/alerts/evaluate")
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
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$.alertGenerated").value(false)
        )
        .andExpect(
            jsonPath("$.duplicatePrevented").value(true)
        );

    mockMvc.perform(
            get("/api/alerts")
                .with(jwt()
                    .jwt(token ->
                        token.subject("admin-user")
                    )
                )
        )
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1));
}

@Test
void alertsCanBeFilteredBySeverityAndSensor()
    throws Exception {

    Alert redAlert = new Alert();
    redAlert.setSensorId(30);
    redAlert.setCommunityId(1);
    redAlert.setSeverity(Alert.Severity.ROJO);
    redAlert.setPhenomenon(
        Alert.Phenomenon.INUNDACION
    );
    redAlert.setMessage("Alerta roja");

    Alert yellowAlert = new Alert();
    yellowAlert.setSensorId(31);
    yellowAlert.setCommunityId(1);
    yellowAlert.setSeverity(
        Alert.Severity.AMARILLO
    );
    yellowAlert.setPhenomenon(
        Alert.Phenomenon.SEQUIA
    );
    yellowAlert.setMessage("Alerta amarilla");

    alertRepository.saveAndFlush(redAlert);
    alertRepository.saveAndFlush(yellowAlert);

    mockMvc.perform(
            get("/api/alerts")
                .param("severity", "ROJO")
                .param("sensorId", "30")
                .with(jwt()
                    .jwt(token ->
                        token.subject("admin-user")
                    )
                )
        )
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(
            jsonPath("$[0].severity").value("ROJO")
        )
        .andExpect(
            jsonPath("$[0].sensorId").value(30)
        );
}
}