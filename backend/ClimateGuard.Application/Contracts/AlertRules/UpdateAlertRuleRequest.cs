namespace ClimateGuard.Application.Contracts.AlertRules;

public sealed record UpdateAlertRuleRequest(
    string Name,
    byte SensorTypeId,
    decimal MinimumValue,
    decimal MaximumValue,
    byte AlertSeverityId,
    byte PhenomenonTypeId,
    string Message);