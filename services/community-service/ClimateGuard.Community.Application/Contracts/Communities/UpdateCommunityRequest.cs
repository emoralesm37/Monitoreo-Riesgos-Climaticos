using System.ComponentModel.DataAnnotations;

namespace ClimateGuard.Community.Application.Contracts.Communities;

public sealed class UpdateCommunityRequest
{
    [Required]
    [StringLength(120)]
    public string Name { get; init; } = string.Empty;

    [Required]
    [StringLength(120)]
    public string Municipality { get; init; } = string.Empty;

    [Required]
    [StringLength(120)]
    public string Department { get; init; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string Country { get; init; } = string.Empty;

    [Range(-90, 90)]
    public decimal? Latitude { get; init; }

    [Range(-180, 180)]
    public decimal? Longitude { get; init; }

    [StringLength(500)]
    public string? Description { get; init; }
}