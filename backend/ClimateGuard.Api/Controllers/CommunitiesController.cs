using ClimateGuard.Application.Abstractions.Communities;
using ClimateGuard.Application.Contracts.Communities;
using Microsoft.AspNetCore.Mvc;

namespace ClimateGuard.Api.Controllers;

[ApiController]
[Route("api/communities")]
public sealed class CommunitiesController(
    ICommunityService communityService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CommunityDto>>> GetAll(
        CancellationToken cancellationToken)
    {
        var communities =
            await communityService.GetAllAsync(cancellationToken);

        return Ok(communities);
    }

    [HttpGet("{communityId:int}")]
    public async Task<ActionResult<CommunityDto>> GetById(
        int communityId,
        CancellationToken cancellationToken)
    {
        var community = await communityService.GetByIdAsync(
            communityId,
            cancellationToken);

        if (community is null)
        {
            return NotFound(new
            {
                message = "La comunidad no fue encontrada."
            });
        }

        return Ok(community);
    }

    [HttpPost]
    public async Task<ActionResult<CommunityDto>> Create(
        CreateCommunityRequest request,
        CancellationToken cancellationToken)
    {
        var community = await communityService.CreateAsync(
            request,
            cancellationToken);

        return CreatedAtAction(
            nameof(GetById),
            new { communityId = community.CommunityId },
            community);
    }

    [HttpPut("{communityId:int}")]
    public async Task<IActionResult> Update(
        int communityId,
        UpdateCommunityRequest request,
        CancellationToken cancellationToken)
    {
        var updated = await communityService.UpdateAsync(
            communityId,
            request,
            cancellationToken);

        if (!updated)
        {
            return NotFound(new
            {
                message = "La comunidad no fue encontrada."
            });
        }

        return NoContent();
    }
}