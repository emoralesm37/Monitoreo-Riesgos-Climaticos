namespace ClimateGuard.Domain.Entities;

public sealed class Community
{
    public int CommunityId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Municipality { get; set; } = string.Empty;

    public string Department { get; set; } = string.Empty;

    public string Country { get; set; } = string.Empty;

    public decimal? Latitude { get; set; }

    public decimal? Longitude { get; set; }

    public string? Description { get; set; }

    public bool IsActive { get; set; }

    public ICollection<Sensor> Sensors { get; set; } =
        new List<Sensor>();
}