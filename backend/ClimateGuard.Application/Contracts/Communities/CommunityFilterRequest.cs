using System.ComponentModel.DataAnnotations;

namespace ClimateGuard.Application.Contracts.Communities;

public sealed record CommunityFilterRequest(
    [StringLength(120)]
    string? Search,

    bool? IsActive,

    [StringLength(120)]
    string? Municipality,

    [StringLength(120)]
    string? Department
);