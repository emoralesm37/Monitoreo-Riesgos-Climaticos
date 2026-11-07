using ClimateGuard.Community.Application.Abstractions.Communities;
using ClimateGuard.Community.Application.Contracts.Communities;
using ClimateGuard.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using CommunityEntity =
    ClimateGuard.Community.Domain.Entities.Community;

namespace ClimateGuard.Community.Infrastructure.Services.Communities;

public sealed class CommunityService(
    CommunityDbContext dbContext)
    : ICommunityService
{
    public async Task<IReadOnlyList<CommunityDto>> GetAllAsync(
        CommunityFilterRequest filters,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.Communities
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(filters.Search))
        {
            var search = $"%{filters.Search.Trim()}%";

            query = query.Where(community =>
                EF.Functions.ILike(community.Name, search) ||
                EF.Functions.ILike(
                    community.Municipality,
                    search) ||
                EF.Functions.ILike(
                    community.Department,
                    search));
        }

        if (!string.IsNullOrWhiteSpace(
                filters.Municipality))
        {
            var municipality =
                filters.Municipality.Trim();

            query = query.Where(community =>
                community.Municipality.ToLower() ==
                municipality.ToLower());
        }

        if (!string.IsNullOrWhiteSpace(
                filters.Department))
        {
            var department = filters.Department.Trim();

            query = query.Where(community =>
                community.Department.ToLower() ==
                department.ToLower());
        }

        if (!string.IsNullOrWhiteSpace(filters.Country))
        {
            var country = filters.Country.Trim();

            query = query.Where(community =>
                community.Country.ToLower() ==
                country.ToLower());
        }

        if (filters.IsActive.HasValue)
        {
            query = query.Where(community =>
                community.IsActive ==
                filters.IsActive.Value);
        }

        return await ProjectToDto(
        query.OrderBy(community => community.Name))
        .ToListAsync(cancellationToken);
    }

    public async Task<CommunityDto?> GetByIdAsync(
        int communityId,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.Communities
            .AsNoTracking()
            .Where(community =>
                community.CommunityId == communityId);

        return await ProjectToDto(query)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<CommunityDto> CreateAsync(
        CreateCommunityRequest request,
        CancellationToken cancellationToken = default)
    {
        var normalizedName = request.Name.Trim();

        var nameExists =
            await dbContext.Communities.AnyAsync(
                community =>
                    community.Name.ToLower() ==
                    normalizedName.ToLower(),
                cancellationToken);

        if (nameExists)
        {
            throw new ArgumentException(
                "Ya existe una comunidad con ese nombre.");
        }

        var community = new CommunityEntity
        {
            Name = normalizedName,
            Municipality = request.Municipality.Trim(),
            Department = request.Department.Trim(),
            Country = request.Country.Trim(),
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            Description =
                NormalizeOptionalText(request.Description),
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow
        };

        dbContext.Communities.Add(community);

        await dbContext.SaveChangesAsync(
            cancellationToken);

        return (await GetByIdAsync(
            community.CommunityId,
            cancellationToken))!;
    }

    public async Task<bool> UpdateAsync(
        int communityId,
        UpdateCommunityRequest request,
        CancellationToken cancellationToken = default)
    {
        var community =
            await dbContext.Communities.FirstOrDefaultAsync(
                item =>
                    item.CommunityId == communityId,
                cancellationToken);

        if (community is null)
        {
            return false;
        }

        var normalizedName = request.Name.Trim();

        var nameExists =
            await dbContext.Communities.AnyAsync(
                item =>
                    item.CommunityId != communityId &&
                    item.Name.ToLower() ==
                    normalizedName.ToLower(),
                cancellationToken);

        if (nameExists)
        {
            throw new ArgumentException(
                "Ya existe otra comunidad con ese nombre.");
        }

        community.Name = normalizedName;
        community.Municipality =
            request.Municipality.Trim();
        community.Department =
            request.Department.Trim();
        community.Country = request.Country.Trim();
        community.Latitude = request.Latitude;
        community.Longitude = request.Longitude;
        community.Description =
            NormalizeOptionalText(request.Description);
        community.UpdatedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(
            cancellationToken);

        return true;
    }

    public async Task<bool> ChangeStatusAsync(
        int communityId,
        bool isActive,
        CancellationToken cancellationToken = default)
    {
        var community =
            await dbContext.Communities.FirstOrDefaultAsync(
                item =>
                    item.CommunityId == communityId,
                cancellationToken);

        if (community is null)
        {
            return false;
        }

        community.IsActive = isActive;
        community.UpdatedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(
            cancellationToken);

        return true;
    }

    private static IQueryable<CommunityDto> ProjectToDto(
        IQueryable<CommunityEntity> query)
    {
        return query.Select(community =>
            new CommunityDto(
                community.CommunityId,
                community.Name,
                community.Municipality,
                community.Department,
                community.Country,
                community.Latitude,
                community.Longitude,
                community.Description,
                community.IsActive,
                community.CreatedAt,
                community.UpdatedAt,
                null));
    }

    private static string? NormalizeOptionalText(
        string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }
}
