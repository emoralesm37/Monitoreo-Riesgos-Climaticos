using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;
using Yarp.ReverseProxy.Forwarder;

namespace ClimateGuard.Gateway.Tests;

public sealed class RoutingTests
{
    [Fact]
    public async Task Readiness_is_anonymous_and_checks_writable_outbox()
    {
        var folder = Path.Combine(Path.GetTempPath(), "cg-gateway-ready-" + Guid.NewGuid());
        using var factory = new GatewayFactory().WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(
                new Dictionary<string,string?> { ["Audit:OutboxDirectory"] = folder })));
        try
        {
            using var client = factory.CreateClient();
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/ready")).StatusCode);
            Assert.Empty(Directory.GetFiles(folder));
        }
        finally { if (Directory.Exists(folder)) Directory.Delete(folder); }
    }

    [Fact]
    public async Task Readiness_returns_unavailable_when_outbox_is_a_file()
    {
        var file = Path.GetTempFileName();
        using var factory = new GatewayFactory().WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(
                new Dictionary<string,string?> { ["Audit:OutboxDirectory"] = file })));
        try
        {
            using var client = factory.CreateClient();
            Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.GetAsync("/health/ready")).StatusCode);
        }
        finally { File.Delete(file); }
    }
    [Theory]
    [InlineData("GET", "/api/users", "http://localhost:7101/users")]
    [InlineData("GET", "/api/users/11111111-1111-4111-8111-111111111111", "http://localhost:7101/users/11111111-1111-4111-8111-111111111111")]
    [InlineData("POST", "/api/users", "http://localhost:7101/users")]
    [InlineData("PATCH", "/api/users/11111111-1111-4111-8111-111111111111/status", "http://localhost:7101/users/11111111-1111-4111-8111-111111111111/status")]
    [InlineData("PATCH", "/api/users/11111111-1111-4111-8111-111111111111", "http://localhost:7101/users/11111111-1111-4111-8111-111111111111")]
    [InlineData("GET", "/api/roles", "http://localhost:7101/roles")]
    [InlineData("POST", "/api/reports/communities", "http://127.0.0.1:8000/api/reports/communities")]
    [InlineData("POST", "/api/reports/sensors", "http://127.0.0.1:8000/api/reports/sensors")]
    [InlineData("POST", "/api/reports/readings", "http://127.0.0.1:8000/api/reports/readings")]
    [InlineData("GET", "/api/reports/admin-check", "http://127.0.0.1:8000/api/reports/admin-check")]
    [InlineData("GET", "/api/reports/history?limit=50", "http://127.0.0.1:8000/api/reports/history?limit=50")]
    [InlineData("GET", "/api/reports/report-id/download", "http://127.0.0.1:8000/api/reports/report-id/download")]
    public async Task Administrative_routes_preserve_contract(string method, string path, string destination)
    {
        using var factory = new GatewayFactory();
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(new HttpMethod(method), path);
        var token = factory.Token("Administrador");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Headers.Add("Origin", "http://localhost:4200");
        if (method is "POST" or "PATCH")
            request.Content = new StringContent("{\"example\":0}", Encoding.UTF8, "application/json");
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(destination, factory.Backend.Uri);
        Assert.Equal(method, factory.Backend.Method);
        Assert.Equal("Bearer " + token, factory.Backend.Authorization);
        Assert.Equal("http://localhost:4200", response.Headers.GetValues("Access-Control-Allow-Origin").Single());
        if (request.Content != null) Assert.Equal("{\"example\":0}", factory.Backend.Body);
    }

    [Theory]
    [InlineData("/api/users", null, 401)]
    [InlineData("/api/roles", null, 401)]
    [InlineData("/api/reports/history", null, 401)]
    [InlineData("/api/reports/sensors", null, 401)]
    [InlineData("/api/reports/readings", "Viewer", 403)]
    [InlineData("/api/users", "VIEWER", 403)]
    [InlineData("/api/users", "Viewer", 403)]
    [InlineData("/api/roles", "Viewer", 403)]
    [InlineData("/api/reports/history", "Viewer", 403)]
    [InlineData("/api/roles", "Operador", 403)]
    [InlineData("/api/reports/history", "ADMIN", 403)]
    public async Task Unauthorized_requests_never_reach_backend(string path, string? role, int status)
    {
        using var factory = new GatewayFactory();
        using var client = factory.CreateClient();
        if (role != null) client.DefaultRequestHeaders.Authorization = new("Bearer", factory.Token(role));
        using var response = await client.GetAsync(path);
        Assert.Equal(status, (int)response.StatusCode);
        Assert.Null(factory.Backend.Uri);
    }

    [Theory]
    [InlineData("/api/sensors/1/readings?limit=100", "http://localhost:5026/api/sensors/1/readings?limit=100")]
    [InlineData("/api/communities", "http://localhost:7000/api/communities")]
    [InlineData("/api/alerts?status=ACTIVA", "http://localhost:7301/api/alerts?status=ACTIVA")]
    [InlineData("/api/catalogs", "http://localhost:7000/api/catalogs")]
    [InlineData("/api/alert-rules", "http://localhost:7000/api/alert-rules")]
    public async Task Existing_routes_are_preserved(string path, string destination)
    {
        using var factory = new GatewayFactory();
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", factory.Token("Administrador"));
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(path)).StatusCode);
        Assert.Equal(destination, factory.Backend.Uri);
    }

    [Fact]
    public async Task Login_remains_anonymous_and_strips_api()
    {
        using var factory = new GatewayFactory();
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync("/api/auth/login", new StringContent("{}"))).StatusCode);
        Assert.Equal("http://localhost:7101/auth/login", factory.Backend.Uri);
    }

    [Theory]
    [InlineData("/api/users")]
    [InlineData("/api/roles")]
    [InlineData("/api/reports/history")]
    public async Task New_routes_do_not_change_production(string path)
    {
        using var factory = new GatewayFactory("Production");
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", factory.Token("Administrador"));
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(path)).StatusCode);
        Assert.Null(factory.Backend.Uri);
    }

    [Theory]
    [InlineData(404)]
    [InlineData(422)]
    [InlineData(502)]
    public async Task Backend_errors_are_forwarded_without_replacing_body(int status)
    {
        using var factory = new GatewayFactory();
        factory.Backend.Status = status;
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", factory.Token("Administrador"));
        using var response = await client.GetAsync("/api/reports/history");
        Assert.Equal(status, (int)response.StatusCode);
        Assert.Equal("{\"source\":\"simulated-backend\"}", await response.Content.ReadAsStringAsync());
    }
    [Theory]
    [InlineData("POST", "/api/auth/oauth/google/start", "http://localhost:7101/auth/oauth/google/start")]
    [InlineData("GET", "/api/auth/callback/google?state=opaque&code=opaque", "http://localhost:7101/auth/callback/google?state=opaque&code=opaque")]
    [InlineData("POST", "/api/auth/oauth/exchange", "http://localhost:7101/auth/oauth/exchange")]
    public async Task OAuth_routes_reach_auth_without_gateway_session(string method,string path,string target)
    {
        using var factory=new GatewayFactory();using var client=factory.CreateClient();
        using var request=new HttpRequestMessage(new HttpMethod(method),path);
        request.Headers.Add("Origin","http://localhost:4200");
        using var response=await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK,response.StatusCode);Assert.Equal(target,factory.Backend.Uri);
        Assert.Equal("true",response.Headers.GetValues("Access-Control-Allow-Credentials").Single());
    }

}

// In-process Gateway with a synthetic JWT and an HTTP handler replacing all backends.
// No sockets, databases or external services are used.
internal sealed class GatewayFactory(string environment = "Development") : WebApplicationFactory<Program>
{
    private const string Key = "gateway-tests-only-synthetic-signing-key-0123456789abcdef";
    public RecordingBackend Backend { get; } = new();
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(environment);
        // Available before Program reads JWT settings during minimal-host startup.
        builder.UseSetting("Jwt:Key", Key);
        builder.UseSetting("Jwt:Issuer", "gateway-tests");
        builder.UseSetting("Jwt:Audience", "gateway-tests");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = Key, ["Jwt:Issuer"] = "gateway-tests", ["Jwt:Audience"] = "gateway-tests",
            ["Audit:Enabled"] = "false",
            ["Cors:AllowedOrigins:0"] = "http://localhost:4200"
        }));
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IForwarderHttpClientFactory>();
            services.AddSingleton<IForwarderHttpClientFactory>(Backend);
        });
    }
    public string Token(string role) => new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(
        issuer: "gateway-tests", audience: "gateway-tests",
        claims: [new Claim("sub", "test-user"), new Claim("role", role)],
        expires: DateTime.UtcNow.AddMinutes(5),
        signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Key)), SecurityAlgorithms.HmacSha256)));
}

internal sealed class RecordingBackend : HttpMessageHandler, IForwarderHttpClientFactory
{
    public string? Uri { get; private set; }
    public string? Method { get; private set; }
    public string? Authorization { get; private set; }
    public string? Body { get; private set; }
    public int Status { get; set; } = 200;
    public HttpMessageInvoker CreateClient(ForwarderHttpClientContext context) => new(this, disposeHandler: false);
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Uri = request.RequestUri!.AbsoluteUri;
        Method = request.Method.Method;
        Authorization = request.Headers.Authorization?.ToString();
        Body = request.Content == null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
        return new HttpResponseMessage((HttpStatusCode)Status)
        {
            Content = new StringContent("{\"source\":\"simulated-backend\"}", Encoding.UTF8, "application/json")
        };
    }
}
