using ClimateGuard.Application.Abstractions.AlertRules;
using ClimateGuard.Application.Contracts.AlertRules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ClimateGuard.Api.Controllers;

[ApiController]
[Authorize(Roles = "Administrador")]
[Route("api/alert-rules")]
public sealed class AlertRulesController(
    IAlertRuleService alertRuleService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AlertRuleDto>>> GetAll(
        CancellationToken cancellationToken)
    {
        var alertRules = await alertRuleService.GetAllAsync(
            cancellationToken);

        return Ok(alertRules);
    }

    [HttpGet("{alertRuleId:int}")]
    public async Task<ActionResult<AlertRuleDto>> GetById(
        int alertRuleId,
        CancellationToken cancellationToken)
    {
        var alertRule = await alertRuleService.GetByIdAsync(
            alertRuleId,
            cancellationToken);

        return alertRule is null
            ? NotFound()
            : Ok(alertRule);
    }

    [HttpPost]
    public async Task<ActionResult<AlertRuleDto>> Create(
        CreateAlertRuleRequest request,
        CancellationToken cancellationToken)
    {
        var alertRule = await alertRuleService.CreateAsync(
            request,
            cancellationToken);

        return CreatedAtAction(
            nameof(GetById),
            new { alertRuleId = alertRule.AlertRuleId },
            alertRule);
    }

    [HttpPut("{alertRuleId:int}")]
    public async Task<IActionResult> Update(
        int alertRuleId,
        UpdateAlertRuleRequest request,
        CancellationToken cancellationToken)
    {
        var updated = await alertRuleService.UpdateAsync(
            alertRuleId,
            request,
            cancellationToken);

        return updated
            ? NoContent()
            : NotFound();
    }

    [HttpDelete("{alertRuleId:int}")]
    public async Task<IActionResult> Delete(
        int alertRuleId,
        CancellationToken cancellationToken)
    {
        var deleted = await alertRuleService.DeleteAsync(
            alertRuleId,
            cancellationToken);

        return deleted
            ? NoContent()
            : NotFound();
    }
}