using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClimateGuard.Sensor.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialSensorSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "dbo");

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
                        name: "FK_Sensors_SensorTypes",
                        column: x => x.SensorTypeId,
                        principalSchema: "dbo",
                        principalTable: "SensorTypes",
                        principalColumn: "SensorTypeId");
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
                name: "IX_SensorReadings_SensorId_Timestamp",
                schema: "dbo",
                table: "SensorReadings",
                columns: new[] { "SensorId", "Timestamp" },
                descending: new[] { false, true });

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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SensorReadings",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Sensors",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "SensorTypes",
                schema: "dbo");
        }
    }
}
