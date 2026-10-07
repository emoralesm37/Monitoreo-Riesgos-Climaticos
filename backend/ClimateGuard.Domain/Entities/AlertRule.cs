namespace ClimateGuard.Domain.Entities;

public sealed class AlertRule
{
    public int AlertRuleId { get; set; }

    public string Name { get; set; } = string.Empty;

    public byte SensorTypeId { get; set; }

    public decimal MinimumValue { get; set; }

    public decimal MaximumValue { get; set; }

    public byte AlertSeverityId { get; set; }

    public byte PhenomenonTypeId { get; set; }

    public string Message { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public SensorType SensorType { get; set; } = null!;

    public AlertSeverity AlertSeverity { get; set; } = null!;

    public PhenomenonType PhenomenonType { get; set; } = null!;
}
