using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wwg.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ImportTheUnitLibrary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(name: "IX_Units_FactionId", table: "Units");

            migrationBuilder.AddColumn<string>(
                name: "BrigadeCommander",
                table: "Units",
                type: "TEXT",
                maxLength: 100,
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "Corps",
                table: "Units",
                type: "TEXT",
                maxLength: 100,
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "CorpsCommander",
                table: "Units",
                type: "TEXT",
                maxLength: 100,
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "DivisionCommander",
                table: "Units",
                type: "TEXT",
                maxLength: 100,
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "ImportKey",
                table: "Units",
                type: "TEXT",
                maxLength: 400,
                nullable: true
            );

            migrationBuilder.AddColumn<int>(
                name: "ImportOrder",
                table: "Units",
                type: "INTEGER",
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "Units",
                type: "TEXT",
                maxLength: 500,
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Units",
                type: "TEXT",
                maxLength: 32,
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "BrigadeCommander",
                table: "ArmyUnits",
                type: "TEXT",
                maxLength: 100,
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "Corps",
                table: "ArmyUnits",
                type: "TEXT",
                maxLength: 100,
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "CorpsCommander",
                table: "ArmyUnits",
                type: "TEXT",
                maxLength: 100,
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "DivisionCommander",
                table: "ArmyUnits",
                type: "TEXT",
                maxLength: 100,
                nullable: true
            );

            migrationBuilder.AddColumn<int>(
                name: "ImportOrder",
                table: "ArmyUnits",
                type: "INTEGER",
                nullable: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_Units_FactionId_ImportKey",
                table: "Units",
                columns: new[] { "FactionId", "ImportKey" },
                unique: true
            );

            // Decision 0025: the units entered by hand so far make way for the imported library.
            // Each goes to an archive faction with its faction's flag ("Archive (France)"), so
            // its army copies still march as the same nation (step 45). Army units only point
            // back at library units, so campaigns keep theirs. Each archive faction takes the
            // ID of its first unit (an ID no faction has), as AddFactions did. Nothing to move,
            // no archive. Down leaves them where they are.
            migrationBuilder.Sql(
                """
                CREATE TEMP TABLE "ArchivedUnits" AS
                SELECT u."Id" AS "UnitId", f."Nation" AS "Nation"
                FROM "Units" AS u
                JOIN "Factions" AS f ON f."Id" = u."FactionId";

                INSERT INTO "Factions" ("Id", "Name", "Nation", "CreatedAt", "UpdatedAt")
                SELECT MIN("UnitId"),
                    CASE "Nation" WHEN 'None' THEN 'Archive' ELSE 'Archive (' || "Nation" || ')' END,
                    "Nation",
                    strftime('%Y-%m-%d %H:%M:%f', 'now'),
                    strftime('%Y-%m-%d %H:%M:%f', 'now')
                FROM "ArchivedUnits"
                GROUP BY "Nation";

                UPDATE "Units"
                SET "FactionId" = (
                        SELECT MIN(o."UnitId")
                        FROM "ArchivedUnits" AS a
                        JOIN "ArchivedUnits" AS o ON o."Nation" = a."Nation"
                        WHERE a."UnitId" = "Units"."Id"
                    ),
                    "UpdatedAt" = strftime('%Y-%m-%d %H:%M:%f', 'now');

                DROP TABLE "ArchivedUnits";
                """
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(name: "IX_Units_FactionId_ImportKey", table: "Units");

            migrationBuilder.DropColumn(name: "BrigadeCommander", table: "Units");

            migrationBuilder.DropColumn(name: "Corps", table: "Units");

            migrationBuilder.DropColumn(name: "CorpsCommander", table: "Units");

            migrationBuilder.DropColumn(name: "DivisionCommander", table: "Units");

            migrationBuilder.DropColumn(name: "ImportKey", table: "Units");

            migrationBuilder.DropColumn(name: "ImportOrder", table: "Units");

            migrationBuilder.DropColumn(name: "Notes", table: "Units");

            migrationBuilder.DropColumn(name: "Status", table: "Units");

            migrationBuilder.DropColumn(name: "BrigadeCommander", table: "ArmyUnits");

            migrationBuilder.DropColumn(name: "Corps", table: "ArmyUnits");

            migrationBuilder.DropColumn(name: "CorpsCommander", table: "ArmyUnits");

            migrationBuilder.DropColumn(name: "DivisionCommander", table: "ArmyUnits");

            migrationBuilder.DropColumn(name: "ImportOrder", table: "ArmyUnits");

            migrationBuilder.CreateIndex(
                name: "IX_Units_FactionId",
                table: "Units",
                column: "FactionId"
            );
        }
    }
}
