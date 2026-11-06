namespace ClimateGuard.Community.Application.Contracts.Communities;

public sealed class ChangeCommunityStatusRequest
{
    public bool IsActive { get; init; }
}