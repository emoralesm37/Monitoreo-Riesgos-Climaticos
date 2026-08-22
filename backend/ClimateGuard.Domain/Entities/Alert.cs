namespace ClimateGuard.Domain.Entities;

public sealed class Alert
{
    public long AlertId { get; set; }

    public int? SensorId { get; set; }

    public byte AlertSeverityId { get; set; }

    public byte? PhenomenonTypeId { get; set; }

    public decimal? TriggerValue { get; set; }

    public string Message { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public DateTime? ResolvedAt { get; set; }

    public int? ResolvedByUserId { get; set; }

    public Sensor? Sensor { get; set; }

    public AlertSeverity AlertSeverity { get; set; } = null!;

    public PhenomenonType? PhenomenonType { get; set; }

    public User? ResolvedByUser { get; set; }
}