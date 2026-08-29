using DuedGusto.Tests.Helpers;

using GraphQL;

using duedgusto.Common;
using duedgusto.GraphQL.Vendite;
using duedgusto.GraphQL.Vendite.Types;

namespace DuedGusto.Tests.Integration;

/// <summary>
/// La chiusura di un ordine: l'unico punto del backend in cui nasce una <c>Vendita</c> e in cui si
/// muove un secchio del registro.
///
/// <para>Due provider, e la scelta non è di comodo:</para>
/// <list type="bullet">
///   <item><b>Sqlite</b> per tutto ciò che riguarda la <b>guardia</b> — la seconda chiusura, le due
///   chiusure concorrenti — perché lì serve un database vero: transazioni che rotolano indietro e
///   una UPDATE condizionata di cui si contano le righe toccate.</item>
///   <item><b>InMemory</b> per gli effetti contabili, che non dipendono dal motore e girano dove
///   gira il resto della suite.</item>
/// </list>
///
/// <para>🔴 <b>Che cosa questi test non provano.</b> Sqlite non riproduce il locking di riga di
/// InnoDB sotto <c>REPEATABLE READ</c>. Verde qui significa «la guardia c'è, è nella macchina a
/// stati, e un secondo scrittore con in mano un valore vecchio viene rifiutato»; non significa
/// «su MySQL due telefoni non possono incassare due volte», che poggia sulla semantica del motore
/// descritta in <see cref="TransizioneOrdine"/>.</para>
/// </summary>
public class OrdiniChiusuraTests
{
    private static ChiudiOrdineInput Taglio(
        Ordine ordine, string metodo, decimal? contanteRicevuto = null) => new()
        {
            OrdineId = ordine.OrdineId,
            Tagli =
            [
                new TaglioOrdineInput
                {
                    MetodoPagamento = metodo,
                    RigheOrdineId = ordine.Righe.Select(r => r.RigaOrdineId).ToList(),
                    ContanteRicevuto = contanteRicevuto,
                }
            ],
        };

    private static ChiudiOrdineInput TaglioSuRighe(
        int ordineId, string metodo, IEnumerable<int> righeId, decimal? contanteRicevuto = null) => new()
        {
            OrdineId = ordineId,
            Tagli =
            [
                new TaglioOrdineInput
                {
                    MetodoPagamento = metodo,
                    RigheOrdineId = righeId.ToList(),
                    ContanteRicevuto = contanteRicevuto,
                }
            ],
        };

    // ── La guardia: una volta e una sola ─────────────────────────────────────────────────────────

    [Fact]
    public async Task Chiusura_MuoveIlSecchioElettronicoUnaVoltaSola()
    {
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var db = TestDbContextFactory.CreateSqlite(connessione);

        ScenarioOrdini.SeminaImpostazioni(db);
        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, utente, incassiElettronici: 40.00m);
        Prodotto spritz = ScenarioOrdini.SeminaProdotto(db, "BIB-SPRITZ", 6.00m);
        Prodotto tagliere = ScenarioOrdini.SeminaProdotto(db, "CIB-TAGLIERE", 12.50m);

        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(
            db, registro, utente, numero: 1, (spritz, 1m), (tagliere, 1m));
        db.Entry(ordine).Collection(o => o.Righe).Load();

        EsitoChiusuraOrdine esito = await ScenarioOrdini.Chiusura(db)
            .ExecuteAsync(Taglio(ordine, MetodiPagamentoVendita.Elettronico), utente.Id);

        esito.Ordine.Stato.Should().Be(StatiOrdine.Chiuso);
        esito.OrdiniGenerati.Should().BeEmpty("una chiusura semplice non genera figli");
        esito.Ordine.TotaleOrdine.Should().Be(18.50m);

        // Rilettura da un contesto nuovo: l'identity map risponderebbe al posto del database.
        using var lettura = TestDbContextFactory.CreateSqlite(connessione);
        RegistroCassa riletto = await lettura.RegistriCassa.SingleAsync();
        riletto.IncassiElettronici.Should().Be(58.50m, "40,00 di partenza più i 18,50 dell'ordine");

        List<Vendita> vendite = await lettura.Vendite.ToListAsync();
        vendite.Should().HaveCount(2);
        vendite.Should().OnlyContain(v => v.OrdineId == ordine.OrdineId);
        vendite.Sum(v => v.PrezzoTotale).Should().Be(18.50m);
    }

    [Fact]
    public async Task SecondaChiusura_RifiutataEIlSecchioNonSiMuoveDiNuovo()
    {
        // Copre due scenari della spec con lo stesso meccanismo: la seconda chiusura deliberata e
        // il retry di rete di un client che ha perso la risposta della prima.
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var db = TestDbContextFactory.CreateSqlite(connessione);

        ScenarioOrdini.SeminaImpostazioni(db);
        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, utente, incassiElettronici: 40.00m);
        Prodotto spritz = ScenarioOrdini.SeminaProdotto(db, "BIB-SPRITZ", 6.00m);

        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(db, registro, utente, numero: 1, (spritz, 3m));
        db.Entry(ordine).Collection(o => o.Righe).Load();
        ChiudiOrdineInput input = Taglio(ordine, MetodiPagamentoVendita.Elettronico);

        await ScenarioOrdini.Chiusura(db).ExecuteAsync(input, utente.Id);

        var errore = await Assert.ThrowsAsync<ExecutionError>(
            () => ScenarioOrdini.Chiusura(db).ExecuteAsync(input, utente.Id));
        errore.Message.Should().Contain(StatiOrdine.Chiuso).And.Contain("storno");

        using var lettura = TestDbContextFactory.CreateSqlite(connessione);
        (await lettura.RegistriCassa.SingleAsync()).IncassiElettronici
            .Should().Be(58.00m, "il delta si applica una volta sola, non due");
        (await lettura.Vendite.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task DueChiusureConcorrenti_UnaSolaVinceEIlSecchioSiMuoveUnaVolta()
    {
        // 🔴 IL TEST CHE GIUSTIFICA IL CHANGE. Non è la seconda chiusura di un ordine già visto
        //    chiuso — quella la ferma il controllo anticipato — è il caso in cui DUE dispositivi
        //    hanno letto lo stesso ordine APERTO e provano a chiuderlo entrambi. Il controllo
        //    anticipato del secondo passa, perché il suo contesto ha in mano un valore ormai
        //    vecchio: a fermarlo resta solo il token di concorrenza, cioè il database.
        //
        //    La finestra si apre in modo deterministico caricando l'ordine nel secondo contesto
        //    PRIMA che il primo chiuda: EF non sovrascrive i valori correnti di un'entità già
        //    tracciata, quindi il secondo continua a credere che sia APERTO.
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var primoDispositivo = TestDbContextFactory.CreateSqlite(connessione);

        ScenarioOrdini.SeminaImpostazioni(primoDispositivo);
        Utente utente = ScenarioOrdini.SeminaUtente(primoDispositivo, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(
            primoDispositivo, utente, incassiElettronici: 40.00m);
        Prodotto spritz = ScenarioOrdini.SeminaProdotto(primoDispositivo, "BIB-SPRITZ", 6.00m);

        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(
            primoDispositivo, registro, utente, numero: 1, (spritz, 3m));
        primoDispositivo.Entry(ordine).Collection(o => o.Righe).Load();
        ChiudiOrdineInput input = Taglio(ordine, MetodiPagamentoVendita.Elettronico);

        using var secondoDispositivo = TestDbContextFactory.CreateSqlite(connessione);
        Ordine vistoDalSecondo = await secondoDispositivo.Ordini
            .Include(o => o.Righe)
            .SingleAsync(o => o.OrdineId == ordine.OrdineId);
        vistoDalSecondo.Stato.Should().Be(StatiOrdine.Aperto, "è la premessa della corsa");

        await ScenarioOrdini.Chiusura(primoDispositivo).ExecuteAsync(input, utente.Id);

        var errore = await Assert.ThrowsAsync<ExecutionError>(
            () => ScenarioOrdini.Chiusura(secondoDispositivo).ExecuteAsync(input, utente.Id));
        errore.Message.Should().Contain("altro dispositivo");

        using var lettura = TestDbContextFactory.CreateSqlite(connessione);
        (await lettura.RegistriCassa.SingleAsync()).IncassiElettronici
            .Should().Be(58.00m, "il perdente non deve aver applicato un secondo delta");
        (await lettura.Vendite.CountAsync()).Should().Be(1, "né aver creato un secondo insieme di vendite");
        (await lettura.Ordini.SingleAsync()).Stato.Should().Be(StatiOrdine.Chiuso);
    }

    // ── Effetti contabili ────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Chiusura_IlBreakdownVedeLeVenditeAppenaCreate_NessunResiduoStimato()
    {
        // 🔴 È il test che sorveglia il SaveChangesAsync fra le Vendita e il breakdown.
        //    BreakdownIvaApplier rilegge le vendite dal DATABASE: se il salvataggio arrivasse dopo,
        //    troverebbe zero vendite, VenditeContanti resterebbe 0 e l'intero incasso finirebbe
        //    nella riga «Stimato» invece che nelle righe IVA esatte — senza alcun errore.
        using var db = TestDbContextFactory.Create();

        ScenarioOrdini.SeminaImpostazioni(db);
        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(
            db, utente, totaleApertura: 50.00m, totaleChiusura: 68.50m);
        Prodotto spritz = ScenarioOrdini.SeminaProdotto(db, "BIB-SPRITZ", 6.00m);
        Prodotto tagliere = ScenarioOrdini.SeminaProdotto(db, "CIB-TAGLIERE", 12.50m);

        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(
            db, registro, utente, numero: 1, (spritz, 1m), (tagliere, 1m));
        db.Entry(ordine).Collection(o => o.Righe).Load();

        await ScenarioOrdini.Chiusura(db)
            .ExecuteAsync(Taglio(ordine, MetodiPagamentoVendita.ContanteNonTracciato), utente.Id);

        db.ChangeTracker.Clear();
        RegistroCassa riletto = await db.RegistriCassa.SingleAsync();
        riletto.VenditeContanti.Should().Be(18.50m, "la somma delle vendite persistite dell'ordine");

        List<RegistroCassaIva> righeIva = await db.RegistriCassaIva.ToListAsync();
        righeIva.Should().NotBeEmpty();
        righeIva.Should().OnlyContain(r => !r.Stimato,
            "l'intero incasso è coperto da vendite itemizzate: non resta nulla da stimare");
        righeIva.Sum(r => r.Imponibile + r.Imposta).Should().Be(18.50m);
    }

    [Fact]
    public async Task OrdineAperto_NonMuoveNessunSecchioNeIlBreakdown()
    {
        using var db = TestDbContextFactory.Create();

        ScenarioOrdini.SeminaImpostazioni(db);
        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, utente, incassiElettronici: 40.00m);
        Prodotto spritz = ScenarioOrdini.SeminaProdotto(db, "BIB-SPRITZ", 6.00m);

        ScenarioOrdini.SeminaOrdineAperto(db, registro, utente, numero: 1, (spritz, 3m));

        db.ChangeTracker.Clear();
        RegistroCassa riletto = await db.RegistriCassa.SingleAsync();
        riletto.IncassiElettronici.Should().Be(40.00m);
        riletto.IncassoContanteTracciato.Should().Be(0m);
        riletto.VenditeContanti.Should().Be(0m);
        (await db.Vendite.CountAsync()).Should().Be(0, "una voce battuta non è ancora una vendita");
        (await db.RegistriCassaIva.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task ChiusuraInContanteNonTracciato_NonMuoveAlcunSecchio_MaRaffinaLIva()
    {
        using var db = TestDbContextFactory.Create();

        ScenarioOrdini.SeminaImpostazioni(db);
        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(
            db, utente, incassiElettronici: 40.00m, incassoContanteTracciato: 15.00m);
        Prodotto spritz = ScenarioOrdini.SeminaProdotto(db, "BIB-SPRITZ", 6.00m);

        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(db, registro, utente, numero: 1, (spritz, 3m));
        db.Entry(ordine).Collection(o => o.Righe).Load();

        await ScenarioOrdini.Chiusura(db)
            .ExecuteAsync(Taglio(ordine, MetodiPagamentoVendita.ContanteNonTracciato), utente.Id);

        db.ChangeTracker.Clear();
        RegistroCassa riletto = await db.RegistriCassa.SingleAsync();
        riletto.IncassiElettronici.Should().Be(40.00m, "il non tracciato non tocca alcun secchio");
        riletto.IncassoContanteTracciato.Should().Be(15.00m);
        riletto.VenditeContanti.Should().Be(18.00m, "ma la ripartizione IVA sì che si raffina");
    }

    [Fact]
    public async Task ChiusuraInContanteTracciato_AlzaIlSecchioDelTracciato()
    {
        using var db = TestDbContextFactory.Create();

        ScenarioOrdini.SeminaImpostazioni(db);
        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, utente, incassoContanteTracciato: 15.00m);
        Prodotto spritz = ScenarioOrdini.SeminaProdotto(db, "BIB-SPRITZ", 6.00m);

        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(db, registro, utente, numero: 1, (spritz, 2m));
        db.Entry(ordine).Collection(o => o.Righe).Load();

        await ScenarioOrdini.Chiusura(db)
            .ExecuteAsync(Taglio(ordine, MetodiPagamentoVendita.ContanteTracciato), utente.Id);

        db.ChangeTracker.Clear();
        (await db.RegistriCassa.SingleAsync()).IncassoContanteTracciato.Should().Be(27.00m);
    }

    [Fact]
    public async Task IlPrezzoDellaVenditaVieneDallaRiga_NonDalListinoRitoccatoDopo()
    {
        // Lo snapshot si prende quando la voce è battuta, perché è il prezzo detto al cliente. Un
        // ritocco di listino a ordine aperto non deve cambiare il conto sotto al cliente.
        using var db = TestDbContextFactory.Create();

        ScenarioOrdini.SeminaImpostazioni(db);
        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, utente);
        Prodotto spritz = ScenarioOrdini.SeminaProdotto(db, "BIB-SPRITZ", 6.00m);

        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(db, registro, utente, numero: 1, (spritz, 2m));
        db.Entry(ordine).Collection(o => o.Righe).Load();

        spritz.Prezzo = 9.00m;
        await db.SaveChangesAsync();

        EsitoChiusuraOrdine esito = await ScenarioOrdini.Chiusura(db)
            .ExecuteAsync(Taglio(ordine, MetodiPagamentoVendita.ContanteNonTracciato), utente.Id);

        esito.Ordine.TotaleOrdine.Should().Be(12.00m, "due spritz a 6,00 €, il prezzo detto al cliente");

        db.ChangeTracker.Clear();
        Vendita vendita = await db.Vendite.SingleAsync();
        vendita.PrezzoUnitario.Should().Be(6.00m);
        vendita.PrezzoTotale.Should().Be(12.00m);
        (vendita.Imponibile + vendita.ImportoIva).Should().Be(vendita.PrezzoTotale);
    }

    // ── Contante ricevuto e resto da rendere ─────────────────────────────────────────────────────

    [Fact]
    public async Task ContanteRicevuto_ProduceIlRestoDaRendere_ENonTocca_RegistroCassaResto()
    {
        using var db = TestDbContextFactory.Create();

        ScenarioOrdini.SeminaImpostazioni(db);
        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, utente);
        registro.Resto = 123.45m;   // la colonna AG del foglio, che non c'entra nulla con il cliente
        await db.SaveChangesAsync();

        Prodotto tagliere = ScenarioOrdini.SeminaProdotto(db, "CIB-TAGLIERE", 17.50m);
        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(db, registro, utente, numero: 1, (tagliere, 1m));
        db.Entry(ordine).Collection(o => o.Righe).Load();

        EsitoChiusuraOrdine esito = await ScenarioOrdini.Chiusura(db).ExecuteAsync(
            Taglio(ordine, MetodiPagamentoVendita.ContanteNonTracciato, contanteRicevuto: 20.00m),
            utente.Id);

        esito.RestoDaRendere.Should().Be(2.50m);

        db.ChangeTracker.Clear();
        RegistroCassa riletto = await db.RegistriCassa.SingleAsync();
        riletto.Resto.Should().Be(123.45m, "il resto al cliente non è la colonna AG del foglio");
        (await db.Ordini.SingleAsync()).ContanteRicevuto.Should().Be(20.00m);
    }

    [Fact]
    public async Task ContanteRicevutoInferioreAlTotale_Rifiutato()
    {
        using var db = TestDbContextFactory.Create();

        ScenarioOrdini.SeminaImpostazioni(db);
        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, utente);
        Prodotto tagliere = ScenarioOrdini.SeminaProdotto(db, "CIB-TAGLIERE", 17.50m);

        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(db, registro, utente, numero: 1, (tagliere, 1m));
        db.Entry(ordine).Collection(o => o.Righe).Load();

        var errore = await Assert.ThrowsAsync<ExecutionError>(() => ScenarioOrdini.Chiusura(db)
            .ExecuteAsync(
                Taglio(ordine, MetodiPagamentoVendita.ContanteNonTracciato, contanteRicevuto: 15.00m),
                utente.Id));

        errore.Message.Should().Contain("non copre il totale");

        db.ChangeTracker.Clear();
        (await db.Ordini.SingleAsync()).Stato.Should().Be(StatiOrdine.Aperto);
        (await db.Vendite.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task ContanteRicevutoSuPagamentoElettronico_Rifiutato()
    {
        using var db = TestDbContextFactory.Create();

        ScenarioOrdini.SeminaImpostazioni(db);
        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, utente);
        Prodotto tagliere = ScenarioOrdini.SeminaProdotto(db, "CIB-TAGLIERE", 17.50m);

        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(db, registro, utente, numero: 1, (tagliere, 1m));
        db.Entry(ordine).Collection(o => o.Righe).Load();

        var errore = await Assert.ThrowsAsync<ExecutionError>(() => ScenarioOrdini.Chiusura(db)
            .ExecuteAsync(
                Taglio(ordine, MetodiPagamentoVendita.Elettronico, contanteRicevuto: 20.00m),
                utente.Id));

        errore.Message.Should().Contain("pagamento elettronico");
    }

    // ── Guardie di contorno ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task MetodoNonAmmesso_Rifiutato_PrimaDiQualunqueScrittura()
    {
        using var db = TestDbContextFactory.Create();

        ScenarioOrdini.SeminaImpostazioni(db);
        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, utente);
        Prodotto spritz = ScenarioOrdini.SeminaProdotto(db, "BIB-SPRITZ", 6.00m);

        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(db, registro, utente, numero: 1, (spritz, 1m));
        db.Entry(ordine).Collection(o => o.Righe).Load();

        var errore = await Assert.ThrowsAsync<ExecutionError>(() => ScenarioOrdini.Chiusura(db)
            .ExecuteAsync(
                TaglioSuRighe(ordine.OrdineId, "ASSEGNO", ordine.Righe.Select(r => r.RigaOrdineId)),
                utente.Id));

        errore.Message.Should().Contain("non ammesso");

        db.ChangeTracker.Clear();
        (await db.Ordini.SingleAsync()).Stato.Should().Be(StatiOrdine.Aperto);
    }

    [Fact]
    public async Task OrdineSenzaVoci_NonSiChiude()
    {
        using var db = TestDbContextFactory.Create();

        ScenarioOrdini.SeminaImpostazioni(db);
        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, utente);
        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(db, registro, utente, numero: 1);

        var errore = await Assert.ThrowsAsync<ExecutionError>(() => ScenarioOrdini.Chiusura(db)
            .ExecuteAsync(TaglioSuRighe(ordine.OrdineId, MetodiPagamentoVendita.Elettronico, []), utente.Id));

        errore.Message.Should().Contain("non ha voci");
    }

    [Fact]
    public async Task RegistroGiaChiuso_LOrdineNonSiIncassa()
    {
        using var db = TestDbContextFactory.Create();

        ScenarioOrdini.SeminaImpostazioni(db);
        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, utente);
        Prodotto spritz = ScenarioOrdini.SeminaProdotto(db, "BIB-SPRITZ", 6.00m);
        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(db, registro, utente, numero: 1, (spritz, 1m));
        db.Entry(ordine).Collection(o => o.Righe).Load();

        registro.Stato = "CLOSED";
        await db.SaveChangesAsync();

        var errore = await Assert.ThrowsAsync<ExecutionError>(() => ScenarioOrdini.Chiusura(db)
            .ExecuteAsync(Taglio(ordine, MetodiPagamentoVendita.Elettronico), utente.Id));

        errore.Message.Should().Contain("già chiuso");
    }

    [Fact]
    public async Task MeseChiusoFraApertura_ELaChiusuraDellOrdine_Rifiutata()
    {
        using var db = TestDbContextFactory.Create();

        ScenarioOrdini.SeminaImpostazioni(db);
        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, utente);
        Prodotto spritz = ScenarioOrdini.SeminaProdotto(db, "BIB-SPRITZ", 6.00m);
        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(db, registro, utente, numero: 1, (spritz, 1m));
        db.Entry(ordine).Collection(o => o.Righe).Load();

        db.ChiusureMensili.Add(new ChiusuraMensile
        {
            Anno = registro.Data.Year,
            Mese = registro.Data.Month,
            Stato = "CHIUSA",
        });
        await db.SaveChangesAsync();

        var errore = await Assert.ThrowsAsync<ExecutionError>(() => ScenarioOrdini.Chiusura(db)
            .ExecuteAsync(Taglio(ordine, MetodiPagamentoVendita.Elettronico), utente.Id));

        errore.Message.Should().Contain("chiuso");

        db.ChangeTracker.Clear();
        (await db.Ordini.SingleAsync()).Stato.Should().Be(StatiOrdine.Aperto);
    }
}
