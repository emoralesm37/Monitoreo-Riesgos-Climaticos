using System.ComponentModel.DataAnnotations;

namespace ClimateGuard.Application.Contracts.Communities;

public sealed record CreateCommunityRequest(
    [property: Required]
    [property: StringLength(120, MinimumLength = 3)]
    string Name,

    [property: StringLength(120)]
    string? Region,

    [property: Range(-90, 90)]
    decimal? Latitude,

    [property: Range(-180, 180)]
    decimal? Longitude);