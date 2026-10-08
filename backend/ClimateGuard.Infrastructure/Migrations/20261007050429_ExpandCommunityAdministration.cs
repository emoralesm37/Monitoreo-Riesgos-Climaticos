using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClimateGuard.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ExpandCommunityAdministration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Country",
                schema: "dbo",
                table: "Communities",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Department",
                schema: "dbo",
                table: "Communities",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Description",
                schema: "dbo",
                table: "Communities",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                schema: "dbo",
                table: "Communities",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "Municipality",
                schema: "dbo",
                table: "Communities",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "");

            // Conserva la información de la antigua columna Region.
            migrationBuilder.Sql(
                """
                UPDATE [dbo].[Communities]
                SET
                    [Department] = COALESCE(
                        NULLIF(LTRIM(RTRIM([Region])), N''),
                        N'Sin especificar'
                    ),
                    [Municipality] = COALESCE(
                        NULLIF(LTRIM(RTRIM([Region])), N''),
                        N'Sin especificar'
                    ),
                    [Country] = N'Guatemala';
                """);

            // Region se elimina solamente después de copiar sus datos.
            migrationBuilder.DropColumn(
                name: "Region",
                schema: "dbo",
                table: "Communities");

            migrationBuilder.CreateIndex(
                name: "IX_Communities_Department",
                schema: "dbo",
                table: "Communities",
                column: "Department");

            migrationBuilder.CreateIndex(
                name: "IX_Communities_IsActive",
                schema: "dbo",
                table: "Communities",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_Communities_Municipality",
                schema: "dbo",
                table: "Communities",
                column: "Municipality");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Communities_Department",
                schema: "dbo",
                table: "Communities");

            migrationBuilder.DropIndex(
                name: "IX_Communities_IsActive",
                schema: "dbo",
                table: "Communities");

            migrationBuilder.DropIndex(
                name: "IX_Communities_Municipality",
                schema: "dbo",
                table: "Communities");

            // Se reconstruye Region antes de eliminar Department.
            migrationBuilder.AddColumn<string>(
                name: "Region",
                schema: "dbo",
                table: "Communities",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE [dbo].[Communities]
                SET [Region] = [Department];
                """);

            migrationBuilder.DropColumn(
                name: "Country",
                schema: "dbo",
                table: "Communities");

            migrationBuilder.DropColumn(
                name: "Department",
                schema: "dbo",
                table: "Communities");

            migrationBuilder.DropColumn(
                name: "Description",
                schema: "dbo",
                table: "Communities");

            migrationBuilder.DropColumn(
                name: "IsActive",
                schema: "dbo",
                table: "Communities");

            migrationBuilder.DropColumn(
                name: "Municipality",
                schema: "dbo",
                table: "Communities");
        }
    }
}