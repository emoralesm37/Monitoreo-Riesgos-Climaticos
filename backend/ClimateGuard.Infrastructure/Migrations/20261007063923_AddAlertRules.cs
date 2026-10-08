using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClimateGuard.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAlertRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AlertRules",
                schema: "dbo",
                columns: table => new
                {
                    AlertRuleId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SensorTypeId = table.Column<byte>(type: "tinyint", nullable: false),
                    MinimumValue = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    MaximumValue = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    AlertSeverityId = table.Column<byte>(type: "tinyint", nullable: false),
                    PhenomenonTypeId = table.Column<byte>(type: "tinyint", nullable: false),
                    Message = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AlertRules", x => x.AlertRuleId);
                    table.ForeignKey(
                        name: "FK_AlertRules_AlertSeverities",
                        column: x => x.AlertSeverityId,
                        principalSchema: "dbo",
                        principalTable: "AlertSeverities",
                        principalColumn: "AlertSeverityId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AlertRules_PhenomenonTypes",
                        column: x => x.PhenomenonTypeId,
                        principalSchema: "dbo",
                        principalTable: "PhenomenonTypes",
                        principalColumn: "PhenomenonTypeId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AlertRules_SensorTypes",
                        column: x => x.SensorTypeId,
                        principalSchema: "dbo",
                        principalTable: "SensorTypes",
                        principalColumn: "SensorTypeId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AlertRules_AlertSeverityId",
                schema: "dbo",
                table: "AlertRules",
                column: "AlertSeverityId");

            migrationBuilder.CreateIndex(
                name: "IX_AlertRules_IsActive",
                schema: "dbo",
                table: "AlertRules",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_AlertRules_Name",
                schema: "dbo",
                table: "AlertRules",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AlertRules_PhenomenonTypeId",
                schema: "dbo",
                table: "AlertRules",
                column: "PhenomenonTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_AlertRules_SensorTypeId",
                schema: "dbo",
                table: "AlertRules",
                column: "SensorTypeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AlertRules",
                schema: "dbo");
        }
    }
}
