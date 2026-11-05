package com.climateguard.alert.repository;

import com.climateguard.alert.domain.Alert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AlertRepository
    extends JpaRepository<Alert, Long> {

    List<Alert> findAllByOrderByCreatedAtDesc();

    List<Alert> findByStatusOrderByCreatedAtDesc(
        Alert.Status status
    );
}