using ClimateGuard.Application.Abstractions.Sensors;
using ClimateGuard.Application.Contracts.Sensors;
using ClimateGuard.Domain.Entities;
using ClimateGuard.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ClimateGuard.Infrastructure.Services.Sensors;

public sealed class SensorService(
    AppDbContext dbContext) : ISensorService
{
    public async Task<IReadOnlyList<SensorDto>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        return await dbContext.Sensors
            .AsNoTracking()
            .OrderBy(sensor => sensor.Name)
            .Select(sensor => new SensorDto(
                sensor.SensorId,
                sensor.Name,
                sensor.SensorTypeId,
                sensor.SensorType.Code,
                sensor.SensorType.Unit,
                sensor.CommunityId,
                sensor.Community.Name,
                sensor.IsActive,
                sensor.LastValue,
                sensor.LastUpdatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<SensorDto?> GetByIdAsync(
        int sensorId,
        CancellationToken cancellationToken = default)
    {
        return await dbContext.Sensors
            .AsNoTracking()
            .Where(sensor => sensor.SensorId == sensorId)
            .Select(sensor => new SensorDto(
                sensor.SensorId,
                sensor.Name,
                sensor.SensorTypeId,
                sensor.SensorType.Code,
                sensor.SensorType.Unit,
                sensor.CommunityId,
                sensor.Community.Name,
                sensor.IsActive,
                sensor.LastValue,
                sensor.LastUpdatedAt))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<SensorDto> CreateAsync(
        CreateSensorRequest request,
        CancellationToken cancellationToken = default)
    {
        await ValidateReferencesAsync(
            request.SensorTypeId,
            request.CommunityId,
            cancellationToken);

        var sensor = new Sensor
        {
            Name = request.Name.Trim(),
            SensorTypeId = request.SensorTypeId,
            CommunityId = request.CommunityId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Sensors.Add(sensor);

        await dbContext.SaveChangesAsync(cancellationToken);

        return (await GetByIdAsync(
            sensor.SensorId,
            cancellationToken))!;
    }

    public async Task<bool> UpdateAsync(
        int sensorId,
        UpdateSensorRequest request,
        CancellationToken cancellationToken = default)
    {
        var sensor = await dbContext.Sensors
            .FirstOrDefaultAsync(
                item => item.SensorId == sensorId,
                cancellationToken);

        if (sensor is null)
        {
            return false;
        }

        await ValidateReferencesAsync(
            request.SensorTypeId,
            request.CommunityId,
            cancellationToken);

        sensor.Name = request.Name.Trim();
        sensor.SensorTypeId = request.SensorTypeId;
        sensor.CommunityId = request.CommunityId;
        sensor.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }

    public async Task<bool> ChangeStatusAsync(
        int sensorId,
        bool isActive,
        CancellationToken cancellationToken = default)
    {
        var sensor = await dbContext.Sensors
            .FirstOrDefaultAsync(
                item => item.SensorId == sensorId,
                cancellationToken);

        if (sensor is null)
        {
            return false;
        }

        sensor.IsActive = isActive;
        sensor.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }

    public async Task<IReadOnlyList<SensorReadingDto>>
        GetReadingsAsync(
            int sensorId,
            int limit = 100,
            CancellationToken cancellationToken = default)
    {
        limit = Math.Clamp(limit, 1, 500);

        return await dbContext.SensorReadings
            .AsNoTracking()
            .Where(reading => reading.SensorId == sensorId)
            .OrderByDescending(reading => reading.Timestamp)
            .Take(limit)
            .Select(reading => new SensorReadingDto(
                reading.SensorReadingId,
                reading.SensorId,
                reading.Value,
                reading.Timestamp))
            .ToListAsync(cancellationToken);
    }

    public async Task<SensorReadingDto?>
        RegisterManualValueAsync(
            int sensorId,
            ManualSensorValueRequest request,
            CancellationToken cancellationToken = default)
    {
        var sensor = await dbContext.Sensors
            .FirstOrDefaultAsync(
                item => item.SensorId == sensorId,
                cancellationToken);

        if (sensor is null)
        {
            return null;
        }

        var timestamp = DateTime.UtcNow;

        var reading = new SensorReading
        {
            SensorId = sensorId,
            Value = request.Value,
            Timestamp = timestamp
        };

        sensor.LastValue = request.Value;
        sensor.LastUpdatedAt = timestamp;
        sensor.UpdatedAt = timestamp;

        dbContext.SensorReadings.Add(reading);

        await dbContext.SaveChangesAsync(cancellationToken);

        return new SensorReadingDto(
            reading.SensorReadingId,
            reading.SensorId,
            reading.Value,
            reading.Timestamp);
    }

    public async Task<bool> ResetAsync(
        int sensorId,
        CancellationToken cancellationToken = default)
    {
        var sensor = await dbContext.Sensors
            .FirstOrDefaultAsync(
                item => item.SensorId == sensorId,
                cancellationToken);

        if (sensor is null)
        {
            return false;
        }

        sensor.LastValue = null;
        sensor.LastUpdatedAt = null;
        sensor.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }

    private IQueryable<SensorDto> SensorQuery()
    {
        return dbContext.Sensors
            .AsNoTracking()
            .Select(sensor => new SensorDto(
                sensor.SensorId,
                sensor.Name,
                sensor.SensorTypeId,
                sensor.SensorType.Code,
                sensor.SensorType.Unit,
                sensor.CommunityId,
                sensor.Community.Name,
                sensor.IsActive,
                sensor.LastValue,
                sensor.LastUpdatedAt));
    }

    private async Task ValidateReferencesAsync(
        byte sensorTypeId,
        int communityId,
        CancellationToken cancellationToken)
    {
        var sensorTypeExists = await dbContext.SensorTypes
            .AnyAsync(
                type => type.SensorTypeId == sensorTypeId,
                cancellationToken);

        if (!sensorTypeExists)
        {
            throw new ArgumentException(
                "El tipo de sensor indicado no existe.");
        }

        var communityExists = await dbContext.Communities
            .AnyAsync(
                community =>
                    community.CommunityId == communityId,
                cancellationToken);

        if (!communityExists)
        {
            throw new ArgumentException(
                "La comunidad indicada no existe.");
        }
    }
}