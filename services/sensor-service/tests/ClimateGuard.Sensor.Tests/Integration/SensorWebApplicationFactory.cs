using ClimateGuard.Sensor.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace ClimateGuard.Sensor.Tests.Integration;

public sealed class SensorWebApplicationFactory
    : WebApplicationFactory<Program>
{
    private SqliteConnection? _connection;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.UseSetting("ConnectionStrings:SensorDatabase", "Server=localhost;Database=TestOnly;");

        builder.UseSetting("Jwt:Key", "ClimateGuardSensorIntegrationTestsOnlyKey2026DoNotUseInProduction!");

        builder.UseSetting("Jwt:Issuer", "ClimateGuard.Auth");

        builder.UseSetting("Jwt:Audience", "ClimateGuard.Services");

        builder.ConfigureTestServices(services =>
        {
            // Retirar las opciones originales del DbContext.
            services.RemoveAll<DbContextOptions<SensorDbContext>>();
            services.RemoveAll<DbContextOptions>();
            services.RemoveAll<SensorDbContext>();
            services.RemoveAll<IDbContextOptionsConfiguration<SensorDbContext>>();

            // Retirar servicios específicos del proveedor SQL Server.
            services.RemoveAll<Microsoft.EntityFrameworkCore.Storage.IDatabaseProvider>();

            _connection = new SqliteConnection("Data Source=:memory:");
            _connection.Open();
            // Compatibilidad con la función de fechas de SQL Server.
            // Se registra únicamente en la conexión SQLite de pruebas.
            _connection.CreateFunction(
            "SYSUTCDATETIME",
            () => DateTime.UtcNow.ToString(
                "yyyy-MM-dd HH:mm:ss.fffffff",
             System.Globalization.CultureInfo.InvariantCulture)
    );

            services.AddDbContext<SensorDbContext>(options =>
                options.UseSqlite(_connection));

            // Crear las tablas únicamente en SQLite temporal.
            using var provider = services.BuildServiceProvider();
            using var scope = provider.CreateScope();

            var db = scope.ServiceProvider
                .GetRequiredService<SensorDbContext>();

            db.Database.EnsureCreated();
        });
    }

    public HttpClient CreateAuthenticatedClient()
    {
        const string testKey =
            "ClimateGuardSensorIntegrationTestsOnlyKey2026DoNotUseInProduction!";

        var signingKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(testKey));

        var credentials = new SigningCredentials(
            signingKey,
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: "ClimateGuard.Auth",
            audience: "ClimateGuard.Services",
            claims:
            [
                new Claim("sub", "sensor-integration-test"),
                new Claim("role", "Admin")
            ],
            notBefore: DateTime.UtcNow.AddMinutes(-1),
            expires: DateTime.UtcNow.AddMinutes(15),
            signingCredentials: credentials
        );

        var tokenString =
            new JwtSecurityTokenHandler().WriteToken(token);

        var client = CreateClient();

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", tokenString);

        return client;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);

        if (disposing)
        {
            _connection?.Dispose();
        }
    }
}
