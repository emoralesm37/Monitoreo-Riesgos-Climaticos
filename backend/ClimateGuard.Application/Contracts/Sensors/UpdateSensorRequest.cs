namespace ClimateGuard.Application.Contracts.Sensors;

public sealed record UpdateSensorRequest(
    string Name,
    byte SensorTypeId,
    int CommunityId);