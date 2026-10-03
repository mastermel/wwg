using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wwg.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddUnitDivisionAndBrigade : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Brigade",
                table: "Units",
                type: "TEXT",
                maxLength: 100,
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "Division",
                table: "Units",
                type: "TEXT",
                maxLength: 100,
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "Brigade",
                table: "ArmyUnits",
                type: "TEXT",
                maxLength: 100,
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "Division",
                table: "ArmyUnits",
                type: "TEXT",
                maxLength: 100,
                nullable: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "Brigade", table: "Units");

            migrationBuilder.DropColumn(name: "Division", table: "Units");

            migrationBuilder.DropColumn(name: "Brigade", table: "ArmyUnits");

            migrationBuilder.DropColumn(name: "Division", table: "ArmyUnits");
        }
    }
}
