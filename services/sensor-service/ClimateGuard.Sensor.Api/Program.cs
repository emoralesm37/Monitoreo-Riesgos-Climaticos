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

// Shared mode preserves existing contracts and alert transactions during migration.
var sharedDatabase = builder.Configuration.GetValue<bool>("Sensor:UseSharedDatabase");
if (sharedDatabase)
{
    builder.Services.AddInfrastructure(builder.Configuration);
    builder.Services.AddControllers();
    builder.Services.AddProblemDetails();
    builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
}

// Configuración JWT compatible con Auth Service y Gateway
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Falta Jwt:Key.");

var jwtIssuer = builder.Configuration["Jwt:Issuer"]
    ?? throw new InvalidOperationException("Falta Jwt:Issuer.");

var jwtAudience = builder.Configuration["Jwt:Audience"]
    ?? throw new InvalidOperationException("Falta Jwt:Audience.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
            RequireExpirationTime = true,
            ClockSkew = TimeSpan.Zero,
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            NameClaimType = "name",
            RoleClaimType = "role"
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy =
        new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .Build();
});

// Configuración de SQL Server
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

// Preserve proxy-terminated TLS in shared mode and HTTPS redirection in standalone mode.
if (sharedDatabase)
{
    app.UseExceptionHandler();
}
else
{
    app.UseHttpsRedirection();
}
app.UseAuthentication();
app.UseAuthorization();

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
    }).AllowAnonymous();
    app.MapSensorEndpoints();
}
app.Run();
public partial class Program { }
