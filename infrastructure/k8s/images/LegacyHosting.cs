using ClimateGuard.Infrastructure.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

// Compiled only into the K8s image; never changes the running local backend.
public static class LegacyHosting
{
    public static void MapClusterReadiness(WebApplication app)
    {
        app.MapGet("/health/database", async (AppDbContext db, CancellationToken ct) =>
        {
            try { return await db.Database.CanConnectAsync(ct) ? (IResult)Results.Ok() : Results.StatusCode(503); }
            catch { return Results.StatusCode(503); }
        }).AllowAnonymous();
    }
}
