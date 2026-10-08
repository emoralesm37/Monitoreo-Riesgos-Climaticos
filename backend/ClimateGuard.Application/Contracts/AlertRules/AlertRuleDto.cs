namespace ClimateGuard.Application.Contracts.AlertRules;

public sealed record AlertRuleDto(
    int AlertRuleId,
    string Name,
    byte SensorTypeId,
    string SensorTypeCode,
    string SensorTypeUnit,
    decimal MinimumValue,
    decimal MaximumValue,
    byte AlertSeverityId,
    string AlertSeverityName,
    byte PhenomenonTypeId,
    string PhenomenonTypeName,
    string Message,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt);