using ClimateGuard.Application.Abstractions.Catalogs;
using ClimateGuard.Application.Contracts.Catalogs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

namespace ClimateGuard.Api.Controllers;

[ApiController]
[Authorize]
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

    [HttpGet("alert-severities")]
    public async Task<ActionResult<IReadOnlyList<AlertSeverityDto>>> GetAlertSeverities(
        CancellationToken cancellationToken)
    {
        var severities =
            await catalogService.GetAlertSeveritiesAsync(cancellationToken);

        return Ok(severities);
    }
}