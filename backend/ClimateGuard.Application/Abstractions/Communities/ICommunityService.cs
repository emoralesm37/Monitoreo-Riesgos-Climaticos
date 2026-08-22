using ClimateGuard.Application.Contracts.Communities;

namespace ClimateGuard.Application.Abstractions.Communities;

public interface ICommunityService
{
    Task<IReadOnlyList<CommunityDto>> GetAllAsync(
        CancellationToken cancellationToken = default);

    Task<CommunityDto?> GetByIdAsync(
        int communityId,
        CancellationToken cancellationToken = default);

    Task<CommunityDto> CreateAsync(
        CreateCommunityRequest request,
        CancellationToken cancellationToken = default);

    Task<bool> UpdateAsync(
        int communityId,
        UpdateCommunityRequest request,
        CancellationToken cancellationToken = default);
}