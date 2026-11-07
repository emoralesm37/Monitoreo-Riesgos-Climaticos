using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace ClimateGuard.Gateway.Tests;

public class AuditDeliveryTests
{
    [Fact]
    public async Task Refuses_before_business_operation_when_reservation_cannot_be_saved()
    {
        var path = Path.GetTempFileName();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
            ["Audit:Enabled"] = "true", ["Audit:SigningKey"] = new string('a', 64), ["Audit:OutboxDirectory"] = path }).Build();
        var context = new DefaultHttpContext(); context.Request.Method = "POST"; context.Request.Path = "/api/users";
        var forwarded = false;
        try {
            await new AuditDelivery(config, NullLogger<AuditDelivery>.Instance).Record(context, _ => { forwarded = true; return Task.CompletedTask; });
            Assert.False(forwarded); Assert.Equal(503, context.Response.StatusCode);
        } finally { File.Delete(path); }
    }

    [Theory]
    [InlineData("POST", "/api/auth/login", "auth", "login")]
    [InlineData("POST", "/api/auth/oauth/exchange", "auth", "login")]
    [InlineData("POST", "/api/reports/communities", "reports", "create")]
    [InlineData("POST", "/api/reports/sensors", "reports", "create")]
    [InlineData("POST", "/api/reports/readings", "reports", "create")]
    [InlineData("POST", "/api/reports/alerts", "reports", "create")]
    [InlineData("POST", "/api/reports/events", "reports", "create")]
    [InlineData("POST", "/api/reports/sensor_status", "reports", "create")]
    [InlineData("POST", "/api/reports/climate_statistics", "reports", "create")]
    [InlineData("POST", "/api/reports/executive", "reports", "create")]
    [InlineData("POST", "/api/sensors/12/readings/ingest", "sensors", "ingest")]
    [InlineData("POST", "/api/sensors/12/readings/manual", "sensors", "manual")]
    [InlineData("PATCH", "/api/alerts/4/resolve", "alerts", "resolve")]
    [InlineData("PUT", "/api/communities/3", "communities", "update")]
    public void Classifies_only_real_operations(string method, string path, string module, string action)
    {
        var result = AuditDelivery.Classify(method, path);
        Assert.NotNull(result); Assert.Equal(module, result.Value.Module); Assert.Equal(action, result.Value.Action);
        Assert.Null(AuditDelivery.Classify("GET", path));
        Assert.Null(AuditDelivery.Classify("POST", "/api/auth/refresh"));
        Assert.Null(AuditDelivery.Classify("POST", "/api/audit/events"));
    }

    [Theory]
    [InlineData(200, "CONFIRMED")]
    [InlineData(403, "FAILED")]
    [InlineData(502, "UNKNOWN")]
    public async Task Persists_server_result_without_request_secrets(int status, string outcome)
    {
        var directory = Path.Combine(Path.GetTempPath(), "cg-audit-unit-" + Guid.NewGuid());
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
            ["Audit:Enabled"] = "true", ["Audit:SigningKey"] = new string('a', 64), ["Audit:OutboxDirectory"] = directory }).Build();
        var delivery = new AuditDelivery(config, NullLogger<AuditDelivery>.Instance);
        var context = new DefaultHttpContext(); context.Request.Method = "PATCH"; context.Request.Path = "/api/users/123/status";
        context.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes("{\"password\":\"DO_NOT_STORE\"}"));
        context.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", Guid.NewGuid().ToString()), new Claim("name", "Unit")], "unit"));
        context.Response.Body = new MemoryStream();
        try {
            await delivery.Record(context, async c => { Assert.Single(Directory.GetFiles(directory, "*.pending")); c.Response.StatusCode = status; await c.Response.WriteAsync("{}"); });
            var json = await File.ReadAllTextAsync(Assert.Single(Directory.GetFiles(directory, "*.ready")));
            Assert.DoesNotContain("DO_NOT_STORE", json); Assert.Empty(Directory.GetFiles(directory, "*.pending"));
            using var doc = JsonDocument.Parse(json); Assert.Equal(outcome, doc.RootElement.GetProperty("result").GetString());
        } finally { Directory.Delete(directory, true); }
    }
}
