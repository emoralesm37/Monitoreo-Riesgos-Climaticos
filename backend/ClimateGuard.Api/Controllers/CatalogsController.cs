using ClimateGuard.Application.Abstractions.Catalogs;
using ClimateGuard.Application.Contracts.Catalogs;
using Microsoft.AspNetCore.Mvc;

namespace ClimateGuard.Api.Controllers;

[ApiController]
[Route("api/catalogs")]
public sealed class CatalogsController(
    ICatalogService catalogService) : ControllerBase
{
    [HttpGet("sensor-types")]
    public async Task<ActionResult<IReadOnlyList<SensorTypeDto>>> GetSensorTypes(
        CancellationToken cancellationToken)
    {
        var sensorTypes =
            await catalogService.GetSensorTypesAsync(cancellationToken);

        return Ok(sensorTypes);
    }
}