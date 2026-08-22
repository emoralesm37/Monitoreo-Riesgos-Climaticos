namespace ClimateGuard.Application.Contracts.Sensors;

public sealed record SensorReadingDto(
    long SensorReadingId,
    int SensorId,
    decimal Value,
    DateTime Timestamp);