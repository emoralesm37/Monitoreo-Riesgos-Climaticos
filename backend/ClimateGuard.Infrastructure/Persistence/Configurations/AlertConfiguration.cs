using ClimateGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClimateGuard.Infrastructure.Persistence.Configurations;

public sealed class AlertConfiguration :
    IEntityTypeConfiguration<Alert>
{
    public void Configure(EntityTypeBuilder<Alert> builder)
    {
        builder.ToTable("Alerts", "dbo");

        builder.HasKey(alert => alert.AlertId);

        builder.Property(alert => alert.AlertId)
            .ValueGeneratedOnAdd();

        builder.Property(alert => alert.TriggerValue)
            .HasColumnType("decimal(10,2)");

        builder.Property(alert => alert.Message)
            .HasMaxLength(300)
            .IsRequired();

        builder.Property(alert => alert.CreatedAt)
            .HasColumnType("datetime2")
            .HasDefaultValueSql("SYSUTCDATETIME()")
            .IsRequired();

        builder.Property(alert => alert.ResolvedAt)
            .HasColumnType("datetime2");

        builder.HasOne(alert => alert.Sensor)
            .WithMany(sensor => sensor.Alerts)
            .HasForeignKey(alert => alert.SensorId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_Alerts_Sensors");

        builder.HasOne(alert => alert.AlertSeverity)
            .WithMany(severity => severity.Alerts)
            .HasForeignKey(alert => alert.AlertSeverityId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName(
                "FK_Alerts_AlertSeverities");

        builder.HasOne(alert => alert.PhenomenonType)
            .WithMany(phenomenon => phenomenon.Alerts)
            .HasForeignKey(alert => alert.PhenomenonTypeId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName(
                "FK_Alerts_PhenomenonTypes");

        builder.HasOne(alert => alert.ResolvedByUser)
            .WithMany(user => user.ResolvedAlerts)
            .HasForeignKey(alert => alert.ResolvedByUserId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName(
                "FK_Alerts_Users_ResolvedBy");

        builder.HasIndex(alert => alert.CreatedAt)
            .IsDescending()
            .HasDatabaseName("IX_Alerts_CreatedAt");

        builder.HasIndex(alert => alert.SensorId)
            .HasDatabaseName("IX_Alerts_SensorId");
    }
}