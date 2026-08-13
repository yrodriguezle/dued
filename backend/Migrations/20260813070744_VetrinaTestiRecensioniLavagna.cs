using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class VetrinaTestiRecensioniLavagna : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "InLavagnaDal",
                table: "Prodotti",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AperitivoCategorie",
                table: "ImpostazioniVetrina",
                type: "text",
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "AperitivoPunti",
                table: "ImpostazioniVetrina",
                type: "text",
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "AperitivoTesto",
                table: "ImpostazioniVetrina",
                type: "text",
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "AperitivoTitolo",
                table: "ImpostazioniVetrina",
                type: "varchar(200)",
                maxLength: 200,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ClaimVetrina",
                table: "ImpostazioniVetrina",
                type: "text",
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "NumeroRecensioniGoogle",
                table: "ImpostazioniVetrina",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PunteggioGoogle",
                table: "ImpostazioniVetrina",
                type: "decimal(2,1)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StoriaTesto",
                table: "ImpostazioniVetrina",
                type: "text",
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "StoriaTitolo",
                table: "ImpostazioniVetrina",
                type: "varchar(200)",
                maxLength: 200,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "UrlProfiloGoogle",
                table: "ImpostazioniVetrina",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "RecensioniVetrina",
                columns: table => new
                {
                    RecensioneVetrinaId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Autore = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Testo = table.Column<string>(type: "text", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Fonte = table.Column<string>(type: "varchar(60)", maxLength: 60, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Punteggio = table.Column<int>(type: "int", nullable: false, defaultValue: 5),
                    Ordinamento = table.Column<int>(type: "int", nullable: false),
                    Pubblicata = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecensioniVetrina", x => x.RecensioneVetrinaId);
                    table.CheckConstraint("CK_RecensioniVetrina_Punteggio", "`Punteggio` BETWEEN 1 AND 5");
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_Prodotti_InLavagnaDal",
                table: "Prodotti",
                column: "InLavagnaDal");

            migrationBuilder.CreateIndex(
                name: "IX_RecensioniVetrina_Pubblicata_Ordinamento",
                table: "RecensioniVetrina",
                columns: new[] { "Pubblicata", "Ordinamento" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RecensioniVetrina");

            migrationBuilder.DropIndex(
                name: "IX_Prodotti_InLavagnaDal",
                table: "Prodotti");

            migrationBuilder.DropColumn(
                name: "InLavagnaDal",
                table: "Prodotti");

            migrationBuilder.DropColumn(
                name: "AperitivoCategorie",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropColumn(
                name: "AperitivoPunti",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropColumn(
                name: "AperitivoTesto",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropColumn(
                name: "AperitivoTitolo",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropColumn(
                name: "ClaimVetrina",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropColumn(
                name: "NumeroRecensioniGoogle",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropColumn(
                name: "PunteggioGoogle",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropColumn(
                name: "StoriaTesto",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropColumn(
                name: "StoriaTitolo",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropColumn(
                name: "UrlProfiloGoogle",
                table: "ImpostazioniVetrina");
        }
    }
}
