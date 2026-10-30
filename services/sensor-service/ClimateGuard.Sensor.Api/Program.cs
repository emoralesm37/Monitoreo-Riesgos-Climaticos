using ClimateGuard.Sensor.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using ClimateGuard.Sensor.Api.Endpoints;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Configuración de OpenAPI
builder.Services.AddOpenApi();

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
    }).AllowAnonymous();
    app.MapSensorEndpoints();
app.Run();
public partial class Program { }
