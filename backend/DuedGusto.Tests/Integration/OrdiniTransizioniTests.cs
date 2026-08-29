using DuedGusto.Tests.Helpers;

using GraphQL;

using duedgusto.Common;
using duedgusto.GraphQL.Vendite.Types;

namespace DuedGusto.Tests.Integration;

/// <summary>
/// Le due uscite di un ordine che non deve restare com'è: <b>annulla</b> e <b>storna</b>.
///
/// <para>Sono due gesti distinti e l'asimmetria è voluta. <b>Annulla</b> agisce su un ordine
/// <c>APERTO</c>, non produce alcun delta — non c'era nulla da disfare — ed è <b>per chiunque
/// venda</b>: è la via d'uscita che sblocca la chiusura di cassa, e riservarla a un
/// amministratore spingerebbe l'operatore a non chiudere affatto gli ordini. <b>Storna</b> agisce
/// su un ordine <c>CHIUSO</c>, applica il <b>delta inverso</b> e cancella le vendite: è
/// l'operazione ad alto rischio, e chiede il ruolo amministratore.</para>
///
/// <para>L'annullo gira su <b>InMemory</b> perché non tocca né transazioni né indici. Lo storno su
/// <b>Sqlite</b>, perché è lì che il delta inverso — non idempotente — va provato con un database
/// vero: uno storno doppio deve trovare la porta chiusa dalla guardia, e le vendite cancellate
/// devono essere davvero sparite quando il breakdown le rilegge.</para>
/// </summary>
public class OrdiniTransizioniTests
{
    private static ChiudiOrdineInput TuttoIn(Ordine ordine, string metodo) => new()
    {
        OrdineId = ordine.OrdineId,
        Tagli =
        [
            new TaglioOrdineInput
            {
                MetodoPagamento = metodo,
                RigheOrdineId = ordine.Righe.Select(r => r.RigaOrdineId).ToList(),
            }
        ],
    };

    // ── Annulla ──────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Annullo_NessunMovimentoSuiSecchi_ELOrdineResta_ConsultabileConChiEQuando()
    {
        using var db = TestDbContextFactory.Create();

        ScenarioOrdini.SeminaImpostazioni(db);
        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(
            db, utente, incassiElettronici: 40.00m, incassoContanteTracciato: 15.00m);
        Prodotto spritz = ScenarioOrdini.SeminaProdotto(db, "BIB-SPRITZ", 6.00m);

        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(db, registro, utente, numero: 1, (spritz, 3m));

        Ordine annullato = await ScenarioOrdini.Annullo(db)
            .ExecuteAsync(ordine.OrdineId, "cliente andato via senza consumare", utente.Id);

        annullato.Stato.Should().Be(StatiOrdine.Annullato);

        db.ChangeTracker.Clear();
        Ordine riletto = await db.Ordini.SingleAsync();
        riletto.Stato.Should().Be(StatiOrdine.Annullato);
        riletto.AnnullatoDa.Should().Be(utente.Id);
        riletto.AnnullatoIl.Should().NotBeNull();
        riletto.MotivoAnnullamento.Should().Be("cliente andato via senza consumare");

        (await db.RigheOrdine.CountAsync()).Should().Be(1, "le righe restano: l'ordine è il libro mastro");
        (await db.Vendite.CountAsync()).Should().Be(0);

        RegistroCassa registroRiletto = await db.RegistriCassa.SingleAsync();
        registroRiletto.IncassiElettronici.Should().Be(40.00m);
        registroRiletto.IncassoContanteTracciato.Should().Be(15.00m);
        registroRiletto.VenditeContanti.Should().Be(0m);
    }

    [Fact]
    public async Task AnnulloSenzaMotivo_Rifiutato()
    {
        using var db = TestDbContextFactory.Create();

        ScenarioOrdini.SeminaImpostazioni(db);
        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, utente);
        Prodotto spritz = ScenarioOrdini.SeminaProdotto(db, "BIB-SPRITZ", 6.00m);
        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(db, registro, utente, numero: 1, (spritz, 1m));

        var errore = await Assert.ThrowsAsync<ExecutionError>(
            () => ScenarioOrdini.Annullo(db).ExecuteAsync(ordine.OrdineId, "   ", utente.Id));

        errore.Message.Should().Contain("serve un motivo");

        db.ChangeTracker.Clear();
        (await db.Ordini.SingleAsync()).Stato.Should().Be(StatiOrdine.Aperto);
    }

    [Fact]
    public async Task AnnulloDiUnOrdineGiaChiuso_Rifiutato_ERimandaAlloStorno()
    {
        using var db = TestDbContextFactory.Create();

        ScenarioOrdini.SeminaImpostazioni(db);
        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, utente);
        Prodotto spritz = ScenarioOrdini.SeminaProdotto(db, "BIB-SPRITZ", 6.00m);
        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(db, registro, utente, numero: 1, (spritz, 1m));
        db.Entry(ordine).Collection(o => o.Righe).Load();

        await ScenarioOrdini.Chiusura(db)
            .ExecuteAsync(TuttoIn(ordine, MetodiPagamentoVendita.Elettronico), utente.Id);

        var errore = await Assert.ThrowsAsync<ExecutionError>(
            () => ScenarioOrdini.Annullo(db).ExecuteAsync(ordine.OrdineId, "sbagliato", utente.Id));

        errore.Message.Should().Contain("storno");

        db.ChangeTracker.Clear();
        (await db.Ordini.SingleAsync()).Stato.Should().Be(StatiOrdine.Chiuso);
    }

    // ── Storna ───────────────────────────────────────────────────────────────────────────────────

    private sealed record MondoChiuso(Utente Operatore, Utente Amministratore, RegistroCassa Registro, Ordine Ordine);

    private static async Task<MondoChiuso> SeminaOrdineChiusoAsync(AppDbContext db, string metodo)
    {
        ScenarioOrdini.SeminaImpostazioni(db);
        Utente operatore = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        Utente amministratore = ScenarioOrdini.SeminaUtente(db, amministratore: true, "Titolare");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, operatore, incassiElettronici: 40.00m);
        Prodotto spritz = ScenarioOrdini.SeminaProdotto(db, "BIB-SPRITZ", 6.00m);
        Prodotto caffe = ScenarioOrdini.SeminaProdotto(db, "BIB-CAFFE", 1.50m);

        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(
            db, registro, operatore, numero: 5, (spritz, 2m), (caffe, 2m));
        db.Entry(ordine).Collection(o => o.Righe).Load();

        await ScenarioOrdini.Chiusura(db).ExecuteAsync(TuttoIn(ordine, metodo), operatore.Id);

        return new MondoChiuso(operatore, amministratore, registro, ordine);
    }

    [Fact]
    public async Task Storno_ApplicaIlDeltaInverso_CancellaLeVendite_EConservaLeRighe()
    {
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var db = TestDbContextFactory.CreateSqlite(connessione);
        MondoChiuso mondo = await SeminaOrdineChiusoAsync(db, MetodiPagamentoVendita.Elettronico);

        using var lettura1 = TestDbContextFactory.CreateSqlite(connessione);
        (await lettura1.RegistriCassa.SingleAsync()).IncassiElettronici
            .Should().Be(55.00m, "40,00 di partenza più i 15,00 dell'ordine");

        Ordine stornato = await ScenarioOrdini.Storno(db)
            .ExecuteAsync(mondo.Ordine.OrdineId, "battuto sul cliente sbagliato", mondo.Amministratore.Id);

        stornato.Stato.Should().Be(StatiOrdine.Stornato);

        using var lettura = TestDbContextFactory.CreateSqlite(connessione);

        Ordine riletto = await lettura.Ordini.SingleAsync();
        riletto.Stato.Should().Be(StatiOrdine.Stornato);
        riletto.StornatoDa.Should().Be(mondo.Amministratore.Id);
        riletto.StornatoIl.Should().NotBeNull();
        riletto.MotivoStorno.Should().Be("battuto sul cliente sbagliato");
        riletto.TotaleOrdine.Should().Be(15.00m, "l'ordine conserva quanto era stato incassato");

        (await lettura.Vendite.CountAsync()).Should().Be(0,
            "una Vendita che esiste è una riga incassata adesso: dopo lo storno non ne esiste nessuna");
        (await lettura.RigheOrdine.CountAsync()).Should().Be(2,
            "le righe restano: senza, uno storno sarebbe indistinguibile da un ordine mai esistito");
        // ⚠️ Somma in memoria e non con SumAsync: Sqlite non ha un tipo decimal nativo e il
        //    provider rifiuta di tradurre l'aggregato. Su due righe non fa differenza.
        (await lettura.RigheOrdine.ToListAsync()).Sum(r => r.PrezzoTotale).Should().Be(15.00m);

        RegistroCassa registro = await lettura.RegistriCassa.SingleAsync();
        registro.IncassiElettronici.Should().Be(40.00m, "il delta inverso riporta il secchio dov'era");
        registro.VenditeContanti.Should().Be(0m, "il breakdown non conta più le vendite cancellate");
    }

    [Fact]
    public async Task StornoDoppio_IlDeltaInversoNonSiApplicaDueVolte()
    {
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var db = TestDbContextFactory.CreateSqlite(connessione);
        MondoChiuso mondo = await SeminaOrdineChiusoAsync(db, MetodiPagamentoVendita.Elettronico);

        await ScenarioOrdini.Storno(db)
            .ExecuteAsync(mondo.Ordine.OrdineId, "primo storno", mondo.Amministratore.Id);

        var errore = await Assert.ThrowsAsync<ExecutionError>(() => ScenarioOrdini.Storno(db)
            .ExecuteAsync(mondo.Ordine.OrdineId, "secondo storno", mondo.Amministratore.Id));

        errore.Message.Should().Contain(StatiOrdine.Stornato);

        using var lettura = TestDbContextFactory.CreateSqlite(connessione);
        (await lettura.RegistriCassa.SingleAsync()).IncassiElettronici
            .Should().Be(40.00m, "un secondo delta inverso lo porterebbe a 25,00 senza che nulla lo segnali");
    }

    [Fact]
    public async Task DueStorniConcorrenti_UnoSoloVince()
    {
        // Come per la chiusura: due amministratori che hanno letto lo stesso ordine CHIUSO. Il
        // controllo anticipato del secondo passa — il suo contesto ha in mano un valore vecchio —
        // e a fermarlo resta il token di concorrenza.
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var primo = TestDbContextFactory.CreateSqlite(connessione);
        MondoChiuso mondo = await SeminaOrdineChiusoAsync(primo, MetodiPagamentoVendita.Elettronico);

        using var secondo = TestDbContextFactory.CreateSqlite(connessione);
        Ordine vistoDalSecondo = await secondo.Ordini
            .Include(o => o.Vendite)
            .SingleAsync(o => o.OrdineId == mondo.Ordine.OrdineId);
        vistoDalSecondo.Stato.Should().Be(StatiOrdine.Chiuso, "è la premessa della corsa");

        await ScenarioOrdini.Storno(primo)
            .ExecuteAsync(mondo.Ordine.OrdineId, "storno del primo", mondo.Amministratore.Id);

        var errore = await Assert.ThrowsAsync<ExecutionError>(() => ScenarioOrdini.Storno(secondo)
            .ExecuteAsync(mondo.Ordine.OrdineId, "storno del secondo", mondo.Amministratore.Id));

        errore.Message.Should().Contain("altro dispositivo");

        using var lettura = TestDbContextFactory.CreateSqlite(connessione);
        (await lettura.RegistriCassa.SingleAsync()).IncassiElettronici.Should().Be(40.00m);
    }

    [Fact]
    public async Task StornoChiestoDaChiNonEAmministratore_Rifiutato_SenzaToccareNulla()
    {
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var db = TestDbContextFactory.CreateSqlite(connessione);
        MondoChiuso mondo = await SeminaOrdineChiusoAsync(db, MetodiPagamentoVendita.Elettronico);

        var errore = await Assert.ThrowsAsync<ExecutionError>(() => ScenarioOrdini.Storno(db)
            .ExecuteAsync(mondo.Ordine.OrdineId, "vorrei disfarlo", mondo.Operatore.Id));

        errore.Message.Should().Contain("amministratori");

        using var lettura = TestDbContextFactory.CreateSqlite(connessione);
        (await lettura.Ordini.SingleAsync()).Stato.Should().Be(StatiOrdine.Chiuso);
        (await lettura.Vendite.CountAsync()).Should().Be(2);
        (await lettura.RegistriCassa.SingleAsync()).IncassiElettronici.Should().Be(55.00m);
    }

    [Fact]
    public async Task StornoSenzaMotivo_Rifiutato()
    {
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var db = TestDbContextFactory.CreateSqlite(connessione);
        MondoChiuso mondo = await SeminaOrdineChiusoAsync(db, MetodiPagamentoVendita.Elettronico);

        var errore = await Assert.ThrowsAsync<ExecutionError>(() => ScenarioOrdini.Storno(db)
            .ExecuteAsync(mondo.Ordine.OrdineId, "", mondo.Amministratore.Id));

        errore.Message.Should().Contain("serve un motivo");

        using var lettura = TestDbContextFactory.CreateSqlite(connessione);
        (await lettura.Ordini.SingleAsync()).Stato.Should().Be(StatiOrdine.Chiuso);
        (await lettura.Vendite.CountAsync()).Should().Be(2);
    }

    [Fact]
    public async Task StornoDiUnOrdineSplittato_Rifiutato_EIFigliRestanoChiusi()
    {
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var db = TestDbContextFactory.CreateSqlite(connessione);

        ScenarioOrdini.SeminaImpostazioni(db);
        Utente operatore = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        Utente amministratore = ScenarioOrdini.SeminaUtente(db, amministratore: true, "Titolare");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, operatore);
        Prodotto spritz = ScenarioOrdini.SeminaProdotto(db, "BIB-SPRITZ", 8.00m);

        Ordine padre = ScenarioOrdini.SeminaOrdineAperto(
            db, registro, operatore, numero: 3, (spritz, 1m), (spritz, 1m));
        db.Entry(padre).Collection(o => o.Righe).Load();
        List<RigaOrdine> righe = padre.Righe.OrderBy(r => r.RigaOrdineId).ToList();

        await ScenarioOrdini.Chiusura(db).ExecuteAsync(
            new ChiudiOrdineInput
            {
                OrdineId = padre.OrdineId,
                Tagli =
                [
                    new TaglioOrdineInput
                    {
                        MetodoPagamento = MetodiPagamentoVendita.ContanteTracciato,
                        RigheOrdineId = [righe[0].RigaOrdineId],
                    },
                    new TaglioOrdineInput
                    {
                        MetodoPagamento = MetodiPagamentoVendita.Elettronico,
                        RigheOrdineId = [righe[1].RigaOrdineId],
                    },
                ],
            },
            operatore.Id);

        var errore = await Assert.ThrowsAsync<ExecutionError>(() => ScenarioOrdini.Storno(db)
            .ExecuteAsync(padre.OrdineId, "annullo tutto", amministratore.Id));

        errore.Message.Should()
            .Contain(StatiOrdine.Splittato).And
            .Contain("singole parti", "si stornano i figli, uno per uno");

        using var lettura = TestDbContextFactory.CreateSqlite(connessione);
        (await lettura.Ordini.SingleAsync(o => o.OrdineId == padre.OrdineId)).Stato
            .Should().Be(StatiOrdine.Splittato);
        (await lettura.Ordini.Where(o => o.OrdinePadreId == padre.OrdineId).ToListAsync())
            .Should().OnlyContain(f => f.Stato == StatiOrdine.Chiuso);

        RegistroCassa registroRiletto = await lettura.RegistriCassa.SingleAsync();
        registroRiletto.IncassoContanteTracciato.Should().Be(8.00m);
        registroRiletto.IncassiElettronici.Should().Be(8.00m);
    }

    [Fact]
    public async Task StornoDiUnOrdineAncoraAperto_Rifiutato()
    {
        using var db = TestDbContextFactory.Create();

        ScenarioOrdini.SeminaImpostazioni(db);
        Utente operatore = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        Utente amministratore = ScenarioOrdini.SeminaUtente(db, amministratore: true, "Titolare");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, operatore);
        Prodotto spritz = ScenarioOrdini.SeminaProdotto(db, "BIB-SPRITZ", 6.00m);
        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(db, registro, operatore, numero: 1, (spritz, 1m));

        var errore = await Assert.ThrowsAsync<ExecutionError>(() => ScenarioOrdini.Storno(db)
            .ExecuteAsync(ordine.OrdineId, "non serve più", amministratore.Id));

        errore.Message.Should().Contain("annullalo", "storna ciò che è incassato, annulla ciò che non lo è");

        db.ChangeTracker.Clear();
        (await db.Ordini.SingleAsync()).Stato.Should().Be(StatiOrdine.Aperto);
    }

    [Fact]
    public async Task StornoDiUnaChiusuraInContanteTracciato_AbbassaIlSecchioGiusto()
    {
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var db = TestDbContextFactory.CreateSqlite(connessione);
        MondoChiuso mondo = await SeminaOrdineChiusoAsync(db, MetodiPagamentoVendita.ContanteTracciato);

        await ScenarioOrdini.Storno(db)
            .ExecuteAsync(mondo.Ordine.OrdineId, "errore di battuta", mondo.Amministratore.Id);

        using var lettura = TestDbContextFactory.CreateSqlite(connessione);
        RegistroCassa registro = await lettura.RegistriCassa.SingleAsync();
        registro.IncassoContanteTracciato.Should().Be(0m);
        registro.IncassiElettronici.Should().Be(40.00m, "il secchio che non c'entra non si muove");
    }
}
