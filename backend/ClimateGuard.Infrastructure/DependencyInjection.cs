using ClimateGuard.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ClimateGuard.Application.Abstractions.Sensors;
using ClimateGuard.Infrastructure.Services.Sensors;
using ClimateGuard.Application.Abstractions.Catalogs;
using ClimateGuard.Application.Abstractions.Communities;
using ClimateGuard.Infrastructure.Services.Catalogs;
using ClimateGuard.Infrastructure.Services.Communities;
using ClimateGuard.Application.Abstractions.Auth;
using ClimateGuard.Domain.Entities;
using ClimateGuard.Infrastructure.Services.Auth;
using Microsoft.AspNetCore.Identity;
using ClimateGuard.Infrastructure.Persistence.Initialization;
using ClimateGuard.Application.Abstractions.AlertRules;
using ClimateGuard.Infrastructure.Services.AlertRules;
using ClimateGuard.Application.Abstractions.Alerts;
using ClimateGuard.Infrastructure.Services.Alerts;

namespace ClimateGuard.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString =
            configuration.GetConnectionString("ClimateGuard")
            ?? throw new InvalidOperationException(
                "No se encontró la cadena de conexión ClimateGuard.");

        services.AddDbContext<AppDbContext>(options =>
        {
            options.UseSqlServer(
                connectionString,
                sqlOptions =>
                {
                    sqlOptions.EnableRetryOnFailure(
                        maxRetryCount: 5,
                        maxRetryDelay: TimeSpan.FromSeconds(10),
                        errorNumbersToAdd: null);
                });
        });
        services.AddScoped<ISensorService, SensorService>();
        services.AddScoped<ICommunityService, CommunityService>();
        services.AddScoped<IAlertRuleService, AlertRuleService>();
        services.AddScoped<IAlertEvaluationService, AlertEvaluationService>();
        services.AddScoped<IAlertGenerationService, AlertGenerationService>();
        services.AddScoped<ICatalogService, CatalogService>();
        services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<InitialAdminSeeder>();
        return services;
    }
}
