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
        CancellationToken cancellationToken = default)
    {
        return await dbContext.Communities
            .AsNoTracking()
            .OrderBy(community => community.Name)
            .Select(community => new CommunityDto(
                community.CommunityId,
                community.Name,
                community.Region,
                community.Latitude,
                community.Longitude))
            .ToListAsync(cancellationToken);
    }

    public async Task<CommunityDto?> GetByIdAsync(
        int communityId,
        CancellationToken cancellationToken = default)
    {
        return await dbContext.Communities
            .AsNoTracking()
            .Where(community => community.CommunityId == communityId)
            .Select(community => new CommunityDto(
                community.CommunityId,
                community.Name,
                community.Region,
                community.Latitude,
                community.Longitude))
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
            Region = request.Region?.Trim(),
            Latitude = request.Latitude,
            Longitude = request.Longitude
        };

        dbContext.Communities.Add(community);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new CommunityDto(
            community.CommunityId,
            community.Name,
            community.Region,
            community.Latitude,
            community.Longitude);
    }

    public async Task<bool> UpdateAsync(
        int communityId,
        UpdateCommunityRequest request,
        CancellationToken cancellationToken = default)
    {
        var community = await dbContext.Communities.FindAsync(
            [communityId],
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
        community.Region = request.Region?.Trim();
        community.Latitude = request.Latitude;
        community.Longitude = request.Longitude;

        await dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }
}