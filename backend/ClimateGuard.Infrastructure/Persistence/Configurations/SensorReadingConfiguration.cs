using ClimateGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClimateGuard.Infrastructure.Persistence.Configurations;

public sealed class SensorReadingConfiguration :
    IEntityTypeConfiguration<SensorReading>
{
    public void Configure(
        EntityTypeBuilder<SensorReading> builder)
    {
        builder.ToTable("SensorReadings", "dbo");

        builder.HasKey(reading => reading.SensorReadingId);

        builder.Property(reading => reading.SensorReadingId)
            .ValueGeneratedOnAdd();

        builder.Property(reading => reading.SensorId)
            .IsRequired();

        builder.Property(reading => reading.Value)
            .HasColumnType("decimal(10,2)")
            .IsRequired();

        builder.Property(reading => reading.Timestamp)
            .HasColumnName("Timestamp")
            .HasColumnType("datetime2")
            .HasDefaultValueSql("SYSUTCDATETIME()")
            .IsRequired();

        builder.HasOne(reading => reading.Sensor)
            .WithMany(sensor => sensor.Readings)
            .HasForeignKey(reading => reading.SensorId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName(
                "FK_SensorReadings_Sensors");

        builder.HasIndex(reading => new
            {
                reading.SensorId,
                reading.Timestamp
            })
            .IsDescending(false, true)
            .HasDatabaseName(
                "IX_SensorReadings_SensorId_Timestamp");
    }
}