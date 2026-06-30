using Microsoft.EntityFrameworkCore;

using duedgusto.Common;
using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.GraphQL.GestioneCassa;

/// <summary>
/// Applier del breakdown IVA per aliquota di un registro cassa — punto di calcolo UNICO
/// invocato da MutateRegistroCassaOrchestrator (salvataggio registro) e dalle mutation
/// Vendite (crea/aggiorna/elimina). Pattern helper statico (come FatturaAcquistoStatusHelper).
///
/// Ricarica le Vendite persistite del registro, normalizza VenditeContanti (= Σ lordi,
/// non più azzerato), ricalcola TotaleVendite, calcola il breakdown col calculator puro
/// <see cref="IvaBreakdownCalculator"/>, rigenera le righe RegistriCassaIva in modo
/// idempotente (RemoveRange + Add) e imposta ImportoIva = Σ Imposta del breakdown.
/// NON chiama SaveChanges: il commit è responsabilità del chiamante.
/// </summary>
public static class BreakdownIvaApplier
{
    /// <param name="db">DbContext corrente (stessa unit of work del chiamante).</param>
    /// <param name="registro">Registro già persistito (Id valorizzato).</param>
    /// <param name="vatRateFrazione">Aliquota di default come FRAZIONE (BusinessSettings.VatRate).</param>
    /// <param name="logger">Logger del chiamante per il warning di clamp del residuo negativo.</param>
    public static async Task<EsitoBreakdownIva> ApplicaAsync(
        AppDbContext db, RegistroCassa registro, decimal vatRateFrazione, ILogger logger)
    {
        List<Vendita> vendite = await db.Vendite
            .Where(v => v.RegistroCassaId == registro.Id)
            .ToListAsync();

        // Normalizzazione: VenditeContanti dalla somma delle Vendite persistite
        // (per i registri senza vendite itemizzate resta 0, identico a oggi)
        registro.VenditeContanti = vendite.Sum(v => v.PrezzoTotale);

        // TotaleVendite allineato al calcolo della view Registro cassa (fonte di verità):
        // il contante reale è il MOVIMENTO FISICO di cassa (TotaleChiusura - TotaleApertura),
        // non IncassoContanteTracciato (digitato a mano, solo un subset del contante reale).
        decimal contanteReale = registro.TotaleChiusura - registro.TotaleApertura;
        registro.TotaleVendite = contanteReale
            + registro.IncassiElettronici
            + registro.IncassiFattura;

        EsitoBreakdownIva esito = IvaBreakdownCalculator.Calcola(
            vendite, registro.TotaleVendite, vatRateFrazione);

        // Rigenerazione idempotente delete + reinsert (come ConteggiMoneta/SpeseCassa)
        List<RegistroCassaIva> righeEsistenti = await db.RegistriCassaIva
            .Where(r => r.RegistroCassaId == registro.Id)
            .ToListAsync();
        db.RegistriCassaIva.RemoveRange(righeEsistenti);

        db.RegistriCassaIva.AddRange(esito.Righe.Select(r => new RegistroCassaIva
        {
            RegistroCassaId = registro.Id,
            Aliquota = r.Aliquota,
            Imponibile = r.Imponibile,
            Imposta = r.Imposta,
            Stimato = r.Stimato,
        }));

        // ImportoIva = Σ Imposta del breakdown (mai ricalcolato indipendentemente)
        registro.ImportoIva = esito.Righe.Sum(r => r.Imposta);

        if (esito.ResiduoClampato)
        {
            logger.LogWarning(
                "Breakdown IVA registro {RegistroCassaId}: residuo negativo (TotaleVendite dichiarato {TotaleVendite}, " +
                "somma vendite itemizzate {TotaleItemizzato}). Residuo portato a 0, nessuna riga stimata generata.",
                registro.Id, registro.TotaleVendite, esito.TotaleItemizzato);
        }

        return esito;
    }
}
