namespace ClimateGuard.Domain.Entities;

public sealed class SensorReading
{
    public long SensorReadingId { get; set; }

    public int SensorId { get; set; }

    public decimal Value { get; set; }

    public DateTime Timestamp { get; set; }

    public Sensor Sensor { get; set; } = null!;
}