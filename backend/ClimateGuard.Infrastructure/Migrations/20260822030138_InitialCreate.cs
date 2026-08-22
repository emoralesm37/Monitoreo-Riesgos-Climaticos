using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClimateGuard.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "dbo");

            migrationBuilder.CreateTable(
                name: "AlertSeverities",
                schema: "dbo",
                columns: table => new
                {
                    AlertSeverityId = table.Column<byte>(type: "tinyint", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Level = table.Column<byte>(type: "tinyint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AlertSeverities", x => x.AlertSeverityId);
                });

            migrationBuilder.CreateTable(
                name: "Communities",
                schema: "dbo",
                columns: table => new
                {
                    CommunityId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Region = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    Latitude = table.Column<decimal>(type: "decimal(9,6)", nullable: true),
                    Longitude = table.Column<decimal>(type: "decimal(9,6)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Communities", x => x.CommunityId);
                });

            migrationBuilder.CreateTable(
                name: "PhenomenonTypes",
                schema: "dbo",
                columns: table => new
                {
                    PhenomenonTypeId = table.Column<byte>(type: "tinyint", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhenomenonTypes", x => x.PhenomenonTypeId);
                });

            migrationBuilder.CreateTable(
                name: "Roles",
                schema: "dbo",
                columns: table => new
                {
                    RoleId = table.Column<byte>(type: "tinyint", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.RoleId);
                });

            migrationBuilder.CreateTable(
                name: "SensorTypes",
                schema: "dbo",
                columns: table => new
                {
                    SensorTypeId = table.Column<byte>(type: "tinyint", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Unit = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SensorTypes", x => x.SensorTypeId);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                schema: "dbo",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    RoleId = table.Column<byte>(type: "tinyint", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_Users_Roles",
                        column: x => x.RoleId,
                        principalSchema: "dbo",
                        principalTable: "Roles",
                        principalColumn: "RoleId");
                });

            migrationBuilder.CreateTable(
                name: "Sensors",
                schema: "dbo",
                columns: table => new
                {
                    SensorId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SensorTypeId = table.Column<byte>(type: "tinyint", nullable: false),
                    CommunityId = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    LastValue = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    LastUpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sensors", x => x.SensorId);
                    table.ForeignKey(
                        name: "FK_Sensors_Communities",
                        column: x => x.CommunityId,
                        principalSchema: "dbo",
                        principalTable: "Communities",
                        principalColumn: "CommunityId");
                    table.ForeignKey(
                        name: "FK_Sensors_SensorTypes",
                        column: x => x.SensorTypeId,
                        principalSchema: "dbo",
                        principalTable: "SensorTypes",
                        principalColumn: "SensorTypeId");
                });

            migrationBuilder.CreateTable(
                name: "AuditLogEntries",
                schema: "dbo",
                columns: table => new
                {
                    AuditLogEntryId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Action = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    EntityAffected = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    Timestamp = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    Details = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLogEntries", x => x.AuditLogEntryId);
                    table.ForeignKey(
                        name: "FK_AuditLogEntries_Users",
                        column: x => x.UserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "UserId");
                });

            migrationBuilder.CreateTable(
                name: "RefreshTokens",
                schema: "dbo",
                columns: table => new
                {
                    RefreshTokenId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    TokenHash = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    RevokedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReplacedByTokenId = table.Column<int>(type: "int", nullable: true),
                    CreatedByIp = table.Column<string>(type: "nvarchar(45)", maxLength: 45, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RefreshTokens", x => x.RefreshTokenId);
                    table.ForeignKey(
                        name: "FK_RefreshTokens_ReplacedBy",
                        column: x => x.ReplacedByTokenId,
                        principalSchema: "dbo",
                        principalTable: "RefreshTokens",
                        principalColumn: "RefreshTokenId");
                    table.ForeignKey(
                        name: "FK_RefreshTokens_Users",
                        column: x => x.UserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "UserId");
                });

            migrationBuilder.CreateTable(
                name: "Alerts",
                schema: "dbo",
                columns: table => new
                {
                    AlertId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SensorId = table.Column<int>(type: "int", nullable: true),
                    AlertSeverityId = table.Column<byte>(type: "tinyint", nullable: false),
                    PhenomenonTypeId = table.Column<byte>(type: "tinyint", nullable: true),
                    TriggerValue = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    Message = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    ResolvedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ResolvedByUserId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Alerts", x => x.AlertId);
                    table.ForeignKey(
                        name: "FK_Alerts_AlertSeverities",
                        column: x => x.AlertSeverityId,
                        principalSchema: "dbo",
                        principalTable: "AlertSeverities",
                        principalColumn: "AlertSeverityId");
                    table.ForeignKey(
                        name: "FK_Alerts_PhenomenonTypes",
                        column: x => x.PhenomenonTypeId,
                        principalSchema: "dbo",
                        principalTable: "PhenomenonTypes",
                        principalColumn: "PhenomenonTypeId");
                    table.ForeignKey(
                        name: "FK_Alerts_Sensors",
                        column: x => x.SensorId,
                        principalSchema: "dbo",
                        principalTable: "Sensors",
                        principalColumn: "SensorId");
                    table.ForeignKey(
                        name: "FK_Alerts_Users_ResolvedBy",
                        column: x => x.ResolvedByUserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "UserId");
                });

            migrationBuilder.CreateTable(
                name: "SensorReadings",
                schema: "dbo",
                columns: table => new
                {
                    SensorReadingId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SensorId = table.Column<int>(type: "int", nullable: false),
                    Value = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SensorReadings", x => x.SensorReadingId);
                    table.ForeignKey(
                        name: "FK_SensorReadings_Sensors",
                        column: x => x.SensorId,
                        principalSchema: "dbo",
                        principalTable: "Sensors",
                        principalColumn: "SensorId");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Alerts_AlertSeverityId",
                schema: "dbo",
                table: "Alerts",
                column: "AlertSeverityId");

            migrationBuilder.CreateIndex(
                name: "IX_Alerts_CreatedAt",
                schema: "dbo",
                table: "Alerts",
                column: "CreatedAt",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_Alerts_PhenomenonTypeId",
                schema: "dbo",
                table: "Alerts",
                column: "PhenomenonTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_Alerts_ResolvedByUserId",
                schema: "dbo",
                table: "Alerts",
                column: "ResolvedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Alerts_SensorId",
                schema: "dbo",
                table: "Alerts",
                column: "SensorId");

            migrationBuilder.CreateIndex(
                name: "IX_AlertSeverities_Name",
                schema: "dbo",
                table: "AlertSeverities",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogEntries_UserId",
                schema: "dbo",
                table: "AuditLogEntries",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Communities_Name",
                schema: "dbo",
                table: "Communities",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PhenomenonTypes_Name",
                schema: "dbo",
                table: "PhenomenonTypes",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_ReplacedByTokenId",
                schema: "dbo",
                table: "RefreshTokens",
                column: "ReplacedByTokenId");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_UserId",
                schema: "dbo",
                table: "RefreshTokens",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Roles_Name",
                schema: "dbo",
                table: "Roles",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SensorReadings_SensorId_Timestamp",
                schema: "dbo",
                table: "SensorReadings",
                columns: new[] { "SensorId", "Timestamp" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_Sensors_CommunityId",
                schema: "dbo",
                table: "Sensors",
                column: "CommunityId");

            migrationBuilder.CreateIndex(
                name: "IX_Sensors_SensorTypeId",
                schema: "dbo",
                table: "Sensors",
                column: "SensorTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_SensorTypes_Code",
                schema: "dbo",
                table: "SensorTypes",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                schema: "dbo",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_RoleId",
                schema: "dbo",
                table: "Users",
                column: "RoleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Alerts",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "AuditLogEntries",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "RefreshTokens",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "SensorReadings",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "AlertSeverities",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "PhenomenonTypes",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Users",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Sensors",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Roles",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Communities",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "SensorTypes",
                schema: "dbo");
        }
    }
}
