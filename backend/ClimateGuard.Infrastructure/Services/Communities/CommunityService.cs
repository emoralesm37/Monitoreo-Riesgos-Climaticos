using ClimateGuard.Application.Abstractions.Communities;
using ClimateGuard.Application.Contracts.Communities;
using ClimateGuard.Domain.Entities;
using ClimateGuard.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ClimateGuard.Infrastructure.Services.Communities;

public sealed class CommunityService(AppDbContext dbContext)
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
            var search = filters.Search.Trim();

            query = query.Where(community =>
                community.Name.Contains(search));
        }

        if (filters.IsActive.HasValue)
        {
            query = query.Where(community =>
                community.IsActive == filters.IsActive.Value);
        }

        if (!string.IsNullOrWhiteSpace(filters.Municipality))
        {
            var municipality = filters.Municipality.Trim();

            query = query.Where(community =>
                community.Municipality == municipality);
        }

        if (!string.IsNullOrWhiteSpace(filters.Department))
        {
            var department = filters.Department.Trim();

            query = query.Where(community =>
                community.Department == department);
        }

        query = query.OrderBy(community => community.Name);

        return await ProjectToDto(query)
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

        var nameExists = await dbContext.Communities.AnyAsync(
            community => community.Name == normalizedName,
            cancellationToken);

        if (nameExists)
        {
            throw new ArgumentException(
                "Ya existe una comunidad con ese nombre.");
        }

        var community = new Community
        {
            Name = normalizedName,
            Municipality = request.Municipality.Trim(),
            Department = request.Department.Trim(),
            Country = request.Country.Trim(),
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            Description = NormalizeOptionalText(request.Description),
            IsActive = true
        };

        dbContext.Communities.Add(community);

        await dbContext.SaveChangesAsync(cancellationToken);

        return (await GetByIdAsync(
            community.CommunityId,
            cancellationToken))!;
    }

    public async Task<bool> UpdateAsync(
        int communityId,
        UpdateCommunityRequest request,
        CancellationToken cancellationToken = default)
    {
        var community = await dbContext.Communities
            .FirstOrDefaultAsync(
                item => item.CommunityId == communityId,
                cancellationToken);

        if (community is null)
        {
            return false;
        }

        var normalizedName = request.Name.Trim();

        var nameExists = await dbContext.Communities.AnyAsync(
            item =>
                item.CommunityId != communityId &&
                item.Name == normalizedName,
            cancellationToken);

        if (nameExists)
        {
            throw new ArgumentException(
                "Ya existe otra comunidad con ese nombre.");
        }

        community.Name = normalizedName;
        community.Municipality = request.Municipality.Trim();
        community.Department = request.Department.Trim();
        community.Country = request.Country.Trim();
        community.Latitude = request.Latitude;
        community.Longitude = request.Longitude;
        community.Description =
            NormalizeOptionalText(request.Description);

        await dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }

    public async Task<bool> ChangeStatusAsync(
        int communityId,
        bool isActive,
        CancellationToken cancellationToken = default)
    {
        var community = await dbContext.Communities
            .FirstOrDefaultAsync(
                item => item.CommunityId == communityId,
                cancellationToken);

        if (community is null)
        {
            return false;
        }

        community.IsActive = isActive;

        await dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }

    private static IQueryable<CommunityDto> ProjectToDto(
        IQueryable<Community> query)
    {
        return query.Select(community => new CommunityDto(
            community.CommunityId,
            community.Name,
            community.Municipality,
            community.Department,
            community.Country,
            community.Latitude,
            community.Longitude,
            community.Description,
            community.IsActive,
            community.Sensors.Count
        ));
    }

    private static string? NormalizeOptionalText(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }
}