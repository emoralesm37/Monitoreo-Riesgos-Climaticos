using System.Text;
using ClimateGuard.Api.Exceptions;
using ClimateGuard.Infrastructure;
using ClimateGuard.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
using ClimateGuard.Sensor.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using ClimateGuard.Sensor.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);

// Configuración de OpenAPI
builder.Services.AddOpenApi();

// Shared mode is a migration bridge: keep existing sensor IDs, communities,
// rules and alert transactions until ownership of data can be separated.
var sharedDatabase = builder.Configuration.GetValue<bool>("Sensor:UseSharedDatabase");
if (sharedDatabase)
{
    builder.Services.AddInfrastructure(builder.Configuration);
    builder.Services.AddControllers();
    builder.Services.AddProblemDetails();
    builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

    var key = builder.Configuration["Jwt:Key"]
        ?? throw new InvalidOperationException("Falta Jwt:Key.");
    var issuer = builder.Configuration["Jwt:Issuer"]
        ?? throw new InvalidOperationException("Falta Jwt:Issuer.");
    var audience = builder.Configuration["Jwt:Audience"]
        ?? throw new InvalidOperationException("Falta Jwt:Audience.");

    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.MapInboundClaims = false;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true, ValidIssuer = issuer,
                ValidateAudience = true, ValidAudience = audience,
                ValidateLifetime = true, RequireExpirationTime = true,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
                ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                ClockSkew = TimeSpan.Zero,
                NameClaimType = "name", RoleClaimType = "role"
            };
        });
    builder.Services.AddAuthorization(options =>
        options.FallbackPolicy = new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser().Build());
}

// Configuración de SQL Server (modo independiente original)
if (!sharedDatabase)
{
var connectionString = builder.Configuration
    .GetConnectionString("SensorDatabase");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "No se encontró la conexión SensorDatabase.");
}

builder.Services.AddDbContext<SensorDbContext>(options =>
    options.UseSqlServer(connectionString));

}

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// TLS terminates at Nginx. The service binds to loopback in production.
if (sharedDatabase)
{
    app.UseExceptionHandler();
    app.UseAuthentication();
    app.UseAuthorization();
}

// Verificación del funcionamiento de la API
app.MapGet("/health", () =>
{
    return Results.Ok(new
    {
        service = "ClimateGuard.Sensor",
        status = "Healthy"
    });
}).AllowAnonymous();


if (sharedDatabase)
{
    app.MapGet("/health/database", async (AppDbContext db, CancellationToken ct) =>
    {
        try
        {
            return await db.Database.CanConnectAsync(ct)
                ? (IResult)Results.Ok(new { service = "ClimateGuard.Sensor", status = "Connected", mode = "shared-database" })
                : Results.StatusCode(503);
        }
        catch { return Results.StatusCode(503); }
    }).AllowAnonymous();
    app.MapControllers();
}
else
{
    app.MapGet("/health/database", async (SensorDbContext db) =>
    {
        try
        {
            return await db.Database.CanConnectAsync()
                ? (IResult)Results.Ok(new { service = "ClimateGuard.Sensor", database = "ClimateGuardSensorDb", status = "Connected" })
                : Results.StatusCode(503);
        }
        catch { return Results.StatusCode(503); }
    });
    app.MapSensorEndpoints();
}
app.Run();
public partial class Program { }
