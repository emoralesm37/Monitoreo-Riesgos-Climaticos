using ClimateGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClimateGuard.Infrastructure.Persistence.Configurations;

public sealed class AlertSeverityConfiguration :
    IEntityTypeConfiguration<AlertSeverity>
{
    public void Configure(
        EntityTypeBuilder<AlertSeverity> builder)
    {
        builder.ToTable("AlertSeverities", "dbo");

        builder.HasKey(severity => severity.AlertSeverityId);

        builder.Property(severity => severity.AlertSeverityId)
            .ValueGeneratedNever();

        builder.Property(severity => severity.Name)
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(severity => severity.Level)
            .IsRequired();

        builder.HasIndex(severity => severity.Name)
            .IsUnique();
    }
}