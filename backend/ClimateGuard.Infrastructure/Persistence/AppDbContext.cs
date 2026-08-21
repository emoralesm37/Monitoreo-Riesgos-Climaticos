using ClimateGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ClimateGuard.Infrastructure.Persistence;

public sealed class AppDbContext(
    DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Role> Roles => Set<Role>();

    public DbSet<SensorType> SensorTypes => Set<SensorType>();

    public DbSet<AlertSeverity> AlertSeverities =>
        Set<AlertSeverity>();

    public DbSet<PhenomenonType> PhenomenonTypes =>
        Set<PhenomenonType>();

    public DbSet<User> Users => Set<User>();

    public DbSet<Community> Communities => Set<Community>();

    public DbSet<Sensor> Sensors => Set<Sensor>();

    public DbSet<SensorReading> SensorReadings =>
        Set<SensorReading>();

    public DbSet<Alert> Alerts => Set<Alert>();

    public DbSet<AuditLogEntry> AuditLogEntries =>
        Set<AuditLogEntry>();

    public DbSet<RefreshToken> RefreshTokens =>
        Set<RefreshToken>();

    protected override void OnModelCreating(
        ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(AppDbContext).Assembly);
    }
}