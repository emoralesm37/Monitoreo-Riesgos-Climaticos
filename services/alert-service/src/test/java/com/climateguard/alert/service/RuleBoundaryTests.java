package com.climateguard.alert.service;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;

class RuleBoundaryTests {
    @Test void minimumAndMaximumAreInclusiveAndZeroIsValid() {
        var min = new BigDecimal("0"); var max = new BigDecimal("40");
        assertFalse(ReadingEvaluationService.outside(min, min, max));
        assertFalse(ReadingEvaluationService.outside(max, min, max));
        assertTrue(ReadingEvaluationService.outside(new BigDecimal("-0.01"), min, max));
        assertTrue(ReadingEvaluationService.outside(new BigDecimal("40.01"), min, max));
    }
}
