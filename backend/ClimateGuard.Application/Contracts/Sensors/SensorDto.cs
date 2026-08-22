namespace ClimateGuard.Application.Contracts.Sensors;

public sealed record SensorDto(
    int SensorId,
    string Name,
    byte SensorTypeId,
    string SensorType,
    string Unit,
    int CommunityId,
    string Community,
    bool IsActive,
    decimal? LastValue,
    DateTime? LastUpdatedAt);