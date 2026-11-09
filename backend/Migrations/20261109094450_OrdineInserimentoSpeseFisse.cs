using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class OrdineInserimentoSpeseFisse : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "SpeseCassa",
                type: "datetime(3)",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP(3)");

            // Le spese esistenti non hanno un istante proprio: prendono quello del loro registro.
            // A parità di istante l'ordine resta quello per id, come prima di questa migrazione.
            migrationBuilder.Sql(@"
                UPDATE SpeseCassa s
                JOIN RegistriCassa r ON r.Id = s.RegistroCassaId
                SET s.CreatedAt = r.CreatedAt;");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "PagamentiFornitori",
                type: "datetime(3)",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP(3)",
                oldClrType: typeof(DateTime),
                oldType: "datetime",
                oldDefaultValueSql: "CURRENT_TIMESTAMP");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "SpeseCassa");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "PagamentiFornitori",
                type: "datetime",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP",
                oldClrType: typeof(DateTime),
                oldType: "datetime(3)",
                oldDefaultValueSql: "CURRENT_TIMESTAMP(3)");
        }
    }
}
