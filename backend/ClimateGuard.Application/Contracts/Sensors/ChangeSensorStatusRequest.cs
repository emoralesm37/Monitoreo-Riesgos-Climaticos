namespace ClimateGuard.Application.Contracts.Sensors;

public sealed record ChangeSensorStatusRequest(
    bool IsActive);