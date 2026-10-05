using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ClimateGuard.Application.Abstractions.Auth;
using ClimateGuard.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace ClimateGuard.Infrastructure.Services.Auth;

public sealed class JwtTokenService(IConfiguration configuration)
    : IJwtTokenService
{
    public (string Token, DateTime ExpiresAt) GenerateToken(User user)
    {
        var key = configuration["Jwt:Key"]
            ?? throw new InvalidOperationException(
                "No se encontró la configuración Jwt:Key.");

        var issuer = configuration["Jwt:Issuer"]
            ?? throw new InvalidOperationException(
                "No se encontró la configuración Jwt:Issuer.");

        var audience = configuration["Jwt:Audience"]
            ?? throw new InvalidOperationException(
                "No se encontró la configuración Jwt:Audience.");

        var expirationMinutes =
            configuration.GetValue<int?>("Jwt:ExpirationMinutes")
            ?? 30;

        var expiresAt = DateTime.UtcNow.AddMinutes(expirationMinutes);

        var claims = new[]
        {
            new Claim(
                JwtRegisteredClaimNames.Sub,
                user.UserId.ToString()),

            new Claim(
                JwtRegisteredClaimNames.Email,
                user.Email),

            new Claim(
                ClaimTypes.Name,
                user.Name),

            new Claim(
                ClaimTypes.Role,
                user.Role.Name),

            new Claim(
                JwtRegisteredClaimNames.Jti,
                Guid.NewGuid().ToString())
        };

        var securityKey =
            new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(key));

        var credentials =
            new SigningCredentials(
                securityKey,
                SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials);

        return (
            new JwtSecurityTokenHandler().WriteToken(token),
            expiresAt
        );
    }
}
