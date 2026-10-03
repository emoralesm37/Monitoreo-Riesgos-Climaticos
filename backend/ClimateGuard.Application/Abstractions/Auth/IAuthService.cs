using ClimateGuard.Application.Contracts.Auth;

namespace ClimateGuard.Application.Abstractions.Auth;

public interface IAuthService
{
    Task<LoginResponse?> LoginAsync(
        LoginRequest request,
        CancellationToken cancellationToken = default);
}
