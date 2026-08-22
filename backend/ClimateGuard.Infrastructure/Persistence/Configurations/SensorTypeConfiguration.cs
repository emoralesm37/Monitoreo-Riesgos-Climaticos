using ClimateGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClimateGuard.Infrastructure.Persistence.Configurations;

public sealed class SensorTypeConfiguration :
    IEntityTypeConfiguration<SensorType>
{
    public void Configure(EntityTypeBuilder<SensorType> builder)
    {
        builder.ToTable("SensorTypes", "dbo");

        builder.HasKey(sensorType => sensorType.SensorTypeId);

        builder.Property(sensorType => sensorType.SensorTypeId)
            .ValueGeneratedNever();

        builder.Property(sensorType => sensorType.Code)
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(sensorType => sensorType.Unit)
            .HasMaxLength(15)
            .IsRequired();

        builder.HasIndex(sensorType => sensorType.Code)
            .IsUnique();
    }
}