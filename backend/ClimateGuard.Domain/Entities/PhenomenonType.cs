namespace ClimateGuard.Domain.Entities;

public sealed class PhenomenonType
{
    public byte PhenomenonTypeId { get; set; }

    public string Name { get; set; } = string.Empty;

    public ICollection<Alert> Alerts { get; set; } = new List<Alert>();
}