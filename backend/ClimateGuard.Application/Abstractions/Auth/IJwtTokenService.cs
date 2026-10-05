using ClimateGuard.Domain.Entities;

namespace ClimateGuard.Application.Abstractions.Auth;

public interface IJwtTokenService
{
    (string Token, DateTime ExpiresAt) GenerateToken(User user);
}
