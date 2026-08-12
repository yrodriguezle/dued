# Design: API pubblica + impostazioni vetrina (vetrina-api-pubblica)

> Fase 2 di 8 del progetto "Sito vetrina 2D Gusto", **prima metà** — il solo backend pubblico.
> Proposal di riferimento: [proposal.md](./proposal.md), in particolare la sezione finale "Verifiche sul codice" (dieci divergenze verificate) e le **quattro decisioni aperte**, che questo documento chiude in §D3 (etichetta di galleria), §D6 (rate limiting), §D5 (CORS) e §D8 (unicità del singleton).
> Change precedente: [`vetrina-fondamenta-media/design.md`](../vetrina-fondamenta-media/design.md) — se ne eredita la dottrina su chiave/URL (§D3 di quel documento), sul confine cassa/vetrina (§D8) e sul gating a tre livelli (§D12).

---

## Technical Approach

Quattro pezzi, in ordine obbligato, ognuno verificabile da solo:

1. **Una regola estratta.** `pubblicatoSulSito` e `prezzoEffettivoVetrina` smettono di essere due lambda dentro un resolver e diventano `Common/RegoleVetrina.cs`. È il **primo** passo e non l'ultimo: finché la regola vive dentro `ProdottoType`, qualunque cosa si scriva nel controller è per forza una seconda copia.
2. **Un'entità e una migrazione.** `ImpostazioniVetrina`, singleton, additiva, separata da `BusinessSettings`.
3. **Tre GET anonime.** `PublicController`, DTO record, proiezione SQL stretta, header di cache. Verificabile con `curl` senza toccare l'interfaccia.
4. **Una pagina admin.** `ImpostazioniVetrinaPage` sul pattern verbatim di `SettingsDetails.tsx`, dentro `SitoGuard`.

Due principi governano ogni decisione:

**La superficie pubblica è chiusa per costruzione, non per disciplina.** Ogni volta che una scelta poteva risolversi con "ricordarsi di non esporre X", il design sceglie la forma in cui X non è nemmeno leggibile dal database. La proiezione SQL, i DTO record e i tre test strutturali sono tre strati della stessa idea.

**La regola di pubblicazione esiste una volta sola, e una seconda copia deve essere difficile da scrivere per sbaglio.** Non "vietata da un commento": resa faticosa. Chi volesse duplicarla dovrebbe scriverla, e un test la troverebbe leggendo i sorgenti.

Sei conseguenze divergono dalla lettera della proposal o del piano (§D3, §D5, §D6, §D8, §D9, §D10). Sono dichiarate, non nascoste, e riassunte nella tabella finale.

---

## Architecture Decisions

### D1 🔴 — La regola di pubblicazione: `Common/RegoleVetrina.cs`, e la seconda copia che esiste già

**Il vincolo.** [`ProdottoType.cs:49-61`](../../../backend/GraphQL/Vendite/Types/ProdottoType.cs) espone due campi derivati con una descrizione che è un divieto — *"chiunque filtri diversamente sta inventando un secondo criterio"* — ma sono **resolver**, non metodi chiamabili. Un `PublicController` che scrivesse `.Where(p => p.Attivo && p.VisibileSulSito)` produrrebbe esattamente ciò che il commento vieta.

🔴 **E la seconda copia esiste già oggi.** [`VetrinaMutations.cs:194`](../../../backend/GraphQL/Vetrina/VetrinaMutations.cs) contiene:

```csharp
.Where(p => p.ImmagineId == mediaAssetId && p.Attivo && p.VisibileSulSito)
```

Serve a elencare i prodotti pubblicati che usano un media che si sta ritirando. È **la stessa regola**, scritta una seconda volta, ed è già lì. Il change non sta prevenendo una duplicazione futura: ne sta risolvendo una presente. Senza questa correzione il criterio di successo *"nessuna seconda congiunzione `Attivo && VisibileSulSito`"* sarebbe rosso al primo `grep`.

**Choice.** Un file nuovo, `backend/Common/RegoleVetrina.cs`:

```csharp
namespace duedgusto.Common;

/// <summary>
/// Le due regole della vetrina, in un punto solo. Non è un helper di comodo: è il posto
/// che esiste perché non ce ne sia un secondo.
///
/// Vive in Common/ per la stessa ragione di CorsOriginPolicy: è logica pura — nessun
/// DbContext, nessun GraphQL, nessun HttpContext — quindi è esercitabile dai test senza
/// montare niente, ed è raggiungibile sia da un resolver sia da un controller senza che
/// nessuno dei due dipenda dall'altro.
/// </summary>
public static class RegoleVetrina
{
    /// <summary>
    /// L'UNICA espressione della regola di pubblicazione.
    ///
    /// 🔴 Expression e non Func: EF Core la traduce in SQL, quindi il filtro gira nel
    /// database e non in memoria. Un Func&lt;&gt; costringerebbe a materializzare l'intero
    /// listino a ogni richiesta anonima per poi scartarne la maggior parte — e sarebbe
    /// invisibile finché il listino resta piccolo.
    /// </summary>
    public static readonly Expression<Func<Prodotto, bool>> Pubblicato =
        prodotto => prodotto.Attivo && prodotto.VisibileSulSito;

    // ⚠️ Ordine testuale vincolante: gli inizializzatori di campo statici girano nell'ordine
    //    di dichiarazione. Compilato DEVE stare dopo Pubblicato, altrimenti compila null.
    private static readonly Func<Prodotto, bool> Compilato = Pubblicato.Compile();

    /// <summary>Stessa regola su un oggetto già in memoria. Non è una seconda scrittura:
    /// è la stessa espressione, compilata una volta sola.</summary>
    public static bool EPubblicato(Prodotto prodotto) => Compilato(prodotto);

    /// <summary>
    /// 🔴 Il fallback del prezzo. **0 è un prezzo valido (omaggio) e NON ricade sul
    /// listino: solo null è assenza.** Chi lo riscrive con "> 0" trasforma un omaggio nel
    /// prezzo pieno sul sito, senza alcun errore, e nessuno se ne accorge finché non
    /// arriva il cliente.
    ///
    /// Prende i due valori e non il Prodotto perché è così che resta usabile dopo una
    /// proiezione SQL, dove l'entità non esiste più (vedi §D2).
    /// </summary>
    public static decimal PrezzoEffettivo(decimal? prezzoVetrina, decimal prezzoListino) =>
        prezzoVetrina ?? prezzoListino;

    /// <summary>Zucchero per chi ha l'entità sotto mano. Delega, non reimplementa.</summary>
    public static decimal PrezzoEffettivo(Prodotto prodotto) =>
        PrezzoEffettivo(prodotto.PrezzoVetrina, prodotto.Prezzo);
}
```

Tre riscritture, tutte nel ramo vetrina, nessuna nel ramo cassa:

| Punto | Prima | Dopo |
|---|---|---|
| `ProdottoType.pubblicatoSulSito` | `ctx.Source.Attivo && ctx.Source.VisibileSulSito` | `RegoleVetrina.EPubblicato(ctx.Source)` |
| `ProdottoType.prezzoEffettivoVetrina` | `ctx.Source.PrezzoVetrina ?? ctx.Source.Prezzo` | `RegoleVetrina.PrezzoEffettivo(ctx.Source)` |
| `VetrinaMutations.cs:194` | `p.ImmagineId == id && p.Attivo && p.VisibileSulSito` | `.Where(p => p.ImmagineId == id).Where(RegoleVetrina.Pubblicato)` |

Le `Description` dei due campi GraphQL **restano identiche**: il contratto dello schema non cambia di un carattere, cambia solo chi calcola il valore.

**Alternatives considered.**
- *Campi persistiti (`PubblicatoSulSito` come colonna)*: andrebbero ricalcolati a ogni scrittura di `Attivo` — cioè da `UpsertProdottoAsync`, codice della cassa. È il confine che il change precedente esiste per difendere. E un campo derivato persistito può andare fuori sincrono; un campo derivato calcolato no, per costruzione.
- *Metodo di estensione su `Prodotto` (`prodotto.EPubblicato()`)*: leggibile, ma un metodo di estensione **non è traducibile da EF Core** in una `Where`. Si finirebbe con l'estensione per la memoria e una lambda per SQL: due scritture, cioè il problema di partenza.
- *Un `IQueryable<Prodotto> Pubblicabili(this AppDbContext db)` che incapsula anche la query*: nasconde la regola dietro un metodo che sa già troppo (quale DbSet, quale Include). L'espressione nuda si compone con qualunque query, incluse quelle che oggi non esistono.
- *Lasciare la regola in `ProdottoType` e farla chiamare dal controller*: significherebbe che un controller REST dipende da un tipo GraphQL. La direzione della dipendenza sarebbe sbagliata e il primo che volesse spostare un file lo scoprirebbe con un errore di compilazione incomprensibile.

**Rationale — e perché l'indice non è il vero argomento.**
`entity.HasIndex(x => x.VisibileSulSito)` esiste ed è etichettato *"Filtro dell'API pubblica di Fase 2"*. Onestamente: **su una colonna booleana con due valori distinti l'ottimizzatore MySQL sceglierà quasi sempre una scansione**, e su qualche centinaio di prodotti la differenza è nulla. Il motivo per cui `Expression` conta non è l'indice, è che **il filtro gira nel database**: la differenza fra "seleziona 40 righe" e "seleziona 900 righe e scartane 860" cresce con il listino e non si vede mai in sviluppo. L'indice resta un'opzione che l'ottimizzatore ha; la sargabilità è ciò che gliela lascia.

**Come si impedisce la seconda copia — tre strati.**

1. **La firma di `PrezzoEffettivo(decimal?, decimal)`** rende la funzione utilizzabile dopo una proiezione. Senza questa forma, il controller sarebbe *costretto* a riscrivere il `??` dentro la `Select`, e la duplicazione sarebbe imposta dal design invece che prevenuta.
2. **Il controller non costruisce il predicato**: usa `.Where(RegoleVetrina.Pubblicato)`. Non ha un posto naturale dove scrivere `Attivo &&`.
3. **Un test che legge i sorgenti**, perché i primi due strati proteggono da un errore, non dalla malizia distratta:

```csharp
// backend/DuedGusto.Tests/Unit/Common/RegolaPubblicazioneUnicaTests.cs
public class RegolaPubblicazioneUnicaTests
{
    // [CallerFilePath] è il percorso ASSOLUTO di QUESTO file, inciso a compile time.
    // È l'unico modo affidabile di risalire alla radice del repository da un test: la
    // directory di esecuzione è bin/Debug/net8.0 e AppContext.BaseDirectory cambia
    // fra "dotnet test", l'IDE e la CI.
    private static string RadiceBackend([CallerFilePath] string percorsoTest = "") =>
        Path.GetFullPath(Path.Combine(Path.GetDirectoryName(percorsoTest)!, "..", "..", ".."));

    [Fact]
    public void LaCongiunzioneDellaRegola_CompareInUnFileSolo()
    {
        // Non verifica il codice di oggi: impedisce la classe di errore di domani.
        // Se questo test è rosso, qualcuno ha riscritto la regola invece di chiamarla —
        // e il nome del file di troppo è nel messaggio di fallimento.
        var fileConLaCongiunzione = SorgentiApplicative()
            .Where(f => Regex.IsMatch(File.ReadAllText(f), @"Attivo\s*&&\s*\w*\.?VisibileSulSito"))
            .Select(NomeRelativo);

        fileConLaCongiunzione.Should().BeEquivalentTo("Common/RegoleVetrina.cs");
    }

    [Fact]
    public void IlFallbackDelPrezzo_CompareInUnFileSolo()
    {
        var fileConIlFallback = SorgentiApplicative()
            .Where(f => Regex.IsMatch(File.ReadAllText(f), @"PrezzoVetrina\s*\?\?"))
            .Select(NomeRelativo);

        fileConIlFallback.Should().BeEquivalentTo("Common/RegoleVetrina.cs");
    }

    // Esclude bin/, obj/, Migrations/ (generate) e il progetto di test stesso.
    private static IEnumerable<string> SorgentiApplicative() => …;
}
```

E la matrice comportamentale, quattro casi più tre, perché la struttura da sola non dice se la regola è *giusta*:

| `Attivo` | `VisibileSulSito` | `EPubblicato` |
|---|---|---|
| true | true | **true** |
| true | false | false |
| false | true | false ← il caso che il change precedente ha reso possibile e diagnosticabile |
| false | false | false |

| `PrezzoVetrina` | `Prezzo` | `PrezzoEffettivo` |
|---|---|---|
| `null` | 1.20 | **1.20** |
| **0** | 1.20 | **0** ← 🔴 il test che ci si dimentica |
| 0.90 | 1.20 | 0.90 |

---

### D2 🔴 — La superficie pubblica è chiusa per costruzione: proiezione, record, tre test

**Il rischio.** Un campo contabile in una risposta pubblica. Non è ipotetico: `/api/public/site` **compone `ImpostazioniVetrina` con `BusinessSettings`** (§2 della proposal), e `BusinessSettings` porta `VatRate`, `GiornaleImportoSabato`, `GiornaleImportoFeriale`, `SettingsId`, `CreatedAt`. Il punto di composizione è esattamente il punto in cui un campo di troppo sale a bordo senza che nessuno lo noti.

**Choice — quattro strati, in ordine di profondità.**

**(1) La proiezione SQL non legge le colonne contabili.** Non "non le serializza": **non le seleziona**.

```csharp
// La forma intermedia della SOLA query. Non esce mai da questo metodo e non è un DTO:
// esiste perché PrezzoEffettivo è una funzione C# e non un'espressione traducibile, quindi
// la SELECT porta a casa i due prezzi grezzi e la regola si applica in memoria, una volta,
// su un risultato già limitato a 300 righe.
private sealed record RigaMenu(
    int ProdottoId, string Nome, string? NomeVetrina, string? DescrizioneVetrina,
    string? CategoriaVetrina, decimal? PrezzoVetrina, decimal Prezzo,
    int OrdinamentoVetrina, string? Allergeni, bool Novita, bool Consigliato,
    string? Chiave, string? LarghezzeDisponibili, string? TestoAlternativo,
    string? Placeholder, string? Focale, int? Larghezza, int? Altezza);

List<RigaMenu> righe = await dbContext.Prodotti
    .Where(RegoleVetrina.Pubblicato)                       // §D1
    .OrderBy(p => p.OrdinamentoVetrina).ThenBy(p => p.ProdottoId)
    .Take(MenuLimiti.MaxItem)                              // §D7
    .Select(p => new RigaMenu(p.ProdottoId, p.Nome, p.NomeVetrina, …))
    .ToListAsync(cancellationToken);
```

Il `SELECT` generato **non contiene** `Codice`, `AliquotaIva`, `CreatedAt`, `UpdatedAt`, `Categoria`, `UnitaDiMisura`, `Attivo`. Nessun `Include` serve: la proiezione attraversa la navigazione `Immagine` e EF genera il `LEFT JOIN` da sola.

**(2) I DTO record non possiedono quei campi.** In `backend/Controllers/Public/Dto/`, namespace `duedgusto.Controllers.Public.Dto` — la collocazione conta, perché è ciò su cui il test (3) fa la scoperta per riflessione. `record` posizionali, `IReadOnlyList<T>` per le collezioni (un `T[]` è mutabile e un `IEnumerable<T>` non ha un `Count` da serializzare in modo deterministico).

**(3) Tre test strutturali**, nello spirito di [`ConfineVetrinaCassaTests`](../../../backend/DuedGusto.Tests/Unit/GraphQL/ConfineVetrinaCassaTests.cs) — file **nuovo**, `Unit/Controllers/SuperficiePubblicaTests.cs`, perché quello difende il confine *cassa ↔ vetrina* e questo difende il confine *privato ↔ pubblico*: due confini, due file, ognuno con la sua ragione scritta in testa.

```csharp
private static readonly string[] MaiInPubblico =
[
    // Cassa
    "Codice", "AliquotaIva", "Attivo", "Categoria", "UnitaDiMisura",
    // Metadati interni
    "CreatedAt", "UpdatedAt",
    // 🔴 BusinessSettings: /api/public/site compone le due entità, ed è QUI che
    //    l'aliquota IVA e il costo del giornale salirebbero a bordo senza farsi notare.
    "VatRate", "GiornaleImportoSabato", "GiornaleImportoFeriale", "SettingsId",
];

[Fact]
public void NessunDtoPubblico_PossiedeUnCampoContabile()
{
    // 🔴 RICORSIVO sui tipi annidati. Senza la ricorsione, MenuPubblicoDto passerebbe
    //    mentre CategoriaMenuDto, che è dentro di lui, porta il campo vietato.
    TipiRaggiungibiliDaiDto()                       // BFS dalle firme delle action
        .SelectMany(t => t.GetProperties().Select(p => (Tipo: t.Name, Campo: p.Name)))
        .Where(x => MaiInPubblico.Contains(x.Campo))
        .Should().BeEmpty();
}

[Fact]
public void OgniActionPubblica_RestituisceUnDtoEMaiUnEntita()
{
    // Il giorno in cui qualcuno passa da ActionResult<T> a IActionResult, il compilatore
    // smette di impedire "return Ok(prodotto)". Questo test no.
    typeof(PublicController).GetMethods(BindingFlags.Public | BindingFlags.DeclaredOnly | …)
        .Select(m => TipoRestituito(m))
        .Should().OnlyContain(t => t.Namespace == "duedgusto.Controllers.Public.Dto");
}

[Fact]
public void ProdottoPubblicoDto_HaEsattamenteQuestiCampi()
{
    // L'elenco esatto, non un sottoinsieme: un campo tolto rompe il sito in silenzio
    // (Astro legge undefined), un campo aggiunto è la fuga che questo file previene.
    typeof(ProdottoPubblicoDto).GetProperties().Select(p => p.Name).Should().BeEquivalentTo(
        "Id", "Nome", "Descrizione", "Prezzo", "Categoria" /* no: vedi nota */, …);
}
```

⚠️ **Nota di naming imposta dal test (3).** `Categoria` è nella lista dei vietati, quindi **nessun DTO pubblico può avere una property chiamata `Categoria`** — nemmeno quella della vetrina, che è legittima. La categoria di menu si chiama `Nome` dentro `CategoriaMenuDto`, e `MenuPubblicoDto` la contiene come `Categorie` (plurale, quindi non vietata). Non è un cavillo: costringe i nomi a restare non ambigui, e un falso positivo si risolve con un rename che rende il codice più chiaro.

**(4) Il tipo di ritorno è `ActionResult<TDto>`**, mai `IActionResult`. Il compilatore rifiuta `return Ok(prodotto)` prima che lo faccia un test.

**Alternatives considered.**
- *`[JsonIgnore]` sull'entità*: l'entità resterebbe l'oggetto serializzato e la protezione dipenderebbe da un attributo per campo. Aggiungere una property senza attributo è il default silenzioso — cioè il fallimento.
- *AutoMapper / mappatura per convenzione*: una convenzione che copia i campi con lo stesso nome è precisamente la macchina che porta a bordo il campo nuovo senza che nessuno lo scriva.
- *Un solo test "il JSON non contiene le chiavi vietate", eseguito sulla risposta reale*: prova oggi e non domani, ed è verde anche quando il campo esiste ma il valore è null. Resta come **criterio manuale** (`curl … | jq 'paths'`), non come rete.

**Rationale.** I quattro strati non sono ridondanti, coprono guasti diversi: (1) protegge dal database, (2) dal serializzatore, (3) dal futuro, (4) dal compilatore. Il costo totale è un record per rotta e un file di test.

---

### D3 — Cartella di galleria: `"galleria"`, normalizzata in scrittura, suggerita dal server

**Chiude la decisione aperta n. 1 della proposal.**

**Il vincolo verificato.** `Cartella` ha default `"generale"` in cinque punti e **nessun media ha mai avuto `"gallery"`**: la rotta del piano risponderebbe `[]` per sempre. Ma il problema non è l'etichetta — è che oggi `Cartella` è un **campo di testo libero** in due punti di [`MediaLibrary.tsx`](../../../duedgusto/src/components/pages/sito/MediaLibrary.tsx) (riga 206, "Cartella di destinazione", e riga 265, nel dialog di modifica), e l'unica normalizzazione è `.Trim()` con fallback su `"generale"` ([`VetrinaMutations.cs:203`](../../../backend/GraphQL/Vetrina/VetrinaMutations.cs)). Nessun `ToLower`.

**Choice — tre mosse.**

**1. L'etichetta è `"galleria"`, minuscola, in italiano.** Non `"gallery"`.

| | |
|---|---|
| Il codebase è italiano fin dentro i dati | `Cartella`, `Pubblicato`, `Ordinamento`, `NomeVetrina`, `"generale"`. `"gallery"` sarebbe **l'unico valore di dato in inglese** del progetto |
| La rotta si chiama `/api/public/galleria` | Rotta `galleria` che filtra su `gallery` è una traduzione che esiste solo nella testa di chi l'ha scritta. Con lo stesso nome, la relazione è ispezionabile: `grep galleria` trova entrambe |
| Non costa niente | Nessun dato da migrare, nessun `"gallery"` esistente. La scelta è libera **oggi** e non lo sarà più dopo il primo upload |

**2. Si normalizza in scrittura, non in lettura.** `Cartella` diventa `minuscolo + Trim` in `AggiornaMediaAssetAsync` e nel percorso di upload, con una costante condivisa:

```csharp
// backend/Services/Media/CartelleVetrina.cs
public static class CartelleVetrina
{
    public const string Generale = "generale";
    public const string Galleria = "galleria";

    /// <summary>Elenco suggerito, non insieme chiuso: le Fasi 3-5 ne aggiungeranno
    /// (eventi, promozioni, hero) e una lista chiusa richiederebbe un deploy per ognuna.</summary>
    public static readonly string[] Suggerite = [Generale, Galleria];

    /// <summary>Una cartella ha UNA sola forma. Senza questo, "Galleria" e "galleria"
    /// sono due raggruppamenti distinti nella libreria — e sul sito ne compare uno solo.</summary>
    public static string Normalizza(string? valore) =>
        string.IsNullOrWhiteSpace(valore) ? Generale : valore.Trim().ToLowerInvariant();
}
```

⚠️ **Perché non basta affidarsi alla collation.** `MediaAssets` usa `utf8mb4_unicode_ci`: su MySQL `Cartella == "galleria"` **matcha già** `"Galleria"`. Ma il provider InMemory dei test confronta in modo ordinale, quindi un test verde in `dotnet test` non dice nulla sul comportamento in produzione — e viceversa. La normalizzazione in scrittura fa coincidere i due mondi, e rende il valore persistito canonico invece che *equivalente*.

⚠️ **E perché non si normalizza in lettura.** `.Where(m => m.Cartella.ToLower() == "galleria")` diventa `LOWER(Cartella) = …` in SQL: non sargabile, l'indice `(Cartella, Ordinamento)` smette di essere utilizzabile per il *range scan* ordinato. La lettura resta un confronto di uguaglianza secco.

**3. È selezionabile, non solo digitabile.** I due `TextField` di `MediaLibrary` diventano un **`Autocomplete freeSolo`** MUI, con opzioni = `CartelleSuggerite` (dal server) ∪ cartelle già presenti negli asset caricati. È il pattern **già usato nella stessa feature**: [`VetrinaProdottiList.tsx:66`](../../../duedgusto/src/components/pages/sito/VetrinaProdottiList.tsx) costruisce così i valori di `categoriaVetrina` per l'`agRichSelectCellEditor` con `allowTyping: true`. Nessun modello mentale nuovo.

**Da dove arriva la stringa al frontend.** Non da una costante duplicata in TypeScript: da **`GET /api/media/configurazione`**, che `MediaLibrary` legge già al mount ([riga 76-103](../../../duedgusto/src/components/pages/sito/MediaLibrary.tsx)). Si aggiunge un campo al DTO esistente:

```csharp
public record MediaConfigurazioneDto(
    long MaxByteFile, int MaxMegapixel, int[] LarghezzeVarianti, string[] MimeAmmessi,
    string[] CartelleSuggerite);   // ← nuovo
```

È lo stesso argomento di §D1 del change precedente, applicato a un dato diverso: *il frontend non può divergere dal backend perché non ha un proprio valore da far divergere*. Qui la divergenza avrebbe una forma precisa e insidiosa — l'admin tagga `"Galleria"` da una tendina che il frontend ha scritto per conto suo, la rotta filtra su `"galleria"`, e **la galleria del sito resta vuota senza alcun errore da nessuna parte**.

**Alternatives considered.**
- *`"gallery"` come da piano*: unico valore inglese nel modello dati, e la rotta italiana che lo filtra. Il piano è anteriore all'implementazione della Fase 1, che ha stabilito l'italiano fin dentro i valori di default.
- *Insieme chiuso (enum + colonna vincolata)*: l'Open Question 3 del design precedente lo rimandava *"a quando si sapranno le cartelle vere"*. Non si sanno ancora: le Fasi 3-5 ne porteranno almeno tre (`eventi`, `promozioni`, `hero`, forse `piatto-del-giorno`). Un enum oggi significa una migrazione per ogni cartella futura. L'`Autocomplete freeSolo` dà la scopribilità di una lista senza la rigidità.
- *Un flag booleano `InGalleria` su `MediaAsset` invece della cartella*: sarebbe più esplicito, ma è una migrazione su una tabella esistente in un change che ne prometteva zero, e moltiplicherebbe i booleani a ogni fase (`InEventi`, `InHero`…). La cartella è già l'asse di raggruppamento, e ha già il suo indice.
- *Riempire la galleria con tutti i media pubblicati, senza filtro di cartella*: la rotta risponderebbe subito qualcosa, e mostrerebbe sul sito **le foto dei prodotti** insieme a quelle di ambiente. La galleria diventerebbe "tutto ciò che è stato caricato", che non è una scelta editoriale.

**Rischio residuo dichiarato.** Una galleria vuota è uno stato legittimo (nessuno ha ancora taggato niente) e indistinguibile da una configurazione sbagliata. La diagnosi vive in admin: la libreria mostra la cartella su ogni card e l'`Autocomplete` elenca quelle esistenti, quindi *"quante immagini ci sono in galleria"* è una domanda a cui si risponde guardando la pagina, non il database.

---

### D4 — Caching: un contratto di header, non una cache. E il numero senza spazio

**Il vincolo verificato.** `grep -rn "proxy_cache" deploy/nginx/` → **zero risultati**; gli unici `expires` sono su `location /media/` (riga 64) e `/assets/` (riga 76). In `Program.cs` non c'è né `AddResponseCaching` né `AddOutputCache`. **Non esiste alcuna cache**, da nessuna parte, per le rotte API.

**Choice.** Le tre rotte dichiarano `[ResponseCache]`, e nient'altro cambia.

```csharp
[HttpGet("site")]     [ResponseCache(Duration = 300, Location = ResponseCacheLocation.Any)]
[HttpGet("menu")]     [ResponseCache(Duration = 60,  Location = ResponseCacheLocation.Any)]
[HttpGet("galleria")] [ResponseCache(Duration = 300, Location = ResponseCacheLocation.Any)]
```

`ResponseCacheAttribute` è un **filtro che scrive header**: non richiede il middleware di response caching, che infatti non si registra. Nulla viene memorizzato lato server in questa fase.

| Rotta | `Cache-Control` | Perché quel numero |
|---|---|---|
| `site` | `public,max-age=300` | Identità del locale: cambia quando l'admin la modifica, cioè quasi mai. 300s è **il ritardo massimo fra "salvo l'indirizzo" e "lo vedo sul sito"**, ed è esattamente ciò che il criterio di successo della proposal misura |
| `menu` | `public,max-age=60` | Il listino cambia durante la giornata. 60s è **lo stesso numero** del `proxy_cache_valid 200 60s` che il piano §8 prescrive per Fase 6: dichiararlo qui significa che nginx non dovrà sovrascriverlo, e che i due valori non possono divergere perché sono la stessa decisione scritta due volte di proposito |
| `galleria` | `public,max-age=300` | Come `site`: contenuto editoriale, cambia a mano |

⚠️ **Il dettaglio che fa fallire un criterio scritto alla lettera.** ASP.NET Core emette `Cache-Control: public,max-age=300` — **senza spazio dopo la virgola**. La proposal scrive il criterio come `public, max-age=300`. Non è un bug: è la stessa direttiva. Il criterio va verificato leggendo l'header (`curl -sI … | grep -i cache-control`), non confrontando una stringa letterale, e un test lo pinna in modo robusto sui metadati:

```csharp
[Theory]
[InlineData(nameof(PublicController.Menu), 60)]
[InlineData(nameof(PublicController.Site), 300)]
[InlineData(nameof(PublicController.Galleria), 300)]
public void OgniRotta_DichiaraLaSuaCache(string azione, int durata)
{
    var attributo = typeof(PublicController).GetMethod(azione)!
        .GetCustomAttribute<ResponseCacheAttribute>();
    attributo!.Duration.Should().Be(durata);
    attributo.Location.Should().Be(ResponseCacheLocation.Any);   // → "public"
}
```

**Alternatives considered.**
- *Header scritto a mano (`Response.Headers.CacheControl = "public, max-age=300"`)*: darebbe il controllo sulla stringa esatta, ma sposta la politica di cache dentro il corpo del metodo, dove si legge dopo il codice invece che prima. L'attributo la mette nella firma, dove un lettore la vede insieme alla rotta.
- *`AddOutputCache` con cache server-side già adesso*: sarebbe una cache vera, ma **duplicherebbe** ciò che nginx farà in Fase 6, con due TTL da tenere allineati e un invalidamento in più da capire quando l'admin salva. Il piano ha già deciso dove sta la cache: nel reverse proxy.
- *`stale-while-revalidate=60`*: gratis e utile per il browser, ma il piano §8 ottiene la stessa proprietà lato server con `proxy_cache_use_stale` + `proxy_cache_background_update`. Due meccanismi con lo stesso scopo e numeri diversi sono un modo per farli divergere. Scartato per non aggiungere un secondo posto in cui la staleness è configurata.
- *`ETag` / `If-None-Match`*: ASP.NET non li genera da solo su un JSON di controller, e Astro legge server-side senza gestirli. Costo non nullo, beneficio nullo a questa scala.

**Rationale — perché emetterlo adesso rende corretto il micro-cache di poi.**
nginx, con `proxy_cache` attivo, **onora il `Cache-Control` dell'upstream**: `proxy_cache_valid` si applica alle risposte che non ne portano uno. Emetterlo oggi significa che in Fase 6 basta aggiungere `proxy_cache_path` + `proxy_cache` e ogni rotta si comporta come deve, senza una riga di configurazione per rotta. Ometterlo significa scoprire in Fase 6 che il TTL va deciso in un secondo posto, dove nessuno lo collegherà più alla natura del dato. Il costo oggi è una riga per rotta.

**`Set-Cookie` e il perché la cache resta corretta.** Le tre rotte sono anonime e non toccano i cookie; nella pipeline nulla ne imposta su una GET (`AuthController` lo fa solo su signin/refresh). nginx, per default, **non cachea una risposta che porta `Set-Cookie`** — quindi anche nell'ipotesi peggiore il guasto sarebbe una cache che non funziona, non una cache che serve il cookie di un altro. Resta un criterio da verificare a mano con `curl -I`, perché un test unitario sul controller non vede i middleware.

**`Vary: Origin`.** Il middleware CORS aggiunge `Vary: Origin` **solo** quando la richiesta porta un header `Origin`, cioè mai sul percorso caldo (Astro legge server-side, senza browser). Con la policy di §D5 l'`Access-Control-Allow-Origin` diventa per di più una costante (`*`), quindi la risposta non varia affatto e il micro-cache di Fase 6 avrà **una sola variante per URL**. Le due decisioni si tengono: non è una coincidenza, è il motivo per cui §D5 sceglie quella policy.

---

### D5 — CORS: policy dedicata senza credenziali. E `localhost:4321` è **già** ammesso

**Chiude la decisione aperta n. 3 della proposal.**

**La verifica che cambia la domanda.** [`CorsOriginPolicy.OrigineAmmessa`](../../../backend/Common/CorsOriginPolicy.cs) confronta `uri.Host`, **ignorando la porta**, e la riga 69 è:

```csharp
if (host == "localhost" || host == "127.0.0.1") return true;
```

Quindi **`http://localhost:4321` è già un'origine ammessa oggi**, senza toccare nulla. Il rischio della proposal — *"bloccante per il change successivo"* — **non esiste**. Non serve aggiungere niente ad `ALLOWED_ORIGINS`, e chi lo facesse aggiungerebbe una riga che non ha effetto. È una proprietà non ovvia (si legge "allowlist di host" e si assume che la porta conti) e va scritta, perché altrimenti verrà "risolta" di nuovo fra un mese.

**Choice.** Nonostante ciò, **una seconda policy CORS dedicata al solo `PublicController`**:

```csharp
// Program.cs, accanto ad AllowSpecificOrigins
options.AddPolicy("PubblicaSenzaCredenziali", policy => policy
    .AllowAnyOrigin()          // "*" — costante, quindi NESSUN Vary: Origin (vedi §D4)
    .WithMethods("GET")
    .AllowAnyHeader());
    // 🔴 NIENTE AllowCredentials(): "*" e le credenziali sono mutuamente esclusivi per
    //    specifica, e qui è una virtù — questa famiglia di rotte non può diventare un
    //    vettore credenziale nemmeno per errore di configurazione futuro.
```

```csharp
[AllowAnonymous]
[EnableCors("PubblicaSenzaCredenziali")]
[Route("api/public")]
[ApiController]
public class PublicController(…) : ControllerBase
```

**Il motivo decisivo non è la sicurezza: è la cache.** Sotto la policy globale, un browser da un'origine ammessa riceve `Access-Control-Allow-Origin: https://…` **+ `Vary: Origin`** su una risposta dichiarata `public, max-age=300`. Una cache condivisa che non onori `Vary` servirebbe l'header di un'origine a un'altra. nginx onora `Vary`, quindi il guasto non si materializzerebbe — ma la difesa dipenderebbe da un comportamento del proxy invece che dalla forma della risposta. Con `*`, l'header è una **costante**: non c'è variante, non c'è `Vary`, non c'è la classe di bug.

**Il secondo motivo è di onestà del contratto.** Restringere per origine una API che risponde a chiunque con `curl` non protegge nulla: CORS è un controllo sul *browser*, e protegge letture **credenziali**. Qui non ce ne sono. Dichiarare `*` senza credenziali descrive esattamente ciò che la rotta è: dati pubblici, leggibili da chiunque, mai con i cookie di qualcuno.

⚠️ **Il dettaglio di ordinamento che la romperebbe in silenzio.** `[EnableCors("…")]` funziona perché il middleware CORS legge i **metadati dell'endpoint**, e l'endpoint è già stato selezionato: `WebApplication` inserisce `UseRouting` all'inizio della pipeline quando non è chiamato esplicitamente, quindi `app.UseCors(…)` alla riga 260 gira **dopo** la selezione. Il giorno in cui qualcuno aggiungesse un `app.UseRouting()` esplicito **dopo** `UseCors`, l'attributo smetterebbe di avere effetto e le rotte pubbliche tornerebbero silenziosamente sotto la policy globale credenziale. Merita un commento accanto a `UseCors` in `Program.cs`.

**Alternatives considered.**
- *Non fare nulla* (la policy globale basta, e `localhost:4321` è già dentro): tecnicamente funziona, ed è la scelta più piccola. Persa: la proprietà di cache a variante unica, e la garanzia che una rotta pubblica non possa mai essere chiamata con credenziali. Costo dell'alternativa scelta: sette righe.
- *Aggiungere `localhost:4321` ad `ALLOWED_ORIGINS`*: **è un no-op** — la porta non viene guardata. Sarebbe una riga di configurazione che sembra fare qualcosa e non fa niente, cioè peggio di nessuna riga.
- *`WithOrigins("https://www.duedgusto.com")` sulla policy pubblica*: legherebbe il backend al dominio prima che il dominio esista, e in Fase 6 il percorso caldo sarà **same-origin attraverso nginx** (piano §8), dove CORS non entra mai in gioco. Si configurerebbe oggi una cosa che domani non viene usata.
- *Estendere la policy globale invece di aggiungerne una*: allargherebbe **anche** `/graphql` e `/api/auth/*`, che sono credenziali. È esattamente l'errore che il commento di `location /api/media` in nginx documenta nel dominio dei limiti di corpo.

**Rinviato consapevolmente a Fase 6:** il `location /api/public/` in nginx con il micro-cache e l'inoltro alla vetrina. Questo change non tocca `deploy/`.

---

### D6 — Rate limiting delle GET pubbliche: **no**, e il perché è verificato nel codice

**Chiude la decisione aperta n. 2 della proposal.**

**Choice. Nessun rate limit applicativo sulle tre GET.** Non per pigrizia: perché il meccanismo disponibile, su queste rotte, **non fa ciò che sembra fare**. Tre verifiche.

**1. La chiave è falsificabile.** [`AuthRateLimitMiddleware.GetClientIpAddress`](../../../backend/Middleware/AuthRateLimitMiddleware.cs) (righe 106-125) prende `X-Forwarded-For` **senza validarlo** e senza sapere se davanti c'è un proxy fidato. La chiave del contatore è quindi scelta dal chiamante: un abusatore ruota un header e ha contatori illimitati, mentre un client onesto — che l'header non lo manda — resta l'unico davvero limitato. Un limitatore che frena solo chi non sta abusando non è una mitigazione.

**2. Il dizionario perde memoria, e le GET pubbliche lo farebbero perdere più in fretta.** `_requestHistory` è una `ConcurrentDictionary` **statica** che cresce di una voce per ogni coppia `(ip, path)`. `CleanupOldEntries()` esiste (riga 131) ed è documentata come *"should be called periodically by a background service"* — verifica: `grep -rn "CleanupOldEntries" backend/` trova **solo la definizione e due chiamate nei test**. Nessun servizio la invoca. Oggi il danno è contenuto perché le due rotte limitate sono di login, con pochi IP distinti. Agganciarci la rotta più fetchata di un sito pubblico significa una voce permanente per ogni IP che passa: **una perdita di memoria proporzionale al traffico anonimo, su un VPS piccolo**.

**3. La protezione vera è già progettata, e non è un contatore.** Con `max-age=60` (§D4) e il micro-cache di Fase 6 con `proxy_cache_lock on`, nginx **collassa le richieste concorrenti identiche in una sola verso l'upstream**: il rate effettivo su `/api/public/menu` è ≤ 1 richiesta al minuto verso .NET, indipendentemente dal numero di visitatori. E ogni risposta ha **costo fisso**: nessun parametro di query, nessun `where` libero, nessuna paginazione, tetto di 300 item (§D7). Non esiste un input che un chiamante possa usare per amplificare il lavoro del server.

**E l'asimmetria da scrivere adesso**, perché la Fase 4 farà la scelta opposta e deve poterla fare senza rileggere questo documento: il piano §7 prescrive `{ "/api/public/prenotazioni", (3, 60) }` nel dizionario. **È corretto e non contraddice questa decisione**: quella rotta *scrive a database e manda email*, non è cacheabile, e il costo per richiesta non è limitato. Il criterio è "GET cacheabile a costo fisso: no; POST che scrive: sì", e va scritto come commento dentro `RateLimitedPaths`, dove lo leggerà chi aggiungerà la voce.

**Alternatives considered.**
- *Aggiungere le tre GET al dizionario* ("costa una riga"): costa una riga e produce le tre proprietà sbagliate del punto 1-2. Disponibile in qualunque momento se servisse davvero — ma se servisse, servirebbe **corretta**, cioè nel punto 3 qui sotto.
- *Un `limit_req_zone` in nginx*: è il posto **giusto** per un rate limit, perché nginx vede l'IP reale della connessione e non può essere ingannato da un header. Ma vive in `deploy/`, che questo change non tocca (§4 della proposal), ed è naturale insieme al server block della vetrina in Fase 6. **È la raccomandazione se il problema si presenterà**, ed è l'unica cosa da ricordare di questa decisione.
- *`AddRateLimiter` di .NET 8 (`FixedWindowLimiter` con partizione per IP)*: sostituirebbe un middleware artigianale con quello di piattaforma, ma è un cambiamento all'intero sistema di rate limiting dell'app in un change che parla d'altro, e resterebbe con lo stesso problema di chiave del punto 1. Candidato per un change dedicato alla sicurezza, non per questo.

**Rischio residuo dichiarato.** Fino a Fase 6 (nessun micro-cache) un flood anonimo arriva a MySQL con una query limitata a 300 righe. Su questo VPS è un carico assorbibile e visibile nei log di nginx; la mitigazione, se serve, è un `limit_req_zone` e non una riga nel dizionario.

---

### D7 — Il limite di 300 si dichiara; e come si raggruppa un menu senza inventare un'entità

**Il vincolo.** `Take(300)` nudo tronca **senza dirlo**: il sito mostrerebbe un menu incompleto e nessuno lo saprebbe mai.

**Choice.**

```csharp
public record MenuPubblicoDto(
    IReadOnlyList<CategoriaMenuDto> Categorie,
    int TotaleProdottiPubblicati,   // conteggio REALE, non la lunghezza della lista
    int LimiteApplicato,            // 300, dal server: il consumatore non lo indovina
    bool Troncato);                 // TotaleProdottiPubblicati > LimiteApplicato
```

Il conteggio è una `CountAsync()` separata sullo stesso predicato — una seconda query indicizzata, non una scansione dei risultati. Al superamento del limite si emette un `LogWarning` con il totale. **Chi guarda il sito vede meno piatti; chi guarda i log sa perché.**

**Raggruppamento.** Per `CategoriaVetrina`. Un prodotto pubblicato **senza** categoria di vetrina finisce in un gruppo `"Altro"` e **non sparisce**: una sparizione silenziosa è la stessa classe di guasto del troncamento muto, e la diagnosi esiste già — `VetrinaProdottiList` mostra `categoriaVetrina` come colonna modificabile.

🔴 **Mai ricadere su `Categoria` (contabile).** Sarebbe la strada più breve per far comparire "BEVANDE" come intestazione sul sito, e `Categoria` è nella lista dei nomi vietati di §D2 proprio perché la tentazione è a portata di mano.

**Ordinamento.**

| Livello | Criterio | Perché |
|---|---|---|
| Categorie | minimo `OrdinamentoVetrina` dei prodotti che contengono, poi nome | Non esiste un'entità `CategoriaVetrina` con un suo ordine, quindi non c'è un dato su cui ordinare. Questo criterio dà **una leva reale all'admin** (metti `OrdinamentoVetrina = 1` su un prodotto e la sua categoria sale) senza aggiungere un'entità |
| Prodotti | `OrdinamentoVetrina`, poi `NomeVetrina ?? Nome`, poi `ProdottoId` | Il terzo criterio serve a rendere l'ordine **totale**: senza, due prodotti con lo stesso ordinamento e lo stesso nome cambiano posizione fra una richiesta e l'altra, e la cache di 60s serve pagine diverse a visitatori diversi |

⚠️ Il troncamento si applica **prima** del raggruppamento (`Take` sulla query ordinata): con 301 prodotti si perde l'ultimo per ordinamento, non un'intera categoria a caso.

**`Id` nel DTO.** Il `ProdottoId` interno viene esposto. Non è un segreto e non sblocca nulla (non esiste una rotta pubblica per singolo prodotto), e serve come chiave stabile lato Astro. L'alternativa — uno slug — è materia della Fase 3, quando serviranno URL per singolo contenuto.

**Alternatives considered.**
- *Paginazione*: un menu da bar è una pagina sola, e paginarlo significherebbe che il crawler indicizza metà listino.
- *`Take(300)` senza dichiararlo*: è il caso che questa decisione esiste per escludere.
- *Limite configurabile da `ImpostazioniVetrina`*: un numero che protegge da un guasto non va messo dove chi subisce il guasto può alzarlo. Costante in `MenuLimiti`, pinnata da un test, come `MediaLimiti` in Fase 1.

---

### D8 — Singleton irrigidito: id fisso, `ValueGeneratedNever`, e un `CHECK` che il database fa rispettare

**Chiude la decisione aperta n. 4 della proposal.**

**Il precedente.** `BusinessSettings` è un singleton **per convenzione**: nessun vincolo, chiave auto-incrementale, e tre letture con `FirstOrDefaultAsync()` senza `OrderBy` ([`SettingsQueries.cs:24`](../../../backend/GraphQL/Settings/SettingsQueries.cs), [`SettingsMutations.cs:36`](../../../backend/GraphQL/Settings/SettingsMutations.cs), [`Program.cs:360`](../../../backend/Program.cs)). Funziona perché il seed inserisce una riga e nessuno ne inserisce altre.

**Choice — irrigidire, e senza inventare un meccanismo nuovo.**

```csharp
public class ImpostazioniVetrina
{
    public const int IdSingleton = 1;
    public int ImpostazioniVetrinaId { get; set; } = IdSingleton;
    …
}
```

```csharp
modelBuilder.Entity<ImpostazioniVetrina>(entity =>
{
    entity.ToTable("ImpostazioniVetrina", t => t.HasCheckConstraint(
        "CK_ImpostazioniVetrina_Singleton", "`ImpostazioniVetrinaId` = 1"))
        .HasCharSet("utf8mb4").UseCollation("utf8mb4_unicode_ci")
        .HasKey(x => x.ImpostazioniVetrinaId);

    // 🔴 ValueGeneratedNever: l'id è un valore di dominio ("la riga"), non un contatore.
    //    Con l'auto-increment, un INSERT senza id creerebbe la riga 2 in silenzio.
    entity.Property(x => x.ImpostazioniVetrinaId).ValueGeneratedNever();
    …
});
```

Il `CHECK` è **l'unico strato che nessuno può saltare** — vale anche per un `INSERT` scritto a mano in una sessione MySQL alle due di notte. MySQL 8.0.16+ li applica davvero (non li ignora come le versioni precedenti), e il progetto richiede 8.0+ (`CLAUDE.md`; il design-time usa `MySqlServerVersion(8,0,32)`).

Lettura e scrittura passano da `IdSingleton`, mai da `FirstOrDefault`:

```csharp
ImpostazioniVetrina? impostazioni = await db.ImpostazioniVetrina
    .Include(x => x.ImmagineOg)
    .FirstOrDefaultAsync(x => x.ImpostazioniVetrinaId == ImpostazioniVetrina.IdSingleton);
```

**Perché non replicare il pattern permissivo.** I due casi non sono simmetrici. `BusinessSettings` è scritta da una schermata, da un tipo di utente, ed è lì da anni. `ImpostazioniVetrina` è scritta da un admin, **seedata all'avvio**, e **letta da una rotta anonima**. Un duplicato lì produce il guasto peggiore possibile per un dato pubblico: **il sito mostra un indirizzo e l'admin ne modifica un altro**, con zero errori da qualunque parte si guardi. Il costo della prevenzione è una riga in `OnModelCreating`.

**Perché non irrigidire anche `BusinessSettings`.** Sarebbe una migrazione su una tabella letta e scritta da cassa e chiusure mensili, in un change che ha promesso di non toccare nulla di esistente. Va **annotato come candidato** per un change dedicato: una riga di configurazione, ma con i suoi test e la sua verifica su dati reali.

**Il seed crea e non aggiorna.**

```csharp
// backend/SeedData/SeedImpostazioniVetrina.cs — stessa forma di SeedBusinessSettings
if (!await dbContext.ImpostazioniVetrina.AnyAsync())
{
    dbContext.ImpostazioniVetrina.Add(new ImpostazioniVetrina { /* dati reali del locale */ });
    await dbContext.SaveChangesAsync();
}
// 🔴 Nessun UpdateIfNeeded, deliberatamente e al contrario di SeedMenus: un menu
//    riallineato è desiderabile, un indirizzo riscritto a ogni restart è perdita di lavoro.
```

⚠️ **La conseguenza da scrivere adesso.** Poiché il seed salta quando la riga esiste, **ogni colonna aggiunta in una fase futura non riceverà mai il valore del seed** sulle installazioni già avviate: prenderà il default EF/database. Quindi un campo con un valore iniziale sensato deve avere quel valore in `OnModelCreating`, **non solo** nel seed. Vale già ora per `OraInizioTemaSera` (`"18:00"`) e `PrenotazioniPreavvisoOre`.

Dati reali del locale (piano, "Dati reali del locale"): insegna **2D Gusto Bar**, Via del Costo 99, 36016 Thiene (VI), Instagram `https://www.instagram.com/2dgusto/`.

---

### D9 — Admin: ramo query `vetrina` + mutation ad assegnazione totale (e perché non si copia `updateBusinessSettings`)

**Choice.** Nuovo ramo root `vetrina` fra le **query**, accanto a quello che già esiste fra le mutation:

```csharp
// GraphQLQueries.cs
Field<VetrinaQueries>("vetrina").Resolve(context => new { });
```

```csharp
public class VetrinaQueries : ObjectGraphType
{
    public VetrinaQueries()
    {
        this.Authorize();   // ← copertura AUTOMATICA di AutorizzazioneAnonimaTests

        Field<ImpostazioniVetrinaType, ImpostazioniVetrina>("impostazioni")
            .ResolveAsync(async context =>
            {
                AppDbContext db = GraphQLService.GetService<AppDbContext>(context);
                await GuardAmministratore(context, db);   // 🔴 anche in LETTURA
                return await LeggiImpostazioniAsync(db);
            });
    }
}
```

⚠️ **`AutorizzazioneAnonimaTests.SchemaEspone_TuttiIRamiRootAttesi` diventerà rosso**, e va aggiornato aggiungendo `"vetrina"` all'elenco delle query. È il comportamento **progettato**: quel test è la sveglia che dice "è nato un ramo root, hai verificato che sia autorizzato?". Le tre `Theory` enumerative coprono il ramo nuovo da sole, senza che nessuno le tocchi.

🔴 **Perché il guard amministratore anche sulla lettura, dato che gli stessi dati escono anonimi da `/api/public/site`?** Perché **non sono gli stessi dati**: il tipo admin espone `TurnstileSiteKey`, i tre campi prenotazione e tutto ciò che le Fasi 3-5 aggiungeranno (note interne, chiavi, flag operativi), mentre il DTO pubblico espone un sottoinsieme scelto a mano. Il guard è ciò che impedisce a quell'asimmetria di diventare un caso. Ed è il **precedente già stabilito nel progetto**: `connection { mediaAssets }` porta `GuardUtenteAmministratore` in lettura con una motivazione scritta a [`ConnectionQueries.cs:281-285`](../../../backend/GraphQL/Connection/ConnectionQueries.cs) — *"in questa fase non esiste alcun consumatore non amministrativo… aprirla dopo è una riga; accorgersi che era aperta è un incidente"*. Stessa situazione, stessa scelta. E soddisfa un criterio di successo esplicito della proposal.

**La mutation, nel `VetrinaMutations` esistente:**

```csharp
Field<ImpostazioniVetrinaType>("mutateImpostazioniVetrina")
    .Argument<NonNullGraphType<ImpostazioniVetrinaInputType>>("input")
    .ResolveAsync(async context =>
    {
        AppDbContext db = GraphQLService.GetService<AppDbContext>(context);
        await GuardAmministratore(context, db);        // prima istruzione, come le altre tre
        return await ApplicaImpostazioniVetrinaAsync(
            db, context.GetArgument<ImpostazioniVetrinaInput>("input"));
    });
```

**Nessun argomento `impostazioniVetrinaId`.** C'è una riga sola e il resolver sa quale: accettare un id sarebbe invitare qualcuno a passarne un altro. Il resolver fa **upsert su `IdSingleton`** — crea la riga se manca (installazione con `SEED_ON_STARTUP=false`), la aggiorna se c'è.

🔴 **Divergenza dichiarata dallo stile di `SettingsMutations.updateBusinessSettings`.** Quel resolver assegna con `if (!string.IsNullOrEmpty(input.X))` (righe 46-80): il risultato è che **un campo non si può svuotare**. Cancellare l'URL Facebook e salvare lascia il vecchio valore, senza errore. È un difetto reale del codice esistente, e copiarlo qui lo importerebbe in un'entità dove i campi opzionali sono la maggioranza. Si usa invece l'**assegnazione totale** di `ApplicaCampiVetrinaAsync` (`VetrinaMutations.cs:144-156`), sicura per la stessa ragione: l'input possiede **esattamente** i campi scrivibili e nient'altro, quindi non c'è nulla da ricordarsi di preservare. Con la stessa normalizzazione del vuoto: `NullSeVuoto` — stringa vuota e soli spazi diventano `null`, una sola rappresentazione dell'assenza.

**Validazioni nel resolver, `ExecutionError` in italiano**, sullo stile già presente:
- `OraInizioTemaSera` deve essere `HH:mm` (stesso formato di `OpeningTime`/`ClosingTime`, che il frontend valida con `/^\d{2}:\d{2}$/`);
- `Latitudine ∈ [-90, 90]`, `Longitudine ∈ [-180, 180]` quando valorizzate — e valorizzate **insieme o nessuna delle due**: mezza coordinata è un punto sull'equatore, cioè un dato peggiore di un dato mancante;
- gli URL social devono essere assoluti `http(s)` — si persistono **URL completi, non handle**, così nessun consumatore deve sapere come si costruisce un indirizzo Instagram, e il `sameAs` del JSON-LD (piano §6) è una copia diretta;
- `ImmagineOgId`, se valorizzato, deve esistere ed essere `Pubblicato`, con **lo stesso identico messaggio d'errore** di `ApplicaCampiVetrinaAsync` (righe 120-135). Due formulazioni diverse per la stessa regola sono due regole, agli occhi di chi legge il messaggio.

**Alternatives considered.**
- *Mettere `impostazioni` in `SettingsQueries`*: metterebbe i dati del sito nel ramo che la cassa legge per orari e IVA, cioè la stessa fusione che §2 della proposal rifiuta a livello di entità. Il ramo dice al lettore in che territorio si trova.
- *Rotta REST admin `PUT /api/vetrina/impostazioni`*: contraddirebbe la dottrina scritta due volte nel codice (REST = pubblico, GraphQL = privato) e rinuncerebbe alla copertura automatica di `AutorizzazioneAnonimaTests`.

---

### D10 🔴 — L'immagine OG apre un **secondo** referente di `MediaAsset`, e oggi l'eliminazione lo ignora

**Il guasto che questo change introdurrebbe senza accorgersene.** [`EliminaMediaAssetAsync`](../../../backend/GraphQL/Vetrina/VetrinaMutations.cs) (righe 226-255) verifica i riferimenti **solo** su `Prodotti`, poi:

```csharp
await storage.EliminaAsync(asset.Chiave);   // ① i file spariscono dal disco
dbContext.MediaAssets.Remove(asset);
await dbContext.SaveChangesAsync();          // ② e SOLO ORA il database dice di no
```

L'ordine è deliberato ed è giusto per il caso previsto (*"se la cancellazione dei file fallisce, la riga resta e l'operazione è ripetibile"*). Ma con `ImpostazioniVetrina.ImmagineOgId` e `DeleteBehavior.Restrict`, il ② solleva un errore **grezzo di foreign key** — **dopo** che ① ha già cancellato gli otto file. Esito: riga presente, file spariti, immagine OG rotta su ogni condivisione social, e un messaggio MySQL incomprensibile nella UI.

**Choice.** `EliminaMediaAssetAsync` estende il controllo dei riferimenti prima di toccare il disco:

```csharp
List<string> inUso = await dbContext.Prodotti
    .Where(p => p.ImmagineId == mediaAssetId).OrderBy(p => p.Codice)
    .Select(p => p.Nome).ToListAsync();

// 🔴 Secondo referente, nato in Fase 2: senza questo controllo i file verrebbero
//    cancellati PRIMA che la foreign key rifiuti la rimozione della riga.
bool usataComeOg = await dbContext.ImpostazioniVetrina
    .AnyAsync(i => i.ImmagineOgId == mediaAssetId);

if (usataComeOg)
    throw new ExecutionError(
        $"L'immagine \"{asset.NomeOriginale}\" è l'immagine di anteprima social del sito. "
        + "Sostituiscila o rimuovila dalle impostazioni del sito, poi riprova.");
```

E la configurazione EF:

```csharp
entity.HasOne(x => x.ImmagineOg)
      .WithMany()                       // ⚠️ SENZA collezione inversa
      .HasForeignKey(x => x.ImmagineOgId)
      .OnDelete(DeleteBehavior.Restrict);
```

⚠️ **`WithMany()` senza argomento è obbligatorio.** `MediaAsset` ha già `ICollection<Prodotto> Prodotti`; se la seconda relazione non dichiara esplicitamente di non avere navigazione inversa, EF può tentare di riusare quella collezione o creare una FK ombra, e la migrazione produce una colonna che nessuno ha chiesto. È lo stesso genere di trappola che il design precedente ha documentato per la navigazione inversa di `MediaAsset` (§"Interfaces / Contracts").

**Rationale.** Questa è la ragione per cui il design *deve* leggere il codice esistente invece di progettare in astratto: l'entità nuova sembra additiva e isolata, ma introduce una relazione verso una tabella che ha già una procedura di eliminazione scritta per un solo referente. Un test lo pinna: *media assegnato come OG → eliminazione rifiutata → **i file sono ancora sul disco***. L'ultima asserzione è quella che conta e quella che si dimentica.

---

### D11 — Il DTO espone la **chiave**, non l'URL; e i due prefissi di Astro non sono lo stesso

**Choice.** La forma dell'immagine è **una sola** per tutta l'API pubblica — menu e galleria condividono `ImmaginePubblicaDto`, così `Immagine.astro` (piano §4) accetta un tipo solo:

```csharp
public record ImmaginePubblicaDto(
    string Chiave,                       // "2026/08/caffe-a1b2c3" — senza /media, senza host
    IReadOnlyList<int> LarghezzeDisponibili,
    int Larghezza, int Altezza,          // per width/height → zero CLS
    string? TestoAlternativo,
    string? Didascalia,
    string? Focale,                      // "50% 40%", già pronto per object-position
    string? Placeholder);                // LQIP data URI
```

Conferma la dottrina di §D3 del change precedente: *la chiave non conosce l'ambiente, `/media` è serving e non dato*. Chi compone l'URL è il consumatore.

🔴 **Come il prefisso arriva ad Astro — e la trappola che c'è dentro.** Il piano §8 prescrive `API_BASE_URL: http://backend:5000` (rete Docker, server-side). Ma **le immagini le carica il browser**, non Astro: comporre l'`src` con quella base produrrebbe `<img src="http://backend:5000/media/…">` nell'HTML — funzionante in ogni test server-side e **rotto per ogni visitatore**.

→ Il progetto Astro avrà **due variabili distinte**, e il fatto che siano due è la decisione:

| Variabile | Valore in produzione | Chi la usa |
|---|---|---|
| `API_BASE_URL` | `http://backend:5000` | Astro, **server-side**, per fetchare `/api/public/*` |
| `PUBLIC_MEDIA_BASE_URL` | `https://www.duedgusto.com` | Il **browser**, per `<img src>` e `srcset` |

In sviluppo coincidono entrambe con l'host del backend, ed è precisamente per questo che l'errore non si vede finché non si va in produzione.

**Perché il backend non espone un `mediaBaseUrl` nella risposta**, che risolverebbe la questione: perché il backend tornerebbe a conoscere il proprio host pubblico — la cosa che §D3 del change precedente ha rifiutato di persistere — e perché una **risposta cacheata 300s che contiene un hostname** resta sbagliata per cinque minuti dopo qualunque cambio di dominio o di reverse proxy. Il prefisso è configurazione di deploy del consumatore, non dato.

**`LarghezzeDisponibili`: `int[]`, e la terza copia del parser CSV che non si scriverà.**
Il modello persiste `"400,800,1200,1600"`. Esistono **già due** conversioni CSV → `int[]`: [`MediaController.LeggiLarghezze`](../../../backend/Controllers/MediaController.cs) (riga 145, `private`, `int.Parse` che **lancia** su input sporco) e [`MediaAssetType.LeggiLarghezze`](../../../backend/GraphQL/Vetrina/Types/MediaAssetType.cs) (riga 52, `internal`, tollerante). Una terza in `PublicController` sarebbe la terza — e la variante `int.Parse` in una rotta anonima significherebbe **500 su una riga malformata**.

→ Si promuove a un punto solo, `backend/Services/Media/LarghezzeCsv.cs`, adottando la semantica **tollerante** (stringa vuota → lista vuota, valori non numerici scartati); i due chiamanti esistenti delegano. Non è pulizia opportunistica: è il modo di non aggiungere la terza copia mentre si scrive la prima riga di questa fase.

**`OperatingDays`: `bool[7]` nullable, e il `!` che non si copia.**
`BusinessSettings.OperatingDays` è un JSON in stringa. Il DTO pubblico espone `IReadOnlyList<bool>?`, per lo stesso principio del CSV. [`GestioneCassaGuards.cs:76`](../../../backend/GraphQL/GestioneCassa/GestioneCassaGuards.cs) lo deserializza con `JsonSerializer.Deserialize<bool[]>(…)!` — un `!` che, su JSON malformato, diventa un'eccezione. **In una rotta anonima quello è un 500.** Qui si fa il contrario: parse tollerante, `null` se il risultato non è un array di sette booleani, `LogWarning` lato server. **Omettere gli orari settimanali è meglio che dichiararne di sbagliati** — e il consumatore JSON-LD di Fase 3 dovrà omettere `openingHoursSpecification` quando il campo è null, cosa che va detta adesso perché lì sembrerà un campo sempre presente.

---

### D12 — Dove vivono i test, e cosa **nessun** meccanismo enumerativo copre

**Il vincolo.** `AutorizzazioneAnonimaTests` enumera i rami **dallo schema GraphQL**: copre gratis il ramo `vetrina` nuovo e **non copre nulla** di REST. Non esiste una cartella `Integration/Controllers`: i test dei controller vivono in `Unit/Controllers` e istanziano la classe direttamente con `TestDbContextFactory.Create()` ([`MediaControllerTests`](../../../backend/DuedGusto.Tests/Unit/Controllers/MediaControllerTests.cs)).

**Choice.** Quattro file nuovi, ognuno con una ragione diversa scritta in testa:

| File | Difende |
|---|---|
| `Unit/Common/RegoleVetrinaTests.cs` | La regola è **giusta** (le due matrici di §D1) |
| `Unit/Common/RegolaPubblicazioneUnicaTests.cs` | La regola è **una sola** (scansione dei sorgenti, §D1) |
| `Unit/Controllers/PublicControllerTests.cs` | Il **comportamento** delle tre rotte |
| `Unit/Controllers/SuperficiePubblicaTests.cs` | La **forma** della superficie pubblica (§D2) |

🔴 **Il buco che va nominato: nessun test automatico prova che le rotte siano raggiungibili in anonimo.** Un test unitario che istanzia `PublicController` e chiama `Menu()` non passa mai da autenticazione e autorizzazione: sarebbe verde anche con `[Authorize]` sulla classe. Due mezze misure, entrambe necessarie e nessuna sufficiente da sola:

```csharp
[Fact]
public void PublicController_EAnonimoPerAttributi()
{
    // Non prova che funzioni: prova che l'INTENZIONE non è stata cancellata. Rompe il
    // giorno in cui qualcuno aggiunge [Authorize] "per coerenza con MediaController".
    typeof(PublicController).GetCustomAttribute<AllowAnonymousAttribute>().Should().NotBeNull();
    typeof(PublicController).GetCustomAttribute<AuthorizeAttribute>().Should().BeNull();
}
```

e il **criterio manuale**, che resta l'unica prova vera: `curl -sk https://<host>/api/public/{site,menu,galleria}` da una shell senza `Authorization` e senza cookie, in Development e in produzione. La proposal lo elenca già; questo design dice **perché** non si può automatizzare senza montare un `WebApplicationFactory`, che il progetto oggi non usa da nessuna parte e che è una dipendenza di test sproporzionata per tre GET.

Stessa natura per `/api/public/business-name`: è una minimal API nei top-level statements di `Program.cs`, **irraggiungibile da un test unitario** (lo stesso problema che ha portato `CorsOriginPolicy` fuori da `Program.cs`). Resta un criterio manuale, e per una ragione che vale la pena scrivere: il suo fallimento non rompe una pagina, rompe **l'avvio dell'app** ([`main.tsx:43`](../../../duedgusto/src/main.tsx), prima del login).

---

## Data Flow

### `GET /api/public/menu` — dove ogni garanzia si applica

```
 client anonimo        nginx           PublicController      RegoleVetrina        MySQL
   (curl/Astro)      (location /api/)
        │                 │                    │                   │                 │
        │ GET /api/public/menu ───────────────>│                   │                 │
        │  nessun Authorization, nessun cookie │                   │                 │
        │                 │                    │                   │                 │
        │                 │   [AllowAnonymous] · nessun guard: la superficie è        │
        │                 │   chiusa per COSTRUZIONE, non da un controllo             │
        │                 │                    │                   │                 │
        │                 │                    │─ .Where(Pubblicato) ──> Expression   │
        │                 │                    │                   │─ WHERE Attivo=1 AND
        │                 │                    │                   │   VisibileSulSito=1
        │                 │                    │─ CountAsync() ───────────────────────>│  (totale reale)
        │                 │                    │─ Take(300).Select(RigaMenu) ─────────>│
        │                 │                    │<── SELECT SENZA Codice/AliquotaIva/CreatedAt
        │                 │                    │                   │                 │
        │                 │                    │─ PrezzoEffettivo(pv, p) ─> 0 resta 0 │
        │                 │                    │─ raggruppa per CategoriaVetrina ?? "Altro"
        │                 │                    │─ Troncato = totale > 300 → LogWarning│
        │                 │                    │                   │                 │
        │<──── 200 MenuPubblicoDto ────────────│                   │                 │
        │      Cache-Control: public,max-age=60                    │                 │
        │      Access-Control-Allow-Origin: *  (costante → nessun Vary)              │
        │      nessun Set-Cookie                                                      │
        │                                                                             │
   Fase 6: qui si inserisce proxy_cache — funziona SENZA modifiche al backend,
   perché nginx onora il Cache-Control dell'upstream. È tutto ciò che questa fase
   deve garantire sul caching.
```

### La regola di pubblicazione: due consumatori, una espressione

```
                        Common/RegoleVetrina.cs
                    ┌──────────────────────────────┐
                    │ Expression<Func<Prodotto,     │
                    │   bool>> Pubblicato           │  ← l'UNICA congiunzione del repository
                    │   = p.Attivo && p.VisibileSulSito
                    │                               │
                    │ Compilato = Pubblicato.Compile()
                    │ EPubblicato(Prodotto)         │
                    │                               │
                    │ PrezzoEffettivo(decimal?,     │  ← l'UNICO "??" del repository
                    │   decimal) => pv ?? listino   │     0 NON ricade sul listino
                    └───┬──────────┬─────────┬──────┘
          in memoria    │          │         │   tradotta in SQL
        ┌───────────────┘          │         └───────────────┐
        ▼                          ▼                         ▼
  ProdottoType              VetrinaMutations           PublicController
  · pubblicatoSulSito       · AggiornaMediaAsset       · .Where(Pubblicato)
  · prezzoEffettivoVetrina    (media ritirato: quali   · PrezzoEffettivo dopo
    (admin, GraphQL)           prodotti pubblicati       la proiezione
                               lo usano?)                (sito, REST)
                             🔴 oggi ha una copia
                                della regola: si
                                riscrive per chiamarla
```

### Admin scrive → il sito legge: la latenza è la decisione, non un effetto

```
ImpostazioniVetrinaPage    VetrinaMutations       DB          PublicController      Astro
        │                        │                 │                 │                │
        │ mutateImpostazioni ───>│                 │                 │                │
        │                        │ GuardAmministratore (prima istruzione)             │
        │                        │ validazioni → ExecutionError in italiano           │
        │                        │ upsert su IdSingleton ─────────>│                  │
        │<──── ImpostazioniVetrinaType ────────────│                 │                │
        │      toast "salvato"   │                 │                 │                │
        │                        │                 │                 │                │
        │                                          │  GET /api/public/site <──────────│
        │                                          │<── FirstOrDefault(Id == 1) ──────│
        │                                          │                 │─ 200 + max-age=300
        │                                          │                 │                │
        │   ⏱ fino a 300s prima che una cache (browser o, da Fase 6, nginx) lasci     │
        │      passare il valore nuovo. È il numero di §D4 e il criterio di successo   │
        │      della proposal dice "entro il tempo di cache", non "subito".            │
```

---

## File Changes

### Backend — nuovi

| File | Descrizione |
|---|---|
| `backend/Common/RegoleVetrina.cs` | 🔴 L'unica espressione della regola e del fallback prezzo (§D1) |
| `backend/Models/ImpostazioniVetrina.cs` | Entità singleton, id fisso (§D8) |
| `backend/Migrations/*_AddImpostazioniVetrina.cs` | **Una tabella nuova**, nessuna colonna su tabelle esistenti |
| `backend/SeedData/SeedImpostazioniVetrina.cs` | Dati reali del locale, crea e **non** aggiorna (§D8) |
| `backend/Controllers/PublicController.cs` | `[AllowAnonymous]`, `[EnableCors]`, tre GET, `[ResponseCache]` |
| `backend/Controllers/Public/Dto/SitoPubblicoDto.cs` | Identità + orari composti da due entità (§D2) |
| `backend/Controllers/Public/Dto/MenuPubblicoDto.cs` | + `CategoriaMenuDto`, `ProdottoPubblicoDto` |
| `backend/Controllers/Public/Dto/GalleriaPubblicaDto.cs` | Elenco di `ImmaginePubblicaDto` |
| `backend/Controllers/Public/Dto/ImmaginePubblicaDto.cs` | **Una sola forma** dell'immagine per tutta l'API (§D11) |
| `backend/Services/Media/CartelleVetrina.cs` | Costanti + `Normalizza` (§D3) |
| `backend/Services/Media/LarghezzeCsv.cs` | Punto unico CSV → `int[]`; assorbe le due copie esistenti (§D11) |
| `backend/Services/Vetrina/MenuLimiti.cs` | `MaxItem = 300`, pinnato da test (§D7) |
| `backend/GraphQL/Vetrina/VetrinaQueries.cs` | Ramo query root, `this.Authorize()` di classe (§D9) |
| `backend/GraphQL/Vetrina/Types/ImpostazioniVetrinaType.cs` | Output admin |
| `backend/GraphQL/Vetrina/Types/ImpostazioniVetrinaInputType.cs` | Input admin (+ `ImpostazioniVetrinaInput`) |

### Backend — modificati

| File | Cosa cambia |
|---|---|
| `backend/GraphQL/Vendite/Types/ProdottoType.cs` | I due resolver **chiamano** `RegoleVetrina`; le `Description` restano identiche |
| `backend/GraphQL/Vetrina/VetrinaMutations.cs` | 🔴 Riga 194: la seconda copia della regola diventa `.Where(RegoleVetrina.Pubblicato)` · `EliminaMediaAssetAsync` controlla anche `ImmagineOgId` (§D10) · `Cartella` normalizzata con `CartelleVetrina.Normalizza` · nuova `mutateImpostazioniVetrina` |
| `backend/GraphQL/GraphQLQueries.cs` | +`Field<VetrinaQueries>("vetrina")` |
| `backend/DataAccess/AppDbContext.cs` | `DbSet<ImpostazioniVetrina>`, config + `CHECK` singleton, FK `ImmagineOg` con `WithMany()` esplicito |
| `backend/Controllers/MediaController.cs` | +`CartelleSuggerite` nel DTO di configurazione (§D3) · `LeggiLarghezze` delega a `LarghezzeCsv` |
| `backend/GraphQL/Vetrina/Types/MediaAssetType.cs` | `LeggiLarghezze` delega a `LarghezzeCsv` |
| `backend/Services/Media/ImmagineProcessor.cs` | Il default cartella passa da `CartelleVetrina.Normalizza` |
| `backend/Program.cs` | +policy `PubblicaSenzaCredenziali` · `SeedImpostazioniVetrina.Initialize` dopo `SeedMenusSito` · commento su `UseCors`/`UseRouting` (§D5) · commento incrociato accanto a `MapGet("/api/public/business-name")` |
| `backend/Middleware/AuthRateLimitMiddleware.cs` | **Solo un commento** in `RateLimitedPaths`: perché le GET pubbliche non ci sono e perché la POST di Fase 4 ci andrà (§D6) |
| `backend/SeedData/SeedMenusSito.cs` | Terza voce, `Posizione = 3`, lookup per `Percorso` |

### Backend — **invariati, e va verificato che lo restino**

| File | Perché |
|---|---|
| `backend/GraphQL/Vendite/VenditeMutations.cs` | 🔴 `UpsertProdottoAsync` non si avvicina |
| `backend/GraphQL/Vendite/Types/ProdottoInputType.cs` | 🔴 Pinnato dal test strutturale della Fase 1 |
| `backend/GraphQL/Vendite/VenditeQueries.cs` | 🔴 Il commento *"il listino pubblico NON passa da qui"* diventa vero senza toccare una riga |
| `backend/Models/BusinessSettings.cs`, `GraphQL/Settings/**` | §D8: irrigidire il suo singleton è un altro change |
| `deploy/**`, `docker-compose.yml` | 🔴 Micro-cache, `location /api/public/` e `limit_req_zone` sono Fase 6 |

### Frontend

| File | Azione | Descrizione |
|---|---|---|
| `duedgusto/src/components/pages/sito/ImpostazioniVetrinaPage.tsx` | Nuovo | Formik + Zod + `FormikToolbar` + `useConfirm`, dentro `SitoGuard` |
| `duedgusto/src/components/pages/sito/MediaLibrary.tsx` | Modificato | I due `TextField` cartella → `Autocomplete freeSolo` con suggerimenti dal server (§D3) |
| `duedgusto/src/graphql/vetrina/queries.tsx` | Modificato | +`getImpostazioniVetrina` |
| `duedgusto/src/graphql/vetrina/mutations.tsx` | Modificato | +`mutationMutateImpostazioniVetrina` |
| `duedgusto/src/graphql/vetrina/fragments.tsx` | Modificato | +`impostazioniVetrinaFragment` |
| `duedgusto/src/@types/vetrina.d.ts` | Modificato | +`ImpostazioniVetrina`, +`cartelleSuggerite` su `MediaConfigurazione` |
| `duedgusto/src/components/layout/sideBar/iconMapping.tsx` | Modificato | +`Store` — verificato assente; `Settings` **non** si riusa: è già la sezione Impostazioni della cassa e le due voci sarebbero indistinguibili nella sidebar |

---

## Interfaces / Contracts

### EF Core — `ImpostazioniVetrina`

```csharp
public class ImpostazioniVetrina
{
    public const int IdSingleton = 1;
    public int ImpostazioniVetrinaId { get; set; } = IdSingleton;

    // ── Identità pubblica ────────────────────────────────────────────────────
    // Separata da BusinessSettings.BusinessName, che resta il nome del gestionale
    // ("DuedGusto"). Questa è l'insegna che legge il cliente: "2D Gusto Bar".
    public string InsegnaPubblica { get; set; } = string.Empty;

    // ── Indirizzo, scomposto perché lo pretende schema.org/PostalAddress ──────
    // streetAddress / postalCode / addressLocality / addressRegion / addressCountry.
    // Un unico campo "indirizzo" costringerebbe il JSON-LD di Fase 3 a spezzarlo con
    // una regex, e la SEO locale è la ragione per cui il sito esiste in Astro.
    public string Via { get; set; } = string.Empty;
    public string Cap { get; set; } = string.Empty;
    public string Citta { get; set; } = string.Empty;
    public string Provincia { get; set; } = string.Empty;      // "VI"
    public string Paese { get; set; } = "IT";

    // Valorizzate INSIEME o nessuna delle due: mezza coordinata è un punto sull'equatore.
    public decimal? Latitudine { get; set; }                   // decimal(9,6) ≈ 11 cm
    public decimal? Longitudine { get; set; }

    // ── Contatti e social: URL COMPLETI, non handle (§D9) ─────────────────────
    public string? Telefono { get; set; }
    public string? Email { get; set; }
    public string? UrlInstagram { get; set; }
    public string? UrlFacebook { get; set; }

    // ── SEO di default ───────────────────────────────────────────────────────
    public string? MetaTitoloDefault { get; set; }
    public string? MetaDescrizioneDefault { get; set; }
    public int? ImmagineOgId { get; set; }
    public MediaAsset? ImmagineOg { get; set; }                // 🔴 §D10

    // ── Tema (piano §6): l'ora dello switch è un DATO, il calcolo resta client-side ──
    public string OraInizioTemaSera { get; set; } = "18:00";   // "HH:mm"

    // ── Ganci SPENTI di Fase 4: nascono ora perché la migrazione è una sola ───
    //    Nessun codice di questa fase li legge, e non compaiono in alcun DTO pubblico.
    public bool PrenotazioniAttive { get; set; }
    public int PrenotazioniPreavvisoOre { get; set; } = 2;
    public int PrenotazioniCopertiMax { get; set; } = 20;
    public string? TurnstileSiteKey { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
```

Configurazione, oltre a quella di §D8: `HasMaxLength` su ogni stringa, `decimal(9,6)` sulle coordinate, `HasColumnType("text")` sulla meta descrizione, `CURRENT_TIMESTAMP` / `ON UPDATE CURRENT_TIMESTAMP` come le altre entità del progetto.

### Contratto REST

```
GET /api/public/site                 [AllowAnonymous]  Cache-Control: public,max-age=300
{
  "insegna": "2D Gusto Bar",
  "indirizzo": { "via": "…", "cap": "36016", "citta": "Thiene",
                 "provincia": "VI", "paese": "IT" },
  "geo": { "latitudine": 45.70…, "longitudine": 11.47… },        // null se non impostate
  "contatti": { "telefono": "…", "email": "…" },
  "social": { "instagram": "https://…", "facebook": "https://…" },
  "orari": { "apertura": "07:00", "chiusura": "21:00",
             "giorniOperativi": [true,true,true,true,true,true,false],  // null se JSON rotto
             "timezone": "Europe/Rome" },                        // ← da BusinessSettings
  "seo": { "titoloDefault": "…", "descrizioneDefault": "…",
           "immagineOg": { …ImmaginePubblicaDto } },             // null se non impostata
  "oraInizioTemaSera": "18:00"
}
// 🔴 MAI: vatRate, giornaleImporto*, settingsId, createdAt, turnstileSiteKey,
//         prenotazioni* — pinnato dal test ricorsivo di §D2

GET /api/public/menu                 [AllowAnonymous]  Cache-Control: public,max-age=60
{
  "categorie": [
    { "nome": "Caffetteria",
      "prodotti": [ { "id": 42, "nome": "Caffè", "descrizione": "…",
                      "prezzo": 1.20,            // ← PrezzoVetrina ?? Prezzo; 0 resta 0
                      "allergeni": "…", "novita": false, "consigliato": true,
                      "immagine": { …ImmaginePubblicaDto } } ] } ],
  "totaleProdottiPubblicati": 87,
  "limiteApplicato": 300,
  "troncato": false
}
// 🔴 MAI: codice, aliquotaIva, createdAt, updatedAt, unitaDiMisura, categoria, attivo

GET /api/public/galleria             [AllowAnonymous]  Cache-Control: public,max-age=300
{ "immagini": [ …ImmaginePubblicaDto ] }
// Cartella == "galleria" (§D3) AND Pubblicato == true, ORDER BY Ordinamento, MediaAssetId

GET /api/public/business-name        ← INVARIATA, minimal API su Program.cs:358 (§D12)
```

### Contratto GraphQL

```graphql
type ImpostazioniVetrina {
  impostazioniVetrinaId: Int!
  insegnaPubblica: String!
  via: String!  cap: String!  citta: String!  provincia: String!  paese: String!
  latitudine: Decimal  longitudine: Decimal
  telefono: String  email: String
  urlInstagram: String  urlFacebook: String
  metaTitoloDefault: String  metaDescrizioneDefault: String
  immagineOgId: Int
  immagineOg: MediaAsset
  oraInizioTemaSera: String!
  prenotazioniAttive: Boolean!
  prenotazioniPreavvisoOre: Int!
  prenotazioniCopertiMax: Int!
  turnstileSiteKey: String
  createdAt: DateTime!  updatedAt: DateTime!
}

input ImpostazioniVetrinaInput {   # nessun id: c'è una riga sola e il resolver sa quale
  insegnaPubblica: String!
  via: String!  cap: String!  citta: String!  provincia: String!  paese: String!
  latitudine: Decimal  longitudine: Decimal
  telefono: String  email: String
  urlInstagram: String  urlFacebook: String
  metaTitoloDefault: String  metaDescrizioneDefault: String
  immagineOgId: Int
  oraInizioTemaSera: String!
  prenotazioniAttive: Boolean!
  prenotazioniPreavvisoOre: Int!
  prenotazioniCopertiMax: Int!
  turnstileSiteKey: String
}

extend type Query   { vetrina: VetrinaQuery }        # ← NUOVO ramo root, this.Authorize()
type VetrinaQuery   { impostazioni: ImpostazioniVetrina }   # + GuardAmministratore (§D9)

extend type VetrinaMutation {
  mutateImpostazioniVetrina(input: ImpostazioniVetrinaInput!): ImpostazioniVetrina
}

# INVARIATI, e il loro testo non cambia di un carattere — cambia solo chi calcola:
extend type Prodotto { pubblicatoSulSito: Boolean!  prezzoEffettivoVetrina: Decimal! }
```

---

## UI — `ImpostazioniVetrinaPage.tsx`

Pattern verbatim di [`SettingsDetails.tsx`](../../../duedgusto/src/components/pages/settings/SettingsDetails.tsx): `Formik` + `FormikProps` ref + schema Zod + `FormikToolbar` + `useConfirm` + toast, con `refetchQueries` e `awaitRefetchQueries` sulla mutation. Avvolta in `SitoGuard`.

Sezioni, nell'ordine in cui un proprietario le compila:

| Sezione | Campi | Note |
|---|---|---|
| Identità | insegna pubblica | Distinta dal nome del gestionale, con l'helper text che lo dice |
| Indirizzo | via, cap, città, provincia, paese | Scomposto (schema.org) — l'helper text spiega perché non è un campo solo |
| Posizione | latitudine, longitudine | Validazione Zod **incrociata**: entrambe o nessuna |
| Contatti e social | telefono, email, Instagram, Facebook | URL completi, `z.string().url()` |
| SEO | titolo, descrizione, immagine OG | Immagine via `MediaPickerDialog` già esistente; contatore caratteri su titolo (~60) e descrizione (~155) |
| Aspetto | ora inizio tema sera | `HH:mm`, stesso pattern dei campi orario di `BusinessSettingsForm` |
| Prenotazioni | attive, preavviso, coperti max | 🔴 Sezione **dichiaratamente inattiva**: un `Alert severity="info"` — *"Le prenotazioni non sono ancora attive sul sito: questi valori vengono salvati e verranno usati quando la funzione sarà disponibile."* Un campo che si compila e non fa niente, senza spiegazione, è un bug segnalato |

Gli orari di apertura **non compaiono qui**: si modificano in Impostazioni (cassa). Un link a quella pagina, con la frase che lo spiega — è §2 della proposal reso visibile all'utente invece che solo scritto nel design.

---

## Testing Strategy

| Layer | Cosa | Come |
|---|---|---|
| **Unit .NET** | 🔴 `EPubblicato`: matrice 2×2 | §D1 |
| **Unit .NET** | 🔴 `PrezzoEffettivo`: null → listino, **0 → 0**, 0.90 → 0.90 | §D1 — il secondo è quello che si dimentica |
| **Unit .NET** | 🔴 La congiunzione compare in **un file solo** | Scansione dei sorgenti via `[CallerFilePath]` (§D1) |
| **Unit .NET** | 🔴 Il `??` del prezzo compare in **un file solo** | Idem |
| **Unit .NET** | 🔴 Nessun DTO pubblico possiede un campo contabile | Riflessione **ricorsiva** sui tipi annidati (§D2) |
| **Unit .NET** | Ogni action pubblica restituisce un DTO, mai un'entità | Riflessione sui tipi di ritorno (§D2) |
| **Unit .NET** | Elenco **esatto** delle property di ogni DTO | `BeEquivalentTo`, stile `ProdottoInput_NonContieneCampiVetrina` |
| **Unit .NET** | `PublicController` porta `[AllowAnonymous]` e non `[Authorize]` | §D12 |
| **Unit .NET** | Ogni rotta dichiara la sua `Duration` e `Location.Any` | Riflessione su `ResponseCacheAttribute` (§D4) |
| **Unit .NET** | `MenuLimiti.MaxItem == 300` | Pinning |
| **Unit .NET** | `CartelleVetrina.Normalizza`: `"Galleria "` → `"galleria"`, `null`/spazi → `"generale"` | §D3 |
| **Unit .NET** | `LarghezzeCsv`: vuoto → `[]`, sporco → scartato, nessuna eccezione | §D11 |
| **Unit .NET** | `OperatingDays` malformato → `null` + warning, **non** eccezione | §D11 |
| **Unit .NET** | `menu`: `VisibileSulSito=true, Attivo=false` **assente**; e la controprova | Due test, due direzioni |
| **Unit .NET** | `menu`: 301 prodotti → 300 elementi, `troncato: true`, `totale: 301`, warning nei log | §D7 |
| **Unit .NET** | `menu`: prodotto senza `CategoriaVetrina` finisce in `"Altro"` e **non sparisce** | §D7 |
| **Unit .NET** | `galleria`: filtra cartella **e** `Pubblicato`; un media `"generale"` non compare | §D3 |
| **Unit .NET** | `site`: espone gli orari di `BusinessSettings` e **nessun** campo contabile | §D2 |
| **Unit .NET** | `site` senza riga a database non esplode (installazione senza seed) | 404 o corpo con default — deciso in apply, comunque **mai 500** |
| **Integration .NET** | 🔴 Media assegnato come OG → eliminazione rifiutata **e i file sono ancora su disco** | §D10 — l'ultima asserzione è quella che conta |
| **Integration .NET** | `mutateImpostazioniVetrina` con `immagineOgId` non pubblicato → errore leggibile | Stesso messaggio di `ApplicaCampiVetrinaAsync` |
| **Integration .NET** | Un campo valorizzato si può **svuotare** | §D9 — è il difetto di `updateBusinessSettings` che non si importa |
| **Integration .NET** | Non amministratore: rifiutato **sia** su `vetrina { impostazioni }` **sia** sulla mutation, e nessuna scrittura | In `PrivilegiAmministrativiTests` |
| **Integration .NET** | Il ramo `vetrina` query nega l'anonimo | **Automatico**: `AutorizzazioneAnonimaTests` enumera dallo schema |
| **Integration .NET** | `SchemaEspone_TuttiIRamiRootAttesi` aggiornato con `"vetrina"` fra le query | Aggiornamento **atteso**, §D9 |
| **Integration .NET** | Seed × 3 → una riga, terza voce di menu non duplicata, campo editato a mano **intatto** | §D8 |
| **Unit React** | `ImpostazioniVetrinaPage`: Zod incrociata su lat/long, `HH:mm`, URL | Testing Library |
| **Unit React** | `MediaLibrary`: l'`Autocomplete` propone `galleria` e accetta un valore digitato | §D3 |
| **Manuale** | 🔴 `curl` senza `Authorization` né cookie sulle tre rotte, in dev **e** in produzione | L'unica prova reale dell'anonimato (§D12) |
| **Manuale** | `curl -I`: `Cache-Control` atteso, **nessun `Set-Cookie`** | §D4 |
| **Manuale** | `curl … \| jq 'paths \| join(".")' \| sort -u` sul menu reale | La controprova indipendente di §D2 |
| **Manuale** | 🔴 `/api/public/business-name` risponde **e l'app si avvia**: login + titolo in header | §D12 — rompe il bootstrap, non una pagina |
| **Manuale** | Giro completo: admin salva l'indirizzo → compare in `/api/public/site` entro 300s | Dall'interfaccia, non dal database |

---

## Migration / Rollout

### La migrazione

```bash
cd backend
# Modello + DbSet + OnModelCreating (incluso il CHECK e la FK con WithMany() esplicito)
EF_MIGRATIONS=1 dotnet ef migrations add AddImpostazioniVetrina
```

`EF_MIGRATIONS=1` è obbligatorio: senza, `ServerVersion.AutoDetect` apre una connessione e serve un MySQL in esecuzione ([`Program.cs:96-98`](../../../backend/Program.cs)). Si applica da sola all'avvio (riga 312).

**Strettamente additiva**: `CREATE TABLE` e nient'altro. Verifica prima di fidarsi: `dotnet ef migrations script` deve mostrare **solo** `CREATE TABLE` (più il `CONSTRAINT CK_…`) e nessun `ALTER TABLE`. ⚠️ Se comparisse un `ALTER TABLE Prodotti` o `MediaAssets`, la causa è quasi certamente la relazione `ImmagineOg` senza `WithMany()` esplicito (§D10): si corregge il modello e si rigenera, **non** si edita la migrazione a mano.

### Ordine di rollout

Ogni gradino è verificabile senza il successivo, e nessuno tocca la cassa.

1. **`RegoleVetrina` + le tre riscritture** (§D1) → `dotnet test` verde con lo schema GraphQL **invariato**. È il passo che rende sensati tutti gli altri, e da solo non aggiunge nessuna superficie.
2. `LarghezzeCsv` + `CartelleVetrina` → i due chiamanti esistenti delegano, test verdi.
3. Modello + migrazione + `dotnet ef database update` locale → ispezione dello schema.
4. `SeedImpostazioniVetrina` → tre avvii consecutivi, una riga sola, campo editato a mano intatto.
5. `PublicController` + DTO + test → **verificabile interamente con `curl`**, senza interfaccia.
6. Policy CORS + `[ResponseCache]` → `curl -I` con e senza `Origin`.
7. `EliminaMediaAssetAsync` esteso (§D10) → il test dei file su disco.
8. Ramo GraphQL admin → **verificabile con GraphiQL** da solo.
9. `MediaLibrary` con l'`Autocomplete`, poi `ImpostazioniVetrinaPage`.
10. Terza voce di menu → riavvio ×3, conteggio dei figli di "Sito" fermo a 3.

### Rollback

Come da proposal. Due precisazioni che il design aggiunge:

- **`RegoleVetrina` si revertisce da sola.** Il passo 1 è indipendente da tutto il resto e lascia il comportamento osservabile dello schema **identico per costruzione**: tornare alle due `Resolve` inline è ripristinare cinque righe. Ma tornare indietro **reintroduce** la copia di `VetrinaMutations.cs:194`, che era un difetto anche prima di questo change.
- **La migrazione si lascia in produzione.** Una tabella con una riga che nessuno legge non ha effetti; il `down` invece **cancella i dati del locale inseriti dall'admin**. Sono pochi campi e si riscrivono, ma vanno esportati o persi consapevolmente.

**Punto di non ritorno: nessuno in questa fase.** Il sito Astro non esiste, quindi nessun consumatore esterno dipende dal contratto JSON e un rollback non produce link rotti verso Internet.

---

## Divergenze dalla proposal e dal piano (da recepire in `sdd-spec`)

| # | Fonte | Diceva | Design | Perché |
|---|---|---|---|---|
| 1 | Piano §3 | `Cartella="gallery"` | **`"galleria"`**, normalizzata in scrittura, suggerita dal server, selezionabile | §D3 — unico valore inglese del modello dati, e la rotta italiana che lo filtra |
| 2 | Proposal, Rischi | CORS: *"bloccante per il change successivo"* | **Non lo è**: `localhost:4321` è già ammesso (la policy ignora la porta). Si aggiunge comunque una policy dedicata **senza credenziali** | §D5 — il motivo decisivo è la cache a variante unica, non l'accesso |
| 3 | Proposal, Rischi | Rate limiting: *"l'aggiunta al dizionario costa una riga"* | **Nessun rate limit applicativo.** Se servirà, va in nginx | §D6 — chiave falsificabile, dizionario che perde memoria, e la cache è la protezione vera |
| 4 | Proposal, Rischi | Singleton: *"replicare il pattern permissivo o irrigidirlo"* | **Irrigidito**: id fisso + `ValueGeneratedNever` + `CHECK` a database | §D8 — un duplicato qui è "il sito dice un indirizzo, l'admin ne modifica un altro" |
| 5 | Proposal §3 | *"la regola si estrae in un punto condiviso"* | Estratta **e** riscritta la seconda copia **che esiste già** in `VetrinaMutations.cs:194` | §D1 — senza, il criterio `grep` sarebbe rosso il primo giorno |
| 6 | Proposal, Affected Areas | `VetrinaMutations.cs` modificato solo per la nuova mutation | Modificato **anche** per `EliminaMediaAssetAsync` | 🔴 §D10 — l'immagine OG è un secondo referente e l'eliminazione cancella i file **prima** che la FK rifiuti |
| 7 | Proposal, Success Criteria | `Cache-Control: public, max-age=300` (con spazio) | ASP.NET emette `public,max-age=300` (senza) | §D4 — stessa direttiva; il criterio si verifica leggendo l'header, non confrontando una stringa |
| 8 | Proposal, Rischi | *"il DTO espone un `int[]` come fa già `MediaController.LeggiLarghezze`"* | Le conversioni CSV esistenti sono **due, e divergono**: si unificano in `LarghezzeCsv` | §D11 — la variante `int.Parse` in una rotta anonima è un 500 |
| 9 | Proposal, Rischi | *"da confermare in design come si passa il prefisso ad Astro"* | Due variabili distinte: `API_BASE_URL` (server-side) e `PUBLIC_MEDIA_BASE_URL` (browser) | §D11 — un prefisso solo produce `<img src="http://backend:5000/…">`, verde in ogni test |
| 10 | — | | `AutorizzazioneAnonimaTests.SchemaEspone_TuttiIRamiRootAttesi` **va aggiornato** | §D9 — è il comportamento progettato di quel test, non una rottura |

---

## Open Questions

Nessuna bloccante. Quattro punti da chiudere in fase di apply, ciascuno con la raccomandazione già presa.

> **Tutte e quattro confermate il 12 agosto 2026** (task 11.5). Sotto ciascuna, la conferma dice
> **come è stata effettivamente implementata** e cosa la renderebbe migrabile più avanti: una
> raccomandazione confermata senza il suo punto di uscita è una decisione che nessuno saprà come
> revocare.

- [x] **`/api/public/site` con la tabella vuota** (installazione con `SEED_ON_STARTUP=false`): 404 o corpo con i default? **Raccomandazione: 200 con i valori di default dell'entità e un `LogWarning`.** Un 404 sulla rotta dell'identità del locale farebbe fallire la home del sito interamente; un corpo con default fa comparire un sito incompleto, che è un guasto visibile e circoscritto. In nessun caso un 500.
  → **Confermata il 12 agosto 2026.** Implementata come **due** ripieghi indipendenti e non uno: la riga della vetrina e quella operativa si leggono con due `FirstOrDefaultAsync` distinti, e ciascuna assenza produce il **suo** `LogWarning` — quella della vetrina dice che il sito resta incompleto finché un amministratore non compila, quella operativa dice che non è uno stato atteso perché il seed crea quella riga all'avvio. Chi legge i log sa **quale** delle due manca. I valori di ripiego non sono scritti nel controller: `DefaultDelSito()` e `DefaultOperativo()` istanziano l'entità (`new ImpostazioniVetrina()`, `new BusinessSettings()`) e ne leggono le proprietà. Ciò che la rende migrabile: il giorno in cui un default cambiasse — o in cui un 404 diventasse preferibile — la modifica sta nel punto in cui il valore già vive, e non esiste una seconda copia destinata a divergere.
- [x] **`Telefono` e `Email` nel DTO pubblico**: sono dati di un'attività commerciale, già stampati sulle locandine — nessun problema GDPR. **Raccomandazione: esposti.** Se in futuro comparisse un contatto personale, la separazione giusta è un campo distinto (`TelefonoInterno`), non un filtro sul DTO.
  → **Confermata il 12 agosto 2026.** Esposti come `ContattiPubbliciDto(Telefono, Email)`, entrambi nullable; a database sono oggi `null` e la rotta li serve come `"contatti":{"telefono":null,"email":null}` — la decisione riguarda la **forma del contratto**, non un dato che oggi esca davvero. Ciò che la rende migrabile: `SuperficiePubblicaTests` pinna la forma **esatta** di ogni record raggiungibile, quindi togliere o rinominare un contatto rompe un test con il nome del campo nel messaggio, invece di cambiare in silenzio ciò che il sito pubblica.
- [x] **Ordinamento delle categorie di menu** (§D7): minimo `OrdinamentoVetrina`, poi nome. **Raccomandazione: confermato per questa fase.** Un'entità `CategoriaVetrina` con ordinamento proprio è un candidato di Fase 3, quando i template Astro diranno se le categorie hanno anche descrizione e immagine.
  → **Confermata il 12 agosto 2026.** `PublicController.Raggruppa` ordina i gruppi per `gruppo.Min(riga => riga.Ordinamento)` e poi per nome (`StringComparer.Ordinal`), in memoria su un risultato **già limitato e già ordinato**. La leva per l'amministratore è reale e non richiede alcuna entità: abbassare l'ordinamento di un prodotto fa salire la sua categoria. Ciò che la rende migrabile: la regola vive in un metodo privato di venti righe che riceve una lista e ne restituisce un'altra — il giorno in cui esisterà `CategoriaVetrina` con un ordinamento proprio, cambia la sorgente della chiave di ordinamento e non la forma della risposta.
- [x] **Irrigidire anche il singleton di `BusinessSettings`** (§D8): una riga di configurazione, ma su una tabella che cassa e chiusure mensili leggono e scrivono. **Raccomandazione: fuori scope qui, change dedicato.** Va annotato come debito noto, non silenziosamente lasciato divergere dal pattern che questo change introduce.
  → **Confermata il 12 agosto 2026.** Fuori scope, e il debito è scritto **nel codice** in testa alla configurazione di `ImpostazioniVetrina` — [`AppDbContext.cs:521-536`](../../../backend/DataAccess/AppDbContext.cs) — dove dice perché i due casi non sono simmetrici (una la scrive una schermata ed è lì da anni; l'altra è seedata all'avvio e letta da una rotta **anonima**) e perché irrigidire l'altra è un change con i suoi test e la sua verifica su dati reali. Nel frattempo la rotta pubblica non si affida alla fortuna: legge le impostazioni operative con `.OrderBy(x => x.SettingsId).FirstOrDefaultAsync()`, così una risposta **cacheabile** resta deterministica anche se un giorno esistessero due righe. Ciò che lo rende migrabile: il vincolo mancante è additivo (chiave fissa + `CHECK`), e il pattern da replicare è già scritto e provato a database su `ImpostazioniVetrina` (task 3.7).
