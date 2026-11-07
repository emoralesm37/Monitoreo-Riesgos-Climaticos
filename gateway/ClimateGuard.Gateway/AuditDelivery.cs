using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

// The Gateway is the only event producer for HTTP operations routed through it.
// No request bodies, tokens, email addresses, hashes or query strings enter this queue.
public sealed class AuditDelivery(IConfiguration config, ILogger<AuditDelivery> logger) : BackgroundService
{
    private readonly HttpClient client = new() { Timeout = TimeSpan.FromSeconds(5) };
    public bool Enabled => config.GetValue<bool>("Audit:Enabled");
    private string DirectoryPath => config["Audit:OutboxDirectory"] ?? Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ClimateGuard", "audit-outbox");
    private string SigningKey => config["Audit:SigningKey"] ?? throw new InvalidOperationException("Audit signing key required.");

    public async Task Record(HttpContext context, RequestDelegate next)
    {
        var route = Classify(context.Request.Method, context.Request.Path.Value ?? "");
        if (!Enabled || route is null) { await next(context); return; }
        _ = SigningKey;
        var id = Guid.NewGuid().ToString();
        var item = new Dictionary<string, object?> {
            ["event_id"] = id, ["occurred_at"] = DateTimeOffset.UtcNow,
            ["actor_id"] = Guid.TryParse(context.User.FindFirst("sub")?.Value, out var actor) ? actor.ToString() : null,
            ["actor_name"] = context.User.Identity?.IsAuthenticated == true ? context.User.FindFirst("name")?.Value ?? "Usuario" : "Anonimo",
            ["actor_role"] = context.User.Identity?.IsAuthenticated == true ? context.User.FindFirst("role")?.Value ?? "" : "",
            ["module"] = route.Value.Module, ["action"] = route.Value.Action,
            ["entity_id"] = route.Value.Entity, ["result"] = "UNKNOWN", ["http_status"] = 0
        };
        // Reserve on disk before forwarding. If unavailable, refuse the operation before side effects.
        try { await Save(id, "pending", item); }
        catch { logger.LogCritical("Audit reservation failed; operation refused. EventId={EventId}", id); context.Response.StatusCode = 503; return; }
        var original = context.Response.Body;
        await using var buffer = new MemoryStream();
        context.Response.Body = buffer;
        try
        {
            await next(context);
            var status = context.Response.StatusCode;
            item["http_status"] = status;
            item["result"] = status is >= 200 and < 300 ? "CONFIRMED" : status >= 500 ? "UNKNOWN" : "FAILED";
            // Only select server response identifiers. Never retain the response body.
            if (status is >= 200 and < 300 && buffer.Length <= 2_000_000)
            {
                try
                {
                    buffer.Position = 0;
                    using var response = await JsonDocument.ParseAsync(buffer);
                    var root = response.RootElement;
                    if (route.Value.Module == "auth" && route.Value.Action == "login")
                    {
                        var user = root.GetProperty("user");
                        item["actor_id"] = user.GetProperty("id").GetString();
                        item["actor_name"] = user.GetProperty("name").GetString();
                        item["actor_role"] = user.GetProperty("role").GetString();
                    }
                    if (item["entity_id"] is null)
                        foreach (var field in new[] { "id", "sensorId", "communityId", "report_id", "alertId" })
                            if (root.TryGetProperty(field, out var value) && Regex.IsMatch(value.ToString(), "^[0-9a-fA-F-]{1,36}$"))
                            { item["entity_id"] = value.ToString(); break; }
                }
                catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException) { }
            }
            try { await Save(id, "ready", item); File.Delete(Path.Combine(DirectoryPath, id + ".pending")); }
            catch { logger.LogCritical("Audit completion not persisted; pending event remains UNKNOWN. EventId={EventId}", id); }
            buffer.Position = 0;
            await buffer.CopyToAsync(original);
        }
        finally { context.Response.Body = original; }
    }

    public static (string Module, string Action, string? Entity)? Classify(string method, string path)
    {
        if (method is not ("POST" or "PUT" or "PATCH" or "DELETE")) return null;
        // Successful OAuth exchange is a confirmed Auth login; never inspect its request body.
        if (method == "POST" && path == "/api/auth/oauth/exchange") return ("auth", "login", null);
        if (method == "POST" && path is "/api/reports/sensors" or "/api/reports/readings" or "/api/reports/communities" or "/api/reports/alerts" or "/api/reports/events" or "/api/reports/sensor_status" or "/api/reports/climate_statistics" or "/api/reports/executive")
            return ("reports", "create", null);
        var ingest = Regex.Match(path, @"^/api/sensors/([0-9]+)/readings/ingest$");
        if (method == "POST" && ingest.Success) return ("sensors", "ingest", ingest.Groups[1].Value);
        var match = Regex.Match(path, @"^/api/(auth|users|communities|sensors|alerts|reports|alert-rules)(?:/([0-9a-fA-F-]{1,36}))?(?:/(login|logout|status|reset|resolve|readings/manual|communities))?/?$");
        if (!match.Success) return null;
        var module = match.Groups[1].Value;
        var suffix = match.Groups[3].Value;
        if (module == "auth" && suffix is not ("login" or "logout")) return null;
        var action = suffix switch { "readings/manual" => "manual", "communities" => "create", "" => method == "POST" ? "create" : method == "DELETE" ? "delete" : "update", _ => suffix };
        return (module, action, match.Groups[2].Success ? match.Groups[2].Value : null);
    }

    private async Task Save(string id, string extension, Dictionary<string, object?> item)
    {
        Directory.CreateDirectory(DirectoryPath);
        var target = Path.Combine(DirectoryPath, id + "." + extension);
        var temporary = target + ".tmp";
        await using (var file = new FileStream(temporary, FileMode.Create, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough))
        {
            await JsonSerializer.SerializeAsync(file, item);
            file.Flush(true);
        }
        File.Move(temporary, target, true);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!Enabled) return;
        _ = SigningKey;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
            Directory.CreateDirectory(DirectoryPath);
            foreach (var pending in Directory.EnumerateFiles(DirectoryPath, "*.pending"))
                if (File.GetLastWriteTimeUtc(pending) < DateTime.UtcNow.AddMinutes(-5))
                {
                    var ready = Path.ChangeExtension(pending, ".ready");
                    if (!File.Exists(ready)) File.Move(pending, ready);
                    else File.Delete(pending);
                }
            foreach (var path in Directory.EnumerateFiles(DirectoryPath, "*.ready"))
            {
                try
                {
                    var body = await File.ReadAllTextAsync(path, stoppingToken);
                    var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
                    var signature = Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(SigningKey), Encoding.UTF8.GetBytes(timestamp + "." + body)));
                    using var request = new HttpRequestMessage(HttpMethod.Post, config["Audit:IngestUrl"]);
                    request.Headers.Add("X-Audit-Timestamp", timestamp);
                    request.Headers.Add("X-Audit-Signature", signature);
                    request.Content = new StringContent(body, Encoding.UTF8, "application/json");
                    using var response = await client.SendAsync(request, stoppingToken);
                    if (response.IsSuccessStatusCode) File.Delete(path);
                    else logger.LogWarning("Audit delivery pending; HTTP {Status}; EventId={EventId}", (int)response.StatusCode, Path.GetFileNameWithoutExtension(path));
                }
                catch (Exception ex) when (ex is HttpRequestException or IOException or TaskCanceledException)
                { logger.LogWarning("Audit delivery unavailable; event remains on disk."); }
            }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            { logger.LogCritical("Audit outbox unavailable; delivery will retry and new audited operations will be refused until storage recovers."); }
            await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
        }
    }
}
