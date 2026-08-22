namespace ClimateGuard.Application.Contracts.Sensors;

public sealed record ManualSensorValueRequest(
    decimal Value);