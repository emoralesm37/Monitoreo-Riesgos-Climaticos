namespace ClimateGuard.Community.Application.Contracts.Communities;

public sealed class CommunityFilterRequest
{
    public string? Search { get; init; }
    public string? Municipality { get; init; }
    public string? Department { get; init; }
    public string? Country { get; init; }
    public bool? IsActive { get; init; }
}