
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

namespace ClimateGuard.Sensor.Tests.Integration;

public sealed class SensorWebApplicationFactory
    : WebApplicationFactory<Program>
{
    private SqliteConnection? _connection;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.ConfigureAppConfiguration((context, config) =>
        {
            config.AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["ConnectionStrings:SensorDatabase"] =
                        "Server=localhost;Database=TestOnly;"
                });
        });

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

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);

        if (disposing)
        {
            _connection?.Dispose();
        }
    }
}
