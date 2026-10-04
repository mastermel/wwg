using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wwg.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ScoutsAreTheCampaigns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A scout is now a campaign's non-combat observer (decision 0028), never the
            // library's: a library unit typed in as Scouts was cavalry that fights, and so are
            // its campaigns' copies. (Every army unit then had a library unit, but for boats.)
            migrationBuilder.Sql(
                "UPDATE \"Units\" SET \"Type\" = 'LightCavalry' WHERE \"Type\" = 'Scouts';"
            );
            migrationBuilder.Sql(
                "UPDATE \"ArmyUnits\" SET \"Type\" = 'LightCavalry' "
                    + "WHERE \"Type\" = 'Scouts' AND \"UnitId\" IS NOT NULL;"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Light cavalry that were scouts can't be told from the rest: they stay light
            // cavalry, and the campaigns' scouts stay scouts.
        }
    }
}
