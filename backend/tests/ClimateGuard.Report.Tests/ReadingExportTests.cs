using System.Text.Json;
using ClimateGuard.Api.Controllers;
using ClimateGuard.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

public sealed class ReadingExportTests : IDisposable
{
    private readonly SqliteConnection connection = new("Data Source=:memory:");
    private readonly AppDbContext db;
    public ReadingExportTests()
    {
        connection.Open();
        db = new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        db.Database.ExecuteSqlRaw("CREATE TABLE Sensors (SensorId INTEGER PRIMARY KEY)");
        db.Database.ExecuteSqlRaw("INSERT INTO Sensors VALUES (1)");
        db.Database.ExecuteSqlRaw("CREATE TABLE SensorReadings (SensorReadingId INTEGER PRIMARY KEY, SensorId INTEGER, Value TEXT, Timestamp TEXT)");
        db.Database.ExecuteSqlRaw("CREATE TABLE ReadingAlertDeliveries (SensorReadingId INTEGER PRIMARY KEY, DeliveredAt TEXT)");
        db.Database.ExecuteSqlRaw("WITH RECURSIVE ids(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM ids WHERE x<502) INSERT INTO SensorReadings SELECT x,1,'0','2026-11-06 12:00:00' FROM ids");
        db.Database.ExecuteSqlRaw("INSERT INTO ReadingAlertDeliveries VALUES (1,NULL),(2,'2026-11-06 12:01:00')");
    }
    private static JsonElement Data(IActionResult result) => JsonSerializer.SerializeToElement(
        Assert.IsType<OkObjectResult>(result).Value, new JsonSerializerOptions(JsonSerializerDefaults.Web));
    [Fact]
    public async Task Pages_more_than_500_without_duplicates_and_excludes_later_inserts()
    {
        var controller = new ReadingReportsController(db);
        var first = Data(await controller.Get(1));
        Assert.Equal(500, first.GetProperty("readings").GetArrayLength());
        Assert.True(first.GetProperty("hasMore").GetBoolean());
        var snapshot = first.GetProperty("snapshotId").GetInt64();
        db.Database.ExecuteSqlRaw("INSERT INTO SensorReadings VALUES (503,1,'1','2026-11-06 12:00:00')");
        var last = Data(await controller.Get(1, afterId:500,snapshotId:snapshot));
        Assert.Equal(2, last.GetProperty("readings").GetArrayLength());
        Assert.False(last.GetProperty("hasMore").GetBoolean());
        Assert.Equal(502,last.GetProperty("nextAfterId").GetInt64());
    }
    [Fact]
    public async Task Exports_zero_utc_dates_and_persisted_delivery_flags()
    {
        var data=Data(await new ReadingReportsController(db).Get(1,pageSize:3,
            startDate:DateTimeOffset.Parse("2026-11-06T06:00:00-06:00"),
            endDate:DateTimeOffset.Parse("2026-11-06T12:00:00Z")));
        var rows=data.GetProperty("readings");
        Assert.Equal(3,rows.GetArrayLength());
        Assert.Equal(0,rows[0].GetProperty("value").GetDecimal());
        Assert.EndsWith("Z",rows[0].GetProperty("timestamp").GetString());
        Assert.True(rows[0].GetProperty("evaluationRecorded").GetBoolean());
        Assert.False(rows[0].GetProperty("evaluationDelivered").GetBoolean());
        Assert.True(rows[1].GetProperty("evaluationDelivered").GetBoolean());
        Assert.False(rows[2].GetProperty("evaluationRecorded").GetBoolean());
    }
    [Fact]
    public async Task Invalid_filters_missing_sensor_and_empty_range()
    {
        var c=new ReadingReportsController(db);
        Assert.IsType<BadRequestObjectResult>(await c.Get(1,pageSize:501));
        Assert.IsType<BadRequestObjectResult>(await c.Get(1,afterId:-1));
        Assert.IsType<NotFoundResult>(await c.Get(2));
        var data=Data(await c.Get(1,startDate:DateTimeOffset.Parse("2027-01-01T00:00:00Z")));
        Assert.Equal(0,data.GetProperty("readings").GetArrayLength());
        Assert.False(data.GetProperty("hasMore").GetBoolean());
    }
    [Fact]
    public void Export_requires_administrator()
    {
        var guard=Assert.Single(typeof(ReadingReportsController).GetCustomAttributes(typeof(AuthorizeAttribute),true));
        Assert.Equal("Administrador",((AuthorizeAttribute)guard).Roles);
    }
    public void Dispose() { db.Dispose();connection.Dispose(); }
}
