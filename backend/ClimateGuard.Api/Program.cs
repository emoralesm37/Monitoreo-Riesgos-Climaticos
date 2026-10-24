using ClimateGuard.Api.Exceptions;
using ClimateGuard.Infrastructure;
using ClimateGuard.Infrastructure.Persistence.Initialization;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using ClimateGuard.Api.OpenApi;

var builder = WebApplication.CreateBuilder(args);

const string frontendCorsPolicy = "FrontendPolicy";

var allowedOrigins =
    builder.Configuration
        .GetSection("Cors:AllowedOrigins")
        .Get<string[]>()
    ?? ["http://localhost:4200"];

// Servicios de ASP.NET Core
builder.Services.AddControllers();

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

            ValidateLifetime = true,
            RequireExpirationTime = true,

            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtKey)),

            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            ClockSkew = TimeSpan.Zero,

            NameClaimType = "name",
            RoleClaimType = "role"
        };
    });

// OpenAPI, salud y errores
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer<
        BearerSecuritySchemeTransformer>();
});

builder.Services.AddHealthChecks();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

// CORS para Angular
builder.Services.AddCors(options =>
{
    options.AddPolicy(frontendCorsPolicy, policy =>
    {
        policy
            .WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// Infrastructure: AppDbContext y SQL Server
builder.Services.AddInfrastructure(
    builder.Configuration);

// La aplicación se construye después de registrar servicios
var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();

    var initialAdminSeeder =
        scope.ServiceProvider.GetRequiredService<InitialAdminSeeder>();

    await initialAdminSeeder.SeedAsync();
}

// Manejo global de errores
app.UseExceptionHandler();

// OpenAPI y Swagger solo en desarrollo
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();

    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint(
            "/openapi/v1.json",
            "ClimateGuard API v1");

        options.RoutePrefix = "swagger";
    });
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseRouting();

app.UseCors(frontendCorsPolicy);

app.UseAuthentication();

app.UseAuthorization();

app.MapControllers();

app.MapHealthChecks("/health");

app.Run();