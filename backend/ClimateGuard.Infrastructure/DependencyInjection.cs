using ClimateGuard.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ClimateGuard.Application.Abstractions.Sensors;
using ClimateGuard.Infrastructure.Services.Sensors;

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
        return services;
    }
}