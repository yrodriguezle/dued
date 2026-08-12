using duedgusto.Common;

namespace DuedGusto.Tests.Unit.Common;

/// <summary>
/// Contratto della policy CORS: quali origini cross-origin possono chiamare l'API.
///
/// <para>La policy è combinata con <c>AllowCredentials()</c>, quindi un'origine ammessa parla
/// con l'API usando i cookie dell'utente. La regola è che un'origine sia <b>dichiarata</b> e
/// mai <b>dedotta</b>: il caso che questi test sorvegliano davvero è
/// <see cref="IpPubblicoNonDichiarato_Rifiutato"/>, perché la versione precedente ammetteva
/// qualunque host che fosse un IP parsabile.</para>
/// </summary>
public class CorsOriginPolicyTests
{
    /// <summary>Allowlist di default: <c>ALLOWED_ORIGINS</c> e <c>SERVER_IP</c> non impostate.</summary>
    private static HashSet<string> AllowlistDiDefault() =>
        CorsOriginPolicy.CostruisciAllowlist(null, null);

    #region Scenario: Origine dichiarata nell'allowlist

    [Theory]
    [InlineData("https://app.duedgusto.it")]
    [InlineData("https://app.duedgusto.it:8443")]
    [InlineData("http://app.duedgusto.it")]
    public void HostDichiaratoInAllowedOrigins_Ammesso(string origin)
    {
        HashSet<string> allowlist =
            CorsOriginPolicy.CostruisciAllowlist("app.duedgusto.it", null);

        CorsOriginPolicy.OrigineAmmessa(origin, allowlist).Should().BeTrue(
            "l'host è dichiarato in ALLOWED_ORIGINS, che elenca soli host senza schema né porta");
    }

    [Fact]
    public void AllowedOrigins_NonImpostata_AmmetteIlDominioDiDefault()
    {
        CorsOriginPolicy.OrigineAmmessa("https://app.duedgusto.it", AllowlistDiDefault())
            .Should().BeTrue("senza ALLOWED_ORIGINS vale il default 'app.duedgusto.it'");
    }

    [Fact]
    public void AllowedOrigins_ElencoMultiplo_AmmetteOgniHostConSpaziIgnorati()
    {
        HashSet<string> allowlist = CorsOriginPolicy.CostruisciAllowlist(
            " app.duedgusto.it , vetrina.duedgusto.it ", null);

        CorsOriginPolicy.OrigineAmmessa("https://app.duedgusto.it", allowlist).Should().BeTrue();
        CorsOriginPolicy.OrigineAmmessa("https://vetrina.duedgusto.it", allowlist).Should().BeTrue();
        CorsOriginPolicy.OrigineAmmessa("https://altro.duedgusto.it", allowlist).Should().BeFalse(
            "un host non elencato non è dichiarato");
    }

    [Fact]
    public void ConfrontoHost_CaseInsensitive()
    {
        HashSet<string> allowlistMaiuscola =
            CorsOriginPolicy.CostruisciAllowlist("APP.DUEDGUSTO.IT", null);

        CorsOriginPolicy.OrigineAmmessa("https://app.duedgusto.it", allowlistMaiuscola)
            .Should().BeTrue("il confronto fra host è OrdinalIgnoreCase");

        CorsOriginPolicy.OrigineAmmessa("https://App.DuedGusto.It", AllowlistDiDefault())
            .Should().BeTrue("il case dell'header Origin non deve cambiare il verdetto");
    }

    #endregion

    #region Scenario: IP pubblico non dichiarato

    [Theory]
    // L'IP dello scenario della spec (TEST-NET-3, RFC 5737)
    [InlineData("https://203.0.113.10")]
    [InlineData("http://203.0.113.10:4001")]
    [InlineData("https://8.8.8.8")]
    // Appena fuori dai blocchi privati: 172.16-31 è privato, 172.15 e 172.32 no
    [InlineData("https://172.15.0.1")]
    [InlineData("https://172.32.0.1")]
    // 11.x non è privato (lo è solo 10.x), 192.169 non è privato (lo è solo 192.168)
    [InlineData("https://11.0.0.1")]
    [InlineData("https://192.169.1.50")]
    public void IpPubblicoNonDichiarato_Rifiutato(string origin)
    {
        CorsOriginPolicy.OrigineAmmessa(origin, AllowlistDiDefault()).Should().BeFalse(
            "un IP pubblico non deve essere ammesso per il solo fatto di essere un IP: "
            + "con AllowCredentials() qualunque sito ospitato su un IP nudo potrebbe "
            + "chiamare l'API con i cookie dell'utente");
    }

    [Fact]
    public void DominioSconosciuto_Rifiutato()
    {
        CorsOriginPolicy.OrigineAmmessa("https://sito-malevolo.example", AllowlistDiDefault())
            .Should().BeFalse();
    }

    #endregion

    #region Scenario: Sviluppo su più dispositivi in LAN

    [Theory]
    [InlineData("http://localhost:4001")]
    [InlineData("https://localhost")]
    [InlineData("http://LOCALHOST:4001")]
    [InlineData("http://127.0.0.1:4001")]
    public void SviluppoLocale_Ammesso(string origin)
    {
        CorsOriginPolicy.OrigineAmmessa(origin, AllowlistDiDefault()).Should().BeTrue(
            "lo sviluppo in locale deve funzionare senza configurazione aggiuntiva");
    }

    [Theory]
    // 192.168.x.x
    [InlineData("http://192.168.1.50:4001")]
    [InlineData("http://192.168.0.1")]
    // 10.x.x.x
    [InlineData("http://10.0.0.5:4001")]
    [InlineData("http://10.255.255.254")]
    // 172.16.x.x – 172.31.x.x, estremi inclusi
    [InlineData("http://172.16.0.1:4001")]
    [InlineData("http://172.31.255.254")]
    public void LanPrivata_Ammessa(string origin)
    {
        CorsOriginPolicy.OrigineAmmessa(origin, AllowlistDiDefault()).Should().BeTrue(
            "il test su più dispositivi in rete locale deve continuare a funzionare "
            + "senza configurazione aggiuntiva");
    }

    #endregion

    #region Scenario: IP del server aggiunto senza toccare l'allowlist

    [Fact]
    public void ServerIp_AmmessoSenzaDuplicarloInAllowedOrigins()
    {
        HashSet<string> allowlist =
            CorsOriginPolicy.CostruisciAllowlist("app.duedgusto.it", "203.0.113.10");

        CorsOriginPolicy.OrigineAmmessa("https://203.0.113.10", allowlist).Should().BeTrue(
            "SERVER_IP entra da sola nell'allowlist");

        CorsOriginPolicy.OrigineAmmessa("https://203.0.113.10", AllowlistDiDefault())
            .Should().BeFalse("senza SERVER_IP lo stesso IP resta rifiutato: è la dichiarazione "
            + "che lo ammette, non il fatto di essere un IP");
    }

    [Fact]
    public void ServerIp_ConSpaziEsterni_VieneNormalizzata()
    {
        HashSet<string> allowlist = CorsOriginPolicy.CostruisciAllowlist(null, "  203.0.113.10  ");

        CorsOriginPolicy.OrigineAmmessa("https://203.0.113.10", allowlist).Should().BeTrue();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ServerIp_NonValorizzata_NonAggiungeNulla(string? serverIp)
    {
        HashSet<string> allowlist =
            CorsOriginPolicy.CostruisciAllowlist("app.duedgusto.it", serverIp);

        allowlist.Should().BeEquivalentTo(["app.duedgusto.it"]);
    }

    #endregion

    #region Scenario: Nuovo client legittimo da autorizzare

    [Fact]
    public void HostAggiuntoAdAllowedOrigins_PassaDaRifiutatoAdAmmesso()
    {
        const string origin = "https://nuovo-client.duedgusto.it";

        CorsOriginPolicy.OrigineAmmessa(origin, AllowlistDiDefault()).Should().BeFalse(
            "prima dell'autorizzazione l'host non è dichiarato");

        HashSet<string> allowlistAggiornata = CorsOriginPolicy.CostruisciAllowlist(
            "app.duedgusto.it,nuovo-client.duedgusto.it", null);

        CorsOriginPolicy.OrigineAmmessa(origin, allowlistAggiornata).Should().BeTrue(
            "basta aggiungere l'host a ALLOWED_ORIGINS e riavviare il container: "
            + "nessun rebuild dell'immagine");
    }

    #endregion

    #region Origini non parsabili

    /// <remarks>
    /// Non è asserito il caso <c>"//app.duedgusto.it"</c>: su Windows
    /// <c>Uri.TryCreate(UriKind.Absolute)</c> lo interpreta come percorso UNC e produce
    /// <c>file://app.duedgusto.it/</c>, con <c>Host</c> valorizzato — quindi il verdetto
    /// dipende dalla piattaforma. Non è una falla sfruttabile (un browser non fa mai match
    /// fra la propria origin e un <c>Access-Control-Allow-Origin</c> senza schema), ma
    /// un'asserzione qui renderebbe il test rosso su Linux o su Windows a seconda di dove gira.
    /// </remarks>
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not-a-uri")]
    // Host senza schema: ALLOWED_ORIGINS elenca host, ma l'header Origin è un URI assoluto
    [InlineData("app.duedgusto.it")]
    [InlineData("/graphql")]
    public void OrigineNonParsabileComeUri_Rifiutata(string? origin)
    {
        CorsOriginPolicy.OrigineAmmessa(origin, AllowlistDiDefault()).Should().BeFalse(
            "un'origine che non è un URI assoluto non può essere confrontata con l'allowlist");
    }

    #endregion
}
