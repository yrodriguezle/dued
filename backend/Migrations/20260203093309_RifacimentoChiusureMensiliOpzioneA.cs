using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class RifacimentoChiusureMensiliOpzioneA : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PagamentiMensiliFornitori",
                columns: table => new
                {
                    ChiusuraId = table.Column<int>(type: "int", nullable: false),
                    PagamentoId = table.Column<int>(type: "int", nullable: false),
                    InclusoInChiusura = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PagamentiMensiliFornitori", x => new { x.ChiusuraId, x.PagamentoId });
                    table.ForeignKey(
                        name: "FK_PagamentiMensiliFornitori_ChiusureMensili_ChiusuraId",
                        column: x => x.ChiusuraId,
                        principalTable: "ChiusureMensili",
                        principalColumn: "ChiusuraId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PagamentiMensiliFornitori_PagamentiFornitori_PagamentoId",
                        column: x => x.PagamentoId,
                        principalTable: "PagamentiFornitori",
                        principalColumn: "PagamentoId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "RegistriCassaMensili",
                columns: table => new
                {
                    ChiusuraId = table.Column<int>(type: "int", nullable: false),
                    RegistroId = table.Column<int>(type: "int", nullable: false),
                    Incluso = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RegistriCassaMensili", x => new { x.ChiusuraId, x.RegistroId });
                    table.ForeignKey(
                        name: "FK_RegistriCassaMensili_ChiusureMensili_ChiusuraId",
                        column: x => x.ChiusuraId,
                        principalTable: "ChiusureMensili",
                        principalColumn: "ChiusuraId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RegistriCassaMensili_RegistriCassa_RegistroId",
                        column: x => x.RegistroId,
                        principalTable: "RegistriCassa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "SpeseMensiliLibere",
                columns: table => new
                {
                    SpesaId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    ChiusuraId = table.Column<int>(type: "int", nullable: false),
                    Descrizione = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Importo = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    Categoria = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    AggiornatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SpeseMensiliLibere", x => x.SpesaId);
                    table.ForeignKey(
                        name: "FK_SpeseMensiliLibere_ChiusureMensili_ChiusuraId",
                        column: x => x.ChiusuraId,
                        principalTable: "ChiusureMensili",
                        principalColumn: "ChiusuraId",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_PagamentiMensiliFornitori_ChiusuraId",
                table: "PagamentiMensiliFornitori",
                column: "ChiusuraId");

            migrationBuilder.CreateIndex(
                name: "IX_PagamentiMensiliFornitori_PagamentoId",
                table: "PagamentiMensiliFornitori",
                column: "PagamentoId");

            migrationBuilder.CreateIndex(
                name: "IX_RegistriCassaMensili_ChiusuraId",
                table: "RegistriCassaMensili",
                column: "ChiusuraId");

            migrationBuilder.CreateIndex(
                name: "IX_RegistriCassaMensili_RegistroId",
                table: "RegistriCassaMensili",
                column: "RegistroId");

            migrationBuilder.CreateIndex(
                name: "IX_SpeseMensiliLibere_Categoria",
                table: "SpeseMensiliLibere",
                column: "Categoria");

            migrationBuilder.CreateIndex(
                name: "IX_SpeseMensiliLibere_ChiusuraId",
                table: "SpeseMensiliLibere",
                column: "ChiusuraId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PagamentiMensiliFornitori");

            migrationBuilder.DropTable(
                name: "RegistriCassaMensili");

            migrationBuilder.DropTable(
                name: "SpeseMensiliLibere");
        }
    }
}
