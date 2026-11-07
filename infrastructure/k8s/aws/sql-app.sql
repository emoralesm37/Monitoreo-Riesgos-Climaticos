-- Only after sql-empty-schema succeeded, on a NEW database instance.
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_ID(N'ClimateGuard') IS NULL THROW 51000, 'Initialize the new schema first.', 1;
IF EXISTS (SELECT 1 FROM sys.server_principals WHERE name=N'$(CG_SQL_APP_USER)')
    THROW 51000, 'Identity already exists; refusing replacement.', 1;
BEGIN TRANSACTION;
CREATE LOGIN [$(CG_SQL_APP_USER)] WITH PASSWORD=N'$(CG_SQL_APP_PASSWORD)', CHECK_POLICY=ON;
USE [ClimateGuard];
CREATE USER [$(CG_SQL_APP_USER)] FOR LOGIN [$(CG_SQL_APP_USER)];
ALTER ROLE db_datareader ADD MEMBER [$(CG_SQL_APP_USER)];
ALTER ROLE db_datawriter ADD MEMBER [$(CG_SQL_APP_USER)];
GRANT EXECUTE TO [$(CG_SQL_APP_USER)];
COMMIT;
