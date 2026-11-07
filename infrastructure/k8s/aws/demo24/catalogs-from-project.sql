-- Reference catalogs copied from database/ClimateGuard.sql, not fabricated readings.
-- NEW database only. Refuse a non-empty catalog instead of modifying existing data.
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF EXISTS (SELECT 1 FROM dbo.SensorTypes) OR EXISTS (SELECT 1 FROM dbo.AlertSeverities)
   OR EXISTS (SELECT 1 FROM dbo.PhenomenonTypes)
    THROW 51000, 'Catalog is not empty; refusing replacement.', 1;
BEGIN TRANSACTION;
INSERT INTO dbo.SensorTypes (SensorTypeId, Code, Unit) VALUES
    (1, N'Temperatura', N'C'),
    (2, N'Humedad', N'%'),
    (3, N'VelocidadViento', N'km/h'),
    (4, N'NivelLluvia', N'mm'),
    (5, N'NivelRio', N'm');
INSERT INTO dbo.AlertSeverities (AlertSeverityId, Name, Level) VALUES
    (1, N'Verde', 0), (2, N'Amarillo', 1), (3, N'Naranja', 2), (4, N'Rojo', 3);
INSERT INTO dbo.PhenomenonTypes (PhenomenonTypeId, Name) VALUES
    (1, N'Inundacion'), (2, N'Sequia'), (3, N'Tormenta'), (4, N'Helada'), (5, N'IncendioForestal');
COMMIT;
