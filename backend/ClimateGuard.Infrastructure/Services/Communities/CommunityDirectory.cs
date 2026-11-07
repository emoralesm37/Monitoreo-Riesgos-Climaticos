using System.Net.Http.Json;
using System.Text.Json;
using ClimateGuard.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace ClimateGuard.Infrastructure.Services.Communities;

// The SQL Communities table is a private Sensor read-model for existing foreign keys.
// PostgreSQL Community Service is authoritative; synchronization is API-only.
public sealed class CommunityDirectory(IHttpClientFactory clients, IHttpContextAccessor context, IConfiguration config)
{
    public bool Enabled => !string.IsNullOrWhiteSpace(config["Community:ServiceUrl"]);
    public async Task<Dictionary<int,string>> NamesAsync(CancellationToken ct)
    {
        using var request=new HttpRequestMessage(HttpMethod.Get,config["Community:ServiceUrl"]!.TrimEnd('/')+"/api/communities");
        request.Headers.TryAddWithoutValidation("Authorization",context.HttpContext?.Request.Headers.Authorization.ToString());
        using var response=await clients.CreateClient("CommunityDirectory").SendAsync(request,ct);
        response.EnsureSuccessStatusCode();
        var rows=await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken:ct);
        return rows.EnumerateArray().ToDictionary(c=>c.GetProperty("communityId").GetInt32(),c=>c.GetProperty("name").GetString()!);
    }
    public async Task<JsonElement> GetAsync(int id, CancellationToken ct)
    {
        using var request=new HttpRequestMessage(HttpMethod.Get,config["Community:ServiceUrl"]!.TrimEnd('/')+"/api/communities/"+id);
        request.Headers.TryAddWithoutValidation("Authorization",context.HttpContext?.Request.Headers.Authorization.ToString());
        using var response=await clients.CreateClient("CommunityDirectory").SendAsync(request,ct);
        if(response.StatusCode==System.Net.HttpStatusCode.NotFound)throw new ArgumentException("La comunidad indicada no existe.");
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken:ct);
    }
    public async Task SynchronizeAsync(AppDbContext db, int id, CancellationToken ct)
    {
        if(!Enabled)return;
        var c=await GetAsync(id,ct);
        string Text(string name)=>c.GetProperty(name).GetString()!;
        decimal? Number(string name)=>c.GetProperty(name).ValueKind==JsonValueKind.Null?null:c.GetProperty(name).GetDecimal();
        var name=Text("name");var municipality=Text("municipality");var department=Text("department");var country=Text("country");
        var latitude=Number("latitude");var longitude=Number("longitude");var active=c.GetProperty("isActive").GetBoolean();
        if(!active)throw new ArgumentException("La comunidad está inactiva.");
        // Parameterized, idempotent private projection; preserve all existing rows and IDs.
        await db.Database.ExecuteSqlInterpolatedAsync($@"
IF EXISTS (SELECT 1 FROM dbo.Communities WHERE CommunityId={id})
 UPDATE dbo.Communities SET Name={name},Municipality={municipality},Department={department},Country={country},Latitude={latitude},Longitude={longitude},IsActive={active} WHERE CommunityId={id};
ELSE BEGIN
 SET IDENTITY_INSERT dbo.Communities ON;
 INSERT dbo.Communities (CommunityId,Name,Municipality,Department,Country,Latitude,Longitude,IsActive) VALUES ({id},{name},{municipality},{department},{country},{latitude},{longitude},{active});
 SET IDENTITY_INSERT dbo.Communities OFF;
END",ct);
    }
}
