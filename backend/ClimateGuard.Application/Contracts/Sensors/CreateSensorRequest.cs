namespace ClimateGuard.Application.Contracts.Sensors;

public sealed record CreateSensorRequest(
    string Name,
    byte SensorTypeId,
    int CommunityId);