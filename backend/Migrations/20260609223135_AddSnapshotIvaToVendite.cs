using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <summary>
    /// IVA multialiquota (Fase 3) — migrazione B: snapshot IVA su Vendite
    /// (AliquotaIva percentuale, Imponibile, ImportoIva). Dipende dalla migrazione A
    /// (AddAliquotaIvaToProdotti): il backfill legge Prodotti.AliquotaIva.
    ///
    /// Backfill: scorporo con la stessa formula di IvaCalculator.ScorporaDaLordo
    /// (Imponibile = ROUND(lordo / (1 + aliquota/100), 2); ImportoIva per differenza).
    /// MySQL ROUND è half-away-from-zero, IvaCalculator usa ToEven, ma per le aliquote
    /// ammesse (0/4/5/10/22) un lordo a 2 decimali non produce mai un midpoint esatto
    /// (documentato nella XML doc di IvaCalculator, coperto da IvaCalculatorTests):
    /// i valori coincidono al centesimo.
    ///
    /// Query di controllo post-migrazione (attesa: 0):
    ///   SELECT COUNT(*) FROM Vendite WHERE Imponibile + ImportoIva <> PrezzoTotale;
    /// </summary>
    public partial class AddSnapshotIvaToVendite : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AliquotaIva",
                table: "Vendite",
                type: "decimal(5,2)",
                nullable: false,
                defaultValue: 22.00m);

            migrationBuilder.AddColumn<decimal>(
                name: "Imponibile",
                table: "Vendite",
                type: "decimal(10,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ImportoIva",
                table: "Vendite",
                type: "decimal(10,2)",
                nullable: false,
                defaultValue: 0m);

            // Backfill dalle aliquote prodotto (backfillate in AddAliquotaIvaToProdotti);
            // ImportoIva per differenza per garantire Imponibile + ImportoIva == PrezzoTotale
            migrationBuilder.Sql(@"
                UPDATE Vendite v
                INNER JOIN Prodotti p ON p.ProdottoId = v.ProdottoId
                SET v.AliquotaIva = p.AliquotaIva,
                    v.Imponibile  = ROUND(v.PrezzoTotale / (1 + p.AliquotaIva / 100), 2),
                    v.ImportoIva  = v.PrezzoTotale - ROUND(v.PrezzoTotale / (1 + p.AliquotaIva / 100), 2);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AliquotaIva",
                table: "Vendite");

            migrationBuilder.DropColumn(
                name: "Imponibile",
                table: "Vendite");

            migrationBuilder.DropColumn(
                name: "ImportoIva",
                table: "Vendite");
        }
    }
}
