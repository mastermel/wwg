using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wwg.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddUmpireReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "FromArmyId",
                table: "IntelReports",
                type: "TEXT",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "TEXT"
            );

            migrationBuilder.AddColumn<bool>(
                name: "FromUmpire",
                table: "IntelReports",
                type: "INTEGER",
                nullable: false,
                defaultValue: false
            );

            migrationBuilder.AddCheckConstraint(
                name: "CK_IntelReports_FromUmpire",
                table: "IntelReports",
                sql: "(\"FromArmyId\" IS NULL) = (\"FromUmpire\" = 1)"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_IntelReports_FromUmpire",
                table: "IntelReports"
            );

            migrationBuilder.DropColumn(name: "FromUmpire", table: "IntelReports");

            migrationBuilder.AlterColumn<Guid>(
                name: "FromArmyId",
                table: "IntelReports",
                type: "TEXT",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "TEXT",
                oldNullable: true
            );
        }
    }
}
