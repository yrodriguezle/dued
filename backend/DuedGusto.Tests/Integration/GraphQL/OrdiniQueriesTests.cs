using System.Text.Json;

using GraphQL;
using GraphQL.Server.Transports.AspNetCore.Errors;
using GraphQL.Types;

using duedgusto.Common;
using duedgusto.Models;
using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// La superficie GraphQL degli ordini, esercitata attraverso il motore vero: lo schema che espone
/// (e ciò che <b>non</b> espone più), l'autorizzazione, e le tre query di lettura.
///
/// <para>🔴 <b>Perché l'autorizzazione si prova eseguendo</b> e non ispezionando i metadati.
/// L'endpoint /graphql è montato con <c>AuthorizationRequired = false</c>: la protezione è
/// interamente per campo, quindi un campo che nascesse sotto un tipo senza <c>this.Authorize()</c>
/// sarebbe <b>pubblico per default</b> e la dimenticanza non avrebbe alcun sintomo. Le mutation
/// d'ordine muovono i secchi del registro: che siano coperte va <i>visto</i>, non dedotto dal fatto
/// che stanno sotto un tipo che dovrebbe essere autorizzato.</para>
///
/// <para>⚠️ <c>AutorizzazioneAnonimaTests</c> enumera i <b>rami root</b>, non i campi: nessuno dei
/// suoi casi cambia quando si aggiunge un campo sotto <c>vendite</c>. È il motivo per cui questi
/// casi esistono qui e non lì.</para>
/// </summary>
public class OrdiniQueriesTests : IDisposable
{
    private const int UtenteId = 1;

    private readonly AppDbContext _dbContext;
    private readonly GraphQLTestHost _host;

    public OrdiniQueriesTests()
    {
        _dbContext = TestDbContextFactory.Create();
        _host = new GraphQLTestHost(_dbContext);
    }

    public void Dispose()
    {
        _host.Dispose();
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    // ── Seed ─────────────────────────────────────────────────────────────────────────────────

    private RegistroCassa SeedRegistro(DateTime data)
    {
        var registro = new RegistroCassa { Data = data, UtenteId = UtenteId, Stato = "DRAFT" };
        _dbContext.RegistriCassa.Add(registro);
        _dbContext.SaveChanges();
        return registro;
    }

    private Prodotto SeedProdotto(string codice, decimal prezzo, decimal aliquota = 10m)
    {
        var prodotto = new Prodotto
        {
            Codice = codice,
            Nome = $"Prodotto {codice}",
            Prezzo = prezzo,
            AliquotaIva = aliquota,
            Attivo = true,
        };
        _dbContext.Prodotti.Add(prodotto);
        _dbContext.SaveChanges();
        return prodotto;
    }

    private Ordine SeedOrdine(RegistroCassa registro, int numero, string stato = StatiOrdine.Aperto)
    {
        var ordine = new Ordine
        {
            RegistroCassaId = registro.Id,
            Numero = numero,
            SuffissoSplit = string.Empty,
            Stato = stato,
            ApertoIl = registro.Data.AddHours(20),
            ApertoDa = UtenteId,
        };
        _dbContext.Ordini.Add(ordine);
        _dbContext.SaveChanges();
        return ordine;
    }

    private RigaOrdine SeedRiga(Ordine ordine, Prodotto prodotto, decimal quantita)
    {
        var riga = new RigaOrdine
        {
            OrdineId = ordine.OrdineId,
            ProdottoId = prodotto.ProdottoId,
            Quantita = quantita,
            PrezzoUnitario = prodotto.Prezzo,
            AliquotaIva = prodotto.AliquotaIva,
            PrezzoTotale = quantita * prodotto.Prezzo,
            DataOra = ordine.ApertoIl.AddMinutes(1),
        };
        _dbContext.RigheOrdine.Add(riga);
        _dbContext.SaveChanges();
        return riga;
    }

    private async Task<JsonElement> EseguiELeggiVendite(string query)
    {
        ExecutionResult result = await _host.EseguiAsync(query, GraphQLTestHost.Autenticato(UtenteId));

        result.Errors.Should().BeNullOrEmpty(
            $"la query deve riuscire, invece: {GraphQLTestHost.DescriviErrori(result)}");

        using JsonDocument documento = JsonDocument.Parse(_host.Serializza(result));
        return documento.RootElement.GetProperty("data").GetProperty("vendite").Clone();
    }

    // ── Lo schema: ciò che c'è e ciò che è stato ritirato ────────────────────────────────────

    /// <summary>
    /// 🔴 <c>creaVendita</c> è stata <b>rimossa</b>, non deprecata: finché quel campo risponde, i
    /// due regimi convivono — uno che muove i secchi al momento della riga e uno che li muove alla
    /// chiusura dell'ordine — cioè il difetto per cui questo change esiste, tenuto in vita da un
    /// commento. Senza questo test qualcuno la rimetterebbe per comodità e nulla lo segnalerebbe:
    /// una mutation in più non rompe niente, e il doppio incasso che permette non ha sintomi
    /// finché la quadratura del mese non torna.
    /// </summary>
    [Fact]
    public void CreaVendita_NonEsistePiuNelloSchema()
    {
        IObjectGraphType vendite = TipoDelRamo("vendite", mutation: true);

        vendite.Fields.Select(f => f.Name).Should().NotContain("creaVendita",
            "la creazione di una Vendita è interna a ChiudiOrdineOrchestrator: se questo campo "
            + "torna nello schema, torna anche il secondo percorso verso un delta non idempotente");
    }

    [Fact]
    public void LeMutationDOrdine_SonoTutteEsposteSottoIlRamoVendite()
    {
        IObjectGraphType vendite = TipoDelRamo("vendite", mutation: true);

        vendite.Fields.Select(f => f.Name).Should().Contain(
        [
            "apriOrdine", "aggiungiRigaOrdine", "aggiornaRigaOrdine", "rimuoviRigaOrdine",
            "chiudiOrdine", "annullaOrdine", "stornaOrdine",
        ]);

        // Le due legacy restano: sono l'unica strada per le righe di sviluppo nate prima degli
        // ordini, e rifiutano tutte le altre.
        vendite.Fields.Select(f => f.Name).Should().Contain(["aggiornaVendita", "eliminaVendita"]);
    }

    [Fact]
    public void LeQueryDOrdine_SonoEsposteSottoIlRamoVendite()
    {
        IObjectGraphType vendite = TipoDelRamo("vendite", mutation: false);

        vendite.Fields.Select(f => f.Name).Should().Contain(
            ["ordine", "ordiniDelRegistro", "ordiniAperti"]);
    }

    /// <summary>
    /// L'argomento di <c>ordiniAperti</c> deve restare <b>opzionale</b>: renderlo obbligatorio
    /// costringerebbe ogni chiamante a scegliere un registro, e il chiamante naturale sceglierebbe
    /// quello di oggi — cioè la trappola della mezzanotte reintrodotta dal contratto invece che
    /// dal codice.
    /// </summary>
    [Fact]
    public void OrdiniAperti_HaIlRegistroOpzionale()
    {
        IObjectGraphType vendite = TipoDelRamo("vendite", mutation: false);
        QueryArgument argomento = vendite.Fields
            .First(f => f.Name == "ordiniAperti").Arguments!
            .First(a => a.Name == "registroCassaId");

        argomento.ResolvedType.Should().NotBeOfType<NonNullGraphType>(
            "omettere il registro deve restare possibile: è così che un ordine di ieri resta visibile");
    }

    /// <summary>
    /// 🔴 La divisione per importo non deve essere <b>esprimibile</b>: un limite che il contratto
    /// non permette di scrivere non ha bisogno di essere controllato a runtime, e non può essere
    /// aggirato. Se domani comparisse un campo importo su un taglio, questo test cade.
    /// </summary>
    [Fact]
    public void TaglioOrdineInput_NonHaUnCampoImporto()
    {
        var taglio = (IInputObjectGraphType)_host.Schema.AllTypes["TaglioOrdineInput"]!;

        taglio.Fields.Select(f => f.Name).Should().BeEquivalentTo(
            "metodoPagamento", "righeOrdineId", "contanteRicevuto");
    }

    /// <remarks>
    /// L'inizializzazione è obbligatoria: prima di essa i campi esistono ma il loro
    /// <c>ResolvedType</c> è ancora null, e ogni asserzione su ciò che il ramo espone
    /// fallirebbe con una NullReferenceException invece che con un verdetto.
    /// </remarks>
    private IObjectGraphType TipoDelRamo(string ramo, bool mutation)
    {
        _host.Schema.Initialize();
        IObjectGraphType radice = mutation ? _host.Schema.Mutation! : _host.Schema.Query!;
        return (IObjectGraphType)radice.Fields.First(f => f.Name == ramo).ResolvedType!;
    }

    // ── Autorizzazione: eseguita, non dedotta ────────────────────────────────────────────────

    public static TheoryData<string, string> CampiDOrdine() => new()
    {
        { "mutation", "apriOrdine(registroCassaId: 1) { ordineId }" },
        { "mutation", "aggiungiRigaOrdine(ordineId: 1, prodottoId: 1, quantita: 1) { rigaOrdineId }" },
        { "mutation", "aggiornaRigaOrdine(rigaOrdineId: 1, quantita: 2) { rigaOrdineId }" },
        { "mutation", "rimuoviRigaOrdine(rigaOrdineId: 1)" },
        { "mutation", "chiudiOrdine(input: { ordineId: 1, tagli: [{ metodoPagamento: \"CONTANTE_TRACCIATO\", righeOrdineId: [1] }] }) { restoDaRendere }" },
        { "mutation", "annullaOrdine(ordineId: 1, motivo: \"x\") { ordineId }" },
        { "mutation", "stornaOrdine(ordineId: 1, motivo: \"x\") { ordineId }" },
        { "query", "ordine(id: 1) { ordineId }" },
        { "query", "ordiniDelRegistro(registroCassaId: 1) { ordineId }" },
        { "query", "ordiniAperti { ordineId }" },
    };

    [Theory]
    [MemberData(nameof(CampiDOrdine))]
    public async Task OgniCampoDOrdine_InAnonimo_NegaAccesso(string operazione, string campo)
    {
        ExecutionResult result = await _host.EseguiAsync(
            $"{operazione} {{ vendite {{ {campo} }} }}", GraphQLTestHost.Anonimo());

        result.Errors.Should().NotBeNullOrEmpty(
            $"'{campo}' risponde in anonimo: manca this.Authorize() sul tipo che lo espone");

        result.Errors!.Any(errore => errore is AccessDeniedError).Should().BeTrue(
            $"'{campo}' fallisce in anonimo ma non per autorizzazione — errori: "
            + GraphQLTestHost.DescriviErrori(result));
    }

    // ── Lettura ──────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Ordine_RestituisceRigheTotaleCorrenteEIdentificativo()
    {
        RegistroCassa registro = SeedRegistro(new DateTime(2026, 8, 28));
        Prodotto caffe = SeedProdotto("CAF", 1.20m);
        Prodotto spritz = SeedProdotto("SPR", 3.50m);
        Ordine ordine = SeedOrdine(registro, numero: 17);
        SeedRiga(ordine, caffe, 2);
        SeedRiga(ordine, spritz, 1);

        JsonElement vendite = await EseguiELeggiVendite($$"""
            query {
              vendite {
                ordine(id: {{ordine.OrdineId}}) {
                  ordineId numero suffissoSplit stato identificativo
                  totaleOrdine totaleCorrente
                  righe { prezzoTotale prodotto { codice } }
                }
              }
            }
            """);

        JsonElement letto = vendite.GetProperty("ordine");
        letto.GetProperty("stato").GetString().Should().Be(StatiOrdine.Aperto);

        // "" e non null: la colonna è NOT NULL, ed è la stringa vuota a far reggere l'indice unico
        // sulla terna (RegistroCassaId, Numero, SuffissoSplit) per gli ordini non splittati.
        letto.GetProperty("suffissoSplit").GetString().Should().BeEmpty();

        letto.GetProperty("identificativo").GetString().Should().Be("260828-017");

        // Lo snapshot si scrive alla chiusura: su un ordine aperto vale 0, e il totale da mostrare
        // è quello derivato dalle righe.
        letto.GetProperty("totaleOrdine").GetDecimal().Should().Be(0m);
        letto.GetProperty("totaleCorrente").GetDecimal().Should().Be(5.90m);

        letto.GetProperty("righe").EnumerateArray()
            .Select(r => r.GetProperty("prodotto").GetProperty("codice").GetString())
            .Should().BeEquivalentTo("CAF", "SPR");
    }

    [Fact]
    public async Task OrdiniDelRegistro_FiltraPerStato()
    {
        RegistroCassa registro = SeedRegistro(new DateTime(2026, 8, 28));
        SeedOrdine(registro, numero: 1, stato: StatiOrdine.Chiuso);
        SeedOrdine(registro, numero: 2, stato: StatiOrdine.Aperto);
        SeedOrdine(registro, numero: 3, stato: StatiOrdine.Annullato);

        JsonElement vendite = await EseguiELeggiVendite($$"""
            query {
              vendite {
                ordiniDelRegistro(registroCassaId: {{registro.Id}}, stati: ["APERTO", "ANNULLATO"]) {
                  numero stato
                }
              }
            }
            """);

        vendite.GetProperty("ordiniDelRegistro").EnumerateArray()
            .Select(o => o.GetProperty("numero").GetInt32())
            .Should().BeEquivalentTo([2, 3]);
    }

    /// <summary>
    /// Uno stato scritto male darebbe una lista vuota, che si legge come «non ci sono ordini»
    /// invece che «hai sbagliato il filtro»: il vuoto è una risposta legittima, e nessuno la mette
    /// in dubbio.
    /// </summary>
    [Fact]
    public async Task OrdiniDelRegistro_StatoInesistente_RifiutatoConMessaggioParlante()
    {
        RegistroCassa registro = SeedRegistro(new DateTime(2026, 8, 28));

        ExecutionResult result = await _host.EseguiAsync($$"""
            query { vendite { ordiniDelRegistro(registroCassaId: {{registro.Id}}, stati: ["BOZZA"]) { numero } } }
            """, GraphQLTestHost.Autenticato(UtenteId));

        GraphQLTestHost.DescriviErrori(result).Should().Contain("BOZZA").And.Contain("APERTO");
    }

    /// <summary>
    /// 🔴 <b>La trappola della mezzanotte.</b> Un ordine aperto alle 23:50 appartiene al registro
    /// di <b>ieri</b> — decisione della issue: finché la cassa non si chiude, tutto resta nel
    /// giorno di apertura. Se <c>ordiniAperti</c> filtrasse su oggi, alle 00:05 quell'ordine
    /// sparirebbe: invisibile, non chiudibile, e la guardia della chiusura di cassa bloccherebbe
    /// il registro di ieri mostrando un elenco <b>vuoto</b> — il modo peggiore di bloccare, perché
    /// non mostra la propria causa.
    /// </summary>
    [Fact]
    public async Task OrdiniAperti_SenzaRegistro_ComprendeGliOrdiniDeiGiorniPrecedenti()
    {
        RegistroCassa ieri = SeedRegistro(new DateTime(2026, 8, 27));
        RegistroCassa oggi = SeedRegistro(new DateTime(2026, 8, 28));
        SeedOrdine(ieri, numero: 9);
        SeedOrdine(oggi, numero: 1);
        SeedOrdine(oggi, numero: 2, stato: StatiOrdine.Chiuso);

        JsonElement vendite = await EseguiELeggiVendite("""
            query { vendite { ordiniAperti { numero dataRegistro registroCassaId } } }
            """);

        JsonElement[] aperti = [.. vendite.GetProperty("ordiniAperti").EnumerateArray()];

        aperti.Select(o => o.GetProperty("numero").GetInt32()).Should().BeEquivalentTo([9, 1],
            "l'ordine di ieri non è ancora stato incassato: deve restare nell'elenco");

        // La data del registro viaggia su ogni riga: è ciò che permette all'operatore di vedere
        // che quell'ordine è di ieri, invece di cercarlo fra quelli di oggi.
        aperti.First().GetProperty("dataRegistro").GetDateTime().Date
            .Should().Be(new DateTime(2026, 8, 27));
    }

    // ── Le due mutation legacy, chiuse strutturalmente ───────────────────────────────────────

    /// <summary>
    /// 🔴 <c>aggiornaVendita</c> e <c>eliminaVendita</c> restano nello schema per le sole righe di
    /// sviluppo nate prima degli ordini, e rifiutano tutte le altre. Non è disciplina: poiché ogni
    /// nuova <c>Vendita</c> nasce con un <c>OrdineId</c>, la guardia le chiude per <b>tutti</b> i
    /// dati futuri. Correggere qui una riga nata da un ordine muoverebbe i secchi una seconda
    /// volta — <c>ApplicaDelta</c> non è idempotente — lasciando l'ordine a raccontare un incasso
    /// che non corrisponde più a nulla.
    /// </summary>
    [Theory]
    [InlineData("aggiornaVendita(id: @id, input: { quantita: 5 }) { venditaId }")]
    [InlineData("eliminaVendita(id: @id)")]
    public async Task VenditaNataDaUnOrdine_NonSiCorreggeRigaPerRiga(string campo)
    {
        RegistroCassa registro = SeedRegistro(new DateTime(2026, 8, 28));
        Prodotto caffe = SeedProdotto("CAF", 1.20m);
        Ordine ordine = SeedOrdine(registro, numero: 4, stato: StatiOrdine.Chiuso);

        var vendita = new Vendita
        {
            RegistroCassaId = registro.Id,
            ProdottoId = caffe.ProdottoId,
            Quantita = 1,
            PrezzoUnitario = caffe.Prezzo,
            PrezzoTotale = caffe.Prezzo,
            AliquotaIva = caffe.AliquotaIva,
            DataOra = DateTime.UtcNow,
            MetodoPagamento = MetodiPagamentoVendita.ContanteTracciato,
            OrdineId = ordine.OrdineId,
        };
        _dbContext.Vendite.Add(vendita);
        _dbContext.SaveChanges();

        ExecutionResult result = await _host.EseguiAsync(
            $"mutation {{ vendite {{ {campo.Replace("@id", vendita.VenditaId.ToString())} }} }}",
            GraphQLTestHost.Autenticato(UtenteId));

        // Il messaggio deve indicare la via d'uscita, non solo rifiutare: chi legge «non si può»
        // e basta cerca un altro modo di farlo a mano.
        GraphQLTestHost.DescriviErrori(result).Should().Contain("stornaOrdine");
    }

    [Fact]
    public async Task OrdiniAperti_ConRegistro_SiLimitaAQuelRegistro()
    {
        RegistroCassa ieri = SeedRegistro(new DateTime(2026, 8, 27));
        RegistroCassa oggi = SeedRegistro(new DateTime(2026, 8, 28));
        SeedOrdine(ieri, numero: 9);
        SeedOrdine(oggi, numero: 1);

        JsonElement vendite = await EseguiELeggiVendite($$"""
            query { vendite { ordiniAperti(registroCassaId: {{oggi.Id}}) { numero } } }
            """);

        vendite.GetProperty("ordiniAperti").EnumerateArray()
            .Select(o => o.GetProperty("numero").GetInt32())
            .Should().BeEquivalentTo([1]);
    }
}
