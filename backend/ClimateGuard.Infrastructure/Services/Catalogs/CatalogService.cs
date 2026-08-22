using ClimateGuard.Application.Abstractions.Catalogs;
using ClimateGuard.Application.Contracts.Catalogs;
using ClimateGuard.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ClimateGuard.Infrastructure.Services.Catalogs;

public sealed class CatalogService(AppDbContext dbContext)
    : ICatalogService
{
    public async Task<IReadOnlyList<SensorTypeDto>> GetSensorTypesAsync(
        CancellationToken cancellationToken = default)
    {
        return await dbContext.SensorTypes
            .AsNoTracking()
            .OrderBy(sensorType => sensorType.SensorTypeId)
            .Select(sensorType => new SensorTypeDto(
                sensorType.SensorTypeId,
                sensorType.Code,
                sensorType.Unit))
            .ToListAsync(cancellationToken);
    }
}
