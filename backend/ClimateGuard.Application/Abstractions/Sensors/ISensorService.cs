using ClimateGuard.Application.Contracts.Sensors;

namespace ClimateGuard.Application.Abstractions.Sensors;

public interface ISensorService
{
    Task<IReadOnlyList<SensorDto>> GetAllAsync(
        CancellationToken cancellationToken = default);

    Task<SensorDto?> GetByIdAsync(
        int sensorId,
        CancellationToken cancellationToken = default);

    Task<SensorDto> CreateAsync(
        CreateSensorRequest request,
        CancellationToken cancellationToken = default);

    Task<bool> UpdateAsync(
        int sensorId,
        UpdateSensorRequest request,
        CancellationToken cancellationToken = default);

    Task<bool> ChangeStatusAsync(
        int sensorId,
        bool isActive,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SensorReadingDto>> GetReadingsAsync(
        int sensorId,
        int limit = 100,
        CancellationToken cancellationToken = default);

    Task<SensorReadingDto?> RegisterManualValueAsync(
        int sensorId,
        ManualSensorValueRequest request,
        CancellationToken cancellationToken = default);

    Task<bool> ResetAsync(
        int sensorId,
        CancellationToken cancellationToken = default);
}