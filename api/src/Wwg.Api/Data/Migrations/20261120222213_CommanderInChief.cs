using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wwg.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CommanderInChief : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsCommanderInChief",
                table: "ArmyUnits",
                type: "INTEGER",
                nullable: false,
                defaultValue: false
            );

            migrationBuilder.CreateIndex(
                name: "IX_ArmyUnits_CommanderInChief",
                table: "ArmyUnits",
                column: "ArmyId",
                unique: true,
                filter: "\"IsCommanderInChief\" = 1"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(name: "IX_ArmyUnits_CommanderInChief", table: "ArmyUnits");

            migrationBuilder.DropColumn(name: "IsCommanderInChief", table: "ArmyUnits");
        }
    }
}
