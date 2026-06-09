using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <summary>
    /// IVA multialiquota (Fase 3) — migrazione A: Prodotto.AliquotaIva in PERCENTUALE
    /// (decimal(5,2), default 22.00, convenzione Fornitore.AliquotaIva).
    ///
    /// Backfill: i prodotti preesistenti ricevono l'aliquota di default derivata da
    /// BusinessSettings.VatRate (FRAZIONE, es. 0.22) convertita in percentuale (×100),
    /// con fallback 22.00 se la riga settings non esiste.
    ///
    /// Query di controllo post-migrazione (attesa: 0 su dati standard):
    ///   SELECT COUNT(*) FROM Prodotti WHERE AliquotaIva NOT IN (0, 4, 5, 10, 22);
    /// </summary>
    public partial class AddAliquotaIvaToProdotti : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AliquotaIva",
                table: "Prodotti",
                type: "decimal(5,2)",
                nullable: false,
                defaultValue: 22.00m);

            // Backfill: VatRate è frazione (0.22) → percentuale (22.00); fallback 22 senza settings
            migrationBuilder.Sql(@"
                UPDATE Prodotti
                SET AliquotaIva = COALESCE((SELECT VatRate * 100 FROM BusinessSettings LIMIT 1), 22.00);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AliquotaIva",
                table: "Prodotti");
        }
    }
}
