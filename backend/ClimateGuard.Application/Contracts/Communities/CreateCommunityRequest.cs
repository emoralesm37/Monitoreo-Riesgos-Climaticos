using System.ComponentModel.DataAnnotations;

namespace ClimateGuard.Application.Contracts.Communities;

public sealed record CreateCommunityRequest(
    [Required(ErrorMessage = "El nombre es obligatorio.")]
    [StringLength(
        120,
        MinimumLength = 3,
        ErrorMessage = "El nombre debe contener entre 3 y 120 caracteres.")]
    string Name,

    [Required(ErrorMessage = "El municipio es obligatorio.")]
    [StringLength(120)]
    string Municipality,

    [Required(ErrorMessage = "El departamento es obligatorio.")]
    [StringLength(120)]
    string Department,

    [Required(ErrorMessage = "El país es obligatorio.")]
    [StringLength(100)]
    string Country,

    [Range(-90, 90, ErrorMessage = "La latitud debe estar entre -90 y 90.")]
    decimal? Latitude,

    [Range(-180, 180, ErrorMessage = "La longitud debe estar entre -180 y 180.")]
    decimal? Longitude,

    [StringLength(
        500,
        ErrorMessage = "La descripción no puede superar 500 caracteres.")]
    string? Description
);