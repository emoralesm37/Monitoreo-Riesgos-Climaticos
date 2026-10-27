using System.Diagnostics;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

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
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? ["http://localhost:4200"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.GlobalLimiter =
        PartitionedRateLimiter.Create<HttpContext, string>(context =>
        {
            if (context.Request.Path == "/health")
            {
                return RateLimitPartition.GetNoLimiter("health");
            }

            var isAuth = context.Request.Path
                .StartsWithSegments("/api/auth");

            var ip = context.Connection.RemoteIpAddress?.ToString()
                ?? "unknown";

            return RateLimitPartition.GetFixedWindowLimiter(
                $"{ip}:{(isAuth ? "auth" : "api")}",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = isAuth ? 20 : 120,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    AutoReplenishment = true
                });
        });

    options.OnRejected = async (context, cancellationToken) =>
    {
        await context.HttpContext.Response.WriteAsJsonAsync(
            new
            {
                title = "Demasiadas solicitudes",
                status = 429,
                detail = "Espera un minuto e intenta nuevamente."
            },
            cancellationToken: cancellationToken);
    };
});

builder.Services.AddProblemDetails();

builder.Services
    .AddReverseProxy()
    .LoadFromConfig(
        builder.Configuration.GetSection("ReverseProxy"));

builder.Services.AddHealthChecks();

var app = builder.Build();

// Registra método, ruta, estado y duración. No registra tokens ni cuerpos.
app.Use(async (context, next) =>
{
    var timer = Stopwatch.StartNew();

    try
    {
        await next(context);
    }
    finally
    {
        app.Logger.LogInformation(
            "{Method} {Path} -> {StatusCode} en {ElapsedMs} ms; TraceId={TraceId}",
            context.Request.Method,
            context.Request.Path,
            context.Response.StatusCode,
            timer.ElapsedMilliseconds,
            context.TraceIdentifier);
    }
});

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        await Results.Problem(
            statusCode: StatusCodes.Status500InternalServerError,
            title: "Error interno del Gateway",
            detail: "No se pudo procesar la solicitud.",
            extensions: new Dictionary<string, object?>
            {
                ["traceId"] = context.TraceIdentifier
            }).ExecuteAsync(context);
    });
});

// Agrega una respuesta JSON cuando el error no contiene cuerpo.
app.UseStatusCodePages(async statusContext =>
{
    var context = statusContext.HttpContext;
    var status = context.Response.StatusCode;

    await Results.Problem(
        statusCode: status,
        title: status switch
        {
            401 => "Autenticación requerida",
            403 => "Acceso denegado",
            404 => "Ruta no encontrada",
            502 => "No se pudo contactar con el servicio",
            503 => "Servicio no disponible",
            504 => "El servicio tardó demasiado en responder",
            _ => "Error al procesar la solicitud"
        },
        extensions: new Dictionary<string, object?>
        {
            ["traceId"] = context.TraceIdentifier
        }).ExecuteAsync(context);
});

app.UseRouting();
app.UseCors("Frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapGet(
        "/gateway/session",
        (System.Security.Claims.ClaimsPrincipal user) =>
            Results.Ok(new
            {
                name = user.Identity?.Name,
                role = user.FindFirst("role")?.Value
            }))
        .RequireAuthorization();
}

app.MapHealthChecks("/health")
    .AllowAnonymous();

app.MapReverseProxy();

app.Run();