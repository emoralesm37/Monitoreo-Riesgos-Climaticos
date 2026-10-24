using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ClimateGuard.Application.Abstractions.Sensors;
using ClimateGuard.Application.Contracts.Sensors;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;

namespace ClimateGuard.Sensor.Tests;

public sealed class CompatibilityTests
{
    private const string Key = "test-only-key-0123456789abcdef0123456789abcdef0123456789abcdef";
    private static WebApplicationFactory<Program> Factory() =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("Sensor:UseSharedDatabase", "true");
            builder.UseSetting("ConnectionStrings:ClimateGuard", "Server=127.0.0.1;Database=unused;User Id=unused;Password=unused;TrustServerCertificate=True");
            builder.UseSetting("Jwt:Key", Key);
            builder.UseSetting("Jwt:Issuer", "test");
            builder.UseSetting("Jwt:Audience", "test");
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<ISensorService>();
                services.AddSingleton<ISensorService>(new FakeSensors());
            });
        });

    private static void SignIn(HttpClient client, string role, bool expired = false)
    {
        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken("test", "test",
            [new Claim("sub", "test"), new Claim("role", role)],
            now.AddMinutes(-10), expired ? now.AddMinutes(-1) : now.AddMinutes(5),
            new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Key)), SecurityAlgorithms.HmacSha256));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", new JwtSecurityTokenHandler().WriteToken(token));
    }

    [Fact]
    public async Task AnonymousSensorRequestIsRejected()
    {
        using var factory = Factory(); using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/sensors")).StatusCode);
    }
    [Fact]
    public async Task HealthIsPublic()
    {
        using var factory = Factory(); using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health")).StatusCode);
    }
    [Fact]
    public async Task ExpiredTokenIsRejected()
    {
        using var factory = Factory(); using var client = factory.CreateClient(); SignIn(client, "Administrador", true);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/sensors")).StatusCode);
    }
    [Fact]
    public async Task ReaderCannotModifySensor()
    {
        using var factory = Factory(); using var client = factory.CreateClient(); SignIn(client, "Consulta");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/sensors/1/reset", new {})).StatusCode);
    }
    [Theory]
    [InlineData("Administrador")]
    [InlineData("Operador")]
    public async Task WriterCanUseExistingStatusAndResetRoutes(string role)
    {
        using var factory = Factory(); using var client = factory.CreateClient(); SignIn(client, role);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PatchAsJsonAsync("/api/sensors/1/status", new { isActive = false })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/api/sensors/1/reset", new {})).StatusCode);
    }
    [Fact]
    public async Task SensorResponseKeepsCommunityAndUnit()
    {
        using var factory = Factory(); using var client = factory.CreateClient(); SignIn(client, "Operador");
        var sensors = await client.GetFromJsonAsync<SensorDto[]>("/api/sensors");
        Assert.Equal("Comunidad", Assert.Single(sensors!).Community);
        Assert.Equal("C", sensors![0].Unit);
    }
    [Fact]
    public async Task ManualAndReadingsRoutesKeepLegacyContract()
    {
        using var factory = Factory(); using var client = factory.CreateClient(); SignIn(client, "Operador");
        var response = await client.PostAsJsonAsync("/api/sensors/1/readings/manual", new { value = 25m });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(25m, (await response.Content.ReadFromJsonAsync<SensorReadingDto>())!.Value);
        Assert.Single((await client.GetFromJsonAsync<SensorReadingDto[]>("/api/sensors/1/readings?limit=10"))!);
    }
    [Fact]
    public async Task CreateValidatesName()
    {
        using var factory = Factory(); using var client = factory.CreateClient(); SignIn(client, "Operador");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/sensors", new { name = "", sensorTypeId = 1, communityId = 1 })).StatusCode);
    }

    private sealed class FakeSensors : ISensorService
    {
        private static SensorDto Sensor => new(1, "Sensor", 1, "TEMP", "C", 1, "Comunidad", true, 25m, null);
        private static SensorReadingDto Reading => new(1, 1, 25m, DateTime.UtcNow);
        public Task<IReadOnlyList<SensorDto>> GetAllAsync(CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<SensorDto>>([Sensor]);
        public Task<SensorDto?> GetByIdAsync(int sensorId, CancellationToken cancellationToken = default) => Task.FromResult<SensorDto?>(Sensor);
        public Task<SensorDto> CreateAsync(CreateSensorRequest request, CancellationToken cancellationToken = default) => Task.FromResult(Sensor);
        public Task<bool> UpdateAsync(int sensorId, UpdateSensorRequest request, CancellationToken cancellationToken = default) => Task.FromResult(true);
        public Task<bool> ChangeStatusAsync(int sensorId, bool isActive, CancellationToken cancellationToken = default) => Task.FromResult(true);
        public Task<IReadOnlyList<SensorReadingDto>> GetReadingsAsync(int sensorId, int limit = 100, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<SensorReadingDto>>([Reading]);
        public Task<SensorReadingDto?> RegisterManualValueAsync(int sensorId, ManualSensorValueRequest request, CancellationToken cancellationToken = default) => Task.FromResult<SensorReadingDto?>(Reading with { Value = request.Value });
        public Task<bool> ResetAsync(int sensorId, CancellationToken cancellationToken = default) => Task.FromResult(true);
    }
}
