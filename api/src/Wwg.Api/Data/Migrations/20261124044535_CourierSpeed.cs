using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wwg.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CourierSpeed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "CourierSpeed",
                table: "Campaigns",
                type: "REAL",
                nullable: false,
                // Half as far again as light cavalry, as new campaigns have.
                defaultValue: 1.5
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "CourierSpeed", table: "Campaigns");
        }
    }
}
