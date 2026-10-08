using ClimateGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClimateGuard.Infrastructure.Persistence.Configurations;

public sealed class AlertRuleConfiguration :
    IEntityTypeConfiguration<AlertRule>
{
    public void Configure(
        EntityTypeBuilder<AlertRule> builder)
    {
        builder.ToTable("AlertRules", "dbo");

        builder.HasKey(rule => rule.AlertRuleId);

        builder.Property(rule => rule.AlertRuleId)
            .ValueGeneratedOnAdd();

        builder.Property(rule => rule.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(rule => rule.MinimumValue)
            .HasColumnType("decimal(10,2)")
            .IsRequired();

        builder.Property(rule => rule.MaximumValue)
            .HasColumnType("decimal(10,2)")
            .IsRequired();

        builder.Property(rule => rule.Message)
            .HasMaxLength(300)
            .IsRequired();

        builder.Property(rule => rule.IsActive)
            .HasDefaultValue(true)
            .IsRequired();

        builder.Property(rule => rule.CreatedAt)
            .HasDefaultValueSql("SYSUTCDATETIME()")
            .IsRequired();

        builder.Property(rule => rule.UpdatedAt);

        builder.HasOne(rule => rule.SensorType)
            .WithMany()
            .HasForeignKey(rule => rule.SensorTypeId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_AlertRules_SensorTypes");

        builder.HasOne(rule => rule.AlertSeverity)
            .WithMany()
            .HasForeignKey(rule => rule.AlertSeverityId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_AlertRules_AlertSeverities");

        builder.HasOne(rule => rule.PhenomenonType)
            .WithMany()
            .HasForeignKey(rule => rule.PhenomenonTypeId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_AlertRules_PhenomenonTypes");

        builder.HasIndex(rule => rule.Name)
            .IsUnique();

        builder.HasIndex(rule => rule.SensorTypeId);

        builder.HasIndex(rule => rule.AlertSeverityId);

        builder.HasIndex(rule => rule.PhenomenonTypeId);

        builder.HasIndex(rule => rule.IsActive);
    }
}
