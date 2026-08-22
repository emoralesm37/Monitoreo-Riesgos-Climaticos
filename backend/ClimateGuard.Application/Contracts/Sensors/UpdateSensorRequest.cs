using System.ComponentModel.DataAnnotations;

namespace ClimateGuard.Application.Contracts.Sensors;

public sealed record UpdateSensorRequest(
    [Required]
    [StringLength(100, MinimumLength = 3)]
    string Name,

    [Range(1, byte.MaxValue)]
    byte SensorTypeId,

    [Range(1, int.MaxValue)]
    int CommunityId);