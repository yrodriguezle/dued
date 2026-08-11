using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class AddImpostazioniVetrina : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ImpostazioniVetrina",
                columns: table => new
                {
                    ImpostazioniVetrinaId = table.Column<int>(type: "int", nullable: false),
                    InsegnaPubblica = table.Column<string>(type: "varchar(150)", maxLength: 150, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Via = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Cap = table.Column<string>(type: "varchar(10)", maxLength: 10, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Citta = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Provincia = table.Column<string>(type: "varchar(5)", maxLength: 5, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Paese = table.Column<string>(type: "varchar(2)", maxLength: 2, nullable: false, defaultValue: "IT", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Latitudine = table.Column<decimal>(type: "decimal(9,6)", nullable: true),
                    Longitudine = table.Column<decimal>(type: "decimal(9,6)", nullable: true),
                    Telefono = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Email = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    UrlInstagram = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    UrlFacebook = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    MetaTitoloDefault = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    MetaDescrizioneDefault = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ImmagineOgId = table.Column<int>(type: "int", nullable: true),
                    OraInizioTemaSera = table.Column<string>(type: "varchar(5)", maxLength: 5, nullable: false, defaultValue: "18:00", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    PrenotazioniAttive = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    PrenotazioniPreavvisoOre = table.Column<int>(type: "int", nullable: false, defaultValue: 2),
                    PrenotazioniCopertiMax = table.Column<int>(type: "int", nullable: false, defaultValue: 20),
                    TurnstileSiteKey = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImpostazioniVetrina", x => x.ImpostazioniVetrinaId);
                    table.CheckConstraint("CK_ImpostazioniVetrina_Singleton", "`ImpostazioniVetrinaId` = 1");
                    table.ForeignKey(
                        name: "FK_ImpostazioniVetrina_MediaAssets_ImmagineOgId",
                        column: x => x.ImmagineOgId,
                        principalTable: "MediaAssets",
                        principalColumn: "MediaAssetId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_ImpostazioniVetrina_ImmagineOgId",
                table: "ImpostazioniVetrina",
                column: "ImmagineOgId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ImpostazioniVetrina");
        }
    }
}
