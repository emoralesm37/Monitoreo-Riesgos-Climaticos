
using ClimateGuard.Sensor.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using SensorEntity = ClimateGuard.Sensor.Domain.Entities.Sensor;
using ClimateGuard.Sensor.Application.Validation;

namespace ClimateGuard.Sensor.Api.Endpoints;

public sealed record CreateSensorRequest(
    string Name,
    byte SensorTypeId,
    int CommunityId
);
public sealed record UpdateSensorRequest(
    string Name,
    byte SensorTypeId
);

public sealed record CreateSensorReadingRequest(decimal Value);

public static class SensorEndpoints
{
    public static void MapSensorEndpoints(this WebApplication app)
    {
        // Consultar catálogo de tipos de sensores
        app.MapGet("/api/sensor-types",
            async (SensorDbContext db) =>
            {
                var types = await db.SensorTypes
                    .AsNoTracking()
                    .OrderBy(t => t.SensorTypeId)
                    .Select(t => new
                    {
                        t.SensorTypeId,
                        t.Code,
                        t.Unit
                    })
                    .ToListAsync();

                return Results.Ok(types);
            });

        // Consultar sensores registrados
        app.MapGet("/api/sensors",
            async (SensorDbContext db) =>
            {
                var sensors = await db.Sensors
                    .AsNoTracking()
                    .OrderBy(s => s.SensorId)
                    .Select(s => new
                    {
                        s.SensorId,
                        s.Name,
                        s.SensorTypeId,
                        SensorType = s.SensorType.Code,
                        s.CommunityId,
                        s.IsActive,
                        s.LastValue,
                        s.LastUpdatedAt,
                        s.CreatedAt
                    })
                    .ToListAsync();

                return Results.Ok(sensors);
            });
            
        app.MapPost("/api/sensors",
            async (CreateSensorRequest request, SensorDbContext db) =>
            {
                if (!SensorValidator.IsValidName(request.Name))
                    {
                        return Results.BadRequest(new
                        {
                        message = "El nombre debe contener entre 1 y 100 caracteres."
                        });
                    }

                if (request.CommunityId <= 0)
                {
                    return Results.BadRequest(new
                    {
                        message = "CommunityId debe ser mayor que cero."
                    });
                }

                var sensorTypeExists = await db.SensorTypes
                    .AnyAsync(t => t.SensorTypeId == request.SensorTypeId);

                if (!sensorTypeExists)
                {
                    return Results.BadRequest(new
                    {
                        message = "El tipo de sensor no existe."
                    });
                }

                var sensor = new SensorEntity
                {
                 Name = request.Name.Trim(),
                    SensorTypeId = request.SensorTypeId,
                    CommunityId = request.CommunityId,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };

                db.Sensors.Add(sensor);
                await db.SaveChangesAsync();

                return Results.Created(
                    $"/api/sensors/{sensor.SensorId}",
                    new
                    {
                        sensor.SensorId,
                        sensor.Name,
                        sensor.SensorTypeId,
                        sensor.CommunityId,
                        sensor.IsActive,
                        sensor.CreatedAt
                    });
                });
        
        app.MapGet("/api/sensors/{id:int}",
            async (int id, SensorDbContext db) =>
            {
                if (id <= 0)
                {
                    return Results.BadRequest(new
                    {
                        message = "El identificador debe ser mayor que cero."
                    });
                }

            var sensor = await db.Sensors
                .AsNoTracking()
                .Where(s => s.SensorId == id)
                .Select(s => new
                {
                    s.SensorId,
                    s.Name,
                    s.SensorTypeId,
                    SensorType = s.SensorType.Code,
                    s.CommunityId,
                    s.IsActive,
                    s.LastValue,
                    s.LastUpdatedAt,
                    s.CreatedAt,
                    s.UpdatedAt
                })
                .FirstOrDefaultAsync();

                if (sensor is null)
                {
                    return Results.NotFound(new
                    {
                        message = "Sensor no encontrado."
                    });
                }

                return Results.Ok(sensor);
            });
        
        
        app.MapPut("/api/sensors/{id:int}",
            async (int id, UpdateSensorRequest request, SensorDbContext db) =>
            {
                if (id <= 0)
                return Results.BadRequest(new
                {
                    message = "El identificador debe ser mayor que cero."
                });

                if (!SensorValidator.IsValidName(request.Name))
                {
                    return Results.BadRequest(new
                    {
                        message = "El nombre debe contener entre 1 y 100 caracteres."
                    });
                }
                var sensor = await db.Sensors
                .FirstOrDefaultAsync(s => s.SensorId == id);

                if (sensor is null)
                return Results.NotFound(new
                {
                    message = "Sensor no encontrado."
                });

            var sensorTypeExists = await db.SensorTypes
                .AnyAsync(t => t.SensorTypeId == request.SensorTypeId);

            if (!sensorTypeExists)
                return Results.BadRequest(new
                {
                    message = "El tipo de sensor no existe."
                });

                sensor.Name = request.Name.Trim();
                sensor.SensorTypeId = request.SensorTypeId;
                sensor.UpdatedAt = DateTime.UtcNow;

            await db.SaveChangesAsync();

            return Results.Ok(new
            {
                sensor.SensorId,
                sensor.Name,
                sensor.SensorTypeId,
                sensor.CommunityId,
                sensor.IsActive,
                sensor.UpdatedAt
            });
        });

        app.MapPatch("/api/sensors/{id:int}/deactivate",
            async (int id, SensorDbContext db) =>
            {
                if (id <= 0)
                {
                    return Results.BadRequest(new
                    {
                    message = "El identificador debe ser mayor que cero."
                    });
                }

            var sensor = await db.Sensors
                .FirstOrDefaultAsync(s => s.SensorId == id);

                if (sensor is null)
                {
                    return Results.NotFound(new
                    {
                     message = "Sensor no encontrado."
                    });
                }

                if (!sensor.IsActive)
                {
                    return Results.Ok(new
                    {
                        message = "El sensor ya se encuentra desactivado.",
                        sensor.SensorId,
                        sensor.IsActive
                    });
                }

                sensor.IsActive = false;
                sensor.UpdatedAt = DateTime.UtcNow;

                await db.SaveChangesAsync();

                return Results.Ok(new
                {
                    message = "Sensor desactivado correctamente.",
                    sensor.SensorId,
                    sensor.IsActive,
                    sensor.UpdatedAt
                });
            });


        app.MapPost("/api/sensors/{id:int}/readings",
            async (int id, CreateSensorReadingRequest request, SensorDbContext db) =>
            {
                if (id <= 0)
                    return Results.BadRequest(new
                {
                    message = "El identificador debe ser mayor que cero."
                });

                var sensor = await db.Sensors
                .FirstOrDefaultAsync(s => s.SensorId == id);

                if (sensor is null)
                    return Results.NotFound(new
                    {
                     message = "Sensor no encontrado."
                    });

                if (!sensor.IsActive)
                    return Results.Conflict(new
                    {
                        message = "No se pueden registrar lecturas en un sensor desactivado."
                    });

                var timestamp = DateTime.UtcNow;

                var reading = new ClimateGuard.Sensor.Domain.Entities.SensorReading
                {
                    SensorId = sensor.SensorId,
                    Value = request.Value,
                    Timestamp = timestamp
                };

             db.SensorReadings.Add(reading);

                sensor.LastValue = request.Value;
                sensor.LastUpdatedAt = timestamp;
                sensor.UpdatedAt = timestamp;

                await db.SaveChangesAsync();

                return Results.Created(
                    $"/api/sensors/{id}/readings/{reading.SensorReadingId}",
                    new
                    {
                        reading.SensorReadingId,
                        reading.SensorId,
                        reading.Value,
                        reading.Timestamp
                    });
            });
    

        app.MapGet("/api/sensors/{id:int}/readings",
            async (int id, int page, int pageSize, SensorDbContext db) =>
            {
                if (id <= 0)
                    return Results.BadRequest(new
                    {
                        message = "El identificador debe ser mayor que cero."
                    });

                page = page <= 0 ? 1 : page;
                pageSize = pageSize <= 0 ? 10 : Math.Min(pageSize, 100);

                var sensorExists = await db.Sensors
                    .AnyAsync(s => s.SensorId == id);

                if (!sensorExists)
                 return Results.NotFound(new
                {
                    message = "Sensor no encontrado."
                }   );

                var query = db.SensorReadings
                    .AsNoTracking()
                    .Where(r => r.SensorId == id);

                var totalRecords = await query.CountAsync();

                var readings = await query
                    .OrderByDescending(r => r.Timestamp)
                    .ThenByDescending(r => r.SensorReadingId)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(r => new
                    {
                        r.SensorReadingId,
                        r.SensorId,
                        r.Value,
                        r.Timestamp
                    })
                    .ToListAsync();

                return Results.Ok(new
                {
                    sensorId = id,
                    page,
                    pageSize,
                    totalRecords,
                    totalPages = (int)Math.Ceiling(
                        totalRecords / (double)pageSize),
                    readings
                });
            });

        }
}