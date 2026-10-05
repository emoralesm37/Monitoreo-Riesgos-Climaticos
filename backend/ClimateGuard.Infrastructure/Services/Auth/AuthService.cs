using ClimateGuard.Application.Abstractions.Auth;
using ClimateGuard.Application.Contracts.Auth;
using ClimateGuard.Domain.Entities;
using ClimateGuard.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace ClimateGuard.Infrastructure.Services.Auth;

public sealed class AuthService(
    AppDbContext dbContext,
    IPasswordHasher<User> passwordHasher,
    IJwtTokenService jwtTokenService)
    : IAuthService
{
    public async Task<LoginResponse?> LoginAsync(
        LoginRequest request,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var user = await dbContext.Users
            .AsNoTracking()
            .Include(item => item.Role)
            .FirstOrDefaultAsync(
                item => item.Email.ToLower() == normalizedEmail,
                cancellationToken);

        if (user is null || !user.IsActive)
        {
            return null;
        }

        var verificationResult = passwordHasher.VerifyHashedPassword(
            user,
            user.PasswordHash,
            request.Password);

        if (verificationResult == PasswordVerificationResult.Failed)
        {
            return null;
        }

        var (token, expiresAt) =
            jwtTokenService.GenerateToken(user);

        return new LoginResponse
        {
            UserId = user.UserId,
            Name = user.Name,
            Email = user.Email,
            Role = user.Role.Name,
            Token = token,
            ExpiresAt = expiresAt
        };
    }
}
