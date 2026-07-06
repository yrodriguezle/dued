using System.Reflection;

using DuedGusto.Tests.Helpers;

using duedgusto.GraphQL.Authentication;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Tests per la preferenza per-utente <c>PreferenzaDragModale</c> ("free" | "elastic").
/// Come per gli altri integration test della cartella, i resolver GraphQL sono strettamente
/// accoppiati a <c>GraphQLService.GetService</c>: si testa quindi (a) la logica di whitelist+fallback
/// invocando il vero helper privato <c>AuthMutations.ParseDragMode</c> via reflection e (b) la
/// persistenza round-trip replicando i rami create/update di <c>mutateUtente</c> (ContainsKey) contro
/// il DbContext InMemory. Copre gli scenari degli specs: create con/senza preferenza, update con/senza
/// chiave, whitelist (valore fuori dominio / vuoto), lettura via utenteCorrente.
/// </summary>
public class UserPreferencesTests : IDisposable
{
    private readonly AppDbContext _dbContext;

    // Riferimento al vero helper privato AuthMutations.ParseDragMode(Dictionary<string, object>):
    // testa la logica di produzione (whitelist + fallback) invece di riscriverla nel test.
    private static readonly MethodInfo ParseDragModeMethod =
        typeof(AuthMutations).GetMethod("ParseDragMode", BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException("AuthMutations.ParseDragMode non trovato via reflection");

    private static string ParseDragMode(Dictionary<string, object> arg) =>
        (string)ParseDragModeMethod.Invoke(null, new object[] { arg })!;

    public UserPreferencesTests()
    {
        _dbContext = TestDbContextFactory.Create();
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    #region Helpers

    private Ruolo SeedRuolo(string nome = "Amministratore")
    {
        var ruolo = new Ruolo { Nome = nome, Descrizione = $"Ruolo {nome}" };
        _dbContext.Ruoli.Add(ruolo);
        _dbContext.SaveChanges();
        return ruolo;
    }

    private Utente SeedUtente(string preferenza = "free", string username = "mario.rossi", Ruolo? ruolo = null)
    {
        ruolo ??= SeedRuolo();
        var utente = JwtTestHelper.CreateTestUtente(id: 0, username: username);
        utente.RuoloId = ruolo.Id;
        utente.PreferenzaDragModale = preferenza;
        _dbContext.Utenti.Add(utente);
        _dbContext.SaveChanges();
        return utente;
    }

    // Replica il ramo CREATE di AuthMutations.mutateUtente: usa ParseDragMode (valore fornito o default "free").
    private async Task<Utente> CreateUtenteFromArg(Dictionary<string, object> userArg, Ruolo ruolo)
    {
        var newUser = JwtTestHelper.CreateTestUtente(id: 0, username: userArg["nomeUtente"].ToString()!);
        newUser.RuoloId = ruolo.Id;
        newUser.PreferenzaDragModale = ParseDragMode(userArg);
        _dbContext.Utenti.Add(newUser);
        await _dbContext.SaveChangesAsync();
        return newUser;
    }

    // Replica il ramo UPDATE di AuthMutations.mutateUtente: applica la preferenza SOLO se la chiave è presente.
    private async Task UpdateUtenteFromArg(Utente existingUser, Dictionary<string, object> userArg)
    {
        if (userArg.ContainsKey("preferenzaDragModale"))
        {
            existingUser.PreferenzaDragModale = ParseDragMode(userArg);
        }
        await _dbContext.SaveChangesAsync();
    }

    #endregion

    #region Whitelist + fallback (ParseDragMode reale)

    [Fact]
    public void ParseDragMode_ValoreValido_RestituisceValore()
    {
        var arg = new Dictionary<string, object> { ["preferenzaDragModale"] = "elastic" };
        ParseDragMode(arg).Should().Be("elastic");
    }

    [Fact]
    public void ParseDragMode_ChiaveAssente_RestituisceDefaultFree()
    {
        var arg = new Dictionary<string, object> { ["nome"] = "Mario" };
        ParseDragMode(arg).Should().Be("free");
    }

    [Theory]
    [InlineData("spring")]   // fuori whitelist
    [InlineData("")]          // stringa vuota
    [InlineData("FREE")]      // casing diverso
    public void ParseDragMode_ValoreFuoriWhitelist_NormalizzaAFree(string valore)
    {
        var arg = new Dictionary<string, object> { ["preferenzaDragModale"] = valore };
        ParseDragMode(arg).Should().Be("free");
    }

    #endregion

    #region Create

    [Fact]
    public async Task Create_ConPreferenzaEsplicita_PersisteElastic()
    {
        // Arrange
        var ruolo = SeedRuolo();
        var userArg = new Dictionary<string, object>
        {
            ["nomeUtente"] = "nuovo.utente",
            ["preferenzaDragModale"] = "elastic",
        };

        // Act
        var created = await CreateUtenteFromArg(userArg, ruolo);

        // Assert
        var persisted = await _dbContext.Utenti.FindAsync(created.Id);
        persisted.Should().NotBeNull();
        persisted!.PreferenzaDragModale.Should().Be("elastic");
    }

    [Fact]
    public async Task Create_SenzaPreferenza_ApplicaDefaultFree()
    {
        // Arrange
        var ruolo = SeedRuolo();
        var userArg = new Dictionary<string, object>
        {
            ["nomeUtente"] = "nuovo.utente",
            // nessuna chiave preferenzaDragModale
        };

        // Act
        var created = await CreateUtenteFromArg(userArg, ruolo);

        // Assert
        var persisted = await _dbContext.Utenti.FindAsync(created.Id);
        persisted!.PreferenzaDragModale.Should().Be("free");
    }

    #endregion

    #region Update

    [Fact]
    public async Task Update_ConPreferenzaEsplicita_CambiaValore()
    {
        // Arrange — utente con "free"
        var utente = SeedUtente(preferenza: "free");
        var userArg = new Dictionary<string, object>
        {
            ["id"] = utente.Id,
            ["preferenzaDragModale"] = "elastic",
        };

        // Act
        await UpdateUtenteFromArg(utente, userArg);

        // Assert
        var persisted = await _dbContext.Utenti.FindAsync(utente.Id);
        persisted!.PreferenzaDragModale.Should().Be("elastic");
    }

    [Fact]
    public async Task Update_SenzaChiavePreferenza_NonAlteraValore()
    {
        // Arrange — utente con "elastic"
        var utente = SeedUtente(preferenza: "elastic");
        var userArg = new Dictionary<string, object>
        {
            ["id"] = utente.Id,
            ["nome"] = "NomeAggiornato", // update su altri campi, senza preferenzaDragModale
        };

        // Act
        await UpdateUtenteFromArg(utente, userArg);

        // Assert — il valore resta invariato
        var persisted = await _dbContext.Utenti.FindAsync(utente.Id);
        persisted!.PreferenzaDragModale.Should().Be("elastic");
    }

    [Fact]
    public async Task Update_ConValoreFuoriWhitelist_NormalizzaAFree()
    {
        // Arrange — utente con "elastic"
        var utente = SeedUtente(preferenza: "elastic");
        var userArg = new Dictionary<string, object>
        {
            ["id"] = utente.Id,
            ["preferenzaDragModale"] = "spring", // fuori whitelist
        };

        // Act
        await UpdateUtenteFromArg(utente, userArg);

        // Assert — il DB non contiene mai il valore grezzo fuori whitelist
        var persisted = await _dbContext.Utenti.FindAsync(utente.Id);
        persisted!.PreferenzaDragModale.Should().Be("free");
    }

    #endregion

    #region Lettura via utenteCorrente

    [Fact]
    public async Task UtenteCorrente_RestituiscePreferenzaPersistita()
    {
        // Arrange — utente seed con "elastic"
        var utente = SeedUtente(preferenza: "elastic", username: JwtTestHelper.E2eUsername);

        // Act — il resolver utenteCorrente restituisce l'utente per NomeUtente/Id
        var corrente = await _dbContext.Utenti.FirstOrDefaultAsync(u => u.Id == utente.Id);

        // Assert
        corrente.Should().NotBeNull();
        corrente!.PreferenzaDragModale.Should().Be("elastic");
    }

    [Fact]
    public async Task RoundTrip_SalvataggioERilettura_ElasticPersistito()
    {
        // Arrange — utente con "free"
        var ruolo = SeedRuolo();
        var utente = SeedUtente(preferenza: "free", username: "round.trip", ruolo: ruolo);

        // Act — update a "elastic" e rilettura
        var userArg = new Dictionary<string, object>
        {
            ["id"] = utente.Id,
            ["preferenzaDragModale"] = "elastic",
        };
        await UpdateUtenteFromArg(utente, userArg);

        // Assert
        var riletto = await _dbContext.Utenti.FirstAsync(u => u.Id == utente.Id);
        riletto.PreferenzaDragModale.Should().Be("elastic");
    }

    #endregion
}
