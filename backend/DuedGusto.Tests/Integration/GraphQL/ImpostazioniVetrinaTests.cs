using GraphQL;

using duedgusto.GraphQL.Vetrina;
using duedgusto.GraphQL.Vetrina.Types;
using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// L'amministrazione delle impostazioni del sito: lettura, scrittura ad <b>assegnazione
/// totale</b> e validazioni.
///
/// <para>🔴 Il tema di questo file è uno solo, ed è il motivo per cui esiste come fase a sé:
/// <b>un campo valorizzato si deve poter svuotare</b>. <c>updateBusinessSettings</c> assegna con
/// <c>if (!string.IsNullOrEmpty(input.X))</c> e quindi non lo permette — si cancella il link
/// Facebook, si salva, e il vecchio valore resta senza alcun errore. Qui quello stile è vietato,
/// e il test dello svuotamento è ciò che impedisce a un <c>if</c> reintrodotto per distrazione di
/// passare la CI.</para>
/// </summary>
public class ImpostazioniVetrinaTests : IDisposable
{
    private readonly AppDbContext _dbContext;

    public ImpostazioniVetrinaTests() => _dbContext = TestDbContextFactory.Create();

    public void Dispose()
    {
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    /// <summary>
    /// Un input completo e valido, da cui ogni test cambia il solo campo che gli interessa: così
    /// il test dice cosa sta provando invece di ripetere venti assegnazioni.
    /// </summary>
    private static ImpostazioniVetrinaInput InputValido() => new()
    {
        InsegnaPubblica = "2D Gusto Bar",
        Via = "Via del Costo 99",
        Cap = "36016",
        Citta = "Thiene",
        Provincia = "VI",
        Paese = "IT",
        OraInizioTemaSera = "18:00",
        PrenotazioniPreavvisoOre = 2,
        PrenotazioniCopertiMax = 20,
    };

    private Task<ImpostazioniVetrina> Salva(ImpostazioniVetrinaInput input) =>
        VetrinaMutations.ApplicaImpostazioniVetrinaAsync(_dbContext, input);

    private async Task<ImpostazioniVetrina> Rileggi() =>
        (await VetrinaQueries.LeggiImpostazioniAsync(_dbContext))!;

    private async Task<MediaAsset> CreaMedia(string nome = "anteprima.jpg", bool pubblicato = true)
    {
        var asset = new MediaAsset
        {
            Chiave = $"2026/08/{Guid.NewGuid():N}"[..24],
            NomeOriginale = nome,
            MimeType = "image/jpeg",
            Larghezza = 1200,
            Altezza = 630,
            LarghezzeDisponibili = "400,800,1200",
            Cartella = "generale",
            Pubblicato = pubblicato,
            ByteTotali = 100,
        };
        _dbContext.MediaAssets.Add(asset);
        await _dbContext.SaveChangesAsync();
        return asset;
    }

    // ── 8.8 — lo svuotamento, che è il punto di tutta la fase ────────────────────────────

    /// <summary>
    /// 🔴 Lo scenario che la verifica per mutazione del task 8.8 fa cadere: sostituendo
    /// l'assegnazione di <c>UrlFacebook</c> con <c>if (!string.IsNullOrEmpty(...))</c> questo test
    /// diventa rosso, e nessun altro.
    /// </summary>
    [Fact]
    public async Task Mutation_ConUnCampoOpzionaleSvuotato_PersisteLAssenza()
    {
        ImpostazioniVetrinaInput conFacebook = InputValido();
        conFacebook.UrlFacebook = "https://www.facebook.com/2dgusto/";
        await Salva(conFacebook);
        (await Rileggi()).UrlFacebook.Should().Be("https://www.facebook.com/2dgusto/");

        // Stessi campi di prima, con il solo link Facebook cancellato dal modulo.
        ImpostazioniVetrinaInput senzaFacebook = InputValido();
        senzaFacebook.UrlFacebook = "";
        ImpostazioniVetrina salvate = await Salva(senzaFacebook);

        salvate.UrlFacebook.Should().BeNull(
            "cancellare un campo e salvare deve persistere l'assenza: è la proprietà che lo "
            + "stile condizionale di updateBusinessSettings rende impossibile");
        (await Rileggi()).UrlFacebook.Should().BeNull("e la rilettura deve confermarlo");
    }

    [Fact]
    public async Task Mutation_ConTelefonoDiSoliSpazi_PersisteNullENonLaStringa()
    {
        ImpostazioniVetrinaInput conTelefono = InputValido();
        conTelefono.Telefono = "0445 123456";
        await Salva(conTelefono);

        ImpostazioniVetrinaInput soliSpazi = InputValido();
        soliSpazi.Telefono = "   ";
        ImpostazioniVetrina salvate = await Salva(soliSpazi);

        salvate.Telefono.Should().BeNull(
            "l'assenza ha una sola rappresentazione: nessun consumatore deve distinguere fra "
            + "null, stringa vuota e soli spazi");
    }

    [Fact]
    public async Task Mutation_ConSpaziAiBordi_PersisteIlValoreRipulito()
    {
        ImpostazioniVetrinaInput input = InputValido();
        input.Telefono = "  0445 123456  ";
        input.InsegnaPubblica = "  2D Gusto Bar  ";

        ImpostazioniVetrina salvate = await Salva(input);

        salvate.Telefono.Should().Be("0445 123456");
        salvate.InsegnaPubblica.Should().Be("2D Gusto Bar");
    }

    // ── 8.9 — creazione implicita, round-trip, lettura ───────────────────────────────────

    [Fact]
    public async Task Mutation_ConLaRigaAssente_CreaConLIdentificativoFisso()
    {
        _dbContext.ImpostazioniVetrina.Should().BeEmpty("il presupposto è la tabella vuota");

        ImpostazioniVetrina salvate = await Salva(InputValido());

        salvate.ImpostazioniVetrinaId.Should().Be(ImpostazioniVetrina.IdSingleton);
        _dbContext.ImpostazioniVetrina.Should().HaveCount(1);
        salvate.InsegnaPubblica.Should().Be("2D Gusto Bar");
    }

    [Fact]
    public async Task Mutation_InvocataDueVolte_NonCreaUnaSecondaRiga()
    {
        await Salva(InputValido());
        await Salva(InputValido());

        _dbContext.ImpostazioniVetrina.Should().HaveCount(1,
            "l'upsert scrive sempre sulla stessa riga: non esiste un percorso per crearne una "
            + "seconda, nemmeno sbagliando");
    }

    [Fact]
    public async Task Mutation_RoundTripCompleto_RileggeOgniValoreIdentico()
    {
        MediaAsset anteprima = await CreaMedia();

        var input = new ImpostazioniVetrinaInput
        {
            InsegnaPubblica = "2D Gusto Bar",
            Via = "Via del Costo 99",
            Cap = "36016",
            Citta = "Thiene",
            Provincia = "VI",
            Paese = "IT",
            Latitudine = 45.707500m,
            Longitudine = 11.478900m,
            Telefono = "0445 123456",
            Email = "info@2dgusto.it",
            UrlInstagram = "https://www.instagram.com/2dgusto/",
            UrlFacebook = "https://www.facebook.com/2dgusto/",
            MetaTitoloDefault = "2D Gusto Bar — Thiene",
            MetaDescrizioneDefault = "Colazioni, pranzi e aperitivi a Thiene.",
            ImmagineOgId = anteprima.MediaAssetId,
            OraInizioTemaSera = "19:30",
            PrenotazioniAttive = true,
            PrenotazioniPreavvisoOre = 4,
            PrenotazioniCopertiMax = 30,
            TurnstileSiteKey = "0x4AAAAAAA",
        };

        await Salva(input);
        ImpostazioniVetrina riletto = await Rileggi();

        // Il confronto è guidato dall'INPUT: ogni campo scrivibile deve tornare identico. Le
        // marche temporali e l'identificativo non compaiono perché non fanno parte dell'input —
        // sono ciò che il sistema ha osservato, non ciò che il client ha dichiarato — ed è la
        // stessa asimmetria che rende sicura l'assegnazione totale.
        riletto.Should().BeEquivalentTo(input);

        riletto.ImmagineOg.Should().NotBeNull("la navigazione deve essere caricata dalla lettura")
            .And.Subject.As<MediaAsset>().NomeOriginale.Should().Be("anteprima.jpg");
    }

    [Fact]
    public async Task Lettura_ConLaRigaAssente_RestituisceNullENonUnErrore()
    {
        ImpostazioniVetrina? impostazioni =
            await VetrinaQueries.LeggiImpostazioniAsync(_dbContext);

        impostazioni.Should().BeNull(
            "un client sa gestire l'assenza — mostra un modulo vuoto e il primo salvataggio "
            + "crea la riga — mentre non sa gestire un errore di infrastruttura");
    }

    // ── 8.9 — validazioni, e nessuna scrittura parziale ──────────────────────────────────

    [Theory]
    [InlineData("18.00")]
    [InlineData("1800")]
    [InlineData("18:0")]
    [InlineData("25:00")]
    [InlineData("18:60")]
    [InlineData("sera")]
    public async Task Mutation_ConOraDelTemaSeraNonValida_RifiutataENullaModificato(string ora)
    {
        await Salva(InputValido());

        ImpostazioniVetrinaInput sbagliato = InputValido();
        sbagliato.OraInizioTemaSera = ora;
        sbagliato.InsegnaPubblica = "NON DEVE ESSERE SCRITTA";

        Func<Task> act = () => Salva(sbagliato);

        await act.Should().ThrowAsync<ExecutionError>().WithMessage("*HH:mm*");
        ImpostazioniVetrina dopo = await Rileggi();
        dopo.OraInizioTemaSera.Should().Be("18:00");
        dopo.InsegnaPubblica.Should().Be("2D Gusto Bar",
            "un rifiuto non deve lasciare alcuna scrittura parziale");
    }

    [Theory]
    [InlineData(45.7075, null)]
    [InlineData(null, 11.4789)]
    public async Task Mutation_ConMezzaCoordinata_RifiutataConIlMotivo(double? lat, double? lon)
    {
        await Salva(InputValido());

        ImpostazioniVetrinaInput sbagliato = InputValido();
        sbagliato.Latitudine = (decimal?)lat;
        sbagliato.Longitudine = (decimal?)lon;

        Func<Task> act = () => Salva(sbagliato);

        await act.Should().ThrowAsync<ExecutionError>().WithMessage("*insieme*");
        ImpostazioniVetrina dopo = await Rileggi();
        dopo.Latitudine.Should().BeNull();
        dopo.Longitudine.Should().BeNull();
    }

    [Theory]
    [InlineData(120, 11.4789)]
    [InlineData(-91, 11.4789)]
    [InlineData(45.7075, 181)]
    [InlineData(45.7075, -200)]
    public async Task Mutation_ConCoordinataFuoriIntervallo_Rifiutata(double lat, double lon)
    {
        await Salva(InputValido());

        ImpostazioniVetrinaInput sbagliato = InputValido();
        sbagliato.Latitudine = (decimal)lat;
        sbagliato.Longitudine = (decimal)lon;

        Func<Task> act = () => Salva(sbagliato);

        await act.Should().ThrowAsync<ExecutionError>().WithMessage("*fuori intervallo*");
        (await Rileggi()).Latitudine.Should().BeNull();
    }

    [Fact]
    public async Task Mutation_ConEntrambeLeCoordinateAzzerate_RiesceELaGeolocalizzazioneSparisce()
    {
        ImpostazioniVetrinaInput conGeo = InputValido();
        conGeo.Latitudine = 45.707500m;
        conGeo.Longitudine = 11.478900m;
        await Salva(conGeo);

        ImpostazioniVetrina salvate = await Salva(InputValido());

        salvate.Latitudine.Should().BeNull();
        salvate.Longitudine.Should().BeNull();
    }

    [Theory]
    [InlineData("@2dgusto")]
    [InlineData("2dgusto")]
    [InlineData("www.instagram.com/2dgusto")]
    [InlineData("instagram.com/2dgusto")]
    public async Task Mutation_ConSocialCheNonEUnUrlAssoluto_Rifiutata(string handle)
    {
        ImpostazioniVetrinaInput sbagliato = InputValido();
        sbagliato.UrlInstagram = handle;

        Func<Task> act = () => Salva(sbagliato);

        await act.Should().ThrowAsync<ExecutionError>()
            .WithMessage("*indirizzo completo*");
        _dbContext.ImpostazioniVetrina.Should().BeEmpty(
            "il rifiuto precede qualunque tocco al change tracker: non deve restare nemmeno "
            + "un'entità agganciata in stato Added");
    }

    [Fact]
    public async Task Mutation_ConImmagineOgInesistente_RifiutataEValoreInvariato()
    {
        MediaAsset esistente = await CreaMedia();
        ImpostazioniVetrinaInput conImmagine = InputValido();
        conImmagine.ImmagineOgId = esistente.MediaAssetId;
        await Salva(conImmagine);

        ImpostazioniVetrinaInput sbagliato = InputValido();
        sbagliato.ImmagineOgId = 9999;

        Func<Task> act = () => Salva(sbagliato);

        await act.Should().ThrowAsync<ExecutionError>().WithMessage("*non esiste*");
        (await Rileggi()).ImmagineOgId.Should().Be(esistente.MediaAssetId);
    }

    /// <summary>
    /// 🔴 Il messaggio non è "simile": è <b>lo stesso</b>, e questo test lo confronta carattere
    /// per carattere eseguendo davvero i due percorsi. Due formulazioni diverse per la stessa
    /// regola sono due regole, agli occhi di chi legge il messaggio — e il modo di garantirlo nel
    /// tempo non è copiare la stringa, è avere una sede unica che la produce.
    /// </summary>
    [Fact]
    public async Task Mutation_ConImmagineOgNonPubblicata_HaLoStessoMessaggioDelCasoProdotto()
    {
        MediaAsset ritirata = await CreaMedia("non-pubblicata.jpg", pubblicato: false);

        var prodotto = new Prodotto
        {
            Codice = "A1",
            Nome = "Caffè",
            Prezzo = 1.20m,
            UnitaDiMisura = "pz",
            Attivo = true,
            AliquotaIva = 10,
        };
        _dbContext.Prodotti.Add(prodotto);
        await _dbContext.SaveChangesAsync();

        ImpostazioniVetrinaInput comeOg = InputValido();
        comeOg.ImmagineOgId = ritirata.MediaAssetId;

        ExecutionError erroreOg = (await ((Func<Task>)(() => Salva(comeOg)))
            .Should().ThrowAsync<ExecutionError>()).Which;

        ExecutionError erroreProdotto = (await ((Func<Task>)(() =>
                VetrinaMutations.ApplicaCampiVetrinaAsync(_dbContext, prodotto.ProdottoId,
                    new ProdottoVetrinaInput { ImmagineId = ritirata.MediaAssetId })))
            .Should().ThrowAsync<ExecutionError>()).Which;

        erroreOg.Message.Should().Be(erroreProdotto.Message,
            "la regola è una sola, quindi il messaggio deve essere uno solo");
        erroreOg.Message.Should().Contain("non-pubblicata.jpg").And.Contain("non è pubblicata");
    }

    [Fact]
    public async Task Mutation_ConRiferimentoOgAzzerato_RiesceEIlMediaRestaInLibreria()
    {
        MediaAsset anteprima = await CreaMedia();
        ImpostazioniVetrinaInput conImmagine = InputValido();
        conImmagine.ImmagineOgId = anteprima.MediaAssetId;
        await Salva(conImmagine);

        ImpostazioniVetrina salvate = await Salva(InputValido());

        salvate.ImmagineOgId.Should().BeNull();
        salvate.ImmagineOg.Should().BeNull();
        _dbContext.MediaAssets.Should().HaveCount(1, "azzerare il riferimento non elimina il media");
    }

    // ── 8.2 — ciò che l'input NON possiede, e chi lo rifiuta ─────────────────────────────

    /// <summary>
    /// 🔴 Il rifiuto arriva dalla <b>validazione dello schema</b>, non dal resolver: è la
    /// differenza fra un campo che non esiste e un campo che esiste e viene ignorato. Il secondo
    /// si può reintrodurre per distrazione; il primo no.
    ///
    /// <para><c>impostazioniVetrinaId</c>: c'è una riga sola e il resolver sa quale — accettare un
    /// identificativo sarebbe invitare qualcuno a passarne un altro. <c>openingTime</c>: gli
    /// orari hanno una sola sorgente, e non è la vetrina.</para>
    /// </summary>
    [Theory]
    [InlineData("impostazioniVetrinaId: 2")]
    [InlineData("openingTime: \"07:00\"")]
    [InlineData("closingTime: \"21:00\"")]
    [InlineData("operatingDays: \"[true,true,true,true,true,true,false]\"")]
    [InlineData("timezone: \"Europe/Rome\"")]
    [InlineData("createdAt: \"2026-01-01T00:00:00Z\"")]
    public async Task Input_ConUnCampoCheNonPossiede_RifiutatoDallaValidazioneDelloSchema(string campo)
    {
        using var host = new GraphQLTestHost(_dbContext);

        ExecutionResult result = await host.EseguiAsync(
            $$"""
            mutation {
              vetrina {
                mutateImpostazioniVetrina(input: {
                  insegnaPubblica: "X", via: "V", cap: "36016", citta: "Thiene",
                  provincia: "VI", paese: "IT", oraInizioTemaSera: "18:00",
                  prenotazioniAttive: false, prenotazioniPreavvisoOre: 2,
                  prenotazioniCopertiMax: 20, {{campo}}
                }) { impostazioniVetrinaId }
              }
            }
            """,
            GraphQLTestHost.Anonimo());

        // La validazione del documento gira PRIMA dell'autorizzazione: anche in anonimo l'errore
        // è quello del campo sconosciuto, che è precisamente ciò che si vuole dimostrare.
        result.Errors.Should().NotBeNullOrEmpty();
        GraphQLTestHost.DescriviErrori(result).Should().Contain(campo.Split(':')[0],
            "l'errore deve nominare il campo che l'input non possiede");
        _dbContext.ImpostazioniVetrina.Should().BeEmpty();
    }

    /// <summary>
    /// Il pin per riflessione, che copre anche i campi che nessuno ha pensato di provare: l'input
    /// possiede <b>esattamente</b> i campi scrivibili. È ciò che rende sicura l'assegnazione
    /// totale — non c'è nulla da ricordarsi di preservare perché non c'è nulla che questo canale
    /// possa toccare fuori perimetro.
    /// </summary>
    [Fact]
    public void ImpostazioniVetrinaInput_HaEsattamenteICampiScrivibili()
    {
        typeof(ImpostazioniVetrinaInput).GetProperties().Select(p => p.Name)
            .Should().BeEquivalentTo(
                "InsegnaPubblica",
                "Via", "Cap", "Citta", "Provincia", "Paese",
                "Latitudine", "Longitudine",
                "Telefono", "Email", "UrlInstagram", "UrlFacebook",
                "MetaTitoloDefault", "MetaDescrizioneDefault", "ImmagineOgId",
                "OraInizioTemaSera",
                "PrenotazioniAttive", "PrenotazioniPreavvisoOre", "PrenotazioniCopertiMax",
                "TurnstileSiteKey");
    }
}
