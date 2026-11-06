using ClimateGuard.Community.Application.Contracts.Communities;
using ClimateGuard.Community.Infrastructure.Persistence;
using ClimateGuard.Community.Infrastructure.Services.Communities;
using Microsoft.EntityFrameworkCore;
using CommunityEntity =
    ClimateGuard.Community.Domain.Entities.Community;

namespace ClimateGuard.Community.Tests;

public sealed class CommunityServiceTests
{
    [Fact]
    public async Task GetAllAsync_ReturnsCommunitiesOrderedByName()
    {
        await using var dbContext = CreateDbContext();

        dbContext.Communities.AddRange(
            CreateCommunity("Zona Norte", true),
            CreateCommunity("Aldea Central", true));

        await dbContext.SaveChangesAsync();

        var service = new CommunityService(dbContext);

        var result = await service.GetAllAsync(
            new CommunityFilterRequest());

        Assert.Collection(
            result,
            first => Assert.Equal(
                "Aldea Central",
                first.Name),
            second => Assert.Equal(
                "Zona Norte",
                second.Name));
    }

    [Fact]
    public async Task GetAllAsync_FiltersCommunitiesByStatus()
    {
        await using var dbContext = CreateDbContext();

        dbContext.Communities.AddRange(
            CreateCommunity("Comunidad Activa", true),
            CreateCommunity("Comunidad Inactiva", false));

        await dbContext.SaveChangesAsync();

        var service = new CommunityService(dbContext);

        var result = await service.GetAllAsync(
            new CommunityFilterRequest
            {
                IsActive = false
            });

        var community = Assert.Single(result);

        Assert.Equal(
            "Comunidad Inactiva",
            community.Name);

        Assert.False(community.IsActive);
    }

    private static CommunityDbContext CreateDbContext()
    {
        var options =
            new DbContextOptionsBuilder<CommunityDbContext>()
                .UseInMemoryDatabase(
                    Guid.NewGuid().ToString())
                .Options;

        return new CommunityDbContext(options);
    }

    private static CommunityEntity CreateCommunity(
        string name,
        bool isActive)
    {
        return new CommunityEntity
        {
            Name = name,
            Municipality = "Mixco",
            Department = "Guatemala",
            Country = "Guatemala",
            Latitude = 14.6333m,
            Longitude = -90.6064m,
            Description = "Comunidad de prueba",
            IsActive = isActive
        };
    }
}