using ClimateGuard.Application.Abstractions.Sensors;
using ClimateGuard.Application.Contracts.Sensors;
using Microsoft.AspNetCore.Mvc;

namespace ClimateGuard.Api.Controllers;

[ApiController]
[Route("api/sensors")]
public sealed class SensorsController(
    ISensorService sensorService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SensorDto>>>
        GetAll(CancellationToken cancellationToken)
    {
        var sensors = await sensorService.GetAllAsync(
            cancellationToken);

        return Ok(sensors);
    }

    [HttpGet("{sensorId:int}")]
    public async Task<ActionResult<SensorDto>> GetById(
        int sensorId,
        CancellationToken cancellationToken)
    {
        var sensor = await sensorService.GetByIdAsync(
            sensorId,
            cancellationToken);

        return sensor is null
            ? NotFound()
            : Ok(sensor);
    }

    [HttpPost]
    public async Task<ActionResult<SensorDto>> Create(
        CreateSensorRequest request,
        CancellationToken cancellationToken)
    {
        var sensor = await sensorService.CreateAsync(
            request,
            cancellationToken);

        return CreatedAtAction(
            nameof(GetById),
            new { sensorId = sensor.SensorId },
            sensor);
    }

    [HttpPut("{sensorId:int}")]
    public async Task<IActionResult> Update(
        int sensorId,
        UpdateSensorRequest request,
        CancellationToken cancellationToken)
    {
        var updated = await sensorService.UpdateAsync(
            sensorId,
            request,
            cancellationToken);

        return updated
            ? NoContent()
            : NotFound();
    }

    [HttpPatch("{sensorId:int}/status")]
    public async Task<IActionResult> ChangeStatus(
        int sensorId,
        ChangeSensorStatusRequest request,
        CancellationToken cancellationToken)
    {
        var updated = await sensorService.ChangeStatusAsync(
            sensorId,
            request.IsActive,
            cancellationToken);

        return updated
            ? NoContent()
            : NotFound();
    }

    [HttpGet("{sensorId:int}/readings")]
    public async Task<ActionResult<IReadOnlyList<SensorReadingDto>>>
        GetReadings(
            int sensorId,
            [FromQuery] int limit = 100,
            CancellationToken cancellationToken = default)
    {
        var readings = await sensorService.GetReadingsAsync(
            sensorId,
            limit,
            cancellationToken);

        return Ok(readings);
    }

    [HttpPost("{sensorId:int}/readings/manual")]
    public async Task<ActionResult<SensorReadingDto>>
        RegisterManualValue(
            int sensorId,
            ManualSensorValueRequest request,
            CancellationToken cancellationToken)
    {
        var reading =
            await sensorService.RegisterManualValueAsync(
                sensorId,
                request,
                cancellationToken);

        return reading is null
            ? NotFound()
            : Ok(reading);
    }

    [HttpPost("{sensorId:int}/reset")]
    public async Task<IActionResult> Reset(
        int sensorId,
        CancellationToken cancellationToken)
    {
        var reset = await sensorService.ResetAsync(
            sensorId,
            cancellationToken);

        return reset
            ? NoContent()
            : NotFound();
    }
}