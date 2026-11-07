using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using ClimateGuard.Domain.Entities;
using ClimateGuard.Infrastructure.Persistence;
using ClimateGuard.Infrastructure.Services.Alerts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;

namespace ClimateGuard.Api.Controllers;

public sealed record BindDeviceRequest([Required,RegularExpression(@"^[A-Za-z0-9_.:-]{1,64}$")] string DeviceId, Guid OwnerUserId);
public sealed record IngestReadingRequest(
    [Required,RegularExpression(@"^[A-Za-z0-9_.:-]{1,64}$")] string DeviceId,
    [Required,RegularExpression(@"^[A-Za-z0-9_.:-]{1,128}$")] string MeasurementId,
    [property:System.Text.Json.Serialization.JsonRequired] decimal Value,
    [property:System.Text.Json.Serialization.JsonRequired] DateTimeOffset CapturedAt,
    [Required,MaxLength(32)] string Unit);

[ApiController,Authorize,Route("api/sensors/{sensorId:int}")]
public sealed class PhysicalReadingsController(AppDbContext db, ReadingAlertDispatcher dispatcher) : ControllerBase
{
    [HttpPost("devices"),Authorize(Roles="Administrador")]
    public async Task<IActionResult> Bind(int sensorId, BindDeviceRequest body, CancellationToken ct)
    {
        if(body.OwnerUserId==Guid.Empty)return BadRequest(new {message="OwnerUserId requerido."});
        if(!await db.Sensors.AnyAsync(s=>s.SensorId==sensorId,ct))return NotFound();
        var existing=await db.SensorDevices.FindAsync([body.DeviceId],ct);
        if(existing is not null)return existing.SensorId==sensorId && existing.OwnerUserId==body.OwnerUserId
            ? Ok(new {deviceId=existing.DeviceId,sensorId=existing.SensorId,isActive=existing.IsActive}) : Conflict(new {message="Dispositivo ya vinculado."});
        db.SensorDevices.Add(new(){DeviceId=body.DeviceId,SensorId=sensorId,OwnerUserId=body.OwnerUserId});
        await db.SaveChangesAsync(ct);
        return StatusCode(201,new {deviceId=body.DeviceId,sensorId,isActive=true});
    }

    [HttpPost("readings/ingest"),Authorize(Roles="Administrador,Operador")]
    public async Task<IActionResult> Ingest(int sensorId, IngestReadingRequest body, CancellationToken ct)
    {
        if(!Guid.TryParse(User.FindFirst("sub")?.Value,out var actor))return Forbid();
        var device=await db.SensorDevices.AsNoTracking().SingleOrDefaultAsync(d=>d.DeviceId==body.DeviceId,ct);
        if(device is null || !device.IsActive || device.SensorId!=sensorId || device.OwnerUserId!=actor)return Forbid();
        if(body.CapturedAt==default || body.CapturedAt>DateTimeOffset.UtcNow.AddMinutes(5) || body.CapturedAt<DateTimeOffset.UtcNow.AddDays(-7)
            || body.Value!=decimal.Round(body.Value,2) || body.Value < -99999999.99m || body.Value > 99999999.99m)
            return BadRequest(new {message="Medición fuera de rango temporal/precisión permitidos (7 días, 2 decimales)."});
        var sensor=await db.Sensors.Include(s=>s.SensorType).SingleOrDefaultAsync(s=>s.SensorId==sensorId,ct);
        if(sensor is null)return NotFound();
        if(!sensor.IsActive)return Conflict(new {message="Sensor inactivo."});
        if(!string.Equals(body.Unit,sensor.SensorType.Unit,StringComparison.Ordinal))return BadRequest(new {message="Unidad incompatible con el sensor."});
        var text=$"{sensorId}|{body.Value.ToString("G29",CultureInfo.InvariantCulture)}|{body.CapturedAt.UtcDateTime:O}|{body.Unit}";
        var fingerprint=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
        var receipt=await db.PhysicalMeasurements.AsNoTracking().SingleOrDefaultAsync(x=>x.DeviceId==body.DeviceId && x.MeasurementId==body.MeasurementId,ct);
        if(receipt is not null)return await Replay(receipt,fingerprint,ct);
        var reading=new SensorReading {SensorId=sensorId,Value=body.Value,Timestamp=body.CapturedAt.UtcDateTime};
        db.SensorReadings.Add(reading);
        db.PhysicalMeasurements.Add(new(){DeviceId=body.DeviceId,MeasurementId=body.MeasurementId,Fingerprint=fingerprint,Reading=reading});
        if(sensor.LastUpdatedAt is null || reading.Timestamp>=sensor.LastUpdatedAt){sensor.LastValue=body.Value;sensor.LastUpdatedAt=reading.Timestamp;}
        sensor.UpdatedAt=DateTime.UtcNow;
        try
        {
            var delivered=await dispatcher.SaveAndDispatchAsync(reading,ct);
            return StatusCode(201,new {reading.SensorReadingId,sensorId,duplicate=false,alertEvaluationPending=!delivered});
        }
        catch(DbUpdateException e) when (e.InnerException is SqlException {Number:2601 or 2627})
        {
            db.ChangeTracker.Clear();
            receipt=await db.PhysicalMeasurements.AsNoTracking().SingleOrDefaultAsync(x=>x.DeviceId==body.DeviceId && x.MeasurementId==body.MeasurementId,ct);
            if(receipt is null)throw;
            return await Replay(receipt,fingerprint,ct);
        }
    }
    private async Task<IActionResult> Replay(PhysicalMeasurement receipt,string fingerprint,CancellationToken ct)
    {
        if(receipt.Fingerprint!=fingerprint)return Conflict(new {message="MeasurementId reutilizado con otro contenido."});
        var delivered=await dispatcher.DeliverAsync(receipt.SensorReadingId,ct);
        return Ok(new {receipt.SensorReadingId,duplicate=true,alertEvaluationPending=!delivered});
    }
}
