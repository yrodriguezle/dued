using DuedGusto.Tests.Helpers;

using GraphQL;

using duedgusto.Common;
using duedgusto.GraphQL.Vendite.Types;

namespace DuedGusto.Tests.Integration;

/// <summary>
/// «Il mio spritz lo pago io, il tuo lo paghi tu»: lo split alla chiusura.
///
/// <para>Tutto su <b>Sqlite</b>, e non per abitudine: metà di questi test riguarda ciò che
/// <b>non</b> deve restare a terra quando l'operazione fallisce, e su InMemory il rollback non
/// annulla nulla — un test di atomicità scritto lì sarebbe verde qualunque cosa faccia il codice.
/// L'altra metà riguarda l'indice unico sulla terna
/// <c>(RegistroCassaId, Numero, SuffissoSplit)</c>, che InMemory non applica.</para>
///
/// <para>Il vincolo che regge tutto è la <b>partizione esatta</b>: ogni voce dell'ordine in
/// esattamente una parte. Una voce dimenticata sparirebbe dall'incasso senza che nulla lo segnali,
/// perché la somma dei figli tornerebbe con sé stessa.</para>
/// </summary>
public class OrdiniSplitTests
{
    private sealed record Mondo(
        AppDbContext Db, Utente Utente, RegistroCassa Registro, Ordine Ordine, List<RigaOrdine> Righe);

    /// <summary>
    /// Quattro voci per 30,00 €: due spritz da 8,00 e due caffè da 7,00. È l'ordine dello scenario
    /// della spec, e le due coppie sono già i due tagli naturali.
    /// </summary>
    private static Mondo SeminaOrdineDaTrenta(AppDbContext db, bool conImpostazioni = true)
    {
        if (conImpostazioni)
        {
            ScenarioOrdini.SeminaImpostazioni(db);
        }

        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, utente);
        Prodotto spritz = ScenarioOrdini.SeminaProdotto(db, "BIB-SPRITZ", 8.00m);
        Prodotto caffe = ScenarioOrdini.SeminaProdotto(db, "BIB-CAFFE", 7.00m);

        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(
            db, registro, utente, numero: 17,
            (spritz, 1m), (spritz, 1m), (caffe, 1m), (caffe, 1m));

        db.Entry(ordine).Collection(o => o.Righe).Load();
        List<RigaOrdine> righe = ordine.Righe.OrderBy(r => r.RigaOrdineId).ToList();
        return new Mondo(db, utente, registro, ordine, righe);
    }

    private static ChiudiOrdineInput DueTagli(Mondo mondo)
        => new()
        {
            OrdineId = mondo.Ordine.OrdineId,
            Tagli =
            [
                new TaglioOrdineInput
                {
                    MetodoPagamento = MetodiPagamentoVendita.ContanteTracciato,
                    RigheOrdineId = [mondo.Righe[0].RigaOrdineId, mondo.Righe[1].RigaOrdineId],
                },
                new TaglioOrdineInput
                {
                    MetodoPagamento = MetodiPagamentoVendita.Elettronico,
                    RigheOrdineId = [mondo.Righe[2].RigaOrdineId, mondo.Righe[3].RigaOrdineId],
                },
            ],
        };

    // ── Lo split che riesce ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task SplitInDue_DueFigliChiusi_ISecchiSiMuovonoUnaVoltaCiascuno()
    {
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var db = TestDbContextFactory.CreateSqlite(connessione);
        Mondo mondo = SeminaOrdineDaTrenta(db);

        EsitoChiusuraOrdine esito = await ScenarioOrdini.Chiusura(db)
            .ExecuteAsync(DueTagli(mondo), mondo.Utente.Id);

        esito.Ordine.Stato.Should().Be(StatiOrdine.Splittato);
        esito.Ordine.MetodoPagamento.Should().BeNull(
            "il padre non ha incassato con alcun metodo: sarebbe una riga che mente in ogni elenco");
        esito.Ordine.TotaleOrdine.Should().Be(30.00m);
        esito.OrdiniGenerati.Should().HaveCount(2);

        using var lettura = TestDbContextFactory.CreateSqlite(connessione);

        List<Ordine> figli = await lettura.Ordini
            .Where(o => o.OrdinePadreId == mondo.Ordine.OrdineId)
            .OrderBy(o => o.SuffissoSplit)
            .ToListAsync();

        figli.Should().HaveCount(2);
        figli.Should().OnlyContain(f => f.Stato == StatiOrdine.Chiuso);
        figli.Select(f => f.SuffissoSplit).Should().Equal("A", "B");
        figli.Should().OnlyContain(f => f.Numero == 17, "i figli ereditano il numero, non ne consumano uno nuovo");
        figli.Sum(f => f.TotaleOrdine).Should().Be(30.00m);
        figli[0].TotaleOrdine.Should().Be(16.00m);
        figli[1].TotaleOrdine.Should().Be(14.00m);

        RegistroCassa registro = await lettura.RegistriCassa.SingleAsync();
        registro.IncassoContanteTracciato.Should().Be(16.00m);
        registro.IncassiElettronici.Should().Be(14.00m);
        registro.VenditeContanti.Should().Be(30.00m, "il breakdown vede tutte e quattro le vendite");

        (await lettura.Ordini.CountAsync(o => o.Stato == StatiOrdine.Aperto))
            .Should().Be(0, "nessun ordine resta aperto da questa operazione");
    }

    [Fact]
    public async Task SplitInDue_LeRigheVengonoRiassegnateAiFigli_NonDuplicate()
    {
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var db = TestDbContextFactory.CreateSqlite(connessione);
        Mondo mondo = SeminaOrdineDaTrenta(db);

        await ScenarioOrdini.Chiusura(db).ExecuteAsync(DueTagli(mondo), mondo.Utente.Id);

        using var lettura = TestDbContextFactory.CreateSqlite(connessione);

        (await lettura.RigheOrdine.CountAsync()).Should().Be(4, "riassegnate, non duplicate");
        (await lettura.RigheOrdine.CountAsync(r => r.OrdineId == mondo.Ordine.OrdineId))
            .Should().Be(0, "il padre si rilegge attraverso i figli");

        List<Vendita> vendite = await lettura.Vendite.ToListAsync();
        vendite.Should().HaveCount(4);
        vendite.Count(v => v.MetodoPagamento == MetodiPagamentoVendita.ContanteTracciato).Should().Be(2);
        vendite.Count(v => v.MetodoPagamento == MetodiPagamentoVendita.Elettronico).Should().Be(2);
        vendite.Should().OnlyContain(v => v.OrdineId != mondo.Ordine.OrdineId,
            "ogni vendita appartiene al figlio che l'ha incassata, non al padre");
    }

    [Fact]
    public async Task SplitInUnaSolaParte_IndistinguibileDaUnaChiusuraSemplice()
    {
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var db = TestDbContextFactory.CreateSqlite(connessione);
        Mondo mondo = SeminaOrdineDaTrenta(db);

        EsitoChiusuraOrdine esito = await ScenarioOrdini.Chiusura(db).ExecuteAsync(
            new ChiudiOrdineInput
            {
                OrdineId = mondo.Ordine.OrdineId,
                Tagli =
                [
                    new TaglioOrdineInput
                    {
                        MetodoPagamento = MetodiPagamentoVendita.Elettronico,
                        RigheOrdineId = mondo.Righe.Select(r => r.RigaOrdineId).ToList(),
                    },
                ],
            },
            mondo.Utente.Id);

        esito.Ordine.Stato.Should().Be(StatiOrdine.Chiuso);
        esito.OrdiniGenerati.Should().BeEmpty();

        using var lettura = TestDbContextFactory.CreateSqlite(connessione);
        (await lettura.Ordini.CountAsync()).Should().Be(1, "nessun figlio per un taglio solo");
        (await lettura.RegistriCassa.SingleAsync()).IncassiElettronici.Should().Be(30.00m);
    }

    // ── Gli split che vengono rifiutati ──────────────────────────────────────────────────────────

    [Fact]
    public async Task VoceNonAssegnata_Rifiutata_ELOrdineRestaAperto()
    {
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var db = TestDbContextFactory.CreateSqlite(connessione);
        Mondo mondo = SeminaOrdineDaTrenta(db);

        ChiudiOrdineInput input = DueTagli(mondo);
        input.Tagli[1].RigheOrdineId.Remove(mondo.Righe[3].RigaOrdineId);

        var errore = await Assert.ThrowsAsync<ExecutionError>(
            () => ScenarioOrdini.Chiusura(db).ExecuteAsync(input, mondo.Utente.Id));

        errore.Message.Should().Contain($"riga {mondo.Righe[3].RigaOrdineId}",
            "il messaggio deve nominare la voce dimenticata, non dire genericamente che qualcosa manca");

        using var lettura = TestDbContextFactory.CreateSqlite(connessione);
        (await lettura.Ordini.SingleAsync()).Stato.Should().Be(StatiOrdine.Aperto);
        RegistroCassa registro = await lettura.RegistriCassa.SingleAsync();
        registro.IncassoContanteTracciato.Should().Be(0m);
        registro.IncassiElettronici.Should().Be(0m);
        (await lettura.Vendite.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task VoceAssegnataDueVolte_Rifiutata_EIlMessaggioSpiegaCheSiDivideraPerVoci()
    {
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var db = TestDbContextFactory.CreateSqlite(connessione);
        Mondo mondo = SeminaOrdineDaTrenta(db);

        ChiudiOrdineInput input = DueTagli(mondo);
        input.Tagli[1].RigheOrdineId.Add(mondo.Righe[0].RigaOrdineId);

        var errore = await Assert.ThrowsAsync<ExecutionError>(
            () => ScenarioOrdini.Chiusura(db).ExecuteAsync(input, mondo.Utente.Id));

        errore.Message.Should()
            .Contain($"riga {mondo.Righe[0].RigaOrdineId}").And
            .Contain("per voci");

        using var lettura = TestDbContextFactory.CreateSqlite(connessione);
        (await lettura.Ordini.SingleAsync()).Stato.Should().Be(StatiOrdine.Aperto);
        (await lettura.Vendite.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task DivisionePerImporto_NonEsprimibile_ERifiutataDicendoloEsplicitamente()
    {
        // La spec: un ordine con una sola voce da 30 € che si vorrebbe spaccare in 20 contanti e 10
        // con carta. Il contratto non ha un campo «importo» — la divisione per importo non è
        // nemmeno esprimibile — quindi il tentativo arriva al server come una parte senza voci. Il
        // rifiuto deve dire PERCHÉ, o alla cassa sembrerebbe un guasto.
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var db = TestDbContextFactory.CreateSqlite(connessione);

        ScenarioOrdini.SeminaImpostazioni(db);
        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, utente);
        Prodotto menu = ScenarioOrdini.SeminaProdotto(db, "CIB-MENU", 30.00m);
        Ordine ordine = ScenarioOrdini.SeminaOrdineAperto(db, registro, utente, numero: 1, (menu, 1m));
        db.Entry(ordine).Collection(o => o.Righe).Load();
        int rigaId = ordine.Righe.Single().RigaOrdineId;

        var errore = await Assert.ThrowsAsync<ExecutionError>(() => ScenarioOrdini.Chiusura(db)
            .ExecuteAsync(
                new ChiudiOrdineInput
                {
                    OrdineId = ordine.OrdineId,
                    Tagli =
                    [
                        new TaglioOrdineInput
                        {
                            MetodoPagamento = MetodiPagamentoVendita.ContanteTracciato,
                            RigheOrdineId = [rigaId],
                        },
                        new TaglioOrdineInput
                        {
                            MetodoPagamento = MetodiPagamentoVendita.Elettronico,
                            RigheOrdineId = [],
                        },
                    ],
                },
                utente.Id));

        errore.Message.Should().Contain("per voci, non per importo");

        using var lettura = TestDbContextFactory.CreateSqlite(connessione);
        (await lettura.Ordini.SingleAsync()).Stato.Should().Be(StatiOrdine.Aperto);
    }

    [Fact]
    public async Task VoceDiUnAltroOrdine_Rifiutata()
    {
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var db = TestDbContextFactory.CreateSqlite(connessione);
        Mondo mondo = SeminaOrdineDaTrenta(db);

        Prodotto altro = ScenarioOrdini.SeminaProdotto(db, "BIB-ALTRO", 3.00m);
        Ordine estraneo = ScenarioOrdini.SeminaOrdineAperto(
            db, mondo.Registro, mondo.Utente, numero: 18, (altro, 1m));
        db.Entry(estraneo).Collection(o => o.Righe).Load();

        ChiudiOrdineInput input = DueTagli(mondo);
        input.Tagli[0].RigheOrdineId.Add(estraneo.Righe.Single().RigaOrdineId);

        var errore = await Assert.ThrowsAsync<ExecutionError>(
            () => ScenarioOrdini.Chiusura(db).ExecuteAsync(input, mondo.Utente.Id));

        errore.Message.Should().Contain("non appartiene all'ordine");
    }

    // ── Atomicità ────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task SplitFallitoAMeta_NessunEffettoParziale()
    {
        // 🔴 IL TEST CHE GIUSTIFICA LA TRANSAZIONE ESPLICITA, e per questo il guasto è messo DOPO
        //    il primo salvataggio: a quel punto il padre è già SPLITTATO a database, i due figli
        //    esistono e le quattro vendite pure. Senza BusinessSettings il breakdown non trova
        //    l'aliquota e lancia — e ciò che resta a terra è la misura di quanto vale il rollback.
        //    Un guasto piazzato PRIMA del primo save non proverebbe nulla: lì basterebbe la
        //    transazione implicita di SaveChanges.
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var db = TestDbContextFactory.CreateSqlite(connessione);
        Mondo mondo = SeminaOrdineDaTrenta(db, conImpostazioni: false);

        await Assert.ThrowsAnyAsync<Exception>(
            () => ScenarioOrdini.Chiusura(db).ExecuteAsync(DueTagli(mondo), mondo.Utente.Id));

        using var lettura = TestDbContextFactory.CreateSqlite(connessione);

        (await lettura.Ordini.CountAsync()).Should().Be(1, "non esiste alcun figlio orfano");
        (await lettura.Ordini.SingleAsync()).Stato.Should().Be(StatiOrdine.Aperto,
            "l'ordine è ancora aperto, con tutte e quattro le voci");
        (await lettura.RigheOrdine.CountAsync(r => r.OrdineId == mondo.Ordine.OrdineId)).Should().Be(4);
        (await lettura.Vendite.CountAsync()).Should().Be(0);

        RegistroCassa registro = await lettura.RegistriCassa.SingleAsync();
        registro.IncassoContanteTracciato.Should().Be(0m, "nessun secchio è stato mosso");
        registro.IncassiElettronici.Should().Be(0m);
    }

    [Fact]
    public async Task LIndiceUnicoImpedisceDueFigliConLoStessoSuffisso()
    {
        // La terna (registro, numero, suffisso) è ciò che rende stampabile un ticket. Qui si
        // verifica sul caso dei figli — il padre occupa la stringa vuota, i figli "A" e "B" — che
        // l'indice sia davvero applicato dallo schema, e non solo dichiarato nel modello.
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var db = TestDbContextFactory.CreateSqlite(connessione);
        Mondo mondo = SeminaOrdineDaTrenta(db);

        await ScenarioOrdini.Chiusura(db).ExecuteAsync(DueTagli(mondo), mondo.Utente.Id);

        using var intruso = TestDbContextFactory.CreateSqlite(connessione);
        intruso.Ordini.Add(new Ordine
        {
            RegistroCassaId = mondo.Registro.Id,
            Numero = 17,
            SuffissoSplit = "A",
            Stato = StatiOrdine.Chiuso,
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => intruso.SaveChangesAsync());
    }
}
