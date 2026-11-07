using System.Text;
using ClimateGuard.Community.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ClimateGuard.Community.Application.Abstractions.Communities;
using ClimateGuard.Community.Infrastructure.Services.Communities;
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddHttpClient("SensorDirectory", c => c.Timeout = TimeSpan.FromSeconds(10));
builder.Services.AddScoped<
    ICommunityService,
    CommunityService>();
builder.Services.AddOpenApi();

var connectionString =
    builder.Configuration.GetConnectionString(
        "CommunityDatabase")
    ?? throw new InvalidOperationException(
        "No se configuró ConnectionStrings:CommunityDatabase.");

builder.Services.AddDbContext<CommunityDbContext>(options =>
    options.UseNpgsql(connectionString));

var jwtAccessSecret =
    builder.Configuration["Jwt:AccessSecret"]
    ?? throw new InvalidOperationException(
        "No se configuró Jwt:AccessSecret.");

var jwtIssuer =
    builder.Configuration["Jwt:Issuer"]
    ?? throw new InvalidOperationException(
        "No se configuró Jwt:Issuer.");

var jwtAudience =
    builder.Configuration["Jwt:Audience"]
    ?? throw new InvalidOperationException(
        "No se configuró Jwt:Audience.");

builder.Services
    .AddAuthentication(
        JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;

        options.TokenValidationParameters =
            new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey =
                    new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(
                            jwtAccessSecret)),

                ValidateIssuer = true,
                ValidIssuer = jwtIssuer,

                ValidateAudience = true,
                ValidAudience = jwtAudience,

                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero,

                NameClaimType = "name",
                RoleClaimType = "role"
            };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

if (args.Contains("--migrate-only"))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<CommunityDbContext>().Database.MigrateAsync();
    return;
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapGet("/health/database", async (CommunityDbContext db) =>
{
    try { return await db.Database.CanConnectAsync() ? Results.Ok(new { status="connected" }) : (IResult)Results.StatusCode(503); }
    catch { return Results.StatusCode(503); }
}).AllowAnonymous();

app.MapGet(
    "/health",
    () => Results.Ok(new
    {
        status = "healthy",
        service = "community-service",
        timestamp = DateTimeOffset.UtcNow
    }))
    .AllowAnonymous();

app.Run();
