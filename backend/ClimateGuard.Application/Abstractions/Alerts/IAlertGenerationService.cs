namespace ClimateGuard.Application.Abstractions.Alerts;

public interface IAlertGenerationService
{
    Task<int> GenerateAsync(
        int sensorId,
        decimal triggerValue,
        IReadOnlyList<int> violatedRuleIds,
        CancellationToken cancellationToken = default);
}