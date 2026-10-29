
using System.Net;
using System.Net.Http.Json;

namespace ClimateGuard.Sensor.Tests.Integration;

public class SensorHealthTests
{
    [Fact]
    public async Task Health_ReturnsHealthyStatus()
    {
        using var factory = new SensorWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<HealthResponse>();

        Assert.NotNull(result);
        Assert.Equal("ClimateGuard.Sensor", result.Service);
        Assert.Equal("Healthy", result.Status);
    }

    private sealed record HealthResponse(
        string Service,
        string Status
    );
}
