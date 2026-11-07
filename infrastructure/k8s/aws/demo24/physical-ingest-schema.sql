SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID('dbo.SensorDevices','U') IS NULL
CREATE TABLE dbo.SensorDevices (
 DeviceId nvarchar(64) NOT NULL PRIMARY KEY, SensorId int NOT NULL,
 OwnerUserId uniqueidentifier NOT NULL, IsActive bit NOT NULL,
 CONSTRAINT FK_SensorDevices_Sensors FOREIGN KEY (SensorId) REFERENCES dbo.Sensors(SensorId)
);
IF OBJECT_ID('dbo.PhysicalMeasurements','U') IS NULL
CREATE TABLE dbo.PhysicalMeasurements (
 DeviceId nvarchar(64) NOT NULL, MeasurementId nvarchar(128) NOT NULL,
 Fingerprint nvarchar(64) NOT NULL, SensorReadingId bigint NOT NULL UNIQUE,
 CONSTRAINT PK_PhysicalMeasurements PRIMARY KEY (DeviceId,MeasurementId),
 CONSTRAINT FK_PhysicalMeasurements_Device FOREIGN KEY(DeviceId) REFERENCES dbo.SensorDevices(DeviceId),
 CONSTRAINT FK_PhysicalMeasurements_Reading FOREIGN KEY(SensorReadingId) REFERENCES dbo.SensorReadings(SensorReadingId)
);
COMMIT;
