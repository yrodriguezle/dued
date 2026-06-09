using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <summary>
    /// IVA multialiquota (Fase 3) — migrazione C: tabella figlia RegistriCassaIva
    /// (breakdown IVA per aliquota del registro cassa) + backfill dei registri storici.
    ///
    /// Backfill (decisione vincolante #5): una SOLA riga stimata per registro che replica
    /// bit a bit l'aggregato esistente (Imposta = ImportoIva, Imponibile = TotaleVendite −
    /// ImportoIva, Aliquota = VatRate × 100 con fallback 22). NESSUNA ricostruzione esatta
    /// dalle vendite storiche: i registri con Vendite verranno raffinati al primo
    /// risalvataggio naturale (l'applier rigenera il breakdown). Le righe con aggregati
    /// tutti a zero non vengono inserite.
    ///
    /// Query di controllo post-migrazione (attesa: result set vuoto):
    ///   SELECT r.Id FROM RegistriCassa r
    ///   JOIN RegistriCassaIva i ON i.RegistroCassaId = r.Id
    ///   GROUP BY r.Id
    ///   HAVING SUM(i.Imposta) <> MAX(r.ImportoIva);
    ///
    /// Down(): droppa la sola tabella (dato derivato, rigenerabile); nessun dato
    /// preesistente viene toccato.
    /// </summary>
    public partial class AddRegistroCassaIva : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RegistriCassaIva",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    RegistroCassaId = table.Column<int>(type: "int", nullable: false),
                    Aliquota = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    Imponibile = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    Imposta = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    Stimato = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RegistriCassaIva", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RegistriCassaIva_RegistriCassa_RegistroCassaId",
                        column: x => x.RegistroCassaId,
                        principalTable: "RegistriCassa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_RegistriCassaIva_RegistroCassaId",
                table: "RegistriCassaIva",
                column: "RegistroCassaId");

            migrationBuilder.CreateIndex(
                name: "IX_RegistriCassaIva_RegistroCassaId_Aliquota_Stimato",
                table: "RegistriCassaIva",
                columns: new[] { "RegistroCassaId", "Aliquota", "Stimato" },
                unique: true);

            // Backfill stimato: aggregato esistente preservato bit a bit, tutto Stimato = true;
            // skip dei registri con TotaleVendite e ImportoIva entrambi a zero
            migrationBuilder.Sql(@"
                INSERT INTO RegistriCassaIva (RegistroCassaId, Aliquota, Imponibile, Imposta, Stimato)
                SELECT r.Id,
                       COALESCE((SELECT VatRate * 100 FROM BusinessSettings LIMIT 1), 22.00),
                       r.TotaleVendite - r.ImportoIva,
                       r.ImportoIva,
                       1
                FROM RegistriCassa r
                WHERE r.TotaleVendite <> 0 OR r.ImportoIva <> 0;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RegistriCassaIva");
        }
    }
}
