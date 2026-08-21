using ClimateGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClimateGuard.Infrastructure.Persistence.Configurations;

public sealed class UserConfiguration :
    IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("Users", "dbo");

        builder.HasKey(user => user.UserId);

        builder.Property(user => user.UserId)
            .ValueGeneratedOnAdd();

        builder.Property(user => user.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(user => user.Email)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(user => user.PasswordHash)
            .HasMaxLength(300)
            .IsRequired();

        builder.Property(user => user.RoleId)
            .IsRequired();

        builder.Property(user => user.IsActive)
            .HasDefaultValue(true)
            .IsRequired();

        builder.Property(user => user.CreatedAt)
            .HasColumnType("datetime2")
            .HasDefaultValueSql("SYSUTCDATETIME()")
            .IsRequired();

        builder.Property(user => user.UpdatedAt)
            .HasColumnType("datetime2");

        builder.HasIndex(user => user.Email)
            .IsUnique();

        builder.HasOne(user => user.Role)
            .WithMany(role => role.Users)
            .HasForeignKey(user => user.RoleId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_Users_Roles");
    }
}