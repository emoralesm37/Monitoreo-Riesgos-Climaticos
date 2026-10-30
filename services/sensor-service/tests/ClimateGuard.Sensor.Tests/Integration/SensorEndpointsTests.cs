
using System.Net;
using System.Net.Http.Json;
using ClimateGuard.Sensor.Domain.Entities;
using ClimateGuard.Sensor.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using SensorEntity = ClimateGuard.Sensor.Domain.Entities.Sensor;
using Microsoft.EntityFrameworkCore;

namespace ClimateGuard.Sensor.Tests.Integration;

public class SensorEndpointsTests
{
    [Fact]
    public async Task GetSensors_WithoutToken_ReturnsUnauthorized()
    {
        using var factory = new SensorWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/sensors");

        Assert.Equal(
            HttpStatusCode.Unauthorized,
            response.StatusCode);
    }

    [Fact]
    public async Task GetSensors_WithValidToken_ReturnsOk()
    {
        using var factory = new SensorWebApplicationFactory();
        using var client = factory.CreateAuthenticatedClient();

        var response = await client.GetAsync("/api/sensors");

        Assert.Equal(
            HttpStatusCode.OK,
            response.StatusCode);
    }
 
    [Fact]
    public async Task CreateSensor_ThenGetSensor_ReturnsCreatedSensor()
    {
        using var factory = new SensorWebApplicationFactory();
        using var client = factory.CreateAuthenticatedClient();

        // Preparar un tipo de sensor en SQLite temporal.
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider
                .GetRequiredService<SensorDbContext>();

            db.SensorTypes.Add(new SensorType
            {
                SensorTypeId = 1,
                Code = "TEMPERATURE",
                Unit = "C"
            });

            await db.SaveChangesAsync();
        }

        var request = new
        {
            name = "Sensor de prueba automatizada",
            sensorTypeId = 1,
            communityId = 1
        };

        // Registrar el sensor mediante HTTP.
        var createResponse =
            await client.PostAsJsonAsync("/api/sensors", request);

        Assert.Equal(HttpStatusCode.Created,
            createResponse.StatusCode);

        // Consultar el sensor creado.
        var location = createResponse.Headers.Location;

        Assert.NotNull(location);

        var getResponse = await client.GetAsync(location);

        Assert.Equal(HttpStatusCode.OK,
            getResponse.StatusCode);

        var sensor = await getResponse.Content
            .ReadFromJsonAsync<SensorResponse>();

        Assert.NotNull(sensor);
        Assert.Equal(request.name, sensor.Name);
        Assert.Equal(request.sensorTypeId, sensor.SensorTypeId);
        Assert.Equal(request.communityId, sensor.CommunityId);
    }


    [Fact]
    public async Task DeactivateSensor_ReturnsInactiveSensor()
    {
        using var factory = new SensorWebApplicationFactory();
        using var client = factory.CreateAuthenticatedClient();

        int sensorId;

        // Preparar datos exclusivamente en SQLite temporal.
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider
                .GetRequiredService<SensorDbContext>();

            db.SensorTypes.Add(new SensorType
            {
                SensorTypeId = 1,
                Code = "TEMPERATURE",
                Unit = "C"
            });

        var sensor = new SensorEntity
        {
            Name = "Sensor para desactivacion",
            SensorTypeId = 1,
            CommunityId = 1,
            IsActive = true
        };

        db.Sensors.Add(sensor);
        await db.SaveChangesAsync();

        sensorId = sensor.SensorId;
        }

        // Desactivar mediante la API.
        var response = await client.PatchAsync(
            $"/api/sensors/{sensorId}/deactivate",
            null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // Verificar el estado almacenado.
        using var verificationScope = factory.Services.CreateScope();

        var verificationDb = verificationScope.ServiceProvider
            .GetRequiredService<SensorDbContext>();

        var updatedSensor = await verificationDb.Sensors
            .FindAsync(sensorId);

        Assert.NotNull(updatedSensor);
        Assert.False(updatedSensor.IsActive);
    }


    [Fact]
    public async Task CreateReading_UpdatesSensorLastValue()
    {
        using var factory = new SensorWebApplicationFactory();
        using var client = factory.CreateAuthenticatedClient();

        int sensorId;

        // Preparar datos en SQLite temporal.
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider
                .GetRequiredService<SensorDbContext>();

            db.SensorTypes.Add(new SensorType
            {
                SensorTypeId = 1,
                Code = "TEMPERATURE",
                Unit = "C"
            });

            var sensor = new SensorEntity
            {
                Name = "Sensor de lecturas",
                SensorTypeId = 1,
                CommunityId = 1,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            db.Sensors.Add(sensor);
            await db.SaveChangesAsync();

            sensorId = sensor.SensorId;
        }

        // Enviar una lectura mediante HTTP.
        const decimal expectedValue = 28.75m;

        var response = await client.PostAsJsonAsync(
            $"/api/sensors/{sensorId}/readings",
            new { Value = expectedValue });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        // Verificar la lectura y el sensor en la base temporal.
        using var verificationScope = factory.Services.CreateScope();

        var verificationDb = verificationScope.ServiceProvider
            .GetRequiredService<SensorDbContext>();

        var reading = await verificationDb.SensorReadings
            .AsNoTracking()
            .SingleAsync();

        Assert.Equal(sensorId, reading.SensorId);
        Assert.Equal(expectedValue, reading.Value);

        var updatedSensor = await verificationDb.Sensors
            .AsNoTracking()
            .SingleAsync(s => s.SensorId == sensorId);

        Assert.Equal(expectedValue, updatedSensor.LastValue);
        Assert.NotNull(updatedSensor.LastUpdatedAt);
    }



    [Fact]
    public async Task CreateReading_InactiveSensor_ReturnsConflict()
    {
        using var factory = new SensorWebApplicationFactory();
        using var client = factory.CreateAuthenticatedClient();

        int sensorId;

        // Preparar un sensor desactivado en SQLite temporal.
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider
                .GetRequiredService<SensorDbContext>();

            db.SensorTypes.Add(new SensorType
            {
                SensorTypeId = 1,
                Code = "TEMPERATURE",
                Unit = "C"
            });

            var sensor = new SensorEntity
            {
                Name = "Sensor inactivo de prueba",
                SensorTypeId = 1,
                CommunityId = 1,
                IsActive = false,
                CreatedAt = DateTime.UtcNow
            };

            db.Sensors.Add(sensor);
            await db.SaveChangesAsync();

            sensorId = sensor.SensorId;
        }

        // Intentar registrar una lectura.
        var response = await client.PostAsJsonAsync(
            $"/api/sensors/{sensorId}/readings",
            new { Value = 25.50m });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        // Confirmar que no se almacenó ninguna lectura.
        using var verificationScope = factory.Services.CreateScope();

        var verificationDb = verificationScope.ServiceProvider
            .GetRequiredService<SensorDbContext>();

        var readingCount = await verificationDb.SensorReadings
            .CountAsync();

        Assert.Equal(0, readingCount);
    }

    [Fact]
    public async Task UpdateSensor_ChangesNameAndType()
    {
        using var factory = new SensorWebApplicationFactory();
        using var client = factory.CreateAuthenticatedClient();

        int sensorId;

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider
                .GetRequiredService<SensorDbContext>();

            db.SensorTypes.AddRange(
                new SensorType
                {
                    SensorTypeId = 1,
                    Code = "TEMPERATURE",
                    Unit = "C"
                },
                new SensorType
                {
                    SensorTypeId = 2,
                    Code = "HUMIDITY",
                    Unit = "%"
                }
            );

            var sensor = new SensorEntity
            {
                Name = "Sensor original",
                SensorTypeId = 1,
                CommunityId = 1,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            db.Sensors.Add(sensor);
            await db.SaveChangesAsync();

            sensorId = sensor.SensorId;
        }

        // Actualizar mediante HTTP.
        var response = await client.PutAsJsonAsync(
            $"/api/sensors/{sensorId}",
            new
            {
                Name = "Sensor actualizado",
                SensorTypeId = 2
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // Comprobar los datos persistidos.
        using var verificationScope = factory.Services.CreateScope();

        var verificationDb = verificationScope.ServiceProvider
            .GetRequiredService<SensorDbContext>();

        var updatedSensor = await verificationDb.Sensors
            .AsNoTracking()
            .SingleAsync(s => s.SensorId == sensorId);

        Assert.Equal("Sensor actualizado", updatedSensor.Name);
        Assert.Equal((byte)2, updatedSensor.SensorTypeId);
        Assert.Equal(1, updatedSensor.CommunityId);
        Assert.True(updatedSensor.IsActive);
        Assert.NotNull(updatedSensor.UpdatedAt);
    }

    [Fact]
    public async Task GetReadings_ReturnsPaginatedHistory()
    {
        using var factory = new SensorWebApplicationFactory();
        using var client = factory.CreateAuthenticatedClient();

        int sensorId;

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider
                .GetRequiredService<SensorDbContext>();

            db.SensorTypes.Add(new SensorType
            {
                SensorTypeId = 1,
                Code = "TEMPERATURE",
                Unit = "C"
            });

            var sensor = new SensorEntity
            {
                Name = "Sensor de historial",
                SensorTypeId = 1,
                CommunityId = 1,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            db.Sensors.Add(sensor);
            await db.SaveChangesAsync();

            sensorId = sensor.SensorId;

            var now = DateTime.UtcNow;

            db.SensorReadings.AddRange(
                new SensorReading
                {
                    SensorId = sensorId,
                    Value = 20m,
                    Timestamp = now.AddMinutes(-3)
                },
                new SensorReading
                {
                    SensorId = sensorId,
                    Value = 25m,
                    Timestamp = now.AddMinutes(-2)
                },
                new SensorReading
                {
                    SensorId = sensorId,
                    Value = 30m,
                    Timestamp = now.AddMinutes(-1)
                }
            );

            await db.SaveChangesAsync();
        }

        // Solicitar la primera página con dos lecturas.
        var response = await client.GetAsync(
            $"/api/sensors/{sensorId}/readings?page=1&pageSize=2");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content
            .ReadFromJsonAsync<ReadingsPageResponse>();

        Assert.NotNull(result);
        Assert.Equal(sensorId, result.SensorId);
        Assert.Equal(1, result.Page);
        Assert.Equal(2, result.PageSize);
        Assert.Equal(3, result.TotalRecords);
        Assert.Equal(2, result.TotalPages);
        Assert.Equal(2, result.Readings.Count);

        // Las lecturas más recientes deben aparecer primero.
        Assert.Equal(30m, result.Readings[0].Value);
        Assert.Equal(25m, result.Readings[1].Value);
    }


    private sealed record SensorResponse(
        int SensorId,
        string Name,
        byte SensorTypeId,
        int CommunityId
    );

    private sealed record ReadingResponse(
        long SensorReadingId,
        int SensorId,
        decimal Value,
        DateTime Timestamp
    );

    private sealed record ReadingsPageResponse(
        int SensorId,
        int Page,
        int PageSize,
        int TotalRecords,
        int TotalPages,
        List<ReadingResponse> Readings
    );
}
