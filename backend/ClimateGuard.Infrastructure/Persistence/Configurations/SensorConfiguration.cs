using ClimateGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClimateGuard.Infrastructure.Persistence.Configurations;

public sealed class SensorConfiguration :
    IEntityTypeConfiguration<Sensor>
{
    public void Configure(EntityTypeBuilder<Sensor> builder)
    {
        builder.ToTable("Sensors", "dbo");

        builder.HasKey(sensor => sensor.SensorId);

        builder.Property(sensor => sensor.SensorId)
            .ValueGeneratedOnAdd();

        builder.Property(sensor => sensor.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(sensor => sensor.SensorTypeId)
            .IsRequired();

        builder.Property(sensor => sensor.CommunityId)
            .IsRequired();

        builder.Property(sensor => sensor.IsActive)
            .HasDefaultValue(true)
            .IsRequired();

        builder.Property(sensor => sensor.LastValue)
            .HasColumnType("decimal(10,2)");

        builder.Property(sensor => sensor.LastUpdatedAt)
            .HasColumnType("datetime2");

        builder.Property(sensor => sensor.CreatedAt)
            .HasColumnType("datetime2")
            .HasDefaultValueSql("SYSUTCDATETIME()")
            .IsRequired();

        builder.Property(sensor => sensor.UpdatedAt)
            .HasColumnType("datetime2");

        builder.HasOne(sensor => sensor.SensorType)
            .WithMany(sensorType => sensorType.Sensors)
            .HasForeignKey(sensor => sensor.SensorTypeId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName(
                "FK_Sensors_SensorTypes");

        builder.HasOne(sensor => sensor.Community)
            .WithMany(community => community.Sensors)
            .HasForeignKey(sensor => sensor.CommunityId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName(
                "FK_Sensors_Communities");
    }
}