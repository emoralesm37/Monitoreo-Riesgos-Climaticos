package com.climateguard.alert.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

@Configuration
public class SecurityConfig {

    @Value("${security.jwt.secret}")
    private String jwtSecret;

    @Value("${security.jwt.issuer}")
    private String jwtIssuer;

    @Value("${security.jwt.audience}")
    private String jwtAudience;

    @Bean
    SecurityFilterChain securityFilterChain(
        HttpSecurity http
    ) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session ->
                session.sessionCreationPolicy(
                    SessionCreationPolicy.STATELESS
                )
            )
            .authorizeHttpRequests(authorize -> authorize
                .requestMatchers(
                    "/actuator/health",
                    "/actuator/health/**",
                    "/actuator/info"
                ).permitAll()

                .requestMatchers(
                    HttpMethod.GET,
                    "/api/alerts/**"
                ).authenticated()

                .requestMatchers(
                    HttpMethod.POST,
                    "/api/alerts/**"
                ).hasAnyAuthority(
                    "ROLE_Administrador",
                    "ROLE_Operador",
                    "ROLE_ADMIN",
                    "ROLE_OPERATOR"
                )

                .requestMatchers(
                    HttpMethod.PATCH,
                    "/api/alerts/**"
                ).hasAnyAuthority(
                    "ROLE_Administrador",
                    "ROLE_Operador",
                    "ROLE_ADMIN",
                    "ROLE_OPERATOR"
                )

                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 ->
                oauth2.jwt(jwt ->
                    jwt.jwtAuthenticationConverter(
                        jwtAuthenticationConverter()
                    )
                )
            );

        return http.build();
    }

    @Bean
    JwtDecoder jwtDecoder() {
        SecretKey key = new SecretKeySpec(
            jwtSecret.getBytes(StandardCharsets.UTF_8),
            "HmacSHA256"
        );

        NimbusJwtDecoder decoder =
            NimbusJwtDecoder.withSecretKey(key)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();

        OAuth2TokenValidator<Jwt> issuerValidator =
            JwtValidators.createDefaultWithIssuer(jwtIssuer);

        OAuth2TokenValidator<Jwt> audienceValidator =
            token -> {
                if (token.getAudience().contains(jwtAudience)) {
                    return OAuth2TokenValidatorResult.success();
                }

                OAuth2Error error = new OAuth2Error(
                    "invalid_token",
                    "El JWT no contiene la audiencia requerida.",
                    null
                );

                return OAuth2TokenValidatorResult.failure(error);
            };

        decoder.setJwtValidator(
            new DelegatingOAuth2TokenValidator<>(
                issuerValidator,
                audienceValidator
            )
        );

        return decoder;
    }

    @Bean
    JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter =
            new JwtAuthenticationConverter();

        converter.setJwtGrantedAuthoritiesConverter(
            this::extractAuthorities
        );

        return converter;
    }

    private Collection<GrantedAuthority> extractAuthorities(
        Jwt jwt
    ) {
        List<GrantedAuthority> authorities =
            new ArrayList<>();

        addRole(authorities, jwt.getClaim("role"));

        Object roles = jwt.getClaim("roles");

        if (roles instanceof Collection<?> collection) {
            collection.forEach(role ->
                addRole(authorities, role)
            );
        } else {
            addRole(authorities, roles);
        }

        return authorities;
    }

    private void addRole(
        List<GrantedAuthority> authorities,
        Object role
    ) {
        if (role == null) {
            return;
        }

        String roleName = role.toString().trim();

        if (!roleName.isEmpty()) {
            authorities.add(
                new SimpleGrantedAuthority(
                    "ROLE_" + roleName
                )
            );
        }
    }
}