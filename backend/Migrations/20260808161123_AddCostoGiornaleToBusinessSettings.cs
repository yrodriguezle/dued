using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class AddCostoGiornaleToBusinessSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "GiornaleImportoFeriale",
                table: "BusinessSettings",
                type: "decimal(10,2)",
                nullable: false,
                defaultValue: 3.20m);

            migrationBuilder.AddColumn<decimal>(
                name: "GiornaleImportoSabato",
                table: "BusinessSettings",
                type: "decimal(10,2)",
                nullable: false,
                defaultValue: 5.00m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GiornaleImportoFeriale",
                table: "BusinessSettings");

            migrationBuilder.DropColumn(
                name: "GiornaleImportoSabato",
                table: "BusinessSettings");
        }
    }
}
