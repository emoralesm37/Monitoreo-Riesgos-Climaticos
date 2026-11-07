namespace ClimateGuard.Domain.Entities;

public sealed class SensorDevice
{
    public string DeviceId { get; set; } = "";
    public int SensorId { get; set; }
    public Guid OwnerUserId { get; set; }
    public bool IsActive { get; set; } = true;
}
public sealed class PhysicalMeasurement
{
    public string DeviceId { get; set; } = "";
    public string MeasurementId { get; set; } = "";
    public string Fingerprint { get; set; } = "";
    public long SensorReadingId { get; set; }
    public SensorReading Reading { get; set; } = null!;
}
