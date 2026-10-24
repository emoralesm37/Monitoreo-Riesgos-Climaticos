
using ClimateGuard.Application.Abstractions.Alerts;
using ClimateGuard.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ClimateGuard.Infrastructure.Services.Alerts;

public sealed class AlertEvaluationService(
    AppDbContext dbContext) : IAlertEvaluationService
{
    public async Task<IReadOnlyList<int>> EvaluateAsync(
        byte sensorTypeId,
        decimal value,
        CancellationToken cancellationToken = default)
    {
        return await dbContext.AlertRules
            .AsNoTracking()
            .Where(rule =>
                rule.IsActive &&
                rule.SensorTypeId == sensorTypeId &&
                (value < rule.MinimumValue ||
                 value > rule.MaximumValue))
            .OrderBy(rule => rule.AlertRuleId)
            .Select(rule => rule.AlertRuleId)
            .ToListAsync(cancellationToken);
    }
}
