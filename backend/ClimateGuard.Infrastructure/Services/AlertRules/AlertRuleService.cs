using ClimateGuard.Application.Abstractions.AlertRules;
using ClimateGuard.Application.Contracts.AlertRules;
using ClimateGuard.Domain.Entities;
using ClimateGuard.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ClimateGuard.Infrastructure.Services.AlertRules;

public sealed class AlertRuleService(
    AppDbContext dbContext) : IAlertRuleService
{

    public async Task<IReadOnlyList<AlertRuleDto>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        return await dbContext.AlertRules
            .AsNoTracking()
            .OrderBy(rule => rule.Name)
            .Select(rule => new AlertRuleDto(
                rule.AlertRuleId,
                rule.Name,
                rule.SensorTypeId,
                rule.SensorType.Code,
                rule.SensorType.Unit,
                rule.MinimumValue,
                rule.MaximumValue,
                rule.AlertSeverityId,
                rule.AlertSeverity.Name,
                rule.PhenomenonTypeId,
                rule.PhenomenonType.Name,
                rule.Message,
                rule.IsActive,
                rule.CreatedAt,
                rule.UpdatedAt))
            .ToListAsync(cancellationToken);
    }
    public async Task<AlertRuleDto?> GetByIdAsync(
        int alertRuleId,
        CancellationToken cancellationToken = default)
    {
        return await dbContext.AlertRules
            .AsNoTracking()
            .Where(rule => rule.AlertRuleId == alertRuleId)
            .Select(rule => new AlertRuleDto(
                rule.AlertRuleId,
                rule.Name,
                rule.SensorTypeId,
                rule.SensorType.Code,
                rule.SensorType.Unit,
                rule.MinimumValue,
                rule.MaximumValue,
                rule.AlertSeverityId,
                rule.AlertSeverity.Name,
                rule.PhenomenonTypeId,
                rule.PhenomenonType.Name,
                rule.Message,
                rule.IsActive,
                rule.CreatedAt,
                rule.UpdatedAt))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<AlertRuleDto> CreateAsync(
    CreateAlertRuleRequest request,
    CancellationToken cancellationToken = default)
{
    ValidateParameters(
        request.Name,
        request.MinimumValue,
        request.MaximumValue,
        request.Message);

    await ValidateReferencesAsync(
        request.SensorTypeId,
        request.AlertSeverityId,
        request.PhenomenonTypeId,
        cancellationToken);

    var normalizedName = request.Name.Trim();

    var nameExists = await dbContext.AlertRules
        .AnyAsync(
            rule => rule.Name == normalizedName,
            cancellationToken);

    if (nameExists)
    {
        throw new ArgumentException(
            "Ya existe una regla de alerta con ese nombre.");
    }

    var alertRule = new AlertRule
    {
        Name = normalizedName,
        SensorTypeId = request.SensorTypeId,
        MinimumValue = request.MinimumValue,
        MaximumValue = request.MaximumValue,
        AlertSeverityId = request.AlertSeverityId,
        PhenomenonTypeId = request.PhenomenonTypeId,
        Message = request.Message.Trim(),
        IsActive = true,
        CreatedAt = DateTime.UtcNow
    };

    dbContext.AlertRules.Add(alertRule);

    await dbContext.SaveChangesAsync(cancellationToken);

    return (await GetByIdAsync(
        alertRule.AlertRuleId,
        cancellationToken))!;
}

public async Task<bool> UpdateAsync(
    int alertRuleId,
    UpdateAlertRuleRequest request,
    CancellationToken cancellationToken = default)
    {
    ValidateParameters(
        request.Name,
        request.MinimumValue,
        request.MaximumValue,
        request.Message);

    var alertRule = await dbContext.AlertRules
        .FirstOrDefaultAsync(
            rule => rule.AlertRuleId == alertRuleId,
            cancellationToken);

    if (alertRule is null)
    {
        return false;
    }

    await ValidateReferencesAsync(
        request.SensorTypeId,
        request.AlertSeverityId,
        request.PhenomenonTypeId,
        cancellationToken);

    var normalizedName = request.Name.Trim();

    var nameExists = await dbContext.AlertRules
        .AnyAsync(
            rule =>
                rule.Name == normalizedName &&
                rule.AlertRuleId != alertRuleId,
            cancellationToken);

    if (nameExists)
    {
        throw new ArgumentException(
            "Ya existe una regla de alerta con ese nombre.");
    }

    alertRule.Name = normalizedName;
    alertRule.SensorTypeId = request.SensorTypeId;
    alertRule.MinimumValue = request.MinimumValue;
    alertRule.MaximumValue = request.MaximumValue;
    alertRule.AlertSeverityId = request.AlertSeverityId;
    alertRule.PhenomenonTypeId = request.PhenomenonTypeId;
    alertRule.Message = request.Message.Trim();
    alertRule.UpdatedAt = DateTime.UtcNow;

    await dbContext.SaveChangesAsync(cancellationToken);

    return true;
    }


    public async Task<bool> DeleteAsync(
        int alertRuleId,
        CancellationToken cancellationToken = default)
    {
        var alertRule = await dbContext.AlertRules
            .FirstOrDefaultAsync(
                rule => rule.AlertRuleId == alertRuleId,
                cancellationToken);

        if (alertRule is null)
        {
            return false;
        }

        dbContext.AlertRules.Remove(alertRule);

        await dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }

    private static void ValidateParameters(
        string name,
        decimal minimumValue,
        decimal maximumValue,
        string message)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException(
                "El nombre de la regla es obligatorio.");
        }

        if (name.Trim().Length > 100)
        {
            throw new ArgumentException(
                "El nombre de la regla no puede superar los 100 caracteres.");
        }

        if (minimumValue >= maximumValue)
        {
            throw new ArgumentException(
                "El valor mínimo debe ser menor que el valor máximo.");
        }

        if (string.IsNullOrWhiteSpace(message))
        {
            throw new ArgumentException(
                "El mensaje de la regla es obligatorio.");
        }

        if (message.Trim().Length > 300)
        {
            throw new ArgumentException(
                "El mensaje de la regla no puede superar los 300 caracteres.");
        }
    }

    private async Task ValidateReferencesAsync(
        byte sensorTypeId,
        byte alertSeverityId,
        byte phenomenonTypeId,
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

        var alertSeverityExists = await dbContext.AlertSeverities
            .AnyAsync(
                severity =>
                    severity.AlertSeverityId == alertSeverityId,
                cancellationToken);

        if (!alertSeverityExists)
        {
            throw new ArgumentException(
                "El nivel de peligro indicado no existe.");
        }

        var phenomenonTypeExists = await dbContext.PhenomenonTypes
            .AnyAsync(
                phenomenon =>
                    phenomenon.PhenomenonTypeId == phenomenonTypeId,
                cancellationToken);

        if (!phenomenonTypeExists)
        {
            throw new ArgumentException(
                "El tipo de fenómeno indicado no existe.");
        }
    }
}