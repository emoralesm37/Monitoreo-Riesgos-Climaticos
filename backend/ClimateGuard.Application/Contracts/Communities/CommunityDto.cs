namespace ClimateGuard.Application.Contracts.Communities;

public sealed record CommunityDto(
    int CommunityId,
    string Name,
    string? Region,
    decimal? Latitude,
    decimal? Longitude);