using System.Text;
using ClimateGuard.Community.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ClimateGuard.Community.Application.Abstractions.Communities;
using ClimateGuard.Community.Infrastructure.Services.Communities;
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
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

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

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