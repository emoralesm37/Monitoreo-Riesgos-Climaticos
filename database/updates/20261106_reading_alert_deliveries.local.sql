SET XACT_ABORT ON;
IF DB_NAME() <> N'ClimateGuard' THROW 51000, 'Expected local ClimateGuard.', 1;
BEGIN TRANSACTION;
IF OBJECT_ID('dbo.ReadingAlertDeliveries', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ReadingAlertDeliveries (
        SensorReadingId bigint NOT NULL PRIMARY KEY,
        Payload nvarchar(max) NOT NULL,
        Attempts int NOT NULL DEFAULT 0,
        DeliveredAt datetime2 NULL,
        CONSTRAINT FK_ReadingAlertDeliveries_Readings FOREIGN KEY(SensorReadingId)
            REFERENCES dbo.SensorReadings(SensorReadingId)
    );
END;
COMMIT;
