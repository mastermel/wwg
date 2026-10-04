using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wwg.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddScreening : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Screening",
                table: "ArmyUnits",
                type: "INTEGER",
                nullable: false,
                defaultValue: false
            );

            migrationBuilder.CreateTable(
                name: "ScreeningTurns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ArmyUnitId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Turn = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreeningTurns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScreeningTurns_ArmyUnits_ArmyUnitId",
                        column: x => x.ArmyUnitId,
                        principalTable: "ArmyUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningTurns_ArmyUnitId_Turn",
                table: "ScreeningTurns",
                columns: new[] { "ArmyUnitId", "Turn" },
                unique: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "ScreeningTurns");

            migrationBuilder.DropColumn(name: "Screening", table: "ArmyUnits");
        }
    }
}
