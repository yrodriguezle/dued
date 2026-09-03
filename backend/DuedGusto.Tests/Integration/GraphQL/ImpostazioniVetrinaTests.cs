using FluentAssertions.Execution;

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

    // ── Le quattro schede, come dato del test ────────────────────────────────────────────
    //
    // 🔴 L'elenco dei campi di una scheda NON è scritto a mano da nessuna parte di questo file:
    //    è `TipoInput(scheda).GetProperties()`. È ciò che rende i test di partizione e di
    //    azzeramento incrociato *parametrizzati sulla definizione dei gruppi* invece che copiati
    //    quattro volte — una copia dimenticherebbe il campo aggiunto domani, che è esattamente
    //    il guasto contro cui questi test esistono.

    public enum Scheda { Impostazioni, Home, Locale, Aperitivo, Piatto }

    private static Type TipoInput(Scheda scheda) => scheda switch
    {
        Scheda.Impostazioni => typeof(ImpostazioniVetrinaInput),
        Scheda.Home => typeof(PaginaHomeInput),
        Scheda.Locale => typeof(PaginaLocaleInput),
        Scheda.Aperitivo => typeof(PaginaAperitivoInput),
        _ => typeof(PaginaPiattoInput),
    };

    private static string NomeMutation(Scheda scheda) => scheda switch
    {
        Scheda.Impostazioni => "mutateImpostazioniVetrina",
        Scheda.Home => "mutatePaginaHome",
        Scheda.Locale => "mutatePaginaLocale",
        Scheda.Aperitivo => "mutatePaginaAperitivo",
        _ => "mutatePaginaPiatto",
    };

    private static string[] PerimetroDi(Scheda scheda) =>
        [.. TipoInput(scheda).GetProperties().Select(p => p.Name)];

    private Task<ImpostazioniVetrina> SalvaScheda(Scheda scheda, object input) => scheda switch
    {
        Scheda.Impostazioni => VetrinaMutations.ApplicaImpostazioniVetrinaAsync(
            _dbContext, (ImpostazioniVetrinaInput)input),
        Scheda.Home => VetrinaMutations.ApplicaPaginaHomeAsync(
            _dbContext, (PaginaHomeInput)input),
        Scheda.Locale => VetrinaMutations.ApplicaPaginaLocaleAsync(
            _dbContext, (PaginaLocaleInput)input),
        Scheda.Aperitivo => VetrinaMutations.ApplicaPaginaAperitivoAsync(
            _dbContext, (PaginaAperitivoInput)input),
        _ => VetrinaMutations.ApplicaPaginaPiattoAsync(
            _dbContext, (PaginaPiattoInput)input),
    };

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

    /// <summary>
    /// 🔴 <b>Lo stesso scenario, una volta per ciascuna delle tre scritture nuove.</b> La
    /// proprietà «un campo valorizzato si deve poter svuotare» non è una proprietà della mutation
    /// che ce l'aveva: è una proprietà di <b>ogni canale di scrittura</b>, e con la divisione in
    /// quattro il modo di perderla è che una delle tre nuove nasca con un
    /// <c>if (!string.IsNullOrEmpty(...))</c> copiato da <c>updateBusinessSettings</c>.
    ///
    /// <para>⚠️ I tre campi scelti non sono intercambiabili con altri: <c>storiaTesto</c> e
    /// <c>aperitivoTesto</c> svuotati <b>cancellano un URL</b> — la pagina risponde 404 e sparisce
    /// dalla navigazione — quindi qui la forma condizionale non renderebbe soltanto impossibile
    /// una modifica, renderebbe impossibile <i>ritirare una pagina dal sito</i>.</para>
    /// </summary>
    [Theory]
    [InlineData(Scheda.Home, "ClaimVetrina")]
    [InlineData(Scheda.Locale, "StoriaTitolo")]
    [InlineData(Scheda.Locale, "StoriaTesto")]
    [InlineData(Scheda.Aperitivo, "AperitivoTesto")]
    [InlineData(Scheda.Aperitivo, "AperitivoCategorie")]
    [InlineData(Scheda.Piatto, "PiattoTesto")]
    public async Task Mutation_DiPagina_ConUnCampoSvuotato_PersisteLAssenza(Scheda scheda, string campo)
    {
        System.Reflection.PropertyInfo proprietaInput = TipoInput(scheda).GetProperty(campo)!;
        System.Reflection.PropertyInfo proprietaEntita =
            typeof(ImpostazioniVetrina).GetProperty(campo)!;

        object conValore = Activator.CreateInstance(TipoInput(scheda))!;
        proprietaInput.SetValue(conValore, "un testo che c'era");
        await SalvaScheda(scheda, conValore);
        proprietaEntita.GetValue(await Rileggi()).Should().Be("un testo che c'era",
            "il presupposto dello scenario è che il campo fosse valorizzato");

        // Il modulo con quel campo cancellato: stringa vuota, non "campo assente".
        object svuotato = Activator.CreateInstance(TipoInput(scheda))!;
        proprietaInput.SetValue(svuotato, "");
        ImpostazioniVetrina salvate = await SalvaScheda(scheda, svuotato);

        proprietaEntita.GetValue(salvate).Should().BeNull(
            "cancellare un campo e salvare deve persistere l'assenza, in OGNI canale di "
            + "scrittura: è la proprietà che lo stile condizionale rende impossibile");
        proprietaEntita.GetValue(await Rileggi()).Should().BeNull("e la rilettura deve confermarlo");
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
    ///
    /// <para>🔴 <b>Da una mutation a QUATTRO, e i 24 casi sono GENERATI, non copiati.</b> Il
    /// rischio di questa change non è che qualcuno violi lo sbarramento di proposito: è che una
    /// scheda nuova, scritta fra sei mesi, non erediti la protezione perché la protezione era
    /// pinnata <b>su una mutation nominata</b>. Enumerare le mutation è ciò che fa ereditare la
    /// copertura a chi arriva dopo — e il giorno in cui nascesse una quinta scheda, aggiungerne il
    /// nome qui è una riga.</para>
    /// </summary>
    [Theory]
    [MemberData(nameof(CampiVietatiSulleQuattroMutation))]
    public async Task Input_ConUnCampoCheNonPossiede_RifiutatoDallaValidazioneDelloSchema(
        Scheda scheda, string campo)
    {
        using var host = new GraphQLTestHost(_dbContext);

        ExecutionResult result = await host.EseguiAsync(
            $$"""
            mutation {
              vetrina {
                {{NomeMutation(scheda)}}(input: {
                  {{InputMinimoValido(scheda)}}, {{campo}}
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

    public static TheoryData<Scheda, string> CampiVietatiSulleQuattroMutation()
    {
        string[] vietati =
        [
            "impostazioniVetrinaId: 2",
            "openingTime: \"07:00\"",
            "closingTime: \"21:00\"",
            "operatingDays: \"[true,true,true,true,true,true,false]\"",
            "timezone: \"Europe/Rome\"",
            "createdAt: \"2026-01-01T00:00:00Z\"",
        ];

        var casi = new TheoryData<Scheda, string>();
        Enum.GetValues<Scheda>().ToList()
            .ForEach(scheda => vietati.ToList().ForEach(campo => casi.Add(scheda, campo)));
        return casi;
    }

    /// <summary>Il minimo che ciascuna delle quattro mutation accetta come input valido.</summary>
    private static string InputMinimoValido(Scheda scheda) => scheda switch
    {
        Scheda.Impostazioni =>
            """
            insegnaPubblica: "X", via: "V", cap: "36016", citta: "Thiene",
            provincia: "VI", paese: "IT", oraInizioTemaSera: "18:00",
            prenotazioniAttive: false, prenotazioniPreavvisoOre: 2,
            prenotazioniCopertiMax: 20
            """,
        Scheda.Home => "claimVetrina: \"X\"",
        Scheda.Locale => "storiaTitolo: \"X\"",
        Scheda.Aperitivo => "aperitivoTitolo: \"X\"",
        // ⚠️ `piattoGiorno` è NON nullable: è l'unico input di scheda il cui minimo valido non è
        //    un campo di testo qualsiasi, e ometterlo farebbe fallire la validazione dello schema
        //    prima del resolver — cioè per una ragione che non è quella in prova qui.
        _ => "piattoTitolo: \"X\", piattoGiorno: 2",
    };

    // ═══════════════════════════════════════════════════════════════════════════════════════
    //  🔴 LA PARTIZIONE, PER RIFLESSIONE — totale e disgiunta, contro il MODELLO
    // ═══════════════════════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Ciò che dell'entità <b>dichiaratamente</b> non si scrive da GraphQL. È il complemento
    /// dell'unione dei quattro input: tutto il resto deve avere un proprietario.
    ///
    /// <para>🔴 <b>L'autorità non è più una lista scritta a mano</b>, com'era il pin precedente
    /// (<c>ImpostazioniVetrinaInput_HaEsattamenteICampiScrivibili</c>, trenta nomi ricopiati): è
    /// <b>l'entità</b>, meno queste otto eccezioni. Un campo aggiunto al modello e a nessun input
    /// diventa <b>orfano</b>, e il test lo dice per nome — mentre una lista letterale sarebbe
    /// rimasta verde, perché avrebbe continuato a descrivere il mondo di ieri.</para>
    ///
    /// <para>⚠️ Le quattro voci di slot sono le <b>navigazioni</b>, non gli identificativi:
    /// <c>ImmagineEroeHomeId</c>, <c>ImmagineRitrattoLocaleId</c>, <c>ImmagineEroeAperitivoId</c>
    /// e <c>ImmagineEroePiattoId</c> <b>sono scrivibili</b>, ciascuno dalla scheda della sua
    /// pagina. Sono le proprietà di navigazione a non esserlo, come <c>ImmagineOg</c> — si scrive
    /// l'identificativo, e l'entità la carica EF.</para>
    /// </summary>
    private static readonly string[] NonScrivibiliDaGraphQL =
    [
        "ImpostazioniVetrinaId",   // c'è una riga sola e il resolver sa quale
        "CreatedAt", "UpdatedAt",  // ciò che il sistema ha osservato, non ciò che un client dichiara
        "ImmagineOg",              // navigazione: si scrive ImmagineOgId
        "ImmagineEroeHome", "ImmagineRitrattoLocale", "ImmagineEroeAperitivo", "ImmagineEroePiatto",
    ];

    private static string[] CampiScrivibiliDelModello() =>
        [.. typeof(ImpostazioniVetrina).GetProperties()
            .Select(proprieta => proprieta.Name)
            .Where(nome => !NonScrivibiliDaGraphQL.Contains(nome))];

    /// <summary>
    /// 🔴 <b>Totalità.</b> L'unione dei cinque perimetri è <b>esattamente</b> l'insieme dei campi
    /// scrivibili del modello.
    ///
    /// <para>Un campo orfano — presente sul modello e in nessun input — è un campo che
    /// <b>nessuno può più modificare</b>, e la sua perdita è invisibile: il valore resta corretto
    /// finché non serve cambiarlo. È il guasto che il pin precedente non poteva vedere, perché
    /// confrontava l'input con una lista scritta a mano <i>accanto</i> a quell'input.</para>
    ///
    /// <para>Il messaggio nomina i campi e non la cardinalità: «31 invece di 33» costringerebbe a
    /// cercare quale, ed è precisamente l'informazione che il test già possiede.</para>
    /// </summary>
    [Fact]
    public void UnioneDegliInput_EEsattamenteLInsiemeDeiCampiScrivibili()
    {
        string[] scrivibili = CampiScrivibiliDelModello();
        string[] rivendicati = [.. Enum.GetValues<Scheda>().SelectMany(PerimetroDi)];

        string[] orfani = [.. scrivibili.Except(rivendicati).Order()];
        string[] intrusi = [.. rivendicati.Except(scrivibili).Order()];

        orfani.Should().BeEmpty(
            "un campo scrivibile che nessuna scheda possiede non si può più modificare da "
            + "nessuna parte, e la perdita è invisibile finché non serve cambiarlo");
        intrusi.Should().BeEmpty(
            "un input che nomina un campo che il modello non ha è un campo che il salvataggio "
            + "ignora in silenzio");
    }

    /// <summary>
    /// 🔴 <b>Disgiunzione.</b> Le intersezioni a due a due dei quattro perimetri sono vuote.
    ///
    /// <para>Due schede che scrivono lo stesso campo sono <b>due verità</b>, e vince l'ultima che
    /// salva — senza alcun errore da nessuna parte. È la proprietà che il compilatore del frontend
    /// <b>non</b> vede: se un campo finisse in due input, l'intersezione dei tipi lo nominerebbe
    /// comunque una volta sola e la mappa di proprietà resterebbe valida. Per questo la
    /// disgiunzione si verifica qui, per riflessione, e non lassù.</para>
    /// </summary>
    [Fact]
    public void NessunCampoAppartieneADueSchede()
    {
        Scheda[] schede = [.. Enum.GetValues<Scheda>()];

        string[] contese =
        [
            .. schede.SelectMany((prima, indice) => schede.Skip(indice + 1)
                .SelectMany(seconda => PerimetroDi(prima).Intersect(PerimetroDi(seconda))
                    .Select(campo => $"{campo} ({prima} + {seconda})")))
        ];

        contese.Should().BeEmpty(
            "un campo rivendicato da due schede è due verità sullo stesso dato, e vince l'ultima "
            + "che salva: il messaggio nomina il campo E le due schede, perché sapere quale campo "
            + "senza sapere chi se lo contende non basta a correggerlo");
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════
    //  🔴 AZZERAMENTO INCROCIATO — il motivo per cui questa change esiste
    // ═══════════════════════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Semina la riga con <b>tutti</b> i campi scrivibili a valori distinti e riconoscibili, e
    /// verifica di averlo fatto davvero.
    ///
    /// <para>🔴 <b>La verifica sul seme non è pignoleria.</b> Un campo dimenticato qui resterebbe
    /// al proprio valore di default, e un test di «non è cambiato» su un campo che valeva già
    /// <c>null</c> passa <b>sempre</b> — cioè coprirebbe il campo nuovo di domani soltanto
    /// all'apparenza. L'asserzione è quindi sul seme stesso, non sui suoi effetti.</para>
    /// </summary>
    private async Task<MediaAsset[]> SeminaTuttiICampiScrivibili()
    {
        MediaAsset[] media =
        [
            await CreaMedia("og.jpg"),
            await CreaMedia("eroe-home.jpg"),
            await CreaMedia("ritratto-locale.jpg"),
            await CreaMedia("eroe-aperitivo.jpg"),
            await CreaMedia("eroe-piatto.jpg"),
        ];

        var riga = new ImpostazioniVetrina
        {
            ImpostazioniVetrinaId = ImpostazioniVetrina.IdSingleton,
            InsegnaPubblica = "SEME insegna",
            Via = "SEME via",
            Cap = "36016",
            Citta = "SEME citta",
            Provincia = "VI",
            Paese = "IT",
            Latitudine = 45.707500m,
            Longitudine = 11.478900m,
            Telefono = "SEME telefono",
            Email = "seme@2dgusto.it",
            UrlInstagram = "https://www.instagram.com/seme/",
            UrlFacebook = "https://www.facebook.com/seme/",
            MetaTitoloDefault = "SEME meta titolo",
            MetaDescrizioneDefault = "SEME meta descrizione",
            ImmagineOgId = media[0].MediaAssetId,
            ImmagineEroeHomeId = media[1].MediaAssetId,
            ImmagineRitrattoLocaleId = media[2].MediaAssetId,
            ImmagineEroeAperitivoId = media[3].MediaAssetId,
            ImmagineEroePiattoId = media[4].MediaAssetId,
            OraInizioTemaSera = "19:30",
            ClaimVetrina = "SEME claim",
            StoriaTitolo = "SEME storia titolo",
            StoriaTesto = "SEME storia testo",
            AperitivoTitolo = "SEME aperitivo titolo",
            AperitivoTesto = "SEME aperitivo testo",
            AperitivoPunti = "SEME punto uno\nSEME punto due",
            AperitivoCategorie = "SEME categoria",
            PiattoTitolo = "SEME piatto titolo",
            PiattoTesto = "SEME piatto testo",
            // ⚠️ NON 0 e non il default 2: il seme deve differire da entrambi, altrimenti
            //    l'asserzione «non è cambiato» passerebbe su un campo mai scritto.
            PiattoGiorno = 5,
            PunteggioGoogle = 4.7m,
            NumeroRecensioniGoogle = 180,
            UrlProfiloGoogle = "https://maps.app.goo.gl/seme",
            PrenotazioniAttive = true,
            PrenotazioniPreavvisoOre = 7,
            PrenotazioniCopertiMax = 33,
            TurnstileSiteKey = "0xSEME",
        };
        _dbContext.ImpostazioniVetrina.Add(riga);
        await _dbContext.SaveChangesAsync();

        string[] rimastiAlDefault =
        [
            .. CampiScrivibiliDelModello()
                .Where(campo => ValoreDi(riga, campo) is null or "" or 0 or false)
        ];
        rimastiAlDefault.Should().BeEmpty(
            "il seme deve valorizzare OGNI campo scrivibile: su un campo lasciato al default "
            + "l'asserzione «non è cambiato» passerebbe sempre, e il test coprirebbe quel campo "
            + "solo all'apparenza");

        return media;
    }

    private static object? ValoreDi(ImpostazioniVetrina riga, string campo) =>
        typeof(ImpostazioniVetrina).GetProperty(campo)!.GetValue(riga);

    private static Dictionary<string, object?> Istantanea(ImpostazioniVetrina riga) =>
        CampiScrivibiliDelModello().ToDictionary(campo => campo, campo => ValoreDi(riga, campo));

    /// <summary>Un input della scheda che rispedisce esattamente ciò che la riga già contiene.</summary>
    private static object InputDallaRiga(Scheda scheda, ImpostazioniVetrina riga)
    {
        object input = Activator.CreateInstance(TipoInput(scheda))!;
        TipoInput(scheda).GetProperties().ToList()
            .ForEach(proprieta => proprieta.SetValue(input, ValoreDi(riga, proprieta.Name)));
        return input;
    }

    /// <summary>
    /// 🔴 <b>Salvataggio a vuoto di ciascuna scheda: nessun campo cambia.</b> È lo scenario che
    /// l'amministratore produce senza volerlo — apre una scheda, guarda, salva.
    ///
    /// <para>Con la mutation unica precedente questo era garantito solo perché la pagina
    /// rispediva tutti e trenta i campi: bastava che una scheda ne dimenticasse uno per azzerarlo
    /// a ogni apertura. Qui la garanzia è strutturale, e il test la esercita <b>campo per
    /// campo</b> su tutti e trentatré.</para>
    /// </summary>
    [Theory]
    [InlineData(Scheda.Impostazioni)]
    [InlineData(Scheda.Home)]
    [InlineData(Scheda.Locale)]
    [InlineData(Scheda.Aperitivo)]
    [InlineData(Scheda.Piatto)]
    public async Task AzzeramentoIncrociato_SalvandoUnaSchedaAVuoto_NessunCampoCambia(Scheda scheda)
    {
        await SeminaTuttiICampiScrivibili();
        Dictionary<string, object?> prima = Istantanea(await Rileggi());

        await SalvaScheda(scheda, InputDallaRiga(scheda, await Rileggi()));

        Istantanea(await Rileggi()).Should().BeEquivalentTo(prima,
            $"salvare la scheda {scheda} senza modificare nulla non deve cambiare nulla, "
            + "dentro né fuori dal suo perimetro");
    }

    /// <summary>
    /// 🔴 <b>Il test che è il motivo della change.</b> Si salva una scheda con l'input
    /// <b>completamente vuoto</b> — il caso peggiore, cioè un modulo che non trasporta niente — e
    /// si pretende che <b>ogni</b> campo fuori dal suo perimetro sia rimasto identico.
    ///
    /// <para>⚠️ <b>Due asserzioni, e la seconda è quella che impedisce al test di mentire.</b> Se
    /// ci fosse solo la prima, una <c>Applica…Async</c> che non scrivesse <b>niente</b> la
    /// passerebbe a pieni voti: «nessun campo fuori perimetro è cambiato» è banalmente vero per
    /// una funzione che non fa nulla. La seconda pretende che i campi <b>dentro</b> il perimetro
    /// siano stati azzerati davvero — cioè che l'assegnazione totale abbia funzionato — ed è ciò
    /// che rende il verde della prima significativo.</para>
    ///
    /// <para>🔴 Parametrizzato sulla <b>definizione dei gruppi</b> (<c>TipoInput</c>), non copiato
    /// quattro volte: una copia dimenticherebbe il campo aggiunto domani.</para>
    /// </summary>
    [Theory]
    [InlineData(Scheda.Impostazioni)]
    [InlineData(Scheda.Home)]
    [InlineData(Scheda.Locale)]
    [InlineData(Scheda.Aperitivo)]
    [InlineData(Scheda.Piatto)]
    public async Task AzzeramentoIncrociato_SalvandoUnaSchedaConInputVuoto_SoloIlSuoPerimetroCambia(
        Scheda scheda)
    {
        await SeminaTuttiICampiScrivibili();
        Dictionary<string, object?> prima = Istantanea(await Rileggi());

        await SalvaScheda(scheda, Activator.CreateInstance(TipoInput(scheda))!);

        Dictionary<string, object?> dopo = Istantanea(await Rileggi());
        string[] perimetro = PerimetroDi(scheda);

        using (new AssertionScope())
        {
            // ① Nessun campo fuori perimetro è stato toccato.
            string[] fuoriPerimetro = [.. prima.Keys.Where(campo => !perimetro.Contains(campo))];
            fuoriPerimetro.Where(campo => !Equals(dopo[campo], prima[campo]))
                .Should().BeEmpty(
                    $"salvare la scheda {scheda} non deve toccare alcun campo che quella scheda "
                    + "non possiede: sono i campi che l'amministratore non ha visto, non ha "
                    + "modificato e non saprebbe di aver perso");

            // ② E l'assegnazione totale ha funzionato DENTRO il perimetro, altrimenti ① sarebbe
            //    verde anche per una funzione che non scrive niente.
            perimetro.Where(campo => Equals(dopo[campo], prima[campo]))
                .Should().BeEmpty(
                    "un input vuoto deve azzerare i campi della PROPRIA scheda: è la riga che "
                    + "permette di svuotare un campo, ed è ciò che rende significativo il verde "
                    + "dell'asserzione precedente");
        }
    }

    /// <summary>
    /// 🔴 <b>La chiave del servizio antispam sopravvive a tutti i salvataggi.</b> È il campo che
    /// il pannello <b>non mostra</b> e che finora viaggiava comunque, per non essere azzerato
    /// dall'assegnazione totale: con sei schede quel trucco sarebbe diventato sei superfici di
    /// trasporto invisibile, ognuna capace di riscrivere un valore che il suo utilizzatore non ha
    /// mai visto.
    ///
    /// <para>Adesso appartiene a una scheda sola e nessun'altra la nomina, quindi non ha più
    /// bisogno di viaggiare per sopravvivere. Il test lo dimostra <b>sul dato persistito</b>, non
    /// sulla risposta della mutation.</para>
    /// </summary>
    [Theory]
    [InlineData(Scheda.Home)]
    [InlineData(Scheda.Locale)]
    [InlineData(Scheda.Aperitivo)]
    [InlineData(Scheda.Piatto)]
    public async Task AzzeramentoIncrociato_LaChiaveAntispamSopravvive_SalvandoUnaSchedaCheNonLaPossiede(
        Scheda scheda)
    {
        await SeminaTuttiICampiScrivibili();

        await SalvaScheda(scheda, Activator.CreateInstance(TipoInput(scheda))!);

        _dbContext.ChangeTracker.Clear();
        (await Rileggi()).TurnstileSiteKey.Should().Be("0xSEME",
            "la chiave non appartiene a questa scheda, quindi questa scheda non ha alcun modo di "
            + "toccarla — e la prova va cercata nel dato persistito, non nella risposta");
    }

    // ── Gli slot immagine delle pagine: adesso si SCRIVONO, ciascuno dalla sua scheda ────

    /// <summary>
    /// La regola «esiste ed è pubblicata» vale per i tre slot esattamente come per l'anteprima
    /// social e per l'immagine di un prodotto — e vale con lo <b>stesso messaggio</b>, perché è
    /// la stessa sede: <c>VerificaImmagineAssegnabileAsync</c>. Uno slot che accettasse un media
    /// ritirato farebbe rendere al sito un'immagine che la rotta pubblica non seleziona: la
    /// pagina resterebbe senza foto e il pannello direbbe che ce n'è una.
    /// </summary>
    [Theory]
    [InlineData(Scheda.Home, "ImmagineEroeHomeId")]
    [InlineData(Scheda.Locale, "ImmagineRitrattoLocaleId")]
    [InlineData(Scheda.Aperitivo, "ImmagineEroeAperitivoId")]
    [InlineData(Scheda.Piatto, "ImmagineEroePiattoId")]
    public async Task Mutation_DiPagina_ConSlotSuMediaNonPubblicato_Rifiutata(
        Scheda scheda, string slot)
    {
        MediaAsset ritirata = await CreaMedia("non-pubblicata.jpg", pubblicato: false);

        object input = Activator.CreateInstance(TipoInput(scheda))!;
        TipoInput(scheda).GetProperty(slot)!.SetValue(input, ritirata.MediaAssetId);

        Func<Task> act = () => SalvaScheda(scheda, input);

        await act.Should().ThrowAsync<ExecutionError>().WithMessage("*non è pubblicata*");
        _dbContext.ImpostazioniVetrina.Should().BeEmpty(
            "il rifiuto precede l'upsert: non deve restare nemmeno un'entità agganciata in "
            + "stato Added");
    }

    [Theory]
    [InlineData(Scheda.Home, "ImmagineEroeHomeId")]
    [InlineData(Scheda.Locale, "ImmagineRitrattoLocaleId")]
    [InlineData(Scheda.Aperitivo, "ImmagineEroeAperitivoId")]
    [InlineData(Scheda.Piatto, "ImmagineEroePiattoId")]
    public async Task Mutation_DiPagina_AssegnaEPoiAzzeraLoSlot_IlMediaRestaInLibreria(
        Scheda scheda, string slot)
    {
        MediaAsset immagine = await CreaMedia();

        object conSlot = Activator.CreateInstance(TipoInput(scheda))!;
        TipoInput(scheda).GetProperty(slot)!.SetValue(conSlot, immagine.MediaAssetId);
        await SalvaScheda(scheda, conSlot);
        ValoreDi(await Rileggi(), slot).Should().Be(immagine.MediaAssetId);

        await SalvaScheda(scheda, Activator.CreateInstance(TipoInput(scheda))!);

        ValoreDi(await Rileggi(), slot).Should().BeNull(
            "azzerare uno slot è un'operazione voluta: riporta la pagina al ripiego posizionale");
        _dbContext.MediaAssets.Should().HaveCount(1, "azzerare il riferimento non elimina il media");
    }

    /// <summary>
    /// 🔴 <b>Il complemento della disgiunzione, detto per nome.</b> Gli slot di pagina non sono
    /// nell'input delle impostazioni del sito, e non è una dimenticanza: ciascuno appartiene alla
    /// scheda della <b>sua</b> pagina, insieme ai testi di quella pagina. L'anteprima social è
    /// l'eccezione che conferma il criterio — è del sito intero, quindi resta qui.
    ///
    /// <para><see cref="NessunCampoAppartieneADueSchede"/> lo garantisce già in generale: questo
    /// test lo dice per nome, così chi aggiunge lo slot all'input trova un rosso che spiega
    /// <i>perché</i> non si fa qui.</para>
    /// </summary>
    [Theory]
    [InlineData("ImmagineEroeHomeId")]
    [InlineData("ImmagineRitrattoLocaleId")]
    [InlineData("ImmagineEroeAperitivoId")]
    public void ImpostazioniVetrinaInput_NonPossiedeGliSlotDiPagina(string campo)
    {
        PerimetroDi(Scheda.Impostazioni).Should().NotContain(campo,
            "lo slot appartiene alla scheda della sua pagina: due schede che lo scrivessero "
            + "entrambe sarebbero due verità, e vincerebbe l'ultima che salva");
    }

    // ── I tre slot immagine delle pagine: in LETTURA, e per ora solo in lettura ──────────

    /// <summary>
    /// I tre slot escono dal tipo di output, con l'identificativo e con il media risolto — la
    /// stessa forma dell'anteprima social, perché è lo stesso genere di dato.
    ///
    /// <para>⚠️ <b>Nel tipo di output UNICO</b>, e non in tre tipi nuovi: la divisione per pagina
    /// che questa change introduce riguarda la <b>scrittura</b>. Tre tipi di output vorrebbero
    /// dire tre fragment, tre refetch e tre copie in cache della stessa riga singleton.</para>
    /// </summary>
    [Theory]
    [InlineData("immagineEroeHomeId")]
    [InlineData("immagineEroeHome")]
    [InlineData("immagineRitrattoLocaleId")]
    [InlineData("immagineRitrattoLocale")]
    [InlineData("immagineEroeAperitivoId")]
    [InlineData("immagineEroeAperitivo")]
    public void ImpostazioniVetrinaType_EsponeLoSlotInLettura(string campo)
    {
        new ImpostazioniVetrinaType().Fields.Select(f => f.Name).Should().Contain(campo);
    }

    /// <summary>
    /// 🔴 <b>Il complemento, ed è il vincolo di fase</b>: gli slot si <b>leggono</b> ma non si
    /// scrivono ancora. La scrittura arriva con le mutation per pagina, insieme alla verifica
    /// «esiste ed è pubblicata» per ciascuno slot — e farla nascere prima, dentro l'input
    /// esistente, vorrebbe dire un canale che assegna un'immagine senza controllarla.
    ///
    /// <para>Il pin per riflessione sopra
    /// (<see cref="ImpostazioniVetrinaInput_HaEsattamenteICampiScrivibili"/>) lo garantisce già
    /// per costruzione, perché confronta l'elenco <b>esatto</b>: questo test lo dice per nome, così
    /// chi aggiunge lo slot all'input trova un rosso che spiega <i>perché</i> non si fa qui.</para>
    /// </summary>
    [Theory]
    [InlineData("ImmagineEroeHomeId")]
    [InlineData("ImmagineRitrattoLocaleId")]
    [InlineData("ImmagineEroeAperitivoId")]
    public void ImpostazioniVetrinaInput_NonAccettaAncoraGliSlotDiPagina(string campo)
    {
        typeof(ImpostazioniVetrinaInput).GetProperties().Select(p => p.Name)
            .Should().NotContain(campo,
                "gli slot si scrivono dalle mutation per pagina, ciascuna con la verifica "
                + "«esiste ed è pubblicata»: accettarli qui aprirebbe un canale senza controllo");
    }
}
