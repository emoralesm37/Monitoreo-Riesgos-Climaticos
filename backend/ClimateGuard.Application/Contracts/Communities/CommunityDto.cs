namespace ClimateGuard.Application.Contracts.Communities;

public sealed record CommunityDto(
    int CommunityId,
    string Name,
    string Municipality,
    string Department,
    string Country,
    decimal? Latitude,
    decimal? Longitude,
    string? Description,
    bool IsActive,
    int SensorCount
);