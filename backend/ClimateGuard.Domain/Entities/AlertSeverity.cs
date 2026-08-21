namespace ClimateGuard.Domain.Entities;

public sealed class AlertSeverity
{
    public byte AlertSeverityId { get; set; }

    public string Name { get; set; } = string.Empty;

    public byte Level { get; set; }

    public ICollection<Alert> Alerts { get; set; } = new List<Alert>();
}