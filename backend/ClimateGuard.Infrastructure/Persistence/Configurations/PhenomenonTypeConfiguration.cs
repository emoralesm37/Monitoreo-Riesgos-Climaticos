using ClimateGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClimateGuard.Infrastructure.Persistence.Configurations;

public sealed class PhenomenonTypeConfiguration :
    IEntityTypeConfiguration<PhenomenonType>
{
    public void Configure(
        EntityTypeBuilder<PhenomenonType> builder)
    {
        builder.ToTable("PhenomenonTypes", "dbo");

        builder.HasKey(phenomenon => phenomenon.PhenomenonTypeId);

        builder.Property(phenomenon => phenomenon.PhenomenonTypeId)
            .ValueGeneratedNever();

        builder.Property(phenomenon => phenomenon.Name)
            .HasMaxLength(30)
            .IsRequired();

        builder.HasIndex(phenomenon => phenomenon.Name)
            .IsUnique();
    }
}