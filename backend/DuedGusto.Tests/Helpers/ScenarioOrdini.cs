using Microsoft.Extensions.Logging.Abstractions;

using duedgusto.Common;
using duedgusto.GraphQL.Vendite;
using duedgusto.Repositories.Implementations;
using duedgusto.Repositories.Interfaces;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.Events;

namespace DuedGusto.Tests.Helpers;

/// <summary>
/// Semina e cablaggio condivisi dei test sugli ordini del punto vendita.
///
/// <para>Sta qui e non in ogni classe di test perché i quattro file degli ordini
/// (chiusura, split, transizioni, numerazione) hanno bisogno esattamente dello stesso mondo — un
/// registro in bozza, un listino, un operatore e un amministratore — e perché diversi di quei test
/// costruiscono <b>più contesti sullo stesso database</b> per simulare due dispositivi: gli
/// orchestrator vanno quindi ricostruiti per contesto, non condivisi.</para>
///
/// <para>⚠️ <c>BusinessSettings</c> va seminato: <c>EnsureCreated()</c> costruisce lo schema, non i
/// dati, e senza quella riga <c>BreakdownIvaApplier</c> non trova l'aliquota di default. Alcuni
/// test lo omettono <b>di proposito</b>, per far fallire la chiusura dopo il primo salvataggio e
/// verificare che la transazione rotoli indietro tutto.</para>
/// </summary>
internal static class ScenarioOrdini
{
    public const decimal AliquotaBar = 10m;

    // ── Semina ───────────────────────────────────────────────────────────────────────────────────

    public static BusinessSettings SeminaImpostazioni(AppDbContext db, decimal vatRate = 0.10m)
    {
        var settings = new BusinessSettings { BusinessName = "Due d Gusto", VatRate = vatRate };
        db.BusinessSettings.Add(settings);
        db.SaveChanges();
        return settings;
    }

    public static Utente SeminaUtente(AppDbContext db, bool amministratore, string nomeRuolo)
    {
        var ruolo = new Ruolo
        {
            Nome = nomeRuolo,
            Descrizione = $"Ruolo {nomeRuolo}",
            Amministratore = amministratore,
        };
        db.Ruoli.Add(ruolo);
        db.SaveChanges();

        Utente utente = JwtTestHelper.CreateTestUtente(id: 0, username: $"utente-{nomeRuolo}");
        utente.RuoloId = ruolo.Id;
        db.Utenti.Add(utente);
        db.SaveChanges();
        return utente;
    }

    public static RegistroCassa SeminaRegistro(
        AppDbContext db,
        Utente utente,
        DateTime? data = null,
        string stato = "DRAFT",
        decimal incassiElettronici = 0m,
        decimal incassoContanteTracciato = 0m,
        decimal totaleApertura = 0m,
        decimal totaleChiusura = 0m)
    {
        var registro = new RegistroCassa
        {
            Data = data ?? new DateTime(2026, 8, 26),
            UtenteId = utente.Id,
            Stato = stato,
            IncassiElettronici = incassiElettronici,
            IncassoContanteTracciato = incassoContanteTracciato,
            TotaleApertura = totaleApertura,
            TotaleChiusura = totaleChiusura,
        };
        db.RegistriCassa.Add(registro);
        db.SaveChanges();
        return registro;
    }

    public static Prodotto SeminaProdotto(
        AppDbContext db, string codice, decimal prezzo, decimal aliquota = AliquotaBar)
    {
        var prodotto = new Prodotto
        {
            Codice = codice,
            Nome = codice,
            Prezzo = prezzo,
            Categoria = "BAR",
            AliquotaIva = aliquota,
            Attivo = true,
        };
        db.Prodotti.Add(prodotto);
        db.SaveChanges();
        return prodotto;
    }

    /// <summary>
    /// Un ordine aperto con le sue voci già battute. Prezzo e aliquota sono <b>copiati adesso</b>
    /// dal prodotto, come fa la mutation di riga: è lo snapshot del prezzo detto al cliente, e i
    /// test che ritoccano il listino dopo contano su questo.
    /// </summary>
    public static Ordine SeminaOrdineAperto(
        AppDbContext db,
        RegistroCassa registro,
        Utente utente,
        int numero,
        params (Prodotto Prodotto, decimal Quantita)[] voci)
    {
        var ordine = new Ordine
        {
            RegistroCassaId = registro.Id,
            Numero = numero,
            SuffissoSplit = string.Empty,
            Stato = StatiOrdine.Aperto,
            ApertoDa = utente.Id,
            ApertoIl = new DateTime(2026, 8, 26, 19, 30, 0, DateTimeKind.Utc),
        };
        db.Ordini.Add(ordine);
        db.SaveChanges();

        foreach ((Prodotto prodotto, decimal quantita) in voci)
        {
            db.RigheOrdine.Add(new RigaOrdine
            {
                OrdineId = ordine.OrdineId,
                ProdottoId = prodotto.ProdottoId,
                Quantita = quantita,
                PrezzoUnitario = prodotto.Prezzo,
                AliquotaIva = prodotto.AliquotaIva,
                PrezzoTotale = quantita * prodotto.Prezzo,
                DataOra = new DateTime(2026, 8, 26, 19, 31, 0, DateTimeKind.Utc),
            });
        }

        db.SaveChanges();
        return ordine;
    }

    // ── Cablaggio degli orchestrator ─────────────────────────────────────────────────────────────
    //
    // Uno per contesto, mai condivisi: due dispositivi concorrenti sono due contesti, ciascuno con
    // la propria identity map e la propria unit of work. Condividerli renderebbe il test una
    // simulazione di sé stesso.

    public static ApriOrdineOrchestrator Apertura(AppDbContext db)
        => new(Uow(db), Chiusure(db));

    public static ChiudiOrdineOrchestrator Chiusura(AppDbContext db, IEventBus? eventBus = null)
        => new(Uow(db), Chiusure(db), eventBus ?? BusFinto(), NullLogger<ChiudiOrdineOrchestrator>.Instance);

    public static AnnullaOrdineOrchestrator Annullo(AppDbContext db)
        => new(Uow(db), Chiusure(db));

    public static StornaOrdineOrchestrator Storno(AppDbContext db, IEventBus? eventBus = null)
        => new(Uow(db), Chiusure(db), eventBus ?? BusFinto(), NullLogger<StornaOrdineOrchestrator>.Instance);

    private static IUnitOfWork Uow(AppDbContext db) => new UnitOfWork(db);

    private static ChiusuraMensileService Chiusure(AppDbContext db)
        => new(db, new ChiusuraMensileValidator(db));

    private static IEventBus BusFinto() => new Mock<IEventBus>().Object;
}
