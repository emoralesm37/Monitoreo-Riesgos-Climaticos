using ClimateGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClimateGuard.Infrastructure.Persistence.Configurations;

public sealed class RoleConfiguration :
    IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        builder.ToTable("Roles", "dbo");

        builder.HasKey(role => role.RoleId);

        builder.Property(role => role.RoleId)
            .ValueGeneratedNever();

        builder.Property(role => role.Name)
            .HasMaxLength(30)
            .IsRequired();

        builder.HasIndex(role => role.Name)
            .IsUnique();
    }
}