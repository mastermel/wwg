using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wwg.Api.Data.Migrations
{
    /// <summary>
    /// A Player can command several armies, all of one side (decision 0036): the commander's
    /// index stops being unique, and a trigger holds a commander's armies to one side.
    /// </summary>
    public partial class AllowSeveralArmiesPerPlayer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(name: "IX_Armies_CommanderId", table: "Armies");

            migrationBuilder.CreateIndex(
                name: "IX_Armies_CommanderId",
                table: "Armies",
                column: "CommanderId"
            );

            CommanderRules.CreateOneSide(migrationBuilder);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            CommanderRules.DropOneSide(migrationBuilder);

            migrationBuilder.DropIndex(name: "IX_Armies_CommanderId", table: "Armies");

            migrationBuilder.CreateIndex(
                name: "IX_Armies_CommanderId",
                table: "Armies",
                column: "CommanderId",
                unique: true
            );
        }
    }
}
