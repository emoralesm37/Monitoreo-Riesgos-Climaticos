using ClimateGuard.Sensor.Domain.Entities;
using Microsoft.EntityFrameworkCore;

using SensorEntity = ClimateGuard.Sensor.Domain.Entities.Sensor;

namespace ClimateGuard.Sensor.Infrastructure.Persistence;

public sealed class SensorDbContext : DbContext
{
    public SensorDbContext(DbContextOptions<SensorDbContext> options)
        : base(options)
    {
    }

    public DbSet<SensorEntity> Sensors => Set<SensorEntity>();
    public DbSet<SensorType> SensorTypes => Set<SensorType>();
    public DbSet<SensorReading> SensorReadings => Set<SensorReading>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // SENSOR TYPES
        modelBuilder.Entity<SensorType>(entity =>
        {
            entity.ToTable("SensorTypes", "dbo");

            entity.HasKey(t => t.SensorTypeId);

            entity.Property(t => t.SensorTypeId)
                .ValueGeneratedNever();

            entity.Property(t => t.Code)
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(t => t.Unit)
                .HasMaxLength(15)
                .IsRequired();

            entity.HasIndex(t => t.Code)
                .IsUnique();
        });

        // SENSORS
        modelBuilder.Entity<SensorEntity>(entity =>
        {
            entity.ToTable("Sensors", "dbo");

            entity.HasKey(s => s.SensorId);

            entity.Property(s => s.SensorId)
                .ValueGeneratedOnAdd();

            entity.Property(s => s.Name)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(s => s.SensorTypeId)
                .IsRequired();

            // Referencia lógica al Community Service.
            // No se configura clave foránea hacia Communities.
            entity.Property(s => s.CommunityId)
                .IsRequired();

            entity.Property(s => s.IsActive)
                .HasDefaultValue(true)
                .IsRequired();

            entity.Property(s => s.LastValue)
                .HasColumnType("decimal(10,2)");

            entity.Property(s => s.LastUpdatedAt)
                .HasColumnType("datetime2");

            entity.Property(s => s.CreatedAt)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("SYSUTCDATETIME()")
                .IsRequired();

            entity.Property(s => s.UpdatedAt)
                .HasColumnType("datetime2");

            entity.HasOne(s => s.SensorType)
                .WithMany(t => t.Sensors)
                .HasForeignKey(s => s.SensorTypeId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_Sensors_SensorTypes");
        });

        // SENSOR READINGS
        modelBuilder.Entity<SensorReading>(entity =>
        {
            entity.ToTable("SensorReadings", "dbo");

            entity.HasKey(r => r.SensorReadingId);

            entity.Property(r => r.SensorReadingId)
                .ValueGeneratedOnAdd();

            entity.Property(r => r.SensorId)
                .IsRequired();

            entity.Property(r => r.Value)
                .HasColumnType("decimal(10,2)")
                .IsRequired();

            entity.Property(r => r.Timestamp)
                .HasColumnName("Timestamp")
                .HasColumnType("datetime2")
                .HasDefaultValueSql("SYSUTCDATETIME()")
                .IsRequired();

            entity.HasOne(r => r.Sensor)
                .WithMany(s => s.Readings)
                .HasForeignKey(r => r.SensorId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_SensorReadings_Sensors");

            entity.HasIndex(r => new
                {
                    r.SensorId,
                    r.Timestamp
                })
                .IsDescending(false, true)
                .HasDatabaseName(
                    "IX_SensorReadings_SensorId_Timestamp");
        });
    }
}
