using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class AddOrdiniPuntoVendita : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "OrdineId",
                table: "Vendite",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Ordini",
                columns: table => new
                {
                    OrdineId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    RegistroCassaId = table.Column<int>(type: "int", nullable: false),
                    Numero = table.Column<int>(type: "int", nullable: false),
                    SuffissoSplit = table.Column<string>(type: "varchar(2)", maxLength: 2, nullable: false, defaultValue: "", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Stato = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, defaultValue: "APERTO", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    MetodoPagamento = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    TotaleOrdine = table.Column<decimal>(type: "decimal(10,2)", nullable: false, defaultValue: 0m),
                    ContanteRicevuto = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    OrdinePadreId = table.Column<int>(type: "int", nullable: true),
                    ApertoDa = table.Column<int>(type: "int", nullable: true),
                    ApertoIl = table.Column<DateTime>(type: "datetime", nullable: false),
                    ChiusoDa = table.Column<int>(type: "int", nullable: true),
                    ChiusoIl = table.Column<DateTime>(type: "datetime", nullable: true),
                    AnnullatoDa = table.Column<int>(type: "int", nullable: true),
                    AnnullatoIl = table.Column<DateTime>(type: "datetime", nullable: true),
                    MotivoAnnullamento = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    StornatoDa = table.Column<int>(type: "int", nullable: true),
                    StornatoIl = table.Column<DateTime>(type: "datetime", nullable: true),
                    MotivoStorno = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Note = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Ordini", x => x.OrdineId);
                    table.ForeignKey(
                        name: "FK_Ordini_Ordini_OrdinePadreId",
                        column: x => x.OrdinePadreId,
                        principalTable: "Ordini",
                        principalColumn: "OrdineId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Ordini_RegistriCassa_RegistroCassaId",
                        column: x => x.RegistroCassaId,
                        principalTable: "RegistriCassa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "RigheOrdine",
                columns: table => new
                {
                    RigaOrdineId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    OrdineId = table.Column<int>(type: "int", nullable: false),
                    ProdottoId = table.Column<int>(type: "int", nullable: false),
                    Quantita = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    PrezzoUnitario = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    AliquotaIva = table.Column<decimal>(type: "decimal(5,2)", nullable: false, defaultValue: 10.00m),
                    PrezzoTotale = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    Note = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    DataOra = table.Column<DateTime>(type: "datetime", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RigheOrdine", x => x.RigaOrdineId);
                    table.ForeignKey(
                        name: "FK_RigheOrdine_Ordini_OrdineId",
                        column: x => x.OrdineId,
                        principalTable: "Ordini",
                        principalColumn: "OrdineId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RigheOrdine_Prodotti_ProdottoId",
                        column: x => x.ProdottoId,
                        principalTable: "Prodotti",
                        principalColumn: "ProdottoId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_Vendite_OrdineId",
                table: "Vendite",
                column: "OrdineId");

            migrationBuilder.CreateIndex(
                name: "IX_Ordini_OrdinePadreId",
                table: "Ordini",
                column: "OrdinePadreId");

            migrationBuilder.CreateIndex(
                name: "IX_Ordini_RegistroCassaId_Numero_SuffissoSplit",
                table: "Ordini",
                columns: new[] { "RegistroCassaId", "Numero", "SuffissoSplit" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Ordini_RegistroCassaId_Stato",
                table: "Ordini",
                columns: new[] { "RegistroCassaId", "Stato" });

            migrationBuilder.CreateIndex(
                name: "IX_RigheOrdine_OrdineId",
                table: "RigheOrdine",
                column: "OrdineId");

            migrationBuilder.CreateIndex(
                name: "IX_RigheOrdine_ProdottoId",
                table: "RigheOrdine",
                column: "ProdottoId");

            migrationBuilder.AddForeignKey(
                name: "FK_Vendite_Ordini_OrdineId",
                table: "Vendite",
                column: "OrdineId",
                principalTable: "Ordini",
                principalColumn: "OrdineId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Vendite_Ordini_OrdineId",
                table: "Vendite");

            migrationBuilder.DropTable(
                name: "RigheOrdine");

            migrationBuilder.DropTable(
                name: "Ordini");

            migrationBuilder.DropIndex(
                name: "IX_Vendite_OrdineId",
                table: "Vendite");

            migrationBuilder.DropColumn(
                name: "OrdineId",
                table: "Vendite");
        }
    }
}
