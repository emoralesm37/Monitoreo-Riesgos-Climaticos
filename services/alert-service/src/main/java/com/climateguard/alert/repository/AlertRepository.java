package com.climateguard.alert.repository;

import com.climateguard.alert.domain.Alert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface AlertRepository
    extends JpaRepository<Alert, Long>,
    JpaSpecificationExecutor<Alert> {

    Optional<Alert>
    findFirstBySensorIdAndPhenomenonAndStatusOrderByCreatedAtDesc(
        Integer sensorId,
        Alert.Phenomenon phenomenon,
        Alert.Status status
    );
}