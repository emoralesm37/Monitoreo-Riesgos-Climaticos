
namespace ClimateGuard.Application.Abstractions.Alerts;

public interface IAlertEvaluationService
{
    Task<IReadOnlyList<int>> EvaluateAsync(
        byte sensorTypeId,
        decimal value,
        CancellationToken cancellationToken = default);
}
