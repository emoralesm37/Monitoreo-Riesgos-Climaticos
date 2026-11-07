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

    public DbSet<AlertRule> AlertRules => Set<AlertRule>();
    public DbSet<ReadingAlertDelivery> ReadingAlertDeliveries => Set<ReadingAlertDelivery>();
    public DbSet<SensorDevice> SensorDevices => Set<SensorDevice>();
    public DbSet<PhysicalMeasurement> PhysicalMeasurements => Set<PhysicalMeasurement>();

    public DbSet<AuditLogEntry> AuditLogEntries =>
        Set<AuditLogEntry>();

    public DbSet<RefreshToken> RefreshTokens =>
        Set<RefreshToken>();

    protected override void OnModelCreating(
        ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<SensorDevice>(e => {
            e.ToTable("SensorDevices", "dbo"); e.HasKey(x => x.DeviceId);
            e.Property(x => x.DeviceId).HasMaxLength(64);
            e.HasOne<Sensor>().WithMany().HasForeignKey(x => x.SensorId).OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<PhysicalMeasurement>(e => {
            e.ToTable("PhysicalMeasurements", "dbo"); e.HasKey(x => new { x.DeviceId, x.MeasurementId });
            e.Property(x => x.DeviceId).HasMaxLength(64);e.Property(x => x.MeasurementId).HasMaxLength(128);
            e.Property(x => x.Fingerprint).HasMaxLength(64);
            e.HasOne<SensorDevice>().WithMany().HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Reading).WithOne().HasForeignKey<PhysicalMeasurement>(x => x.SensorReadingId).OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<ReadingAlertDelivery>(e =>
        {
            e.ToTable("ReadingAlertDeliveries", "dbo");
            e.HasKey(x => x.SensorReadingId);
            e.Property(x => x.SensorReadingId).ValueGeneratedNever();
            e.Property(x => x.Payload).IsRequired();
            e.HasOne(x => x.Reading).WithOne().HasForeignKey<ReadingAlertDelivery>(x => x.SensorReadingId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(AppDbContext).Assembly);
    }
}
