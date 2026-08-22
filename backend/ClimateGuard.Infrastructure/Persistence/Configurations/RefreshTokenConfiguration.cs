using ClimateGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClimateGuard.Infrastructure.Persistence.Configurations;

public sealed class RefreshTokenConfiguration :
    IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(
        EntityTypeBuilder<RefreshToken> builder)
    {
        builder.ToTable("RefreshTokens", "dbo");

        builder.HasKey(token => token.RefreshTokenId);

        builder.Property(token => token.RefreshTokenId)
            .ValueGeneratedOnAdd();

        builder.Property(token => token.UserId)
            .IsRequired();

        builder.Property(token => token.TokenHash)
            .HasMaxLength(300)
            .IsRequired();

        builder.Property(token => token.ExpiresAt)
            .HasColumnType("datetime2")
            .IsRequired();

        builder.Property(token => token.CreatedAt)
            .HasColumnType("datetime2")
            .HasDefaultValueSql("SYSUTCDATETIME()")
            .IsRequired();

        builder.Property(token => token.RevokedAt)
            .HasColumnType("datetime2");

        builder.Property(token => token.CreatedByIp)
            .HasMaxLength(45);

        builder.HasOne(token => token.User)
            .WithMany(user => user.RefreshTokens)
            .HasForeignKey(token => token.UserId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName(
                "FK_RefreshTokens_Users");

        builder.HasOne(token => token.ReplacedByToken)
            .WithMany(token => token.PreviousTokens)
            .HasForeignKey(token => token.ReplacedByTokenId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName(
                "FK_RefreshTokens_ReplacedBy");
    }
}