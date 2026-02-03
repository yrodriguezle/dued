using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class RimozioneColonneObsoleteChiusureMensili : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RicavoNetto",
                table: "ChiusureMensili");

            migrationBuilder.DropColumn(
                name: "RicavoTotale",
                table: "ChiusureMensili");

            migrationBuilder.DropColumn(
                name: "SpeseAggiuntive",
                table: "ChiusureMensili");

            migrationBuilder.DropColumn(
                name: "TotaleContanti",
                table: "ChiusureMensili");

            migrationBuilder.DropColumn(
                name: "TotaleElettronici",
                table: "ChiusureMensili");

            migrationBuilder.DropColumn(
                name: "TotaleFatture",
                table: "ChiusureMensili");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "RicavoNetto",
                table: "ChiusureMensili",
                type: "decimal(10,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RicavoTotale",
                table: "ChiusureMensili",
                type: "decimal(10,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SpeseAggiuntive",
                table: "ChiusureMensili",
                type: "decimal(10,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TotaleContanti",
                table: "ChiusureMensili",
                type: "decimal(10,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TotaleElettronici",
                table: "ChiusureMensili",
                type: "decimal(10,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TotaleFatture",
                table: "ChiusureMensili",
                type: "decimal(10,2)",
                nullable: true);
        }
    }
}
