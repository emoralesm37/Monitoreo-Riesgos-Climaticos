
namespace ClimateGuard.Sensor.Domain.Entities;

public sealed class Sensor
{
    public int SensorId { get; set; }

    public string Name { get; set; } = string.Empty;

    public byte SensorTypeId { get; set; }

    // Referencia lógica al Community Service.
    // No representa una clave foránea entre bases de datos.
    public int CommunityId { get; set; }

    public bool IsActive { get; set; }

    public decimal? LastValue { get; set; }

    public DateTime? LastUpdatedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public SensorType SensorType { get; set; } = null!;

    public ICollection<SensorReading> Readings { get; set; } =
        new List<SensorReading>();
}
