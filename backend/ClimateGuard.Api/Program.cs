using ClimateGuard.Api.Exceptions;
using ClimateGuard.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

const string frontendCorsPolicy = "FrontendPolicy";

var allowedOrigins =
    builder.Configuration
        .GetSection("Cors:AllowedOrigins")
        .Get<string[]>()
    ?? ["http://localhost:4200"];

// Servicios de ASP.NET Core
builder.Services.AddControllers();
builder.Services.AddAuthorization();

// OpenAPI, salud y errores
builder.Services.AddOpenApi();
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

app.UseHttpsRedirection();

app.UseRouting();

app.UseCors(frontendCorsPolicy);

app.UseAuthorization();

app.MapControllers();

app.MapHealthChecks("/health");

app.Run();