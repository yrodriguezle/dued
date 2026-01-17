using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class AddSupplierAndMonthlyClosureTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ChiusureMensili",
                columns: table => new
                {
                    ChiusuraId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Anno = table.Column<int>(type: "int", nullable: false),
                    Mese = table.Column<int>(type: "int", nullable: false),
                    UltimoGiornoLavorativo = table.Column<DateTime>(type: "date", nullable: false),
                    RicavoTotale = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    TotaleContanti = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    TotaleElettronici = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    TotaleFatture = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    SpeseAggiuntive = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    RicavoNetto = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    Stato = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, defaultValue: "BOZZA", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Note = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ChiusaDa = table.Column<int>(type: "int", nullable: true),
                    ChiusaIl = table.Column<DateTime>(type: "datetime", nullable: true),
                    CreatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    AggiornatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChiusureMensili", x => x.ChiusuraId);
                    table.ForeignKey(
                        name: "FK_ChiusureMensili_Users_ChiusaDa",
                        column: x => x.ChiusaDa,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "Fornitori",
                columns: table => new
                {
                    FornitoreId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    RagioneSociale = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    PartitaIva = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CodiceFiscale = table.Column<string>(type: "varchar(16)", maxLength: 16, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Indirizzo = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Citta = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Cap = table.Column<string>(type: "varchar(10)", maxLength: 10, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Paese = table.Column<string>(type: "varchar(2)", maxLength: 2, nullable: false, defaultValue: "IT", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Email = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Telefono = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Note = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Attivo = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: true),
                    CreatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    AggiornatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Fornitori", x => x.FornitoreId);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "FattureAcquisto",
                columns: table => new
                {
                    FatturaId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    FornitoreId = table.Column<int>(type: "int", nullable: false),
                    NumeroFattura = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    DataFattura = table.Column<DateTime>(type: "date", nullable: false),
                    DataScadenza = table.Column<DateTime>(type: "date", nullable: true),
                    Imponibile = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    ImportoIva = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    TotaleConIva = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    Stato = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, defaultValue: "DA_PAGARE", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Note = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    AggiornatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FattureAcquisto", x => x.FatturaId);
                    table.ForeignKey(
                        name: "FK_FattureAcquisto_Fornitori_FornitoreId",
                        column: x => x.FornitoreId,
                        principalTable: "Fornitori",
                        principalColumn: "FornitoreId",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "DocumentiTrasporto",
                columns: table => new
                {
                    DdtId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    FatturaId = table.Column<int>(type: "int", nullable: true),
                    FornitoreId = table.Column<int>(type: "int", nullable: false),
                    NumeroDdt = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    DataDdt = table.Column<DateTime>(type: "date", nullable: false),
                    Importo = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    Note = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    AggiornatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentiTrasporto", x => x.DdtId);
                    table.ForeignKey(
                        name: "FK_DocumentiTrasporto_FattureAcquisto_FatturaId",
                        column: x => x.FatturaId,
                        principalTable: "FattureAcquisto",
                        principalColumn: "FatturaId",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_DocumentiTrasporto_Fornitori_FornitoreId",
                        column: x => x.FornitoreId,
                        principalTable: "Fornitori",
                        principalColumn: "FornitoreId",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "PagamentiFornitori",
                columns: table => new
                {
                    PagamentoId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    FatturaId = table.Column<int>(type: "int", nullable: true),
                    DdtId = table.Column<int>(type: "int", nullable: true),
                    DataPagamento = table.Column<DateTime>(type: "date", nullable: false),
                    Importo = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    MetodoPagamento = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Note = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    AggiornatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PagamentiFornitori", x => x.PagamentoId);
                    table.ForeignKey(
                        name: "FK_PagamentiFornitori_DocumentiTrasporto_DdtId",
                        column: x => x.DdtId,
                        principalTable: "DocumentiTrasporto",
                        principalColumn: "DdtId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PagamentiFornitori_FattureAcquisto_FatturaId",
                        column: x => x.FatturaId,
                        principalTable: "FattureAcquisto",
                        principalColumn: "FatturaId",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "SpeseMensili",
                columns: table => new
                {
                    SpesaId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    ChiusuraId = table.Column<int>(type: "int", nullable: false),
                    PagamentoId = table.Column<int>(type: "int", nullable: true),
                    Descrizione = table.Column<string>(type: "longtext", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Importo = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    Categoria = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    AggiornatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SpeseMensili", x => x.SpesaId);
                    table.ForeignKey(
                        name: "FK_SpeseMensili_ChiusureMensili_ChiusuraId",
                        column: x => x.ChiusuraId,
                        principalTable: "ChiusureMensili",
                        principalColumn: "ChiusuraId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SpeseMensili_PagamentiFornitori_PagamentoId",
                        column: x => x.PagamentoId,
                        principalTable: "PagamentiFornitori",
                        principalColumn: "PagamentoId",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_ChiusureMensili_Anno_Mese",
                table: "ChiusureMensili",
                columns: new[] { "Anno", "Mese" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChiusureMensili_ChiusaDa",
                table: "ChiusureMensili",
                column: "ChiusaDa");

            migrationBuilder.CreateIndex(
                name: "IX_ChiusureMensili_Stato",
                table: "ChiusureMensili",
                column: "Stato");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentiTrasporto_DataDdt",
                table: "DocumentiTrasporto",
                column: "DataDdt");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentiTrasporto_FatturaId",
                table: "DocumentiTrasporto",
                column: "FatturaId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentiTrasporto_FornitoreId_NumeroDdt",
                table: "DocumentiTrasporto",
                columns: new[] { "FornitoreId", "NumeroDdt" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FattureAcquisto_DataFattura",
                table: "FattureAcquisto",
                column: "DataFattura");

            migrationBuilder.CreateIndex(
                name: "IX_FattureAcquisto_FornitoreId_NumeroFattura",
                table: "FattureAcquisto",
                columns: new[] { "FornitoreId", "NumeroFattura" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FattureAcquisto_Stato",
                table: "FattureAcquisto",
                column: "Stato");

            migrationBuilder.CreateIndex(
                name: "IX_Fornitori_Attivo",
                table: "Fornitori",
                column: "Attivo");

            migrationBuilder.CreateIndex(
                name: "IX_Fornitori_PartitaIva",
                table: "Fornitori",
                column: "PartitaIva",
                unique: true,
                filter: "[PartitaIva] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Fornitori_RagioneSociale",
                table: "Fornitori",
                column: "RagioneSociale");

            migrationBuilder.CreateIndex(
                name: "IX_PagamentiFornitori_DataPagamento",
                table: "PagamentiFornitori",
                column: "DataPagamento");

            migrationBuilder.CreateIndex(
                name: "IX_PagamentiFornitori_DdtId",
                table: "PagamentiFornitori",
                column: "DdtId");

            migrationBuilder.CreateIndex(
                name: "IX_PagamentiFornitori_FatturaId",
                table: "PagamentiFornitori",
                column: "FatturaId");

            migrationBuilder.CreateIndex(
                name: "IX_SpeseMensili_Categoria",
                table: "SpeseMensili",
                column: "Categoria");

            migrationBuilder.CreateIndex(
                name: "IX_SpeseMensili_ChiusuraId",
                table: "SpeseMensili",
                column: "ChiusuraId");

            migrationBuilder.CreateIndex(
                name: "IX_SpeseMensili_PagamentoId",
                table: "SpeseMensili",
                column: "PagamentoId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SpeseMensili");

            migrationBuilder.DropTable(
                name: "ChiusureMensili");

            migrationBuilder.DropTable(
                name: "PagamentiFornitori");

            migrationBuilder.DropTable(
                name: "DocumentiTrasporto");

            migrationBuilder.DropTable(
                name: "FattureAcquisto");

            migrationBuilder.DropTable(
                name: "Fornitori");
        }
    }
}
