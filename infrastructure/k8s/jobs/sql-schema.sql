-- Fresh, EMPTY database only. No credentials or business records.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF EXISTS (SELECT 1 FROM sys.tables WHERE is_ms_shipped=0) THROW 51000, 'Database is not empty; refusing initialization.', 1;
GO
CREATE TABLE [dbo].[AlertSeverities] (
    [AlertSeverityId] tinyint NOT NULL,
    [Name] nvarchar(20) NOT NULL,
    [Level] tinyint NOT NULL,
    CONSTRAINT [PK_AlertSeverities] PRIMARY KEY ([AlertSeverityId])
);
GO


CREATE TABLE [dbo].[Communities] (
    [CommunityId] int NOT NULL IDENTITY,
    [Name] nvarchar(120) NOT NULL,
    [Municipality] nvarchar(120) NOT NULL,
    [Department] nvarchar(120) NOT NULL,
    [Country] nvarchar(100) NOT NULL,
    [Latitude] decimal(9,6) NULL,
    [Longitude] decimal(9,6) NULL,
    [Description] nvarchar(500) NULL,
    [IsActive] bit NOT NULL DEFAULT CAST(1 AS bit),
    CONSTRAINT [PK_Communities] PRIMARY KEY ([CommunityId])
);
GO


CREATE TABLE [dbo].[PhenomenonTypes] (
    [PhenomenonTypeId] tinyint NOT NULL,
    [Name] nvarchar(30) NOT NULL,
    CONSTRAINT [PK_PhenomenonTypes] PRIMARY KEY ([PhenomenonTypeId])
);
GO


CREATE TABLE [dbo].[Roles] (
    [RoleId] tinyint NOT NULL,
    [Name] nvarchar(30) NOT NULL,
    CONSTRAINT [PK_Roles] PRIMARY KEY ([RoleId])
);
GO


CREATE TABLE [dbo].[SensorTypes] (
    [SensorTypeId] tinyint NOT NULL,
    [Code] nvarchar(30) NOT NULL,
    [Unit] nvarchar(15) NOT NULL,
    CONSTRAINT [PK_SensorTypes] PRIMARY KEY ([SensorTypeId])
);
GO


CREATE TABLE [dbo].[Users] (
    [UserId] int NOT NULL IDENTITY,
    [Name] nvarchar(100) NOT NULL,
    [Email] nvarchar(150) NOT NULL,
    [PasswordHash] nvarchar(300) NOT NULL,
    [RoleId] tinyint NOT NULL,
    [IsActive] bit NOT NULL DEFAULT CAST(1 AS bit),
    [CreatedAt] datetime2 NOT NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_Users] PRIMARY KEY ([UserId]),
    CONSTRAINT [FK_Users_Roles] FOREIGN KEY ([RoleId]) REFERENCES [dbo].[Roles] ([RoleId])
);
GO


CREATE TABLE [dbo].[AlertRules] (
    [AlertRuleId] int NOT NULL IDENTITY,
    [Name] nvarchar(100) NOT NULL,
    [SensorTypeId] tinyint NOT NULL,
    [MinimumValue] decimal(10,2) NOT NULL,
    [MaximumValue] decimal(10,2) NOT NULL,
    [AlertSeverityId] tinyint NOT NULL,
    [PhenomenonTypeId] tinyint NOT NULL,
    [Message] nvarchar(300) NOT NULL,
    [IsActive] bit NOT NULL DEFAULT CAST(1 AS bit),
    [CreatedAt] datetime2 NOT NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_AlertRules] PRIMARY KEY ([AlertRuleId]),
    CONSTRAINT [FK_AlertRules_AlertSeverities] FOREIGN KEY ([AlertSeverityId]) REFERENCES [dbo].[AlertSeverities] ([AlertSeverityId]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AlertRules_PhenomenonTypes] FOREIGN KEY ([PhenomenonTypeId]) REFERENCES [dbo].[PhenomenonTypes] ([PhenomenonTypeId]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AlertRules_SensorTypes] FOREIGN KEY ([SensorTypeId]) REFERENCES [dbo].[SensorTypes] ([SensorTypeId]) ON DELETE NO ACTION
);
GO


CREATE TABLE [dbo].[Sensors] (
    [SensorId] int NOT NULL IDENTITY,
    [Name] nvarchar(100) NOT NULL,
    [SensorTypeId] tinyint NOT NULL,
    [CommunityId] int NOT NULL,
    [IsActive] bit NOT NULL DEFAULT CAST(1 AS bit),
    [LastValue] decimal(10,2) NULL,
    [LastUpdatedAt] datetime2 NULL,
    [CreatedAt] datetime2 NOT NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_Sensors] PRIMARY KEY ([SensorId]),
    CONSTRAINT [FK_Sensors_Communities] FOREIGN KEY ([CommunityId]) REFERENCES [dbo].[Communities] ([CommunityId]),
    CONSTRAINT [FK_Sensors_SensorTypes] FOREIGN KEY ([SensorTypeId]) REFERENCES [dbo].[SensorTypes] ([SensorTypeId])
);
GO


CREATE TABLE [dbo].[AuditLogEntries] (
    [AuditLogEntryId] int NOT NULL IDENTITY,
    [UserId] int NOT NULL,
    [Action] nvarchar(60) NOT NULL,
    [EntityAffected] nvarchar(60) NULL,
    [Timestamp] datetime2 NOT NULL DEFAULT (SYSUTCDATETIME()),
    [Details] nvarchar(500) NULL,
    CONSTRAINT [PK_AuditLogEntries] PRIMARY KEY ([AuditLogEntryId]),
    CONSTRAINT [FK_AuditLogEntries_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([UserId])
);
GO


CREATE TABLE [dbo].[RefreshTokens] (
    [RefreshTokenId] int NOT NULL IDENTITY,
    [UserId] int NOT NULL,
    [TokenHash] nvarchar(300) NOT NULL,
    [ExpiresAt] datetime2 NOT NULL,
    [CreatedAt] datetime2 NOT NULL DEFAULT (SYSUTCDATETIME()),
    [RevokedAt] datetime2 NULL,
    [ReplacedByTokenId] int NULL,
    [CreatedByIp] nvarchar(45) NULL,
    CONSTRAINT [PK_RefreshTokens] PRIMARY KEY ([RefreshTokenId]),
    CONSTRAINT [FK_RefreshTokens_ReplacedBy] FOREIGN KEY ([ReplacedByTokenId]) REFERENCES [dbo].[RefreshTokens] ([RefreshTokenId]),
    CONSTRAINT [FK_RefreshTokens_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([UserId])
);
GO


CREATE TABLE [dbo].[Alerts] (
    [AlertId] bigint NOT NULL IDENTITY,
    [SensorId] int NULL,
    [AlertSeverityId] tinyint NOT NULL,
    [PhenomenonTypeId] tinyint NULL,
    [TriggerValue] decimal(10,2) NULL,
    [Message] nvarchar(300) NOT NULL,
    [CreatedAt] datetime2 NOT NULL DEFAULT (SYSUTCDATETIME()),
    [ResolvedAt] datetime2 NULL,
    [ResolvedByUserId] int NULL,
    CONSTRAINT [PK_Alerts] PRIMARY KEY ([AlertId]),
    CONSTRAINT [FK_Alerts_AlertSeverities] FOREIGN KEY ([AlertSeverityId]) REFERENCES [dbo].[AlertSeverities] ([AlertSeverityId]),
    CONSTRAINT [FK_Alerts_PhenomenonTypes] FOREIGN KEY ([PhenomenonTypeId]) REFERENCES [dbo].[PhenomenonTypes] ([PhenomenonTypeId]),
    CONSTRAINT [FK_Alerts_Sensors] FOREIGN KEY ([SensorId]) REFERENCES [dbo].[Sensors] ([SensorId]),
    CONSTRAINT [FK_Alerts_Users_ResolvedBy] FOREIGN KEY ([ResolvedByUserId]) REFERENCES [dbo].[Users] ([UserId])
);
GO


CREATE TABLE [dbo].[SensorReadings] (
    [SensorReadingId] bigint NOT NULL IDENTITY,
    [SensorId] int NOT NULL,
    [Value] decimal(10,2) NOT NULL,
    [Timestamp] datetime2 NOT NULL DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_SensorReadings] PRIMARY KEY ([SensorReadingId]),
    CONSTRAINT [FK_SensorReadings_Sensors] FOREIGN KEY ([SensorId]) REFERENCES [dbo].[Sensors] ([SensorId])
);
GO


CREATE TABLE [dbo].[ReadingAlertDeliveries] (
    [SensorReadingId] bigint NOT NULL,
    [Payload] nvarchar(max) NOT NULL,
    [Attempts] int NOT NULL,
    [DeliveredAt] datetime2 NULL,
    CONSTRAINT [PK_ReadingAlertDeliveries] PRIMARY KEY ([SensorReadingId]),
    CONSTRAINT [FK_ReadingAlertDeliveries_SensorReadings_SensorReadingId] FOREIGN KEY ([SensorReadingId]) REFERENCES [dbo].[SensorReadings] ([SensorReadingId]) ON DELETE NO ACTION
);
GO


CREATE INDEX [IX_AlertRules_AlertSeverityId] ON [dbo].[AlertRules] ([AlertSeverityId]);
GO


CREATE INDEX [IX_AlertRules_IsActive] ON [dbo].[AlertRules] ([IsActive]);
GO


CREATE UNIQUE INDEX [IX_AlertRules_Name] ON [dbo].[AlertRules] ([Name]);
GO


CREATE INDEX [IX_AlertRules_PhenomenonTypeId] ON [dbo].[AlertRules] ([PhenomenonTypeId]);
GO


CREATE INDEX [IX_AlertRules_SensorTypeId] ON [dbo].[AlertRules] ([SensorTypeId]);
GO


CREATE INDEX [IX_Alerts_AlertSeverityId] ON [dbo].[Alerts] ([AlertSeverityId]);
GO


CREATE INDEX [IX_Alerts_CreatedAt] ON [dbo].[Alerts] ([CreatedAt] DESC);
GO


CREATE INDEX [IX_Alerts_PhenomenonTypeId] ON [dbo].[Alerts] ([PhenomenonTypeId]);
GO


CREATE INDEX [IX_Alerts_ResolvedByUserId] ON [dbo].[Alerts] ([ResolvedByUserId]);
GO


CREATE INDEX [IX_Alerts_SensorId] ON [dbo].[Alerts] ([SensorId]);
GO


CREATE UNIQUE INDEX [IX_AlertSeverities_Name] ON [dbo].[AlertSeverities] ([Name]);
GO


CREATE INDEX [IX_AuditLogEntries_UserId] ON [dbo].[AuditLogEntries] ([UserId]);
GO


CREATE INDEX [IX_Communities_Department] ON [dbo].[Communities] ([Department]);
GO


CREATE INDEX [IX_Communities_IsActive] ON [dbo].[Communities] ([IsActive]);
GO


CREATE INDEX [IX_Communities_Municipality] ON [dbo].[Communities] ([Municipality]);
GO


CREATE UNIQUE INDEX [IX_Communities_Name] ON [dbo].[Communities] ([Name]);
GO


CREATE UNIQUE INDEX [IX_PhenomenonTypes_Name] ON [dbo].[PhenomenonTypes] ([Name]);
GO


CREATE INDEX [IX_RefreshTokens_ReplacedByTokenId] ON [dbo].[RefreshTokens] ([ReplacedByTokenId]);
GO


CREATE INDEX [IX_RefreshTokens_UserId] ON [dbo].[RefreshTokens] ([UserId]);
GO


CREATE UNIQUE INDEX [IX_Roles_Name] ON [dbo].[Roles] ([Name]);
GO


CREATE INDEX [IX_SensorReadings_SensorId_Timestamp] ON [dbo].[SensorReadings] ([SensorId], [Timestamp] DESC);
GO


CREATE INDEX [IX_Sensors_CommunityId] ON [dbo].[Sensors] ([CommunityId]);
GO


CREATE INDEX [IX_Sensors_SensorTypeId] ON [dbo].[Sensors] ([SensorTypeId]);
GO


CREATE UNIQUE INDEX [IX_SensorTypes_Code] ON [dbo].[SensorTypes] ([Code]);
GO


CREATE UNIQUE INDEX [IX_Users_Email] ON [dbo].[Users] ([Email]);
GO


CREATE INDEX [IX_Users_RoleId] ON [dbo].[Users] ([RoleId]);
GO



COMMIT;
