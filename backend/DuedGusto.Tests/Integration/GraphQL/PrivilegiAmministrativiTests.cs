using GraphQL;

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
}
