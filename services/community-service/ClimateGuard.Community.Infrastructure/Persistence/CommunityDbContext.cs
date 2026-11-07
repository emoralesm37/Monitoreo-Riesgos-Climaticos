using Microsoft.EntityFrameworkCore;
using CommunityEntity =
    ClimateGuard.Community.Domain.Entities.Community;

namespace ClimateGuard.Community.Infrastructure.Persistence;

public sealed class CommunityDbContext(
    DbContextOptions<CommunityDbContext> options)
    : DbContext(options)
{
    public DbSet<CommunityEntity> Communities =>
        Set<CommunityEntity>();

    protected override void OnModelCreating(
        ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(CommunityDbContext).Assembly);
    }
}