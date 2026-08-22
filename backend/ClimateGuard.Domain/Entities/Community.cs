namespace ClimateGuard.Domain.Entities;

public sealed class Community
{
    public int CommunityId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Region { get; set; }

    public decimal? Latitude { get; set; }

    public decimal? Longitude { get; set; }

    public ICollection<Sensor> Sensors { get; set; } =
        new List<Sensor>();
}