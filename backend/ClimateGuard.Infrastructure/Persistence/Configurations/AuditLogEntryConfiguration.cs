using ClimateGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClimateGuard.Infrastructure.Persistence.Configurations;

public sealed class AuditLogEntryConfiguration :
    IEntityTypeConfiguration<AuditLogEntry>
{
    public void Configure(
        EntityTypeBuilder<AuditLogEntry> builder)
    {
        builder.ToTable("AuditLogEntries", "dbo");

        builder.HasKey(entry => entry.AuditLogEntryId);

        builder.Property(entry => entry.AuditLogEntryId)
            .ValueGeneratedOnAdd();

        builder.Property(entry => entry.UserId)
            .IsRequired();

        builder.Property(entry => entry.Action)
            .HasMaxLength(60)
            .IsRequired();

        builder.Property(entry => entry.EntityAffected)
            .HasMaxLength(60);

        builder.Property(entry => entry.Timestamp)
            .HasColumnName("Timestamp")
            .HasColumnType("datetime2")
            .HasDefaultValueSql("SYSUTCDATETIME()")
            .IsRequired();

        builder.Property(entry => entry.Details)
            .HasMaxLength(500);

        builder.HasOne(entry => entry.User)
            .WithMany(user => user.AuditLogEntries)
            .HasForeignKey(entry => entry.UserId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName(
                "FK_AuditLogEntries_Users");
    }
}