using ClimateGuard.Application.Abstractions.AlertRules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ClimateGuard.Api.Controllers;

// Read-only evaluation contract. Existing administrative CRUD remains Administrador-only.
[ApiController]
[Authorize(Roles = "Administrador,Operador")]
[Route("api/alert-rules/evaluation")]
public sealed class EvaluationRulesController(IAlertRuleService rules) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Active(CancellationToken ct) =>
        Ok((await rules.GetAllAsync(ct)).Where(rule => rule.IsActive));
}
