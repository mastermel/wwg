using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wwg.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CommandersHaveNoStats : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A Commander has no FF or points (decision 0034), in the library and in campaigns.
            // Imported ones had FF 1 (then the lowest allowed) and 0 points.
            migrationBuilder.Sql(
                "UPDATE \"Units\" SET \"FightingFactor\" = 0, \"Points\" = 0 "
                    + "WHERE \"Type\" = 'Commander' AND (\"FightingFactor\" <> 0 OR \"Points\" <> 0);"
            );
            migrationBuilder.Sql(
                "UPDATE \"ArmyUnits\" SET \"FightingFactor\" = 0, \"Points\" = 0 "
                    + "WHERE \"Type\" = 'Commander' AND (\"FightingFactor\" <> 0 OR \"Points\" <> 0);"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // The FF and points they had are gone: Commanders keep 0.
        }
    }
}
