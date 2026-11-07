using ClimateGuard.Community.Application.Abstractions.Communities;
using ClimateGuard.Community.Application.Contracts.Communities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ClimateGuard.Community.Api.Controllers;

[ApiController]
[Route("api/communities")]
[Authorize]
public sealed class CommunitiesController(
    ICommunityService communityService, IHttpClientFactory clients, IConfiguration configuration)
    : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(
        typeof(IReadOnlyList<CommunityDto>),
        StatusCodes.Status200OK)]
    public async Task<ActionResult<
        IReadOnlyList<CommunityDto>>> GetAll(
        [FromQuery] CommunityFilterRequest filters,
        CancellationToken cancellationToken)
    {
        var communities =
            await communityService.GetAllAsync(
                filters,
                cancellationToken);

        try
        {
            var counts = await SensorCounts(cancellationToken);
            return Ok(communities.Select(c => c with { SensorCount = counts.GetValueOrDefault(c.CommunityId) }));
        }
        catch (HttpRequestException) { return StatusCode(503, new { message = "No se pudo consultar la asociación de sensores." }); }
    }

    [HttpGet("{communityId:int}")]
    [ProducesResponseType(
        typeof(CommunityDto),
        StatusCodes.Status200OK)]
    [ProducesResponseType(
        StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CommunityDto>> GetById(
        int communityId,
        CancellationToken cancellationToken)
    {
        var community =
            await communityService.GetByIdAsync(
                communityId,
                cancellationToken);

        if (community is null)
        {
            return NotFound(new
            {
                message = "La comunidad no existe."
            });
        }

        try
        {
            var counts = await SensorCounts(cancellationToken);
            return Ok(community with { SensorCount = counts.GetValueOrDefault(communityId) });
        }
        catch (HttpRequestException) { return StatusCode(503, new { message = "No se pudo consultar la asociación de sensores." }); }
    }

    [HttpPost]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(
        typeof(CommunityDto),
        StatusCodes.Status201Created)]
    [ProducesResponseType(
        StatusCodes.Status400BadRequest)]
    [ProducesResponseType(
        StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CommunityDto>> Create(
        [FromBody] CreateCommunityRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var community =
                await communityService.CreateAsync(
                    request,
                    cancellationToken);

            return CreatedAtAction(
                nameof(GetById),
                new
                {
                    communityId =
                        community.CommunityId
                },
                community with { SensorCount = 0 });
        }
        catch (ArgumentException exception)
        {
            return Conflict(new
            {
                message = exception.Message
            });
        }
    }

    [HttpPut("{communityId:int}")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(
        StatusCodes.Status204NoContent)]
    [ProducesResponseType(
        StatusCodes.Status400BadRequest)]
    [ProducesResponseType(
        StatusCodes.Status404NotFound)]
    [ProducesResponseType(
        StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(
        int communityId,
        [FromBody] UpdateCommunityRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var updated =
                await communityService.UpdateAsync(
                    communityId,
                    request,
                    cancellationToken);

            if (!updated)
            {
                return NotFound(new
                {
                    message =
                        "La comunidad no existe."
                });
            }

            return NoContent();
        }
        catch (ArgumentException exception)
        {
            return Conflict(new
            {
                message = exception.Message
            });
        }
    }

    [HttpPatch("{communityId:int}/status")]
    [Authorize(Roles = "Administrador")]
    [ProducesResponseType(
        StatusCodes.Status204NoContent)]
    [ProducesResponseType(
        StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ChangeStatus(
        int communityId,
        [FromBody] ChangeCommunityStatusRequest request,
        CancellationToken cancellationToken)
    {
        var updated =
            await communityService.ChangeStatusAsync(
                communityId,
                request.IsActive,
                cancellationToken);

        if (!updated)
        {
            return NotFound(new
            {
                message = "La comunidad no existe."
            });
        }

        return NoContent();
    }

    private async Task<Dictionary<int,int>> SensorCounts(CancellationToken ct)
    {
        var url = configuration["Sensor:ServiceUrl"];
        if (string.IsNullOrWhiteSpace(url)) throw new HttpRequestException("Sensor API no configurada");
        using var request = new HttpRequestMessage(HttpMethod.Get, url.TrimEnd('/') + "/api/sensors/community-counts");
        request.Headers.TryAddWithoutValidation("Authorization", Request.Headers.Authorization.ToString());
        using var response = await clients.CreateClient("SensorDirectory").SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<Dictionary<int,int>>(cancellationToken:ct)
            ?? throw new HttpRequestException("Contrato de sensores inválido");
    }
}
