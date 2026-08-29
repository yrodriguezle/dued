using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <summary>
    /// Scambia l'ordine delle colonne dell'indice secondario di <c>Ordini</c>:
    /// <c>(RegistroCassaId, Stato)</c> diventa <c>(Stato, RegistroCassaId)</c>.
    ///
    /// <para>Nessuna colonna nuova, nessun dato toccato. Il motivo è la query
    /// <c>ordiniAperti</c> senza registro — quella che non può filtrare su oggi, o un ordine
    /// aperto a cavallo di mezzanotte sparirebbe dall'elenco bloccando per sempre la chiusura
    /// del giorno prima: con <c>RegistroCassaId</c> in testa non ne usa il prefisso e legge tutta
    /// la tabella. Con <c>Stato</c> in testa l'indice serve entrambe le letture, perché la guardia
    /// della chiusura di cassa confronta le due colonne per uguaglianza e a quella l'ordine è
    /// indifferente.</para>
    ///
    /// <para>Si fa ora perché ora è gratis: in produzione <c>Ordini</c> è ancora vuota.</para>
    /// </summary>
    public partial class RiordinaIndiceOrdiniStato : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Ordini_RegistroCassaId_Stato",
                table: "Ordini");

            migrationBuilder.CreateIndex(
                name: "IX_Ordini_Stato_RegistroCassaId",
                table: "Ordini",
                columns: new[] { "Stato", "RegistroCassaId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Ordini_Stato_RegistroCassaId",
                table: "Ordini");

            migrationBuilder.CreateIndex(
                name: "IX_Ordini_RegistroCassaId_Stato",
                table: "Ordini",
                columns: new[] { "RegistroCassaId", "Stato" });
        }
    }
}
