using System.ComponentModel.DataAnnotations;

namespace ClimateGuard.Application.Contracts.Sensors;

public sealed record CreateSensorRequest(
    [property: Required(ErrorMessage = "El nombre es obligatorio.")]
    [property: StringLength(
        100,
        MinimumLength = 3,
        ErrorMessage = "El nombre debe tener entre 3 y 100 caracteres.")]
    string Name,

    [property: Range(
        1,
        byte.MaxValue,
        ErrorMessage = "El tipo de sensor es obligatorio.")]
    byte SensorTypeId,

    [property: Range(
        1,
        int.MaxValue,
        ErrorMessage = "La comunidad es obligatoria.")]
    int CommunityId);