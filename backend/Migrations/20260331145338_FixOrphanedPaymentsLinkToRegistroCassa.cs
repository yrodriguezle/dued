using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <summary>
    /// Migrazione dati: aggancia i pagamenti fornitori orfani (RegistroCassaId = NULL)
    /// al RegistroCassa della data corrispondente.
    ///
    /// Bug: DocumentoTrasportoOrchestrator creava i pagamenti senza sincronizzarli
    /// con il registro cassa. Il fix nel codice previene nuovi orfani, questa migrazione
    /// corregge i dati esistenti in produzione.
    /// </summary>
    public partial class FixOrphanedPaymentsLinkToRegistroCassa : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Crea RegistriCassa DRAFT per date che hanno pagamenti orfani ma nessun registro
            migrationBuilder.Sql(@"
                INSERT INTO RegistriCassa (Data, UtenteId, Stato, CreatoIl, AggiornatoIl,
                    TotaleApertura, TotaleChiusura, VenditeContanti, IncassoContanteTracciato,
                    IncassiElettronici, IncassiFattura, TotaleVendite, SpeseFornitori,
                    SpeseGiornaliere, ContanteAtteso, Differenza, ContanteNetto, ImportoIva)
                SELECT DISTINCT DATE(p.DataPagamento), 1, 'DRAFT', UTC_TIMESTAMP(), UTC_TIMESTAMP(),
                    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
                FROM PagamentiFornitori p
                WHERE p.RegistroCassaId IS NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM RegistriCassa r WHERE r.Data = DATE(p.DataPagamento)
                  );
            ");

            // 2. Collega i pagamenti orfani al registro della loro data
            migrationBuilder.Sql(@"
                UPDATE PagamentiFornitori p
                INNER JOIN RegistriCassa r ON r.Data = DATE(p.DataPagamento)
                SET p.RegistroCassaId = r.Id
                WHERE p.RegistroCassaId IS NULL;
            ");

            // 3. Ricalcola SpeseFornitori e campi derivati sui registri coinvolti
            migrationBuilder.Sql(@"
                UPDATE RegistriCassa r
                INNER JOIN (
                    SELECT RegistroCassaId, SUM(Importo) AS TotaleSpese
                    FROM PagamentiFornitori
                    WHERE RegistroCassaId IS NOT NULL
                    GROUP BY RegistroCassaId
                ) totali ON totali.RegistroCassaId = r.Id
                SET r.SpeseFornitori = totali.TotaleSpese,
                    r.ContanteAtteso = r.VenditeContanti - totali.TotaleSpese - r.SpeseGiornaliere,
                    r.Differenza = (r.TotaleChiusura - r.TotaleApertura) - (r.VenditeContanti - totali.TotaleSpese - r.SpeseGiornaliere),
                    r.AggiornatoIl = UTC_TIMESTAMP();
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Non revertiamo: i dati corretti sono lo stato desiderato
        }
    }
}
