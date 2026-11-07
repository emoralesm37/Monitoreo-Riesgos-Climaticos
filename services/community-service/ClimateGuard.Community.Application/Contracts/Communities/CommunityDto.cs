namespace ClimateGuard.Community.Application.Contracts.Communities;

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
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    int? SensorCount = null
);
