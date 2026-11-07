using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using CommunityEntity =
    ClimateGuard.Community.Domain.Entities.Community;

namespace ClimateGuard.Community.Infrastructure.Persistence.Configurations;

public sealed class CommunityConfiguration
    : IEntityTypeConfiguration<CommunityEntity>
{
    public void Configure(
        EntityTypeBuilder<CommunityEntity> builder)
    {
        builder.ToTable("communities");

        builder.HasKey(community => community.CommunityId);

        builder.Property(community => community.CommunityId)
            .HasColumnName("community_id")
            .UseIdentityByDefaultColumn();

        builder.Property(community => community.Name)
            .HasColumnName("name")
            .HasMaxLength(120)
            .IsRequired();

        builder.Property(community => community.Municipality)
            .HasColumnName("municipality")
            .HasMaxLength(120)
            .IsRequired();

        builder.Property(community => community.Department)
            .HasColumnName("department")
            .HasMaxLength(120)
            .IsRequired();

        builder.Property(community => community.Country)
            .HasColumnName("country")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(community => community.Latitude)
            .HasColumnName("latitude")
            .HasPrecision(9, 6);

        builder.Property(community => community.Longitude)
            .HasColumnName("longitude")
            .HasPrecision(9, 6);

        builder.Property(community => community.Description)
            .HasColumnName("description")
            .HasMaxLength(500);

        builder.Property(community => community.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true)
            .IsRequired();

        builder.Property(community => community.CreatedAt)
            .HasColumnName("created_at")
            .HasDefaultValueSql("CURRENT_TIMESTAMP")
            .IsRequired();

        builder.Property(community => community.UpdatedAt)
            .HasColumnName("updated_at");

        builder.HasIndex(community => community.Name)
            .IsUnique()
            .HasDatabaseName("ux_communities_name");

        builder.HasIndex(community => community.Municipality)
            .HasDatabaseName("ix_communities_municipality");

        builder.HasIndex(community => community.Department)
            .HasDatabaseName("ix_communities_department");

        builder.HasIndex(community => community.IsActive)
            .HasDatabaseName("ix_communities_is_active");
    }
}