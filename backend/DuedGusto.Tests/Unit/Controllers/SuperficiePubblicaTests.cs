using System.Reflection;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using duedgusto.Controllers;
using duedgusto.Controllers.Public.Dto;

namespace DuedGusto.Tests.Unit.Controllers;

/// <summary>
/// Il confine fra <b>privato e pubblico</b>, pinnato per struttura.
///
/// <para>È un file distinto da <c>ConfineVetrinaCassaTests</c>, e la distinzione è la ragione per
/// cui esiste: quello difende il confine <i>cassa ↔ vetrina</i> — chi può scrivere che cosa —
/// mentre questo difende il confine <i>privato ↔ pubblico</i>, cioè che cosa può uscire verso un
/// visitatore senza credenziali. Due confini, due file, ognuno con la sua ragione scritta in
/// testa.</para>
///
/// <para>🔴 <b>Perché serve, oltre ai test di comportamento.</b> I test di
/// <see cref="PublicControllerTests"/> verificano che le risposte di <i>oggi</i> contengano le
/// cose giuste. Ma il giorno in cui qualcuno aggiunge un campo a un DTO annidato, quei test
/// passano comunque — nessuno li ha scritti per quel campo. Questi falliscono subito, e il
/// messaggio nomina il tipo e la property di troppo.</para>
/// </summary>
public class SuperficiePubblicaTests
{
    /// <summary>
    /// I nomi che non possono comparire in <b>nessun</b> tipo raggiungibile da una risposta
    /// pubblica.
    ///
    /// <para>🔴 Gli ultimi quattro non vengono dal listino ma da <c>BusinessSettings</c>:
    /// <c>/api/public/site</c> <b>compone</b> le due entità, ed è esattamente al punto di
    /// composizione che l'aliquota IVA e il costo del giornale salirebbero a bordo senza che
    /// nessuno lo scriva.</para>
    ///
    /// <para>⚠️ <c>Categoria</c> è vietato <b>anche</b> per la categoria di vetrina, che sarebbe
    /// legittima: un nome ambiguo fra due domini è la strada più breve perché l'etichetta di
    /// magazzino finisca come intestazione sul sito. Il falso positivo si risolve con un rename
    /// (la categoria di menu si chiama <c>Nome</c>), non con un'eccezione qui dentro.</para>
    /// </summary>
    private static readonly string[] MaiInPubblico =
    [
        // Cassa
        "Codice", "AliquotaIva", "Attivo", "Categoria", "UnitaDiMisura",
        // Metadati interni
        "CreatedAt", "UpdatedAt",
        // BusinessSettings — il punto di composizione
        "VatRate", "GiornaleImportoSabato", "GiornaleImportoFeriale", "SettingsId",
        // Ganci spenti delle fasi successive
        "TurnstileSiteKey",
    ];

    /// <summary>I campi delle prenotazioni si vietano per prefisso: nasceranno in Fase 4.</summary>
    private const string PrefissoVietato = "Prenotazioni";

    private const string NamespaceDeiDto = "duedgusto.Controllers.Public.Dto";

    // ── (1) Il divieto, RICORSIVO sui tipi annidati ──────────────────────────────────────

    /// <summary>
    /// 🔴 <b>La ricorsione è il punto di questo test.</b> Senza, <c>MenuPubblicoDto</c>
    /// passerebbe — non possiede alcun campo vietato — mentre <c>CategoriaMenuDto</c>, che sta
    /// dentro di lui, potrebbe portarne uno. La visita parte dai tipi di ritorno delle action e
    /// attraversa collezioni e annidamenti fino a esaurire i tipi dell'applicazione: se qualcuno
    /// annidasse un'<b>entità</b> in un DTO, la visita ci arriverebbe e ne troverebbe subito
    /// <c>Codice</c> e <c>AliquotaIva</c>.
    /// </summary>
    [Fact]
    public void NessunTipoRaggiungibile_PossiedeUnCampoVietato()
    {
        var violazioni = TipiRaggiungibiliDaiDto()
            .SelectMany(tipo => tipo.GetProperties().Select(p => $"{tipo.Name}.{p.Name}"))
            .Where(nome => EVietato(nome.Split('.')[1]))
            .OrderBy(nome => nome, StringComparer.Ordinal)
            .ToArray();

        violazioni.Should().BeEmpty(
            "nessun tipo raggiungibile da una risposta pubblica può possedere un campo contabile "
            + "o interno: la protezione è strutturale, non un'omissione in serializzazione");
    }

    private static bool EVietato(string nomeProperty) =>
        MaiInPubblico.Contains(nomeProperty, StringComparer.Ordinal)
        || nomeProperty.StartsWith(PrefissoVietato, StringComparison.Ordinal);

    // ── (2) Ogni action restituisce un DTO, mai un'entità ────────────────────────────────

    /// <summary>
    /// Il giorno in cui qualcuno passa da <c>ActionResult&lt;T&gt;</c> a <c>IActionResult</c>, il
    /// compilatore smette di impedire <c>return Ok(prodotto)</c>. Questo test no.
    /// </summary>
    [Fact]
    public void OgniActionPubblica_RestituisceUnDtoEMaiUnEntita()
    {
        ActionPubbliche()
            .Select(TipoRestituito)
            .Should().OnlyContain(tipo => tipo.Namespace == NamespaceDeiDto);
    }

    /// <summary>
    /// Tre action e nient'altro. Nessuno stub per eventi, promozioni, contenuti o prenotazioni:
    /// una rotta che risponde <c>[]</c> è indistinguibile da una rotta rotta, e il consumatore
    /// della fase successiva la troverebbe già "esistente".
    /// </summary>
    [Fact]
    public void PublicController_EsponeEsattamenteTreRotte()
    {
        ActionPubbliche().Select(m => m.Name)
            .Should().BeEquivalentTo("Menu", "Site", "Galleria");
    }

    /// <summary>
    /// Nessun input del chiamante entra nelle action: niente filtri, niente paginazione, niente
    /// limiti suggeriti. Il costo di ogni risposta è <b>fisso</b>, ed è questa proprietà — non un
    /// contatore di richieste — la protezione vera di una rotta anonima.
    ///
    /// <para>Il <c>CancellationToken</c> è l'unica eccezione ammessa: non è un parametro di
    /// query, lo lega la piattaforma al ciclo di vita della richiesta.</para>
    /// </summary>
    [Fact]
    public void NessunaActionPubblica_AccettaInputDalChiamante()
    {
        ActionPubbliche()
            .SelectMany(azione => azione.GetParameters())
            .Should().OnlyContain(parametro => parametro.ParameterType == typeof(CancellationToken));
    }

    // ── (3) L'elenco ESATTO delle property di ogni DTO ───────────────────────────────────

    /// <summary>
    /// L'elenco esatto, non un sottoinsieme: <b>un campo tolto rompe il sito in silenzio</b> (il
    /// consumatore legge <c>undefined</c> e non mostra nulla), un campo aggiunto è la fuga che
    /// questo file previene.
    /// </summary>
    [Theory]
    [MemberData(nameof(FormaAttesaDeiDto))]
    public void OgniDtoPubblico_HaEsattamenteQuestiCampi(Type dto, string[] campiAttesi)
    {
        dto.GetProperties().Select(p => p.Name).Should().BeEquivalentTo(campiAttesi);
    }

    public static TheoryData<Type, string[]> FormaAttesaDeiDto() => new()
    {
        {
            typeof(ProdottoPubblicoDto),
            ["Id", "Nome", "Descrizione", "Prezzo", "Allergeni", "Novita", "Consigliato", "Immagine"]
        },
        { typeof(CategoriaMenuDto), ["Nome", "Prodotti"] },
        {
            typeof(MenuPubblicoDto),
            ["Categorie", "TotaleProdottiPubblicati", "LimiteApplicato", "Troncato", "Lavagna"]
        },
        {
            typeof(ImmaginePubblicaDto),
            [
                "Chiave", "LarghezzeDisponibili", "Larghezza", "Altezza",
                "TestoAlternativo", "Didascalia", "Focale", "Placeholder",
            ]
        },
        {
            typeof(SitoPubblicoDto),
            [
                "Insegna", "Indirizzo", "Geo", "Contatti", "Social", "Orari", "Seo",
                "OraInizioTemaSera", "Testi", "Reputazione", "Recensioni",
            ]
        },
        { typeof(IndirizzoPubblicoDto), ["Via", "Cap", "Citta", "Provincia", "Paese"] },
        { typeof(GeoPubblicaDto), ["Latitudine", "Longitudine"] },
        { typeof(ContattiPubbliciDto), ["Telefono", "Email"] },
        { typeof(SocialPubbliciDto), ["Instagram", "Facebook"] },
        { typeof(OrariPubbliciDto), ["Apertura", "Chiusura", "GiorniOperativi", "Timezone"] },
        { typeof(SeoPubblicaDto), ["TitoloDefault", "DescrizioneDefault", "ImmagineOg"] },
        { typeof(GalleriaPubblicaDto), ["Immagini"] },

        // ── I testi editoriali e le recensioni ──────────────────────────────────────────
        // 🔴 `TestiPubbliciDto` è il punto in cui, di tutta la superficie pubblica, è più
        //    facile che entri un campo di troppo: è l'unico che cresce per ragioni
        //    *editoriali* invece che di dominio, e la tentazione di aggiungerci una nota
        //    interna «tanto è testo» è concreta. L'elenco esatto sta qui apposta.
        { typeof(TestiPubbliciDto), ["Claim", "Storia", "Aperitivo"] },
        { typeof(StoriaPubblicaDto), ["Titolo", "Testo"] },
        { typeof(AperitivoPubblicoDto), ["Titolo", "Testo", "Punti", "Categorie"] },
        { typeof(ReputazionePubblicaDto), ["Punteggio", "Numero", "UrlProfilo"] },
        // ⚠️ Nessuna data e nessun `Pubblicata`: la rotta pubblica restituisce SOLO le
        //    pubblicate, quindi il flag non ha nulla da dire al visitatore, e le marche
        //    temporali direbbero quando l'amministratore ha lavorato.
        { typeof(RecensionePubblicaDto), ["Id", "Autore", "Testo", "Fonte", "Punteggio"] },
    };

    /// <summary>
    /// La forma attesa deve coprire <b>tutti</b> i tipi raggiungibili: un DTO annidato nuovo che
    /// nessuno aggiunge alla tabella qui sopra sfuggirebbe al pin esatto, e il test (3) resterebbe
    /// verde senza dire niente su di lui.
    /// </summary>
    [Fact]
    public void LaFormaAttesa_CopreOgniTipoRaggiungibile()
    {
        var pinnati = FormaAttesaDeiDto().Select(riga => (Type)riga[0]).ToArray();

        TipiRaggiungibiliDaiDto().Should().BeSubsetOf(pinnati,
            "ogni tipo che può comparire in una risposta pubblica deve avere il proprio elenco "
            + "esatto di campi, altrimenti nasce annidato e nessuno lo guarda più");
    }

    // ── L'anonimato dichiarato (task 5.16) ───────────────────────────────────────────────

    /// <summary>
    /// 🔴 <b>Ciò che questo test NON prova.</b> Un test unitario che istanzia il controller e
    /// chiama <c>Menu()</c> non attraversa né autenticazione né autorizzazione: sarebbe verde
    /// anche con un <c>[Authorize]</c> sulla classe. Qui si prova soltanto che
    /// l'<b>intenzione</b> non sia stata cancellata il giorno in cui qualcuno aggiunge un
    /// <c>[Authorize]</c> "per coerenza con <c>MediaController</c>".
    ///
    /// <para>L'unica prova vera dell'anonimato è la verifica manuale del <b>task 5.17</b>:
    /// <c>curl</c> sulle tre rotte da una shell senza header <c>Authorization</c> e senza cookie.
    /// Automatizzarla richiederebbe un <c>WebApplicationFactory</c>, che il progetto non usa da
    /// nessuna parte ed è una dipendenza di test sproporzionata per tre GET.</para>
    /// </summary>
    [Fact]
    public void PublicController_EAnonimoPerAttributi()
    {
        typeof(PublicController).GetCustomAttribute<AllowAnonymousAttribute>()
            .Should().NotBeNull("l'accesso anonimo va dichiarato, non dedotto dall'assenza di guard");

        typeof(PublicController).GetCustomAttribute<AuthorizeAttribute>().Should().BeNull();

        ActionPubbliche().Should().OnlyContain(
            azione => azione.GetCustomAttribute<AuthorizeAttribute>() == null,
            "nemmeno una singola action può richiedere autorizzazione");
    }

    // ── Scoperta per riflessione ─────────────────────────────────────────────────────────

    private static MethodInfo[] ActionPubbliche() =>
        typeof(PublicController)
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(metodo => !metodo.IsSpecialName)
            .ToArray();

    /// <summary>
    /// Il tipo davvero restituito da un'action, sbucciato di <c>Task&lt;&gt;</c> e di
    /// <c>ActionResult&lt;&gt;</c>.
    /// </summary>
    private static Type TipoRestituito(MethodInfo azione)
    {
        Type tipo = azione.ReturnType;
        while (tipo.IsGenericType
               && (tipo.GetGenericTypeDefinition() == typeof(Task<>)
                   || tipo.GetGenericTypeDefinition() == typeof(ActionResult<>)))
        {
            tipo = tipo.GetGenericArguments()[0];
        }

        return tipo;
    }

    /// <summary>
    /// Visita in ampiezza tutti i tipi <b>dell'applicazione</b> raggiungibili dalle firme delle
    /// action, attraversando collezioni e annidamenti. Si ferma sui tipi di piattaforma
    /// (<c>string</c>, <c>int</c>, …) e non su quelli di <c>duedgusto</c>: è ciò che rende il
    /// test capace di scoprire un'entità annidata in un DTO, non solo un DTO malfatto.
    /// </summary>
    private static Type[] TipiRaggiungibiliDaiDto()
    {
        Assembly applicazione = typeof(PublicController).Assembly;
        var visti = new HashSet<Type>();
        var daVisitare = new Queue<Type>(ActionPubbliche().Select(TipoRestituito));

        while (daVisitare.Count > 0)
        {
            Type tipo = Scarta(daVisitare.Dequeue());
            if (tipo.Assembly != applicazione || !visti.Add(tipo)) continue;

            foreach (PropertyInfo property in tipo.GetProperties())
            {
                daVisitare.Enqueue(property.PropertyType);
            }
        }

        return [.. visti];
    }

    /// <summary>Sbuccia <c>Nullable&lt;&gt;</c> e l'elemento di una collezione.</summary>
    private static Type Scarta(Type tipo)
    {
        Type? sottostante = Nullable.GetUnderlyingType(tipo);
        if (sottostante is not null) return sottostante;

        if (tipo.IsArray) return tipo.GetElementType()!;

        if (tipo.IsGenericType && tipo.GetInterfaces().Append(tipo).Any(i =>
                i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IEnumerable<>)))
        {
            return tipo.GetGenericArguments()[0];
        }

        return tipo;
    }
}
