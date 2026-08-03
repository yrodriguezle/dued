using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <summary>
    /// Allinea la quadratura del registro cassa al foglio di chiusura (colonne Y, AD, AE, AG),
    /// di cui <c>RiepilogoCards.tsx</c> è il riferimento vivo.
    /// <para>
    /// <c>ContanteAtteso</c> sottraeva anche le spese con scontrino e diventa <c>RestoFornitore</c>
    /// (AD); <c>Differenza</c> non è una grandezza del foglio ed è sostituita da <c>Resto</c> (AG);
    /// si aggiunge <c>Ecc</c> (AE). <c>ContanteNetto</c> (Y) era già corretto.
    /// </para>
    /// La rinomina è accompagnata dal ricalcolo dei valori storici: essendo una funzione
    /// deterministica di colonne che questa migrazione non tocca, farlo qui evita che la
    /// produzione resti con i valori della vecchia formula sotto i nomi nuovi.
    /// </summary>
    public partial class RinominaQuadraturaRegistroCassaSecondoFoglio : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "ContanteAtteso",
                table: "RegistriCassa",
                newName: "RestoFornitore");

            migrationBuilder.RenameColumn(
                name: "Differenza",
                table: "RegistriCassa",
                newName: "Resto");

            migrationBuilder.AddColumn<decimal>(
                name: "Ecc",
                table: "RegistriCassa",
                type: "decimal(10,2)",
                nullable: false,
                defaultValue: 0m);

            // Ricalcolo storico: stesse formule di MutateRegistroCassaOrchestrator.CalcolaTotali.
            migrationBuilder.Sql(@"
                UPDATE RegistriCassa SET
                    ContanteNetto  = TotaleChiusura - TotaleApertura,
                    RestoFornitore = IncassoContanteTracciato - SpeseFornitori,
                    Ecc            = (TotaleChiusura - TotaleApertura) - IncassoContanteTracciato,
                    Resto          = ((TotaleChiusura - TotaleApertura) - IncassoContanteTracciato)
                                     - SpeseGiornaliere;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Ecc",
                table: "RegistriCassa");

            migrationBuilder.RenameColumn(
                name: "RestoFornitore",
                table: "RegistriCassa",
                newName: "ContanteAtteso");

            migrationBuilder.RenameColumn(
                name: "Resto",
                table: "RegistriCassa",
                newName: "Differenza");

            // Ripristino della vecchia formula sui valori storici.
            migrationBuilder.Sql(@"
                UPDATE RegistriCassa SET
                    ContanteAtteso = IncassoContanteTracciato - SpeseFornitori - SpeseGiornaliere,
                    Differenza     = (TotaleChiusura - TotaleApertura)
                                     - (IncassoContanteTracciato - SpeseFornitori - SpeseGiornaliere);");
        }
    }
}
