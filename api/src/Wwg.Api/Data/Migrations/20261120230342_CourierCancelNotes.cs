using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wwg.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CourierCancelNotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // AddForeignKey would rebuild the table at the end of the migration: SQLite adds a
            // column with its foreign key in place. The model snapshot records the same foreign key.
            migrationBuilder.Sql(
                """
                ALTER TABLE "IntelReports" ADD "StoppedByUserId" TEXT NULL
                    REFERENCES "AspNetUsers" ("Id") ON DELETE SET NULL;
                """
            );

            migrationBuilder.AddColumn<string>(
                name: "StoppedNote",
                table: "IntelReports",
                type: "TEXT",
                maxLength: 500,
                nullable: true
            );

            migrationBuilder.AddColumn<int>(
                name: "StoppedTurn",
                table: "IntelReports",
                type: "INTEGER",
                nullable: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_IntelReports_StoppedByUserId",
                table: "IntelReports",
                column: "StoppedByUserId"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_IntelReports_AspNetUsers_StoppedByUserId",
                table: "IntelReports"
            );

            migrationBuilder.DropIndex(
                name: "IX_IntelReports_StoppedByUserId",
                table: "IntelReports"
            );

            migrationBuilder.DropColumn(name: "StoppedByUserId", table: "IntelReports");

            migrationBuilder.DropColumn(name: "StoppedNote", table: "IntelReports");

            migrationBuilder.DropColumn(name: "StoppedTurn", table: "IntelReports");
        }
    }
}
