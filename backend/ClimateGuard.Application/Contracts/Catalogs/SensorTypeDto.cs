namespace ClimateGuard.Application.Contracts.Catalogs;

public sealed record SensorTypeDto(
    byte SensorTypeId,
    string Code,
    string Unit);