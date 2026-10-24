namespace ClimateGuard.Application.Contracts.Catalogs;

public sealed record AlertSeverityDto(
    byte AlertSeverityId,
    string Name);