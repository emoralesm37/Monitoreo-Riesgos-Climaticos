namespace ClimateGuard.Application.Contracts.Communities;

public sealed record ChangeCommunityStatusRequest(
    bool IsActive
);