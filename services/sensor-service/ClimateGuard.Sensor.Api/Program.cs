using ClimateGuard.Sensor.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using ClimateGuard.Sensor.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);

// Configuración de OpenAPI
builder.Services.AddOpenApi();

// Configuración de SQL Server
var connectionString = builder.Configuration
    .GetConnectionString("SensorDatabase");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "No se encontró la conexión SensorDatabase.");
}

builder.Services.AddDbContext<SensorDbContext>(options =>
    options.UseSqlServer(connectionString));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// Verificación del funcionamiento de la API
app.MapGet("/health", () =>
{
    return Results.Ok(new
    {
        service = "ClimateGuard.Sensor",
        status = "Healthy"
    });
});


    app.MapGet("/health/database", async (SensorDbContext db) =>
    {
        try
        {
            var connected = await db.Database.CanConnectAsync();

            if (!connected)
            {
                return Results.Problem(
                    "No se pudo establecer conexión con SensorDatabase.",
                statusCode: 503);
            }

            return Results.Ok(new
            {
                service = "ClimateGuard.Sensor",
                database = "ClimateGuardSensorDb",
                status = "Connected"
            });
        }
        catch
        {
            return Results.Problem(
                "Error al verificar la conexión con SQL Server.",
                statusCode: 503);
        }
    });
    app.MapSensorEndpoints();
app.Run();
public partial class Program { }
