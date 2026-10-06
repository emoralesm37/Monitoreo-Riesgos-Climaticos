using ClimateGuard.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace ClimateGuard.Infrastructure.Persistence.Initialization;

public sealed class InitialAdminSeeder(
    AppDbContext dbContext,
    IPasswordHasher<User> passwordHasher,
    IConfiguration configuration)
{
    public async Task SeedAsync(
        CancellationToken cancellationToken = default)
    {
        var name = configuration["InitialAdmin:Name"]?.Trim();
        var email = configuration["InitialAdmin:Email"]?.Trim();
        var password = configuration["InitialAdmin:Password"];

        if (string.IsNullOrWhiteSpace(name) ||
            string.IsNullOrWhiteSpace(email) ||
            string.IsNullOrWhiteSpace(password))
        {
            return;
        }

        var normalizedEmail = email.ToLowerInvariant();

        var userExists = await dbContext.Users
            .AnyAsync(
                user => user.Email.ToLower() == normalizedEmail,
                cancellationToken);

        if (userExists)
        {
            return;
        }

        var adminRole = await dbContext.Roles
            .FirstOrDefaultAsync(
                role => role.Name == "Administrador",
                cancellationToken);

        if (adminRole is null)
        {
            throw new InvalidOperationException(
                "No se encontró el rol Administrador.");
        }

        var user = new User
        {
            Name = name,
            Email = normalizedEmail,
            RoleId = adminRole.RoleId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        user.PasswordHash = passwordHasher.HashPassword(
            user,
            password);

        dbContext.Users.Add(user);

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
