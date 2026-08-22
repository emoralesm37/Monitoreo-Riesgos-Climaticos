namespace ClimateGuard.Domain.Entities;

public sealed class SensorType
{
    public byte SensorTypeId { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Unit { get; set; } = string.Empty;

    public ICollection<Sensor> Sensors { get; set; } = new List<Sensor>();
}