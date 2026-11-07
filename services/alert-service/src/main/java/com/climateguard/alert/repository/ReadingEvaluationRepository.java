package com.climateguard.alert.repository;

import com.climateguard.alert.domain.ReadingEvaluation;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import java.util.Optional;

public interface ReadingEvaluationRepository extends JpaRepository<ReadingEvaluation, String> {
    @Override @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<ReadingEvaluation> findById(String id);
}
