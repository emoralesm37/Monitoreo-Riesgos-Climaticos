-- =====================================================================
-- ClimateGuard - Database Schema (SQL Server 2022+)
-- Sistema de Monitoreo y Alerta Temprana para Riesgos Climaticos
-- Normalizado hasta 3FN (ver Diseno_BaseDatos.md para el detalle)
--
-- NOTA: los umbrales de alerta (AlertThresholds) NO se modelan como tabla.
-- Se manejan simplificados como configuracion (appsettings.json / constantes
-- en el motor de reglas IAlertRuleEvaluator), no como catalogo en la base.
-- =====================================================================

IF DB_ID(N'ClimateGuard') IS NULL
BEGIN
    CREATE DATABASE ClimateGuard;
END
GO

USE ClimateGuard;
GO

-- =====================================================================
-- 1. CATALOGOS
-- =====================================================================

CREATE TABLE dbo.Roles (
    RoleId      TINYINT         NOT NULL PRIMARY KEY,
    Name        NVARCHAR(30)    NOT NULL UNIQUE
);

CREATE TABLE dbo.SensorTypes (
    SensorTypeId    TINYINT         NOT NULL PRIMARY KEY,
    Code            NVARCHAR(30)    NOT NULL UNIQUE,
    Unit            NVARCHAR(15)    NOT NULL
);

CREATE TABLE dbo.AlertSeverities (
    AlertSeverityId TINYINT         NOT NULL PRIMARY KEY,
    Name            NVARCHAR(20)    NOT NULL UNIQUE,
    Level           TINYINT         NOT NULL
);

CREATE TABLE dbo.PhenomenonTypes (
    PhenomenonTypeId    TINYINT         NOT NULL PRIMARY KEY,
    Name                NVARCHAR(30)    NOT NULL UNIQUE
);

-- =====================================================================
-- 2. ENTIDADES PRINCIPALES
-- =====================================================================

CREATE TABLE dbo.Users (
    UserId          INT             IDENTITY(1,1) PRIMARY KEY,
    Name            NVARCHAR(100)   NOT NULL,
    Email           NVARCHAR(150)   NOT NULL UNIQUE,
    PasswordHash    NVARCHAR(300)   NOT NULL,
    RoleId          TINYINT         NOT NULL,
    IsActive        BIT             NOT NULL DEFAULT (1),
    CreatedAt       DATETIME2       NOT NULL DEFAULT (SYSUTCDATETIME()),
    UpdatedAt       DATETIME2       NULL,
    CONSTRAINT FK_Users_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles (RoleId)
);

CREATE TABLE dbo.Communities (
    CommunityId INT             IDENTITY(1,1) PRIMARY KEY,
    Name        NVARCHAR(120)   NOT NULL UNIQUE,
    Region      NVARCHAR(120)   NULL,
    Latitude    DECIMAL(9,6)    NULL,
    Longitude   DECIMAL(9,6)    NULL
);

CREATE TABLE dbo.Sensors (
    SensorId        INT             IDENTITY(1,1) PRIMARY KEY,
    Name            NVARCHAR(100)   NOT NULL,
    SensorTypeId    TINYINT         NOT NULL,
    CommunityId     INT             NOT NULL,
    IsActive        BIT             NOT NULL DEFAULT (1),
    LastValue       DECIMAL(10,2)   NULL,
    LastUpdatedAt   DATETIME2       NULL,
    CreatedAt       DATETIME2       NOT NULL DEFAULT (SYSUTCDATETIME()),
    UpdatedAt       DATETIME2       NULL,
    CONSTRAINT FK_Sensors_SensorTypes FOREIGN KEY (SensorTypeId) REFERENCES dbo.SensorTypes (SensorTypeId),
    CONSTRAINT FK_Sensors_Communities FOREIGN KEY (CommunityId) REFERENCES dbo.Communities (CommunityId)
);
CREATE TABLE dbo.SensorReadings (
    SensorReadingId BIGINT          IDENTITY(1,1) PRIMARY KEY,
    SensorId        INT             NOT NULL,
    Value           DECIMAL(10,2)   NOT NULL,
    [Timestamp]     DATETIME2       NOT NULL DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_SensorReadings_Sensors FOREIGN KEY (SensorId) REFERENCES dbo.Sensors (SensorId)
);

CREATE INDEX IX_SensorReadings_SensorId_Timestamp
    ON dbo.SensorReadings (SensorId, [Timestamp] DESC);

CREATE TABLE dbo.Alerts (
    AlertId             BIGINT          IDENTITY(1,1) PRIMARY KEY,
    SensorId            INT             NULL,
    AlertSeverityId     TINYINT         NOT NULL,
    PhenomenonTypeId    TINYINT         NULL,
    TriggerValue        DECIMAL(10,2)   NULL,
    Message             NVARCHAR(300)   NOT NULL,
    CreatedAt           DATETIME2       NOT NULL DEFAULT (SYSUTCDATETIME()),
    ResolvedAt          DATETIME2       NULL,
    ResolvedByUserId    INT             NULL,
    CONSTRAINT FK_Alerts_Sensors FOREIGN KEY (SensorId) REFERENCES dbo.Sensors (SensorId),
    CONSTRAINT FK_Alerts_AlertSeverities FOREIGN KEY (AlertSeverityId) REFERENCES dbo.AlertSeverities (AlertSeverityId),
    CONSTRAINT FK_Alerts_PhenomenonTypes FOREIGN KEY (PhenomenonTypeId) REFERENCES dbo.PhenomenonTypes (PhenomenonTypeId),
    CONSTRAINT FK_Alerts_Users_ResolvedBy FOREIGN KEY (ResolvedByUserId) REFERENCES dbo.Users (UserId)
);

CREATE INDEX IX_Alerts_CreatedAt ON dbo.Alerts (CreatedAt DESC);
CREATE INDEX IX_Alerts_SensorId ON dbo.Alerts (SensorId);

CREATE TABLE dbo.AuditLogEntries (
    AuditLogEntryId INT             IDENTITY(1,1) PRIMARY KEY,
    UserId          INT             NOT NULL,
    Action          NVARCHAR(60)    NOT NULL,
    EntityAffected  NVARCHAR(60)    NULL,
    [Timestamp]     DATETIME2       NOT NULL DEFAULT (SYSUTCDATETIME()),
    Details         NVARCHAR(500)   NULL,
    CONSTRAINT FK_AuditLogEntries_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId)
);

CREATE TABLE dbo.RefreshTokens (
    RefreshTokenId      INT             IDENTITY(1,1) PRIMARY KEY,
    UserId              INT             NOT NULL,
    TokenHash           NVARCHAR(300)   NOT NULL,
    ExpiresAt           DATETIME2       NOT NULL,
    CreatedAt           DATETIME2       NOT NULL DEFAULT (SYSUTCDATETIME()),
    RevokedAt           DATETIME2       NULL,
    ReplacedByTokenId   INT             NULL,
    CreatedByIp         NVARCHAR(45)    NULL,
    CONSTRAINT FK_RefreshTokens_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_RefreshTokens_ReplacedBy FOREIGN KEY (ReplacedByTokenId) REFERENCES dbo.RefreshTokens (RefreshTokenId)
);

-- =====================================================================
-- 3. SEED DE CATALOGOS (datos de referencia fijos)
-- =====================================================================

INSERT INTO dbo.Roles (RoleId, Name) VALUES
    (1, N'Admin'),
    (2, N'Operador');

INSERT INTO dbo.SensorTypes (SensorTypeId, Code, Unit) VALUES
    (1, N'Temperatura',      N'C'),
    (2, N'Humedad',          N'%'),
    (3, N'VelocidadViento',  N'km/h'),
    (4, N'NivelLluvia',      N'mm'),
    (5, N'NivelRio',         N'm');

INSERT INTO dbo.AlertSeverities (AlertSeverityId, Name, Level) VALUES
    (1, N'Verde',    0),
    (2, N'Amarillo', 1),
    (3, N'Naranja',  2),
    (4, N'Rojo',     3);

INSERT INTO dbo.PhenomenonTypes (PhenomenonTypeId, Name) VALUES
    (1, N'Inundacion'),
    (2, N'Sequia'),
    (3, N'Tormenta'),
    (4, N'Helada'),
    (5, N'IncendioForestal');
GO