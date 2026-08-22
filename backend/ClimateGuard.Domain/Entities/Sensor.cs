namespace ClimateGuard.Domain.Entities;

public sealed class Sensor
{
    public int SensorId { get; set; }

    public string Name { get; set; } = string.Empty;

    public byte SensorTypeId { get; set; }

    public int CommunityId { get; set; }

    public bool IsActive { get; set; }

    public decimal? LastValue { get; set; }

    public DateTime? LastUpdatedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public SensorType SensorType { get; set; } = null!;

    public Community Community { get; set; } = null!;

    public ICollection<SensorReading> Readings { get; set; } =
        new List<SensorReading>();

    public ICollection<Alert> Alerts { get; set; } =
        new List<Alert>();
}