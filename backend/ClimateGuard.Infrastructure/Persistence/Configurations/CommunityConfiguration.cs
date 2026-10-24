using ClimateGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClimateGuard.Infrastructure.Persistence.Configurations;

public sealed class CommunityConfiguration :
    IEntityTypeConfiguration<Community>
{
    public void Configure(EntityTypeBuilder<Community> builder)
    {
        builder.ToTable("Communities", "dbo");

        builder.HasKey(community => community.CommunityId);

        builder.Property(community => community.CommunityId)
            .ValueGeneratedOnAdd();

        builder.Property(community => community.Name)
            .HasMaxLength(120)
            .IsRequired();

        builder.Property(community => community.Municipality)
            .HasMaxLength(120)
            .IsRequired();

        builder.Property(community => community.Department)
            .HasMaxLength(120)
            .IsRequired();

        builder.Property(community => community.Country)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(community => community.Latitude)
            .HasColumnType("decimal(9,6)");

        builder.Property(community => community.Longitude)
            .HasColumnType("decimal(9,6)");

        builder.Property(community => community.Description)
            .HasMaxLength(500);

        builder.Property(community => community.IsActive)
            .HasDefaultValue(true)
            .IsRequired();

        builder.HasIndex(community => community.Name)
            .IsUnique();

        builder.HasIndex(community => community.Municipality);

        builder.HasIndex(community => community.Department);

        builder.HasIndex(community => community.IsActive);
    }
}