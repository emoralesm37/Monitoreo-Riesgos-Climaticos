using ClimateGuard.Application.Contracts.Catalogs;

namespace ClimateGuard.Application.Abstractions.Catalogs;

public interface ICatalogService
{
    Task<IReadOnlyList<SensorTypeDto>> GetSensorTypesAsync(
        CancellationToken cancellationToken = default);
}