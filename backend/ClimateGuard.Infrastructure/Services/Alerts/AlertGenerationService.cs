
using ClimateGuard.Application.Abstractions.Alerts;
using ClimateGuard.Domain.Entities;
using ClimateGuard.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ClimateGuard.Infrastructure.Services.Alerts;

public sealed class AlertGenerationService(
    AppDbContext dbContext) : IAlertGenerationService
{
    public async Task<int> GenerateAsync(
        int sensorId,
        decimal triggerValue,
        IReadOnlyList<int> violatedRuleIds,
        CancellationToken cancellationToken = default)
    {
        if (violatedRuleIds.Count == 0)
        {
            return 0;
        }

        var rules = await dbContext.AlertRules
            .AsNoTracking()
            .Where(rule =>
                rule.IsActive &&
                violatedRuleIds.Contains(rule.AlertRuleId))
            .OrderBy(rule => rule.AlertRuleId)
            .ToListAsync(cancellationToken);

        foreach (var rule in rules)
        {
            var alert = new Alert
            {
                SensorId = sensorId,
                AlertSeverityId = rule.AlertSeverityId,
                PhenomenonTypeId = rule.PhenomenonTypeId,
                TriggerValue = triggerValue,
                Message = rule.Message,
                CreatedAt = DateTime.UtcNow
            };

            dbContext.Alerts.Add(alert);
        }

        // Los cambios serán guardados por SensorService
        // dentro de la operación de registro de lectura.
        return rules.Count;
    }
}
