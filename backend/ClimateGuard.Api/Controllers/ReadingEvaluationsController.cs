using ClimateGuard.Infrastructure.Persistence;
using ClimateGuard.Infrastructure.Services.Alerts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClimateGuard.Api.Controllers;

[ApiController]
[Authorize(Roles = "Administrador,Operador")]
[Route("api/sensors/{sensorId:int}/readings")]
public sealed class ReadingEvaluationsController(AppDbContext db, ReadingAlertDispatcher dispatcher) : ControllerBase
{
    [HttpPost("{readingId:long}/evaluate")]
    public async Task<IActionResult> Retry(int sensorId, long readingId, CancellationToken ct)
    {
        if (!await db.SensorReadings.AnyAsync(x => x.SensorId == sensorId && x.SensorReadingId == readingId, ct))
            return NotFound();
        if (!await db.ReadingAlertDeliveries.AnyAsync(x => x.SensorReadingId == readingId, ct))
            return Conflict(new { message = "Esta lectura anterior no tiene un sobre de evaluación persistido." });
        var delivered = await dispatcher.DeliverAsync(readingId, ct);
        return Ok(new { sensorReadingId = readingId, alertEvaluationPending = !delivered });
    }

    [HttpGet("evaluation-status")]
    public async Task<IActionResult> Status(int sensorId, CancellationToken ct) => Ok(await db.ReadingAlertDeliveries
        .Where(x => x.Reading.SensorId == sensorId).Select(x => new { x.SensorReadingId, x.Attempts,
            AlertEvaluationPending = x.DeliveredAt == null }).ToListAsync(ct));
}
