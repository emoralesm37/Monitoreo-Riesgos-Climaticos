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

        builder.Property(community => community.Region)
            .HasMaxLength(120);

        builder.Property(community => community.Latitude)
            .HasColumnType("decimal(9,6)");

        builder.Property(community => community.Longitude)
            .HasColumnType("decimal(9,6)");

        builder.HasIndex(community => community.Name)
            .IsUnique();
    }
}