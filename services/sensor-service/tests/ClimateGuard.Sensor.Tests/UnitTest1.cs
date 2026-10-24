using ClimateGuard.Sensor.Application.Validation;

namespace ClimateGuard.Sensor.Tests;

public class SensorValidatorTests
{
    [Theory]
    [InlineData("Sensor de temperatura", true)]
    [InlineData("Sensor de humedad", true)]
    [InlineData("", false)]
    [InlineData("   ", false)]
    [InlineData(null, false)]
    public void IsValidName_ReturnsExpectedResult(
        string? name,
        bool expected)
    {
        var result = SensorValidator.IsValidName(name);

        Assert.Equal(expected, result);
    }
}
