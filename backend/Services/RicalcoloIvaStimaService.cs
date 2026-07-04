using Microsoft.EntityFrameworkCore;

using duedgusto.Common;
using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.Services;

/// <summary>
/// Dettaglio del ricalcolo per singolo registro (per log/audit e per i test).
/// </summary>
public readonly record struct DettaglioRicalcoloStima(
    int RegistroCassaId,
    DateTime Data,
    string Stato,
    decimal AliquotaVecchia,
    decimal AliquotaNuova,
    decimal ImportoIvaPrima,
    decimal ImportoIvaDopo);

/// <summary>
/// Esito aggregato del ricalcolo dell'IVA stimata delle vendite.
/// </summary>
public readonly record struct EsitoRicalcoloIvaStima(
    int RegistriEsaminati,
    int RegistriModificati,
    decimal DeltaImportoIvaTotale,
    IReadOnlyList<DettaglioRicalcoloStima> Dettagli);

/// <summary>
/// Rettifica gestionale (issue #6) del residuo IVA <b>stimato</b> dei registri cassa storici.
///
/// <para>Il breakdown IVA vendite (righe <see cref="RegistroCassaIva"/>) viene congelato al
/// salvataggio del registro usando <c>BusinessSettings.VatRate</c> come aliquota del residuo
/// non itemizzato. I registri salvati quando il default era 0.22 conservano la riga
/// <c>Stimato=true</c> al 22% anche dopo aver impostato 0.10; questo servizio la riallinea
/// all'aliquota corrente.</para>
///
/// <para><b>Solo la riga stimata</b> viene toccata (gli snapshot itemizzati per prodotto sono
/// immutabili). Il lordo del residuo (<c>Imponibile + Imposta</c>) è invariante — non dipende
/// dall'aliquota — quindi <c>TotaleVendite</c>/<c>VenditeContanti</c> NON vengono ricalcolati:
/// si riscorpora lo stesso lordo alla nuova aliquota e si aggiorna <c>ImportoIva</c> del solo delta.
/// L'invariante <c>Imponibile + Imposta == lordo</c> resta garantita da <see cref="IvaCalculator.ScorporaDaLordo"/>.</para>
///
/// <para><b>Scope</b> (deciso con l'utente): solo registri <c>DRAFT</c> o <c>CLOSED</c> — mai
/// <c>RECONCILED</c> — e mai registri appartenenti a un mese con una ChiusuraMensile
/// <c>CHIUSA</c>/<c>RICONCILIATA</c> (stessa semantica per Anno/Mese delle guard anti-retroattività
/// già presenti). Dato gestionale, non fiscale.</para>
/// </summary>
public static class RicalcoloIvaStimaService
{
    /// <param name="db">DbContext corrente.</param>
    /// <param name="vatRateFrazione">Aliquota corrente come FRAZIONE (BusinessSettings.VatRate, es. 0.10).</param>
    /// <param name="dryRun">Se true calcola e logga senza persistere (nessun SaveChanges).</param>
    /// <param name="nowUtc">Timestamp per Note/UpdatedAt (iniettato per testabilità).</param>
    /// <param name="logger">Logger per il tracciamento per-registro e il riepilogo.</param>
    public static async Task<EsitoRicalcoloIvaStima> EseguiAsync(
        AppDbContext db, decimal vatRateFrazione, bool dryRun, DateTime nowUtc, ILogger logger)
    {
        decimal aliquotaCorrentePercent = vatRateFrazione * 100m;

        // Candidati: registro DRAFT/CLOSED (mai RECONCILED), con almeno una riga stimata
        // ad aliquota diversa da quella corrente, e NON in un mese consolidato (CHIUSA/RICONCILIATA).
        List<RegistroCassa> candidati = await db.RegistriCassa
            .Where(r => r.Stato == "DRAFT" || r.Stato == "CLOSED")
            .Where(r => r.BreakdownIva.Any(riga => riga.Stimato && riga.Aliquota != aliquotaCorrentePercent))
            .Where(r => !db.ChiusureMensili.Any(c =>
                c.Anno == r.Data.Year && c.Mese == r.Data.Month
                && (c.Stato == "CHIUSA" || c.Stato == "RICONCILIATA")))
            .Include(r => r.BreakdownIva)
            .ToListAsync();

        var dettagli = new List<DettaglioRicalcoloStima>();
        decimal deltaTotale = 0m;
        int modificati = 0;

        foreach (RegistroCassa registro in candidati)
        {
            decimal importoIvaPrima = registro.ImportoIva;
            decimal aliquotaVecchia = 0m;
            bool modificato = false;

            foreach (RegistroCassaIva riga in registro.BreakdownIva
                .Where(x => x.Stimato && x.Aliquota != aliquotaCorrentePercent).ToList())
            {
                // Il lordo del residuo è invariante rispetto all'aliquota: riscorporo lo stesso lordo.
                decimal lordo = riga.Imponibile + riga.Imposta;
                RisultatoIva scorporo = IvaCalculator.ScorporaDaLordo(lordo, vatRateFrazione);

                decimal delta = scorporo.Iva - riga.Imposta;
                aliquotaVecchia = riga.Aliquota;

                riga.Aliquota = aliquotaCorrentePercent;
                riga.Imponibile = scorporo.Imponibile;
                riga.Imposta = scorporo.Iva;

                registro.ImportoIva += delta;
                deltaTotale += delta;
                modificato = true;
            }

            if (!modificato)
            {
                continue;
            }

            modificati++;
            decimal deltaRegistro = registro.ImportoIva - importoIvaPrima;

            string nota = $"[fix#6 {nowUtc:yyyy-MM-dd}] Residuo IVA stimato ricalcolato "
                + $"{aliquotaVecchia:0.##}%→{aliquotaCorrentePercent:0.##}%, "
                + $"ΔImportoIva={deltaRegistro:+0.00;-0.00}€ (dato gestionale, non fiscale)";
            registro.Note = string.IsNullOrEmpty(registro.Note) ? nota : $"{registro.Note}\n{nota}";
            registro.UpdatedAt = nowUtc;

            dettagli.Add(new DettaglioRicalcoloStima(
                registro.Id, registro.Data, registro.Stato,
                aliquotaVecchia, aliquotaCorrentePercent,
                importoIvaPrima, registro.ImportoIva));

            logger.LogInformation(
                "Ricalcolo IVA stima registro {RegistroCassaId} ({Data:yyyy-MM-dd}, {Stato}): "
                + "aliquota residuo {AliquotaVecchia}%→{AliquotaNuova}%, ImportoIva {Prima}→{Dopo} (Δ {Delta}){DryRun}",
                registro.Id, registro.Data, registro.Stato,
                aliquotaVecchia, aliquotaCorrentePercent,
                importoIvaPrima, registro.ImportoIva, deltaRegistro,
                dryRun ? " [DRY-RUN]" : "");
        }

        if (modificati > 0 && !dryRun)
        {
            await db.SaveChangesAsync();
        }

        logger.LogInformation(
            "Ricalcolo IVA stima: {Modificati}/{Esaminati} registri {Azione}, ΔImportoIva totale {DeltaTotale}€.",
            modificati, candidati.Count,
            dryRun ? "da modificare (dry-run, nessun salvataggio)" : "modificati e salvati",
            deltaTotale);

        return new EsitoRicalcoloIvaStima(candidati.Count, modificati, deltaTotale, dettagli);
    }
}
