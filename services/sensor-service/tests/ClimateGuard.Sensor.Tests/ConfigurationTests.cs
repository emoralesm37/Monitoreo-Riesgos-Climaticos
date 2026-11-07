using System.Runtime.CompilerServices;
using Microsoft.Extensions.Configuration;

namespace ClimateGuard.Sensor.Tests;

public sealed class ConfigurationTests
{
    private static string ApiDirectory([CallerFilePath] string testFile = "") =>
        Path.GetFullPath(Path.Combine(Path.GetDirectoryName(testFile)!,
            "..", "..", "ClimateGuard.Sensor.Api"));

    private static ConfigurationManager Settings(string environment)
    {
        var configuration = new ConfigurationManager();
        configuration
            .SetBasePath(ApiDirectory())
            .AddJsonFile("appsettings.json")
            .AddJsonFile($"appsettings.{environment}.json", optional: true);
        return configuration;
    }

    [Theory]
    [InlineData("Development", true)]
    [InlineData("Production", false)]
    public void EnvironmentSettingsSelectExpectedDefault(string environment, bool expected)
    {
        using var configuration = Settings(environment);
        Assert.Equal(expected, configuration.GetValue<bool>("Sensor:UseSharedDatabase"));
    }

    [Fact]
    public void EnvironmentProviderCanOverrideDevelopmentDefault()
    {
        // A unique prefix isolates the test from existing process/user settings.
        var prefix = $"ClimateGuardConfigurationTest_{Guid.NewGuid():N}_";
        var variable = prefix + "Sensor__UseSharedDatabase";
        Assert.Null(Environment.GetEnvironmentVariable(variable));
        try
        {
            Environment.SetEnvironmentVariable(variable, "false");
            using var configuration = Settings("Development");
            configuration.AddEnvironmentVariables(prefix);
            Assert.False(configuration.GetValue<bool>("Sensor:UseSharedDatabase"));
        }
        finally
        {
            Environment.SetEnvironmentVariable(variable, null);
        }
    }
}
