using ClimateGuard.Application.Contracts.AlertRules;

namespace ClimateGuard.Application.Abstractions.AlertRules;

public interface IAlertRuleService
{
    Task<IReadOnlyList<AlertRuleDto>> GetAllAsync(
        CancellationToken cancellationToken = default);

    Task<AlertRuleDto?> GetByIdAsync(
        int alertRuleId,
        CancellationToken cancellationToken = default);

    Task<AlertRuleDto> CreateAsync(
        CreateAlertRuleRequest request,
        CancellationToken cancellationToken = default);

    Task<bool> UpdateAsync(
        int alertRuleId,
        UpdateAlertRuleRequest request,
        CancellationToken cancellationToken = default);

    
    Task<bool> ChangeStatusAsync(
        int alertRuleId,
        bool isActive,
        CancellationToken cancellationToken = default);


    Task<bool> DeleteAsync(
        int alertRuleId,
        CancellationToken cancellationToken = default);
}