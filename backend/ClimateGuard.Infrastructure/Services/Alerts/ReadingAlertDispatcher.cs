using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using ClimateGuard.Domain.Entities;
using ClimateGuard.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ClimateGuard.Infrastructure.Services.Alerts;

public sealed class ReadingAlertDispatcher(AppDbContext db, IHttpClientFactory clients,
    IHttpContextAccessor context, IConfiguration configuration, ILogger<ReadingAlertDispatcher> logger)
{
    public async Task<bool> SaveAndDispatchAsync(SensorReading reading, CancellationToken ct)
    {
        // SQL retry strategy wraps the explicit local transaction, never the HTTP delivery.
        await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            await db.SaveChangesAsync(ct);
            var sensor = await db.Sensors.Where(x => x.SensorId == reading.SensorId)
                .Select(x => new { x.Name, x.SensorTypeId, Type = x.SensorType.Code,
                    x.SensorType.Unit, x.CommunityId, CommunityName = x.Community.Name }).SingleAsync(ct);
            var payload = JsonSerializer.Serialize(new {
                measurementId = $"sqlserver:ClimateGuard:reading:{reading.SensorReadingId}",
                sensorId = reading.SensorId, sensorName = sensor.Name, sensorTypeId = sensor.SensorTypeId,
                readingType = sensor.Type, unit = sensor.Unit, communityId = sensor.CommunityId,
                communityName = sensor.CommunityName, value = reading.Value,
                capturedAt = DateTime.SpecifyKind(reading.Timestamp, DateTimeKind.Utc)
            });
            db.ReadingAlertDeliveries.Add(new() { SensorReadingId = reading.SensorReadingId, Payload = payload });
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        });
        return await DeliverAsync(reading.SensorReadingId, ct);
    }

    public async Task<bool> DeliverAsync(long readingId, CancellationToken ct)
    {
        var envelope = await db.ReadingAlertDeliveries.FindAsync([readingId], ct);
        if (envelope is null) return false;
        var bearer = context.HttpContext?.Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(bearer)) return false;
        envelope.Attempts++;
        try
        {
            using var message = new HttpRequestMessage(HttpMethod.Post,
                configuration["Alerts:GatewayUrl"]?.TrimEnd('/') + "/api/alerts/evaluate");
            message.Headers.Authorization = AuthenticationHeaderValue.Parse(bearer);
            message.Content = new StringContent(envelope.Payload, Encoding.UTF8, "application/json");
            var client = clients.CreateClient("AlertDelivery");
            using var response = await client.SendAsync(message, ct);
            if (response.IsSuccessStatusCode) envelope.DeliveredAt ??= DateTime.UtcNow;
            else logger.LogWarning("Alert delivery pending for reading {ReadingId}: HTTP {Status}", readingId, (int)response.StatusCode);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or InvalidOperationException)
        {
            logger.LogWarning("Alert delivery pending for reading {ReadingId}", readingId);
        }
        // The measurement remains committed even when delivery fails. Retry uses the stored envelope.
        await db.SaveChangesAsync(CancellationToken.None);
        return envelope.DeliveredAt.HasValue;
    }
}
