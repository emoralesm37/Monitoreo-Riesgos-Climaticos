using ClimateGuard.Community.Application.Contracts.Communities;

namespace ClimateGuard.Community.Application.Abstractions.Communities;

public interface ICommunityService
{
    Task<IReadOnlyList<CommunityDto>> GetAllAsync(
        CommunityFilterRequest filters,
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

    Task<bool> ChangeStatusAsync(
        int communityId,
        bool isActive,
        CancellationToken cancellationToken = default);
}