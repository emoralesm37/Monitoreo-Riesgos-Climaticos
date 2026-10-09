
namespace ClimateGuard.Application.Contracts.AlertRules;

public sealed record ChangeAlertRuleStatusRequest(
    bool? IsActive);
