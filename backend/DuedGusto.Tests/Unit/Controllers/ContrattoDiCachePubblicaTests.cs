using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;

using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;

using duedgusto.Controllers;
using duedgusto.Middleware;

namespace DuedGusto.Tests.Unit.Controllers;

/// <summary>
/// Il <b>contratto di trasporto</b> delle tre rotte pubbliche: durata di cache dichiarata,
/// policy CORS dedicata, assenza di qualunque cache lato server e assenza dal dizionario del
/// rate limiting.
///
/// <para>È un file distinto da <see cref="SuperficiePubblicaTests"/> perché difende una cosa
/// diversa: quello pinna <b>cosa</b> esce da una risposta pubblica, questo pinna <b>come</b>
/// viaggia. Le due proprietà si rompono per ragioni diverse e vanno lette separatamente.</para>
///
/// <para>🔴 <b>Ciò che questi test NON provano.</b> Un test riflessivo vede gli attributi, non i
/// middleware: non sa se l'header è stato davvero emesso, se l'ordine della pipeline ha
/// disattivato la policy CORS in silenzio, né se una risposta porta un <c>Set-Cookie</c>.
/// L'unica prova di quelle tre cose è <c>curl -skI</c> sul processo vivo — task 6.7 e 6.8 di
/// <c>tasks.md</c>. Questi test proteggono dalla <i>cancellazione per distrazione</i> di una
/// decisione già verificata a mano, che è un guasto diverso e altrettanto reale.</para>
/// </summary>
public class ContrattoDiCachePubblicaTests
{
    // ── (1) La durata dichiarata, rotta per rotta ────────────────────────────────────────

    /// <summary>
    /// 🔴 <b>Non si confronta una stringa letterale.</b> ASP.NET emette
    /// <c>Cache-Control: public,max-age=300</c> — <b>senza spazio</b> dopo la virgola — mentre la
    /// proposal scrive il criterio come <c>public, max-age=300</c>. È la stessa direttiva, e un
    /// criterio verificato per uguaglianza di stringa fallirebbe su una differenza che non
    /// esiste. Si legge quindi la <b>direttiva</b>: la durata come numero e la condivisibilità
    /// come <see cref="ResponseCacheLocation.Any"/>, che è ciò che diventa <c>public</c>.
    /// </summary>
    [Theory]
    [InlineData(nameof(PublicController.Menu), 60)]
    [InlineData(nameof(PublicController.Site), 300)]
    [InlineData(nameof(PublicController.Galleria), 300)]
    public void OgniRotta_DichiaraLaSuaCache(string azione, int durataAttesa)
    {
        ResponseCacheAttribute? attributo = typeof(PublicController)
            .GetMethod(azione)!
            .GetCustomAttribute<ResponseCacheAttribute>();

        attributo.Should().NotBeNull(
            $"la rotta {azione} deve dichiarare la propria durata di cache nella firma, dove un "
            + "lettore la vede insieme al percorso");

        attributo!.Duration.Should().Be(durataAttesa);
        attributo.Location.Should().Be(ResponseCacheLocation.Any,
            "la cache deve essere pubblica, cioè condivisibile da un proxy: è il presupposto del "
            + "micro-cache del reverse proxy");
    }

    /// <summary>
    /// Nessuna rotta pubblica senza durata dichiarata. Senza questo test una quarta action
    /// nascerebbe muta — e una risposta senza <c>Cache-Control</c> è quella su cui il reverse
    /// proxy applicherà il proprio default, cioè un numero deciso altrove da qualcun altro.
    /// </summary>
    [Fact]
    public void NessunaRottaPubblica_RestaSenzaDurataDichiarata()
    {
        ActionPubbliche()
            .Where(azione => azione.GetCustomAttribute<ResponseCacheAttribute>() is null)
            .Select(azione => azione.Name)
            .Should().BeEmpty();
    }

    /// <summary>
    /// I 60 secondi del menu e il <c>proxy_cache_valid 200 60s</c> previsto per il reverse proxy
    /// sono <b>la stessa decisione</b>, scritta due volte di proposito: nginx onora il
    /// <c>Cache-Control</c> dell'upstream, quindi dichiararlo qui significa che non dovrà essere
    /// deciso una seconda volta in un posto dove nessuno lo collegherà più alla natura del dato.
    /// </summary>
    [Fact]
    public void LaDurataDelMenu_CoincideConQuellaPrevistaPerIlProxy()
    {
        const int ValiditaPrevistaNelProxy = 60;

        typeof(PublicController).GetMethod(nameof(PublicController.Menu))!
            .GetCustomAttribute<ResponseCacheAttribute>()!
            .Duration.Should().Be(ValiditaPrevistaNelProxy);
    }

    // ── (2) La policy CORS dedicata ──────────────────────────────────────────────────────

    [Fact]
    public void PublicController_UsaLaPolicyCorsDedicata()
    {
        typeof(PublicController).GetCustomAttribute<EnableCorsAttribute>()
            .Should().NotBeNull("le tre rotte non devono stare sotto la policy globale credenziale")
            .And.Subject.As<EnableCorsAttribute>()
            .PolicyName.Should().Be("PubblicaSenzaCredenziali");
    }

    /// <summary>
    /// La policy dedicata ammette qualunque origine e il solo <c>GET</c>, e <b>non</b> ammette
    /// credenziali. Si legge dal sorgente perché la registrazione vive nelle istruzioni di primo
    /// livello di <c>Program.cs</c>, che nessun test può istanziare senza montare l'intera
    /// applicazione.
    ///
    /// <para>⚠️ La combinazione <c>AllowAnyOrigin</c> + <c>AllowCredentials</c> fallirebbe anche a
    /// runtime — sono mutuamente esclusivi per specifica — ma fallirebbe <b>sulla richiesta</b>,
    /// cioè in produzione e non in CI. Qui fallisce alla scrittura.</para>
    /// </summary>
    [Fact]
    public void LaPolicyPubblica_AmmetteOgniOrigineInSolaLetturaESenzaCredenziali()
    {
        string corpo = CorpoDellaPolicy("PubblicaSenzaCredenziali");

        corpo.Should().Contain("AllowAnyOrigin()");
        corpo.Should().Contain("WithMethods(\"GET\")");
        corpo.Should().NotContain("AllowCredentials",
            "\"*\" e le credenziali sono mutuamente esclusivi, e qui è una virtù: questa famiglia "
            + "di rotte non deve poter diventare un vettore credenziale nemmeno per errore");
    }

    /// <summary>
    /// L'altra metà della stessa decisione: la policy globale resta <b>credenziale</b>, perché
    /// <c>/graphql</c> e <c>/api/auth/*</c> ne dipendono. Allargare quella invece di aggiungerne
    /// una dedicata avrebbe aperto anche loro.
    /// </summary>
    [Fact]
    public void LaPolicyGlobale_RestaCredenzialeConAllowlist()
    {
        string corpo = CorpoDellaPolicy("AllowSpecificOrigins");

        corpo.Should().Contain("AllowCredentials()");
        corpo.Should().Contain("CorsOriginPolicy.OrigineAmmessa");
    }

    // ── (3) Nessuna cache lato server ────────────────────────────────────────────────────

    /// <summary>
    /// Ciò che questa fase introduce è <b>l'header</b>, non la cache. Registrare anche un
    /// middleware di caching significherebbe due TTL da tenere allineati e un invalidamento in
    /// più da capire quando l'amministratore salva: la cache vera vive nel reverse proxy, e il
    /// piano l'ha già deciso.
    /// </summary>
    [Theory]
    [InlineData("AddResponseCaching")]
    [InlineData("AddOutputCache")]
    [InlineData("UseResponseCaching")]
    [InlineData("UseOutputCache")]
    public void NessunMiddlewareDiCache_ERegistrato(string registrazione)
    {
        FileCheContengono(Regex.Escape(registrazione)).Should().BeEmpty(
            "in questa fase non si memorizza alcuna risposta lato server: due richieste "
            + "consecutive devono interrogare entrambe il database");
    }

    // ── (4) Le rotte pubbliche non sono sotto rate limiting applicativo ──────────────────

    /// <summary>
    /// Il dizionario contiene <b>esattamente</b> le due voci di autenticazione preesistenti. Se
    /// questo test diventa rosso perché qualcuno ha aggiunto una GET pubblica, la correzione non
    /// è allargare l'elenco atteso: è rileggere il criterio scritto accanto al dizionario, che
    /// spiega perché una lettura cacheabile a costo fisso non ci va e perché una scrittura sì.
    /// </summary>
    [Fact]
    public void IlDizionarioDelRateLimit_ContieneSoloLeDueRotteDiAutenticazione()
    {
        AuthRateLimitMiddleware.PercorsiLimitati.Should().BeEquivalentTo(
            "/api/auth/signin", "/api/auth/refresh");
    }

    [Fact]
    public void IlCriterioDelRateLimit_EScrittoAccantoAlDizionario()
    {
        string sorgente = File.ReadAllText(
            Path.Combine(RadiceBackend(), "Middleware", "AuthRateLimitMiddleware.cs"));

        // Non si verifica la prosa parola per parola — sarebbe un test della formattazione — ma
        // che le due metà del criterio siano entrambe presenti: chi aggiungerà la rotta di
        // prenotazione deve trovare qui il "sì", non solo il "no".
        sorgente.Should().Contain("/api/public/prenotazioni",
            "il criterio deve nominare la rotta su cui la scelta sarà opposta, altrimenti chi la "
            + "aggiungerà crederà di contraddire una regola invece di applicarla");
        sorgente.Should().Contain("CleanupOldEntries",
            "la seconda ragione (il dizionario non viene mai ripulito) va nominata dove si legge");
    }

    // ── Scoperta e scansione ─────────────────────────────────────────────────────────────

    private static MethodInfo[] ActionPubbliche() =>
        typeof(PublicController)
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(metodo => !metodo.IsSpecialName)
            .ToArray();

    /// <summary>
    /// Il corpo testuale di una <c>options.AddPolicy("nome", policy =&gt; { … })</c> in
    /// <c>Program.cs</c>, dal nome della policy fino alla chiusura della lambda.
    /// </summary>
    private static string CorpoDellaPolicy(string nome)
    {
        string programma = File.ReadAllText(Path.Combine(RadiceBackend(), "Program.cs"));

        System.Text.RegularExpressions.Match blocco = Regex.Match(
            programma,
            $@"AddPolicy\(""{Regex.Escape(nome)}"".*?\n    \}}\);",
            RegexOptions.Singleline);

        blocco.Success.Should().BeTrue($"la policy CORS \"{nome}\" deve esistere in Program.cs");
        return blocco.Value;
    }

    private static string[] FileCheContengono(string pattern)
    {
        var regex = new Regex(pattern, RegexOptions.CultureInvariant);

        return SorgentiApplicative()
            .Where(percorso => regex.IsMatch(File.ReadAllText(percorso)))
            .Select(NomeRelativo)
            .OrderBy(nome => nome, StringComparer.Ordinal)
            .ToArray();
    }

    private static IEnumerable<string> SorgentiApplicative() =>
        Directory.EnumerateFiles(RadiceBackend(), "*.cs", SearchOption.AllDirectories)
            .Where(percorso => !EInUnaCartellaEsclusa(percorso));

    private static readonly string[] CartelleEscluse =
        ["bin", "obj", "Migrations", "DuedGusto.Tests"];

    private static bool EInUnaCartellaEsclusa(string percorso) =>
        NomeRelativo(percorso).Split('/').Any(segmento =>
            CartelleEscluse.Contains(segmento, StringComparer.OrdinalIgnoreCase));

    private static string NomeRelativo(string percorso) =>
        Path.GetRelativePath(RadiceBackend(), percorso).Replace('\\', '/');

    /// <summary>
    /// La radice del backend, risalita da <c>[CallerFilePath]</c>: la directory di esecuzione è
    /// <c>bin/Debug/net8.0</c> e cambia con <c>dotnet test -o</c>, che è come si compila mentre
    /// il backend di sviluppo tiene bloccata <c>bin/</c>. Tre livelli:
    /// <c>Unit/Controllers</c> → <c>Unit</c> → <c>DuedGusto.Tests</c> → <c>backend</c>.
    /// </summary>
    private static string RadiceBackend([CallerFilePath] string percorsoTest = "") =>
        Path.GetFullPath(Path.Combine(
            Path.GetDirectoryName(percorsoTest)!, "..", "..", ".."));
}
