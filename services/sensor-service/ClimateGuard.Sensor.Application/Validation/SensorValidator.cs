namespace ClimateGuard.Sensor.Application.Validation;

public static class SensorValidator
{
    public static bool IsValidName(string? name)
    {
        return !string.IsNullOrWhiteSpace(name)
            && name.Trim().Length <= 100;
    }
}
