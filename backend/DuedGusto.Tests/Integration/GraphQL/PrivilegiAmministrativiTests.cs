using GraphQL;
using GraphQL.Server.Transports.AspNetCore.Errors;

using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Essere autenticati non basta per il ramo <c>authentication</c>: ruoli, menu e anagrafica
/// utenti sono privilegio amministrativo.
///
/// L'eccezione è <c>mutateUtente</c>, che è anche il canale con cui ProfilePage salva il
/// proprio profilo (nome, password, preferenzaDragModale). Serve quindi una regola più fine
/// di "solo amministratori": chi non lo è può modificare solo se stesso, e non può toccare
/// ruolo o abilitazione — altrimenti si auto-promuoverebbe.
/// </summary>
public class PrivilegiAmministrativiTests : IDisposable
{
    private const int RuoloAdminId = 1;
    private const int RuoloOperatoreId = 2;
    private const int UtenteAdminId = 10;
    private const int UtenteOperatoreId = 20;
    private const int AltroOperatoreId = 21;

    private readonly AppDbContext _dbContext;
    private readonly GraphQLTestHost _host;

    public PrivilegiAmministrativiTests()
    {
        _dbContext = TestDbContextFactory.CreateWithSeed(db =>
        {
            db.Ruoli.AddRange(
                new Ruolo { Id = RuoloAdminId, Nome = "Amministratore", Amministratore = true },
                new Ruolo { Id = RuoloOperatoreId, Nome = "Operatore", Amministratore = false });

            db.Utenti.AddRange(
                CreaUtente(UtenteAdminId, "admin", RuoloAdminId),
                CreaUtente(UtenteOperatoreId, "operatore", RuoloOperatoreId),
                CreaUtente(AltroOperatoreId, "altro", RuoloOperatoreId));
        });

        _host = new GraphQLTestHost(_dbContext);
    }

    private static Utente CreaUtente(int id, string nomeUtente, int ruoloId)
    {
        Utente utente = JwtTestHelper.CreateTestUtente(id, nomeUtente);
        utente.RuoloId = ruoloId;
        return utente;
    }

    public void Dispose()
    {
        _host.Dispose();
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    private static string MutateUtente(int id, string nomeUtente, int ruoloId, string? password = null) =>
        $$"""
        mutation {
          authentication {
            mutateUtente(utente: {
              id: {{id}}, nomeUtente: "{{nomeUtente}}", nome: "N", cognome: "C",
              ruoloId: {{ruoloId}}, disabilitato: false
              {{(password is null ? "" : $", password: \"{password}\"")}}
            }) { id }
          }
        }
        """;

    /// <summary>
    /// Non basta che ci siano errori: alcuni resolver fallirebbero comunque per altri motivi
    /// (deleteMenus su id inesistenti risponde "Nessun menu trovato"), e il test passerebbe
    /// anche a guard rimosso. Va verificato che il rifiuto sia proprio quello sui privilegi.
    /// </summary>
    private static void AssertRifiutata(ExecutionResult result, string perche)
    {
        result.Errors.Should().NotBeNullOrEmpty(perche + " — invece l'operazione è riuscita");

        result.Errors!.Any(e => e.Message.Contains("amministrator", StringComparison.OrdinalIgnoreCase))
            .Should().BeTrue(
                perche + " — è stata rifiutata, ma non per mancanza di privilegi: "
                + GraphQLTestHost.DescriviErrori(result));
    }

    private static void AssertRiuscita(ExecutionResult result, string perche)
    {
        result.Errors.Should().BeNullOrEmpty(
            perche + " — invece è stata rifiutata: " + GraphQLTestHost.DescriviErrori(result));
    }

    // ---- mutateUtente: il caso con la regola fine ----

    [Fact]
    public async Task Operatore_ModificaIlProprioProfilo_Riesce()
    {
        // È il percorso di ProfilePage: invia il proprio ruoloId e disabilitato correnti.
        ExecutionResult result = await _host.EseguiAsync(
            MutateUtente(UtenteOperatoreId, "operatore", RuoloOperatoreId, "nuovaPassword"),
            GraphQLTestHost.Autenticato(UtenteOperatoreId));

        AssertRiuscita(result, "un utente deve poter aggiornare il proprio profilo e la propria password");
    }

    [Fact]
    public async Task Operatore_ModificaUnAltroUtente_Rifiutata()
    {
        ExecutionResult result = await _host.EseguiAsync(
            MutateUtente(AltroOperatoreId, "altro", RuoloOperatoreId, "pwned"),
            GraphQLTestHost.Autenticato(UtenteOperatoreId));

        AssertRifiutata(result, "un non amministratore non deve poter cambiare la password di un altro utente");
    }

    [Fact]
    public async Task Operatore_SiAutoPromuoveAdAmministratore_Rifiutata()
    {
        ExecutionResult result = await _host.EseguiAsync(
            MutateUtente(UtenteOperatoreId, "operatore", RuoloAdminId),
            GraphQLTestHost.Autenticato(UtenteOperatoreId));

        AssertRifiutata(result, "un non amministratore non deve poter cambiare il proprio ruolo");
    }

    [Fact]
    public async Task Amministratore_ModificaUnAltroUtente_Riesce()
    {
        ExecutionResult result = await _host.EseguiAsync(
            MutateUtente(UtenteOperatoreId, "operatore", RuoloOperatoreId, "resetDaAdmin"),
            GraphQLTestHost.Autenticato(UtenteAdminId));

        AssertRiuscita(result, "un amministratore deve poter gestire l'anagrafica utenti");
    }

    // ---- ruoli e menu: privilegio amministrativo puro ----

    [Fact]
    public async Task Operatore_ModificaUnRuolo_Rifiutata()
    {
        ExecutionResult result = await _host.EseguiAsync(
            $$"""
            mutation {
              authentication {
                mutateRuolo(
                  ruolo: { id: {{RuoloOperatoreId}}, nome: "Operatore", amministratore: true },
                  menuIds: []
                ) { id }
              }
            }
            """,
            GraphQLTestHost.Autenticato(UtenteOperatoreId));

        AssertRifiutata(result, "un non amministratore non deve poter alzare i privilegi del proprio ruolo");
    }

    [Fact]
    public async Task Operatore_EliminaMenu_Rifiutata()
    {
        ExecutionResult result = await _host.EseguiAsync(
            "mutation { authentication { deleteMenus(ids: [1]) } }",
            GraphQLTestHost.Autenticato(UtenteOperatoreId));

        AssertRifiutata(result, "un non amministratore non deve poter modificare la navigazione");
    }

    // ---- Ramo vetrina: scritture E lettura dei media ----

    [Fact]
    public async Task Operatore_MutateProdottoVetrina_Rifiutata()
    {
        ExecutionResult result = await _host.EseguiAsync(
            """
            mutation {
              vetrina {
                mutateProdottoVetrina(prodottoId: 1, input: {
                  visibileSulSito: true, ordinamentoVetrina: 0, novita: false, consigliato: false
                }) { prodottoId }
              }
            }
            """,
            GraphQLTestHost.Autenticato(UtenteOperatoreId));

        AssertRifiutata(result, "un non amministratore non deve poter modificare la vetrina");
    }

    [Fact]
    public async Task Operatore_MutateMediaAsset_Rifiutata()
    {
        ExecutionResult result = await _host.EseguiAsync(
            """
            mutation {
              vetrina {
                mutateMediaAsset(mediaAssetId: 1, input: {
                  cartella: "generale", ordinamento: 0, pubblicato: true
                }) { mediaAssetId }
              }
            }
            """,
            GraphQLTestHost.Autenticato(UtenteOperatoreId));

        AssertRifiutata(result, "un non amministratore non deve poter modificare i metadati dei media");
    }

    [Fact]
    public async Task Operatore_EliminaMediaAsset_Rifiutata()
    {
        ExecutionResult result = await _host.EseguiAsync(
            "mutation { vetrina { eliminaMediaAsset(mediaAssetId: 1) } }",
            GraphQLTestHost.Autenticato(UtenteOperatoreId));

        AssertRifiutata(result, "un non amministratore non deve poter eliminare un media");
    }

    /// <summary>
    /// 🔴 Il caso che il design §D12 non prevedeva: il guard sui media vale anche in
    /// <b>lettura</b>. La spec sicurezza è più stretta del design e vince — in questa fase non
    /// esiste alcun consumatore anonimo né non amministrativo dei media.
    ///
    /// Attenzione al modo in cui si asserisce: una lista vuota NON è un rifiuto. Se questo
    /// test si accontentasse di "nessun risultato", passerebbe anche a guard rimosso su un
    /// database senza media — cioè esattamente nella condizione in cui gira la CI.
    /// </summary>
    [Fact]
    public async Task Operatore_LeggeConnectionMediaAssets_Rifiutata()
    {
        ExecutionResult result = await _host.EseguiAsync(
            "query { connection { mediaAssets(first: 10) { edges { node { mediaAssetId } } } } }",
            GraphQLTestHost.Autenticato(UtenteOperatoreId));

        AssertRifiutata(result, "un non amministratore non deve poter leggere la libreria media");
    }

    [Fact]
    public async Task Amministratore_LeggeConnectionMediaAssets_Riesce()
    {
        // Il complemento del test qui sopra: senza, un guard che rifiuta *chiunque*
        // passerebbe inosservato e la libreria non funzionerebbe per nessuno.
        ExecutionResult result = await _host.EseguiAsync(
            "query { connection { mediaAssets(first: 10) { edges { node { mediaAssetId } } } } }",
            GraphQLTestHost.Autenticato(UtenteAdminId));

        AssertRiuscita(result, "un amministratore deve poter leggere la libreria media");
    }

    // ---- Impostazioni della vetrina: scrittura E lettura ----

    private const string LeggiImpostazioniVetrina =
        "query { vetrina { impostazioni { insegnaPubblica turnstileSiteKey } } }";

    private static string ScriviImpostazioniVetrina(string insegna) =>
        $$"""
        mutation {
          vetrina {
            mutateImpostazioniVetrina(input: {
              insegnaPubblica: "{{insegna}}", via: "V", cap: "36016", citta: "Thiene",
              provincia: "VI", paese: "IT", oraInizioTemaSera: "18:00",
              prenotazioniAttive: false, prenotazioniPreavvisoOre: 2, prenotazioniCopertiMax: 20
            }) { impostazioniVetrinaId }
          }
        }
        """;

    /// <summary>
    /// 🔴 <b>Il caso che si dimentica: la LETTURA.</b> Se manca questo test, il guard sulla query
    /// può sparire senza che nulla diventi rosso — e con lui uscirebbe
    /// <c>turnstileSiteKey</c> insieme ai parametri delle prenotazioni, che la rotta pubblica non
    /// espone di proposito.
    ///
    /// <para>⚠️ Attenzione al modo in cui si asserisce: un risultato <c>null</c> <b>non</b> è un
    /// rifiuto. Se questo test si accontentasse di "nessun dato", passerebbe anche a guard
    /// rimosso su un database senza impostazioni — cioè esattamente la condizione in cui gira la
    /// CI. Si verifica quindi che l'errore sia proprio quello sui privilegi.</para>
    /// </summary>
    [Fact]
    public async Task Operatore_LeggeImpostazioniVetrina_Rifiutata()
    {
        ExecutionResult result = await _host.EseguiAsync(
            LeggiImpostazioniVetrina, GraphQLTestHost.Autenticato(UtenteOperatoreId));

        AssertRifiutata(result,
            "un non amministratore non deve poter leggere le impostazioni del sito: questo tipo "
            + "espone campi che la rotta pubblica non contiene");
    }

    [Fact]
    public async Task Operatore_ScriveImpostazioniVetrina_RifiutataESenzaEffetti()
    {
        ExecutionResult result = await _host.EseguiAsync(
            ScriviImpostazioniVetrina("Insegna di un operatore"),
            GraphQLTestHost.Autenticato(UtenteOperatoreId));

        AssertRifiutata(result, "un non amministratore non deve poter scrivere le impostazioni del sito");

        _dbContext.ImpostazioniVetrina.Should().BeEmpty(
            "il guard è la prima istruzione del resolver: il rifiuto non deve lasciare alcuna "
            + "riga creata, nemmeno vuota");
    }

    /// <summary>
    /// L'anonimo è fermato <b>prima</b> del resolver, dalla regola di autorizzazione dello
    /// schema: nessuna verifica di ruolo viene eseguita e nessuna scrittura parte. È il livello
    /// che <c>this.Authorize()</c> di tipo garantisce, e che il guard dentro il resolver
    /// <b>non</b> implica — sono due protezioni distinte, non due scritture della stessa.
    /// </summary>
    [Theory]
    [InlineData(LeggiImpostazioniVetrina)]
    [InlineData("mutation { vetrina { __typename } }")]
    public async Task Anonimo_SulRamoDelleImpostazioniVetrina_RifiutatoComeNonAutenticato(string operazione)
    {
        ExecutionResult result = await _host.EseguiAsync(operazione, GraphQLTestHost.Anonimo());

        result.Errors.Should().NotBeNullOrEmpty();
        result.Errors!.Any(e => e is AccessDeniedError).Should().BeTrue(
            "il rifiuto deve arrivare dall'autorizzazione dello schema, non da un errore "
            + "qualsiasi del resolver: " + GraphQLTestHost.DescriviErrori(result));

        _dbContext.ImpostazioniVetrina.Should().BeEmpty();
    }

    // ---- Le TRE scritture di pagina e la lettura dei ruoli immagine ----

    /// <summary>
    /// 🔴 <b>Il guard non si eredita: si scrive in ognuna delle quattro.</b>
    /// <c>this.Authorize()</c> di tipo ferma l'anonimo su tutto il ramo, ma non dice nulla
    /// sull'utente autenticato senza privilegi — quello lo ferma il guard dentro il resolver, e un
    /// resolver nuovo che se lo dimenticasse sarebbe <b>aperto a ogni operatore</b> senza che
    /// nulla diventi rosso. Enumerare le quattro mutation è ciò che rende quel guasto impossibile
    /// da introdurre in silenzio.
    ///
    /// <para>⚠️ Si verifica anche che il rifiuto <b>non crei la riga</b>: il guard è la prima
    /// istruzione, prima di <c>CaricaOCreaSingletonAsync</c>. Un guard messo dopo l'upsert
    /// rifiuterebbe comunque, ma lascerebbe dietro di sé una riga vuota creata da chi non aveva il
    /// diritto di crearla.</para>
    /// </summary>
    [Theory]
    [InlineData("mutatePaginaHome", "claimVetrina: \"Scritto da un operatore\"")]
    [InlineData("mutatePaginaLocale", "storiaTesto: \"Scritto da un operatore\"")]
    [InlineData("mutatePaginaAperitivo", "aperitivoTesto: \"Scritto da un operatore\"")]
    public async Task Operatore_ScriveUnaPaginaDelSito_RifiutataESenzaEffetti(
        string mutazione, string campo)
    {
        ExecutionResult result = await _host.EseguiAsync(
            $$"""
            mutation {
              vetrina {
                {{mutazione}}(input: { {{campo}} }) { impostazioniVetrinaId }
              }
            }
            """,
            GraphQLTestHost.Autenticato(UtenteOperatoreId));

        AssertRifiutata(result,
            $"un non amministratore non deve poter scrivere i contenuti del sito ({mutazione})");

        _dbContext.ImpostazioniVetrina.Should().BeEmpty(
            "il guard è la prima istruzione del resolver: il rifiuto non deve lasciare alcuna "
            + "riga creata, nemmeno vuota");
    }

    private const string LeggiRuoliImmagini =
        "query { vetrina { ruoliImmagini { eroeHome { mediaAssetId origine } fotoMenu { mediaAssetId } } } }";

    /// <summary>
    /// La lettura dei ruoli è una lettura della <b>libreria media</b> vista da un'altra angolazione:
    /// dice quali foto il sito sta usando e in che ruolo. La stessa regola che chiude
    /// <c>connection { mediaAssets }</c> agli operatori vale qui, e per la stessa ragione — con in
    /// più il campo <c>origine</c>, che non esce nemmeno in pubblico.
    ///
    /// <para>⚠️ Attenzione al modo in cui si asserisce: una risposta con i ruoli vuoti <b>non</b> è
    /// un rifiuto. Su un database senza media — cioè esattamente la condizione della CI — un test
    /// che si accontentasse di «nessuna immagine» passerebbe anche a guard rimosso.</para>
    /// </summary>
    [Fact]
    public async Task Operatore_LeggeRuoliImmagini_Rifiutata()
    {
        ExecutionResult result = await _host.EseguiAsync(
            LeggiRuoliImmagini, GraphQLTestHost.Autenticato(UtenteOperatoreId));

        AssertRifiutata(result,
            "un non amministratore non deve poter leggere quali immagini il sito sta usando");
    }

    [Fact]
    public async Task Amministratore_LeggeRuoliImmagini_Riesce()
    {
        // Il complemento indispensabile: senza, un guard che rifiuta *chiunque* passerebbe
        // inosservato e le schede non funzionerebbero per nessuno.
        AssertRiuscita(
            await _host.EseguiAsync(LeggiRuoliImmagini, GraphQLTestHost.Autenticato(UtenteAdminId)),
            "un amministratore deve poter leggere i ruoli delle immagini");
    }

    [Theory]
    [InlineData("mutatePaginaHome", "claimVetrina: \"Espresso alle sette\"")]
    [InlineData("mutatePaginaLocale", "storiaTesto: \"Due mani italiane\"")]
    [InlineData("mutatePaginaAperitivo", "aperitivoTesto: \"Dalle 18 alle 21\"")]
    public async Task Amministratore_ScriveUnaPaginaDelSito_Riesce(string mutazione, string campo)
    {
        AssertRiuscita(
            await _host.EseguiAsync(
                $$"""
                mutation {
                  vetrina {
                    {{mutazione}}(input: { {{campo}} }) { impostazioniVetrinaId }
                  }
                }
                """,
                GraphQLTestHost.Autenticato(UtenteAdminId)),
            $"un amministratore deve poter scrivere i contenuti del sito ({mutazione})");

        _dbContext.ImpostazioniVetrina.Should().ContainSingle();
    }

    [Fact]
    public async Task Amministratore_LeggeEScriveImpostazioniVetrina_Riesce()
    {
        // Il complemento indispensabile: senza, un guard che rifiuta *chiunque* passerebbe
        // inosservato e la pagina non funzionerebbe per nessuno.
        AssertRiuscita(
            await _host.EseguiAsync(LeggiImpostazioniVetrina, GraphQLTestHost.Autenticato(UtenteAdminId)),
            "un amministratore deve poter leggere le impostazioni del sito");

        AssertRiuscita(
            await _host.EseguiAsync(
                ScriviImpostazioniVetrina("2D Gusto Bar"), GraphQLTestHost.Autenticato(UtenteAdminId)),
            "un amministratore deve poter salvare le impostazioni del sito");

        _dbContext.ImpostazioniVetrina.Should().ContainSingle()
            .Which.InsegnaPubblica.Should().Be("2D Gusto Bar");
    }
}
