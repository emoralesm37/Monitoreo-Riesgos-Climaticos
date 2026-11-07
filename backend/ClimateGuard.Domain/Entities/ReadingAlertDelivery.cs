namespace ClimateGuard.Domain.Entities;

// Durable delivery envelope. JWTs are never persisted here.
public sealed class ReadingAlertDelivery
{
    public long SensorReadingId { get; set; }
    public SensorReading Reading { get; set; } = null!;
    public string Payload { get; set; } = "";
    public int Attempts { get; set; }
    public DateTime? DeliveredAt { get; set; }
}
