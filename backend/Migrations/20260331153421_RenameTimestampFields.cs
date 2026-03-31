using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class RenameTimestampFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "CreatoIl",
                table: "Vendite",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "AggiornatoIl",
                table: "Vendite",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "CreatoIl",
                table: "SpeseMensiliLibere",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "AggiornatoIl",
                table: "SpeseMensiliLibere",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "CreatoIl",
                table: "SpeseMensili",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "AggiornatoIl",
                table: "SpeseMensili",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "CreatoIl",
                table: "RegistriCassa",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "AggiornatoIl",
                table: "RegistriCassa",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "CreatoIl",
                table: "Prodotti",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "AggiornatoIl",
                table: "Prodotti",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "CreatoIl",
                table: "PeriodiProgrammazione",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "AggiornatoIl",
                table: "PeriodiProgrammazione",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "CreatoIl",
                table: "PagamentiFornitori",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "AggiornatoIl",
                table: "PagamentiFornitori",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "CreatoIl",
                table: "GiorniNonLavorativi",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "AggiornatoIl",
                table: "GiorniNonLavorativi",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "CreatoIl",
                table: "Fornitori",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "AggiornatoIl",
                table: "Fornitori",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "CreatoIl",
                table: "FattureAcquisto",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "AggiornatoIl",
                table: "FattureAcquisto",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "CreatoIl",
                table: "DocumentiTrasporto",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "AggiornatoIl",
                table: "DocumentiTrasporto",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "CreatoIl",
                table: "ChiusureMensili",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "AggiornatoIl",
                table: "ChiusureMensili",
                newName: "UpdatedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "Vendite",
                newName: "AggiornatoIl");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "Vendite",
                newName: "CreatoIl");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "SpeseMensiliLibere",
                newName: "AggiornatoIl");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "SpeseMensiliLibere",
                newName: "CreatoIl");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "SpeseMensili",
                newName: "AggiornatoIl");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "SpeseMensili",
                newName: "CreatoIl");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "RegistriCassa",
                newName: "AggiornatoIl");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "RegistriCassa",
                newName: "CreatoIl");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "Prodotti",
                newName: "AggiornatoIl");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "Prodotti",
                newName: "CreatoIl");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "PeriodiProgrammazione",
                newName: "AggiornatoIl");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "PeriodiProgrammazione",
                newName: "CreatoIl");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "PagamentiFornitori",
                newName: "AggiornatoIl");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "PagamentiFornitori",
                newName: "CreatoIl");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "GiorniNonLavorativi",
                newName: "AggiornatoIl");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "GiorniNonLavorativi",
                newName: "CreatoIl");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "Fornitori",
                newName: "AggiornatoIl");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "Fornitori",
                newName: "CreatoIl");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "FattureAcquisto",
                newName: "AggiornatoIl");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "FattureAcquisto",
                newName: "CreatoIl");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "DocumentiTrasporto",
                newName: "AggiornatoIl");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "DocumentiTrasporto",
                newName: "CreatoIl");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "ChiusureMensili",
                newName: "AggiornatoIl");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "ChiusureMensili",
                newName: "CreatoIl");
        }
    }
}
