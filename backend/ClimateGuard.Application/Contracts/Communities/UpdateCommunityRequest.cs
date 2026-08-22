using System.ComponentModel.DataAnnotations;

namespace ClimateGuard.Application.Contracts.Communities;

public sealed record UpdateCommunityRequest(
    [Required]
    [StringLength(120, MinimumLength = 3)]
    string Name,

    [StringLength(120)]
    string? Region,

    [Range(-90, 90)]
    decimal? Latitude,

    [Range(-180, 180)]
    decimal? Longitude);