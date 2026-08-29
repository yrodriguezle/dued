using DuedGusto.Tests.Helpers;

using GraphQL;

using duedgusto.Common;
using duedgusto.GraphQL.GestioneCassa;
using duedgusto.Repositories.Implementations;
using duedgusto.Repositories.Interfaces;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.Events;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// La guardia <c>GuardNessunOrdineAperto</c> su <c>chiudiRegistroCassa</c>, e — cosa che qui pesa
/// di più della guardia stessa — la prova che <b>non</b> tocca nulla di ciò che funzionava prima.
///
/// <para>🔴 <b>Il caso da non rompere è la totalità della produzione di oggi.</b> La tabella
/// <c>Ordini</c> è vuota sul server e i registri sono centinaia: la chiusura di cassa è, oggi, un
/// gesto manuale su giornate che non hanno alcun ordine. Una guardia scritta larga — che conti gli
/// ordini invece degli ordini <i>aperti</i> — le bloccherebbe tutte, e la regressione si vedrebbe
/// solo a fine turno, quando serve chiudere e non si può. Per questo i casi «non blocca» sono qui
/// più numerosi e più espliciti del caso «blocca».</para>
///
/// <para>⚠️ <b>Gli stati terminali hanno uno scenario ciascuno</b>, non un caso solo con un valore
/// parametrico dimenticabile. <see cref="StatiOrdine.Splittato"/> in particolare: bloccare su un
/// padre splittato fermerebbe la cassa su un incasso <b>già dichiarato dai figli</b> e senza via
/// d'uscita, perché quel padre non si può né chiudere né annullare.</para>
///
/// <para>InMemory basta: nessuna transazione da provare, nessun indice unico, nessuna corsa. Ciò
/// che si verifica qui è quali righe la guardia guarda e in che ordine viene valutata.</para>
/// </summary>
public class ChiudiRegistroCassaOrdiniApertiTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly ChiudiRegistroCassaOrchestrator _chiusura;
    private readonly RiapriRegistroCassaOrchestrator _riapertura;

    /// <summary>Mercoledì: giorno operativo secondo gli <c>OperatingDays</c> di default.</summary>
    private static readonly DateTime Mercoledi = new(2026, 8, 26);

    /// <summary>Domenica: giorno di chiusura, serve alla prova sull'ordine dei guard.</summary>
    private static readonly DateTime Domenica = new(2026, 8, 30);

    public ChiudiRegistroCassaOrdiniApertiTests()
    {
        _db = TestDbContextFactory.Create();

        IUnitOfWork uow = new UnitOfWork(_db);
        var chiusureService = new ChiusuraMensileService(_db, new ChiusuraMensileValidator(_db));
        IEventBus bus = new Mock<IEventBus>().Object;

        _chiusura = new ChiudiRegistroCassaOrchestrator(uow, chiusureService, bus);
        _riapertura = new RiapriRegistroCassaOrchestrator(uow, chiusureService, bus);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    #region Semina

    private Ordine SeminaOrdine(
        RegistroCassa registro,
        Utente utente,
        int numero,
        string stato,
        decimal prezzo,
        string suffissoSplit = "")
    {
        Prodotto prodotto = ScenarioOrdini.SeminaProdotto(_db, $"BIB-{numero}-{suffissoSplit}", prezzo);
        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(_db, registro, utente, numero, (prodotto, 1m));

        if (stato != StatiOrdine.Aperto)
        {
            ordine.Stato = stato;
            ordine.SuffissoSplit = suffissoSplit;
            _db.SaveChanges();
        }

        return ordine;
    }

    private void SeminaMeseChiuso(int anno, int mese)
    {
        _db.ChiusureMensili.Add(new ChiusuraMensile { Anno = anno, Mese = mese, Stato = "CHIUSA" });
        _db.SaveChanges();
    }

    private string StatoRiletto(int registroId)
    {
        _db.ChangeTracker.Clear();
        return _db.RegistriCassa.Single(r => r.Id == registroId).Stato;
    }

    #endregion

    // ── 1. Il caso della produzione di oggi: nessun ordine, nessun cambiamento ────────────────────

    /// <summary>
    /// 🔴 <b>Il test che vale più di tutti gli altri di questo file.</b> In produzione ci sono 607
    /// registri storici e zero ordini: se questo diventa rosso, la chiusura di cassa è rotta per
    /// ogni giornata mai importata, non per un caso di frontiera.
    /// </summary>
    [Fact]
    public async Task RegistroSenzaAlcunOrdine_SiChiudeEsattamenteComePrima()
    {
        ScenarioOrdini.SeminaImpostazioni(_db);
        Utente utente = ScenarioOrdini.SeminaUtente(_db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(_db, utente, Mercoledi);

        (await _db.Ordini.CountAsync()).Should().Be(0, "è lo stato della produzione di oggi");

        RegistroCassa chiuso = await _chiusura.ExecuteAsync(registro.Id);

        chiuso.Stato.Should().Be("CLOSED");
        StatoRiletto(registro.Id).Should().Be("CLOSED");
    }

    /// <summary>
    /// Un ordine aperto su un <b>altro</b> registro non blocca questo: la guardia è per registro,
    /// e senza questo caso una condizione scritta male passerebbe comunque tutti gli altri test.
    /// </summary>
    [Fact]
    public async Task OrdineApertoSuUnAltroRegistro_NonBloccaLaChiusuraDiQuesto()
    {
        ScenarioOrdini.SeminaImpostazioni(_db);
        Utente utente = ScenarioOrdini.SeminaUtente(_db, amministratore: false, "Cassiere");
        RegistroCassa ieri = ScenarioOrdini.SeminaRegistro(_db, utente, Mercoledi.AddDays(-1));
        RegistroCassa oggi = ScenarioOrdini.SeminaRegistro(_db, utente, Mercoledi);

        SeminaOrdine(ieri, utente, numero: 1, StatiOrdine.Aperto, prezzo: 12.00m);

        RegistroCassa chiuso = await _chiusura.ExecuteAsync(oggi.Id);

        chiuso.Stato.Should().Be("CLOSED");
        StatoRiletto(ieri.Id).Should().Be("DRAFT", "il registro di ieri non è stato toccato");
    }

    // ── 2. Stati terminali: uno scenario per ciascuno dei quattro ────────────────────────────────

    [Fact]
    public async Task OrdiniTuttiChiusi_NonBloccanoLaChiusura()
    {
        (RegistroCassa registro, Utente utente) = MondoConRegistro();
        SeminaOrdine(registro, utente, numero: 1, StatiOrdine.Chiuso, prezzo: 12.00m);
        SeminaOrdine(registro, utente, numero: 2, StatiOrdine.Chiuso, prezzo: 8.50m);

        RegistroCassa chiuso = await _chiusura.ExecuteAsync(registro.Id);

        chiuso.Stato.Should().Be("CLOSED",
            "un ordine CHIUSO è un incasso già dichiarato: è esattamente ciò che la chiusura dichiara");
    }

    [Fact]
    public async Task OrdiniTuttiAnnullati_NonBloccanoLaChiusura()
    {
        (RegistroCassa registro, Utente utente) = MondoConRegistro();
        SeminaOrdine(registro, utente, numero: 1, StatiOrdine.Annullato, prezzo: 12.00m);

        RegistroCassa chiuso = await _chiusura.ExecuteAsync(registro.Id);

        chiuso.Stato.Should().Be("CLOSED", "un ordine annullato non ha mai incassato nulla");
    }

    [Fact]
    public async Task OrdiniTuttiStornati_NonBloccanoLaChiusura()
    {
        (RegistroCassa registro, Utente utente) = MondoConRegistro();
        SeminaOrdine(registro, utente, numero: 1, StatiOrdine.Stornato, prezzo: 12.00m);

        RegistroCassa chiuso = await _chiusura.ExecuteAsync(registro.Id);

        chiuso.Stato.Should().Be("CLOSED", "uno storno è un gesto già risolto, non un conto in sospeso");
    }

    /// <summary>
    /// 🔴 Il caso <b>senza via d'uscita</b>: un padre <c>SPLITTATO</c> non si può chiudere (i suoi
    /// figli hanno già incassato) né annullare (l'annullo vale solo da <c>APERTO</c>). Se bloccasse
    /// la chiusura, la cassa resterebbe ferma su un incasso già dichiarato e nessuna azione
    /// dell'operatore potrebbe sbloccarla.
    /// </summary>
    [Fact]
    public async Task PadreSplittatoConFigliChiusi_NonBloccaLaChiusura()
    {
        (RegistroCassa registro, Utente utente) = MondoConRegistro();

        SeminaOrdine(registro, utente, numero: 1, StatiOrdine.Splittato, prezzo: 30.00m);
        SeminaOrdine(registro, utente, numero: 1, StatiOrdine.Chiuso, prezzo: 18.00m, suffissoSplit: "A");
        SeminaOrdine(registro, utente, numero: 1, StatiOrdine.Chiuso, prezzo: 12.00m, suffissoSplit: "B");

        RegistroCassa chiuso = await _chiusura.ExecuteAsync(registro.Id);

        chiuso.Stato.Should().Be("CLOSED");
    }

    /// <summary>
    /// Tutti e quattro gli stati terminali insieme sullo stesso registro, che è la forma reale di
    /// una giornata movimentata: nessuno di essi blocca, ed è lo scenario della spec «Ordini già
    /// risolti non bloccano».
    /// </summary>
    [Fact]
    public async Task TuttiGliStatiTerminaliInsieme_LaChiusuraRiesceAlPrimoTentativo()
    {
        (RegistroCassa registro, Utente utente) = MondoConRegistro();

        SeminaOrdine(registro, utente, numero: 1, StatiOrdine.Chiuso, prezzo: 12.00m);
        SeminaOrdine(registro, utente, numero: 2, StatiOrdine.Chiuso, prezzo: 6.00m);
        SeminaOrdine(registro, utente, numero: 3, StatiOrdine.Annullato, prezzo: 4.00m);
        SeminaOrdine(registro, utente, numero: 4, StatiOrdine.Annullato, prezzo: 9.00m);
        SeminaOrdine(registro, utente, numero: 5, StatiOrdine.Stornato, prezzo: 7.00m);
        SeminaOrdine(registro, utente, numero: 6, StatiOrdine.Splittato, prezzo: 20.00m);

        RegistroCassa chiuso = await _chiusura.ExecuteAsync(registro.Id);

        chiuso.Stato.Should().Be("CLOSED");
    }

    // ── 3. Almeno un APERTO: blocca, e dice quanti e quanto ──────────────────────────────────────

    [Fact]
    public async Task UnSoloOrdineAperto_BloccaLaChiusura_EIlRegistroRestaInBozza()
    {
        (RegistroCassa registro, Utente utente) = MondoConRegistro();
        SeminaOrdine(registro, utente, numero: 1, StatiOrdine.Aperto, prezzo: 12.00m);

        ExecutionError errore = await Assert.ThrowsAsync<ExecutionError>(
            () => _chiusura.ExecuteAsync(registro.Id));

        errore.Message.Should().Contain("1 ordine ancora aperto");
        errore.Message.Should().MatchRegex(@"12[.,]00 €", "il messaggio deve dire a quanto ammonta");
        errore.Message.Should().Contain("260826-001", "l'identificativo stampabile individua l'ordine");
        errore.Message.Should().Contain("annullato", "la via d'uscita va detta, o il blocco è un vicolo cieco");

        StatoRiletto(registro.Id).Should().Be("DRAFT");
    }

    /// <summary>
    /// Lo scenario della spec: due ordini aperti per 30,00 € complessivi. Il messaggio deve dire
    /// <b>quanti</b> e <b>quanto</b>, perché è ciò con cui l'operatore decide se cercare un conto
    /// dimenticato o annullarlo.
    /// </summary>
    [Fact]
    public async Task DueOrdiniAperti_IlMessaggioNominaIlConteggioEIlTotale()
    {
        (RegistroCassa registro, Utente utente) = MondoConRegistro();
        SeminaOrdine(registro, utente, numero: 1, StatiOrdine.Aperto, prezzo: 18.00m);
        SeminaOrdine(registro, utente, numero: 2, StatiOrdine.Aperto, prezzo: 12.00m);

        ExecutionError errore = await Assert.ThrowsAsync<ExecutionError>(
            () => _chiusura.ExecuteAsync(registro.Id));

        errore.Message.Should().Contain("2 ordini ancora aperti");
        errore.Message.Should().MatchRegex(@"30[.,]00 €");
        errore.Message.Should().Contain("260826-001").And.Contain("260826-002");

        StatoRiletto(registro.Id).Should().Be("DRAFT");
    }

    /// <summary>
    /// Un solo ordine aperto in mezzo a cinque risolti blocca lo stesso, e il messaggio nomina
    /// <b>lui</b> e il <b>suo</b> importo: se contasse anche i risolti, l'operatore andrebbe a
    /// cercare conti che non esistono più.
    /// </summary>
    [Fact]
    public async Task UnApertoFraTantiRisolti_BloccaENominaSoloLui()
    {
        (RegistroCassa registro, Utente utente) = MondoConRegistro();

        SeminaOrdine(registro, utente, numero: 1, StatiOrdine.Chiuso, prezzo: 100.00m);
        SeminaOrdine(registro, utente, numero: 2, StatiOrdine.Annullato, prezzo: 100.00m);
        SeminaOrdine(registro, utente, numero: 3, StatiOrdine.Stornato, prezzo: 100.00m);
        SeminaOrdine(registro, utente, numero: 4, StatiOrdine.Splittato, prezzo: 100.00m);
        SeminaOrdine(registro, utente, numero: 5, StatiOrdine.Aperto, prezzo: 7.50m);

        ExecutionError errore = await Assert.ThrowsAsync<ExecutionError>(
            () => _chiusura.ExecuteAsync(registro.Id));

        errore.Message.Should().Contain("1 ordine ancora aperto");
        errore.Message.Should().MatchRegex(@"7[.,]50 €");
        errore.Message.Should().Contain("260826-005");
        errore.Message.Should().NotContain("260826-001", "gli ordini risolti non c'entrano con il blocco");
    }

    /// <summary>
    /// Un ordine aperto <b>senza voci</b> — il conto appena battuto per sbaglio — blocca comunque,
    /// e l'importo è 0,00 € invece di far saltare la somma.
    /// </summary>
    [Fact]
    public async Task OrdineApertoSenzaVoci_BloccaConImportoZero()
    {
        (RegistroCassa registro, Utente utente) = MondoConRegistro();
        ScenarioOrdini.SeminaOrdineAperto(_db, registro, utente, numero: 1);

        ExecutionError errore = await Assert.ThrowsAsync<ExecutionError>(
            () => _chiusura.ExecuteAsync(registro.Id));

        errore.Message.Should().Contain("1 ordine ancora aperto");
        errore.Message.Should().MatchRegex(@"0[.,]00 €");
    }

    // ── 4. La via d'uscita: annullare sblocca ────────────────────────────────────────────────────

    /// <summary>
    /// Lo scenario della spec «La via d'uscita sblocca», per intero: prima bloccata, poi l'annullo,
    /// poi la chiusura riesce — e nessun secchio si è mosso, perché un ordine aperto non aveva mai
    /// toccato niente.
    /// </summary>
    [Fact]
    public async Task AnnullareLOrdineAperto_SbloccaLaChiusura_SenzaMuovereISecchi()
    {
        ScenarioOrdini.SeminaImpostazioni(_db);
        Utente utente = ScenarioOrdini.SeminaUtente(_db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(
            _db, utente, Mercoledi, incassiElettronici: 40.00m, incassoContanteTracciato: 15.00m);

        Ordine ordine = SeminaOrdine(registro, utente, numero: 1, StatiOrdine.Aperto, prezzo: 12.00m);

        await Assert.ThrowsAsync<ExecutionError>(() => _chiusura.ExecuteAsync(registro.Id));

        await ScenarioOrdini.Annullo(_db)
            .ExecuteAsync(ordine.OrdineId, "conto abbandonato a fine serata", utente.Id);

        RegistroCassa chiuso = await _chiusura.ExecuteAsync(registro.Id);

        chiuso.Stato.Should().Be("CLOSED");
        chiuso.IncassiElettronici.Should().Be(40.00m);
        chiuso.IncassoContanteTracciato.Should().Be(15.00m);
    }

    // ── 5. Le guardie preesistenti restano attive, e prima ───────────────────────────────────────

    /// <summary>
    /// 🔴 <b>L'ordine di valutazione è parte del contratto.</b> Con un mese chiuso <i>e</i> un
    /// ordine aperto l'operatore deve vedere il mese chiuso: è il motivo più forte, e non c'è nulla
    /// che possa fare sugli ordini per superarlo. Una guardia nuova messa davanti alle vecchie
    /// cambierebbe l'errore che si vede per primo senza che nessun altro test se ne accorga.
    /// </summary>
    [Fact]
    public async Task MeseChiuso_RestaLErroreCheSiVedePerPrimo()
    {
        (RegistroCassa registro, Utente utente) = MondoConRegistro();
        SeminaOrdine(registro, utente, numero: 1, StatiOrdine.Aperto, prezzo: 12.00m);
        SeminaMeseChiuso(Mercoledi.Year, Mercoledi.Month);

        ExecutionError errore = await Assert.ThrowsAsync<ExecutionError>(
            () => _chiusura.ExecuteAsync(registro.Id));

        errore.Message.Should().Contain("il mese").And.Contain("è chiuso");
        errore.Message.Should().NotContain("ordine ancora aperto");
        StatoRiletto(registro.Id).Should().Be("DRAFT");
    }

    [Fact]
    public async Task GiornoNonOperativo_RestaLErroreCheSiVedePerPrimo()
    {
        ScenarioOrdini.SeminaImpostazioni(_db);
        Utente utente = ScenarioOrdini.SeminaUtente(_db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(_db, utente, Domenica);
        SeminaOrdine(registro, utente, numero: 1, StatiOrdine.Aperto, prezzo: 12.00m);

        ExecutionError errore = await Assert.ThrowsAsync<ExecutionError>(
            () => _chiusura.ExecuteAsync(registro.Id));

        errore.Message.Should().Contain("giorno di chiusura");
        errore.Message.Should().NotContain("ordine ancora aperto");
        StatoRiletto(registro.Id).Should().Be("DRAFT");
    }

    /// <summary>
    /// Il rifiuto della richiusura viene prima di ogni guard, come oggi: un registro già
    /// <c>CLOSED</c> risponde «è già chiuso» anche se nel frattempo qualcuno ha aperto un ordine.
    /// </summary>
    [Fact]
    public async Task RegistroGiaChiuso_ContinuaARifiutareLaRichiusuraComeOggi()
    {
        ScenarioOrdini.SeminaImpostazioni(_db);
        Utente utente = ScenarioOrdini.SeminaUtente(_db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(_db, utente, Mercoledi, stato: "CLOSED");
        SeminaOrdine(registro, utente, numero: 1, StatiOrdine.Aperto, prezzo: 12.00m);

        Exception errore = await Assert.ThrowsAsync<Exception>(
            () => _chiusura.ExecuteAsync(registro.Id));

        errore.Message.Should().Contain("già chiuso");
    }

    /// <summary>
    /// ⚠️ <b>La riapertura NON acquisisce la guardia</b>, e il delta di spec non gliela chiede: il
    /// requirement nomina <c>chiudiRegistroCassa</c> soltanto. Riaprire <i>allarga</i> ciò che si
    /// può fare sul registro invece di dichiarare una giornata, quindi un ordine aperto non è un
    /// motivo per impedirla — anzi, è spesso il motivo per cui la si vuole.
    /// </summary>
    [Fact]
    public async Task LaRiapertura_NonEBloccataDaUnOrdineAperto()
    {
        ScenarioOrdini.SeminaImpostazioni(_db);
        Utente admin = ScenarioOrdini.SeminaUtente(_db, amministratore: true, "Amministratore");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(_db, admin, Mercoledi, stato: "CLOSED");
        SeminaOrdine(registro, admin, numero: 1, StatiOrdine.Aperto, prezzo: 12.00m);

        RegistroCassa riaperto = await _riapertura.ExecuteAsync(registro.Id, admin.Id);

        riaperto.Stato.Should().Be("DRAFT");
    }

    private (RegistroCassa Registro, Utente Utente) MondoConRegistro()
    {
        ScenarioOrdini.SeminaImpostazioni(_db);
        Utente utente = ScenarioOrdini.SeminaUtente(_db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(_db, utente, Mercoledi);
        return (registro, utente);
    }
}
