using ClimateGuard.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClimateGuard.Api.Controllers;

// Separate export contract: the existing latest-readings list stays unchanged.
[ApiController]
[Authorize(Roles = "Administrador")]
[Route("api/sensors/{sensorId:int}/readings/report")]
public sealed class ReadingReportsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(int sensorId, long afterId = 0,
        long? snapshotId = null, int pageSize = 500, DateTimeOffset? startDate = null,
        DateTimeOffset? endDate = null, CancellationToken ct = default)
    {
        if (sensorId <= 0 || afterId < 0 || snapshotId < 0 || pageSize is < 1 or > 500 ||
            (startDate.HasValue && endDate.HasValue && startDate > endDate))
            return BadRequest(new { message = "Filtros de exportación inválidos." });
        if (!await db.Sensors.AnyAsync(x => x.SensorId == sensorId, ct)) return NotFound();
        var query = db.SensorReadings.AsNoTracking().Where(x => x.SensorId == sensorId);
        var upper = snapshotId ?? (await query.MaxAsync(x => (long?)x.SensorReadingId, ct) ?? 0);
        query = query.Where(x => x.SensorReadingId > afterId && x.SensorReadingId <= upper);
        if (startDate.HasValue) { var start = startDate.Value.UtcDateTime; query = query.Where(x => x.Timestamp >= start); }
        if (endDate.HasValue) { var end = endDate.Value.UtcDateTime; query = query.Where(x => x.Timestamp <= end); }
        var rows = await query.OrderBy(x => x.SensorReadingId).Take(pageSize + 1)
            .Select(x => new { x.SensorReadingId, x.SensorId, x.Value, x.Timestamp,
                EvaluationRecorded = db.ReadingAlertDeliveries.Any(d => d.SensorReadingId == x.SensorReadingId),
                EvaluationDelivered = db.ReadingAlertDeliveries.Any(d => d.SensorReadingId == x.SensorReadingId && d.DeliveredAt != null) })
            .ToListAsync(ct);
        var page = rows.Take(pageSize).Select(x => new { x.SensorReadingId, x.SensorId, x.Value,
            Timestamp = DateTime.SpecifyKind(x.Timestamp, DateTimeKind.Utc),
            x.EvaluationRecorded, x.EvaluationDelivered }).ToList();
        return Ok(new { readings = page, snapshotId = upper, hasMore = rows.Count > pageSize,
            nextAfterId = page.Count > 0 ? page[^1].SensorReadingId : afterId });
    }
}
