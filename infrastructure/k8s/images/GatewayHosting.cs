using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

public static class GatewayHosting
{
    public static void MapClusterReadiness(WebApplication app)
    {
        app.MapGet("/health/ready", (IConfiguration config) =>
        {
            string? probe = null;
            try
            {
                var folder = config["Audit:OutboxDirectory"] ?? throw new InvalidOperationException();
                Directory.CreateDirectory(folder);
                probe = Path.Combine(folder, ".probe-" + Guid.NewGuid());
                using (var file = new FileStream(probe, FileMode.CreateNew, FileAccess.Write, FileShare.None, 1, FileOptions.WriteThrough)) file.Flush(true);
                File.Delete(probe);
                return Results.Ok();
            }
            catch { return Results.StatusCode(503); }
            finally { if (probe is not null) { try { File.Delete(probe); } catch { } } }
        }).AllowAnonymous();
    }
}
