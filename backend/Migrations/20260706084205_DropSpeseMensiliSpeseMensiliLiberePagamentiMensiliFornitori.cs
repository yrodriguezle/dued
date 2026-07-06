using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class DropSpeseMensiliSpeseMensiliLiberePagamentiMensiliFornitori : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PagamentiMensiliFornitori");

            migrationBuilder.DropTable(
                name: "SpeseMensili");

            migrationBuilder.DropTable(
                name: "SpeseMensiliLibere");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
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
                name: "SpeseMensili",
                columns: table => new
                {
                    SpesaId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    ChiusuraId = table.Column<int>(type: "int", nullable: false),
                    PagamentoId = table.Column<int>(type: "int", nullable: true),
                    Categoria = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    Descrizione = table.Column<string>(type: "longtext", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Importo = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
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

            migrationBuilder.CreateTable(
                name: "SpeseMensiliLibere",
                columns: table => new
                {
                    SpesaId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    ChiusuraId = table.Column<int>(type: "int", nullable: false),
                    Categoria = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    Data = table.Column<DateTime>(type: "date", nullable: true),
                    Descrizione = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Importo = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
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

            migrationBuilder.CreateIndex(
                name: "IX_SpeseMensiliLibere_Categoria",
                table: "SpeseMensiliLibere",
                column: "Categoria");

            migrationBuilder.CreateIndex(
                name: "IX_SpeseMensiliLibere_ChiusuraId",
                table: "SpeseMensiliLibere",
                column: "ChiusuraId");
        }
    }
}
