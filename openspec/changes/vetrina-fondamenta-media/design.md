# Design: Fondamenta media + campi vetrina (vetrina-fondamenta-media)

> Fase 1 di 8 del progetto "Sito vetrina 2D Gusto".
> Proposal di riferimento: [proposal.md](./proposal.md) — in particolare la sezione finale "Verifiche sul codice", che elenca nove divergenze verificate. Questo documento chiude i tre vincoli bloccanti (§D1, §D2, §D3) e i due gap di design (§D4, §D5).

---

## Technical Approach

Tre pezzi indipendenti, ognuno verificabile da solo, in ordine obbligato:

1. **Un'entità e dieci colonne.** `MediaAsset` (metadati, zero binari) e i campi vetrina su `Prodotto`. Due migrazioni additive.
2. **Una pipeline e un endpoint.** L'unico endpoint REST nuovo è `POST /api/media` — multipart non può passare dal link Apollo esistente. Tutto il resto (lettura, patch, eliminazione, mutation vetrina) resta GraphQL, dove il progetto ha già connection, autorizzazione e test enumerativi.
3. **Due pagine admin.** `MediaLibrary` (card MUI) e `VetrinaProdottiList` (AG Grid), dietro il gating a tre livelli del pattern Wiki.

Il principio che governa ogni decisione: **la cassa non viene toccata**. Non "toccata con cautela" — non toccata. `mutateProdotto`, `ProdottoInputType`, `UpsertProdottoAsync` e `VenditeQueries.prodotti` restano **byte per byte identici**. Ogni volta che una scelta poteva risolversi modificando codice del ramo `vendite`, il design sceglie l'alternativa additiva.

Tre conseguenze di quel principio divergono dalla lettera della proposal (§D6, §D7, §D8). Sono dichiarate esplicitamente, non nascoste.

---

## Architecture Decisions

### D1 🔴 — `client_max_body_size`: una sola soglia, quattro punti, il primo che parla è il client

**Il vincolo.** [`deploy/nginx/duedgusto.conf:77`](../../../deploy/nginx/duedgusto.conf) impone `client_max_body_size 10M` su `location /api/`. Una foto da smartphone la supera e prende un **413 generato da nginx**, con una pagina HTML che `makeRequest` non sa nemmeno parsare (`await response.json()` su HTML → `SyntaxError`, non il messaggio d'errore atteso).

**Choice.** **20 MB per file, un file per richiesta**, con i limiti disposti in ordine **decrescente di permissività** dall'esterno verso l'interno, così che a rifiutare sia sempre lo strato che sa produrre un messaggio leggibile:

| Punto | Valore | Ruolo |
|---|---|---|
| **Client** (`MediaLibrary`, pre-check su `file.size`) | **20 MB** | Rifiuta **prima di inviare un byte**. È l'unico che l'utente incontra davvero |
| **nginx** `location /api/media` | **24M** | Backstop contro `curl` diretto. Mai raggiunto dalla UI |
| **Kestrel / MVC** (`[RequestSizeLimit]` + `[RequestFormLimits]`) | **22 MB** | Backstop contro nginx bypassato (dev, LAN) |
| **Applicazione** (`MediaLimiti.MaxByteFile`) | **20 MB** | Rifiuta con `400 { message: "..." }` in italiano |

**Alternatives considered.**
- *Alzare `client_max_body_size` sul `location /api/` esistente*: applicherebbe 24M anche a `/api/auth/signin`, allargando la superficie di un endpoint anonimo e rate-limitato. Scartato: una `location /api/media` dedicata costa sei righe.
- *Un unico numero ovunque (20M / 20MB / 20MB)*: con l'overhead multipart (boundary + header di parte, ~300 byte) un file di esattamente 20 MB produce un body di 20 MB + 300 byte e viene rifiutato da nginx **prima** che l'app possa dire perché. Il margine non è decorativo: è ciò che rende il messaggio leggibile raggiungibile.
- *Upload multiplo in una sola richiesta*: il limite diventerebbe "somma dei file", incomprensibile per l'utente ("ma la foto pesa 3 MB!"), e la progress bar non saprebbe a quale file si riferisce.

**Rationale.**
Il numero 20 non è arbitrario: **Kestrel ha un `MaxRequestBodySize` di default di 30.000.000 byte (~28,6 MB)**. Restando a 22 MB per la richiesta completa non serve alzare il limite globale del server — si applica solo l'attributo sull'action, e ogni altro endpoint dell'app mantiene la protezione di default. Un limite a 25 MB avrebbe portato il totale sopra i 26-27 MB, troppo vicino al soffitto per non doverlo toccare.

**Come si evita la deriva fra i quattro punti.** Solo **due** numeri sono scritti a mano: `MediaLimiti.MaxByteFile = 20 * 1024 * 1024` nel backend e `24M` nel file nginx (con commento incrociato). Il client **non** ha una costante propria: la legge dal server.

```csharp
// GET /api/media/configurazione  — [Authorize], nessun guard admin (è sola lettura di costanti)
public record MediaConfigurazioneDto(
    long MaxByteFile,          // 20971520
    int MaxMegapixel,          // 50
    int[] LarghezzeVarianti,   // [400, 800, 1200, 1600]
    string[] MimeAmmessi);     // ["image/jpeg", "image/png", "image/webp"]
```

`MediaLibrary` la carica al mount, la usa per il pre-check **e** per l'attributo `accept` dell'`<input type="file">`. Il frontend non può divergere dal backend perché non ha un proprio valore da far divergere.

Un test xUnit pinna `MediaLimiti.MaxByteFile` a 20 MB: cambiarlo diventa un gesto deliberato che ricorda di aggiornare nginx.

---

### D2 🔴 — Upload multipart: XHR per la progress, politica 401 estratta e condivisa

**Il vincolo.** [`duedgusto/src/api/makeRequest.tsx:18,26`](../../../duedgusto/src/api/makeRequest.tsx) hardcoda `"Content-Type": "application/json;charset=UTF-8"` e `body: JSON.stringify(data)`. Non può inviare `FormData`. La logica preziosa è alle righe **48-62**: `401 → executeTokenRefresh() → un solo retry con failOnForbidden: true → onRefreshFails()`.

**Choice.** Tre file, non due:

| File | Azione | Contenuto |
|---|---|---|
| `duedgusto/src/api/politicaRefresh.tsx` | **Nuovo** | La **decisione** sul 401, senza trasporto |
| `duedgusto/src/api/makeRequest.tsx` | **Modificato** | Le righe 48-62 delegano a `politicaRefresh` |
| `duedgusto/src/api/uploadRequest.tsx` | **Nuovo** | Trasporto XHR con `upload.onprogress` |

```tsx
// duedgusto/src/api/politicaRefresh.tsx
export type EsitoAutenticazione = "procedi" | "riprova" | "abbandona";

/**
 * Politica unica "401 → refresh → un solo retry", condivisa da makeRequest (fetch)
 * e uploadRequest (XHR). Non conosce il trasporto: riceve uno status, decide.
 */
export async function valutaStatoAutenticazione(
  status: number,
  { failOnForbidden, refreshToken }: { failOnForbidden: boolean; refreshToken: () => Promise<boolean> },
): Promise<EsitoAutenticazione> {
  if (status !== WEB_REQUEST_UNAUTHORIZED) return "procedi";
  if (failOnForbidden) return "abbandona";
  if (await refreshToken()) return "riprova";
  await onRefreshFails();
  return "abbandona";
}
```

**Alternatives considered.**
- *`fetch` invece di XHR*: **`fetch` non espone alcun evento di progresso in upload.** L'unica via è un `ReadableStream` come body, che richiede `duplex: "half"`, HTTP/2 e ha supporto browser parziale. Scartato: XHR fa la stessa cosa oggi, ovunque, in 40 righe.
- *Duplicare le righe 48-62 in `uploadRequest`*: due copie della politica di autenticazione divergono al primo bugfix applicato a una sola.
- *Un wrapper generico `richiestaConRefresh(trasporto)`*: astrazione più grande del problema, e avrebbe richiesto di riscrivere `makeRequest` intero — che ha già 4 test in [`src/api/__tests__/makeRequest.test.tsx`](../../../duedgusto/src/api/__tests__) che iniettano `services`. Estrarre **solo la decisione** lascia firma e comportamento osservabili di `makeRequest` invariati, quindi quei test restano la rete di sicurezza del refactor invece di doverli riscrivere.

**Rationale — e la risposta al retry con `FormData` "già consumato".**

`FormData` **non è uno stream consumabile**. Né `fetch` né `XMLHttpRequest.send(fd)` lo svuotano: entrambi lo serializzano in un body multipart al momento dell'invio e lasciano l'oggetto intatto. Ciò che è consumabile è un `ReadableStream` come body — e i `Request`/`Response`, il cui `.body` è uno stream: è esattamente per questo che `makeRequest:35` fa `response.clone().text()` prima di `response.json()`.

**Il retry è quindi sicuro, a tre condizioni che il design impone e che sono la parte facile da sbagliare:**

1. **Nuovo `XMLHttpRequest` a ogni tentativo.** Il `FormData` si riusa; l'oggetto XHR no — un XHR già `send()`-ato non è reinviabile. La funzione `invia()` costruisce l'XHR al suo interno, non lo riceve.
2. **`getAuthHeaders()` letto _dentro_ `invia()`, non fuori.** `makeRequest` ottiene questo gratis perché il retry è una **chiamata ricorsiva** che rilegge gli header in cima (riga 14). Un `uploadRequest` che leggesse il token una volta sola rimanderebbe **lo stesso token scaduto**, prenderebbe un secondo 401, e con `failOnForbidden: true` finirebbe in `onRefreshFails()` → logout: il file perso *e* l'utente buttato fuori, cioè esattamente il fallimento silenzioso che questo helper esiste per evitare.
3. **`onProgress(0)` all'inizio del retry.** Senza, la barra torna indietro dal 100% e sembra rotta.

**Costo accettato e dichiarato:** il retry **ricarica il file da zero** (nessun resume). Con un tetto di 20 MB su LAN o linea consumer sono pochi secondi; un upload chunked/ripristinabile è sproporzionato per questa fase e va valutato solo se il tetto crescerà.

```tsx
// duedgusto/src/api/uploadRequest.tsx (forma)
async function uploadRequest<T>({ path, formData, onProgress }: UploadRequest, services = defaultServices): Promise<T | null> {
  const invia = (ultimoTentativo: boolean) =>
    new Promise<{ status: number; corpo: string }>((resolve, reject) => {
      onProgress?.(0);                              // (3)
      const xhr = new XMLHttpRequest();             // (1)
      xhr.open("POST", `${(window as Global).API_ENDPOINT}/api/${path}`);
      xhr.withCredentials = true;
      const authHeaders = services.getAuthHeaders(); // (2) letto QUI, a ogni tentativo
      if (authHeaders) xhr.setRequestHeader("Authorization", authHeaders.Authorization);
      xhr.setRequestHeader("Accept", "application/json");
      // NIENTE Content-Type: lo genera il browser col boundary del multipart
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.onload = () => resolve({ status: xhr.status, corpo: xhr.responseText });
      xhr.onerror = () => reject(new Error("Errore di rete durante il caricamento"));
      xhr.send(formData);                            // stesso FormData, XHR nuovo
    });
  // ... valutaStatoAutenticazione → "riprova" ? invia(true) : ...
}
```

**Nota di coerenza con D1.** Su un `413` di nginx il corpo è HTML: `uploadRequest` deve fare `JSON.parse` **dentro un try/catch** e, in caso di fallimento, produrre `"Il file supera il limite consentito dal server"` invece di propagare un `SyntaxError`. È il caso che la UI non dovrebbe mai vedere (il pre-check client lo previene) ma che non deve comunque esplodere.

---

### D3 🔴 — `UseStaticFiles`: la chiave nel DB non conosce l'ambiente

**Il vincolo.** [`Program.cs`](../../../backend/Program.cs) non ha `UseStaticFiles`. Servire i media in Development è codice da scrivere. E se dev e prod producessero URL diversi, il database si popolerebbe di path validi in un ambiente solo.

**Choice — tre livelli separati, un solo dato persistito.**

```
MediaAsset.Chiave  = "2026/08/caffe-esterno-a1b2c3"       ← nel DB. Nessuno schema, nessun host, nessun prefisso
variante           = "{Chiave}/{larghezza}.{webp|jpg}"    ← convenzione, non dato
URL                = `${API_ENDPOINT}/media/{variante}`   ← composto a render time, identico nei due ambienti
```

**`Chiave` non contiene `/media`.** Il prefisso `/media` è un dettaglio di *serving*, non un dato: se domani i file passano su un CDN cambia una costante, non 500 righe di database.

L'URL è identico nei due ambienti **senza nessun `if`**, perché `API_ENDPOINT` punta già, in entrambi, all'host che serve `/media/`:

| | `API_ENDPOINT` | `/media/…` servito da |
|---|---|---|
| **Development** | `https://localhost:4000` (o l'IP LAN, da `npm run setup`) | **.NET**, `UseStaticFiles` con `PhysicalFileProvider(MEDIA_ROOT)` |
| **Production** | `https://<SERVER_IP>` ([deploy.sh:54](../../../deploy/scripts/deploy.sh)) | **nginx**, `location /media/ { alias …; }` |

È lo stesso identico pattern che [`makeRequest.tsx:23`](../../../duedgusto/src/api/makeRequest.tsx) usa già per `/api/`: `${(window as Global).API_ENDPOINT}/api/${path}`. Zero macchinari nuovi.

**Alternatives considered.**
- *Proxy Vite su `/media`*: funzionerebbe, ma introduce un target HTTPS self-signed (`secure: false`), va tenuto allineato all'IP che `npm run setup` scrive in `config.json`, e aggiunge un pezzo mobile per risolvere un problema che `API_ENDPOINT` risolve già.
- *URL assoluto calcolato dal backend e salvato in `Chiave`*: il database diventerebbe non portabile fra ambienti — ripristinare un dump di produzione in locale darebbe 500 immagini che puntano all'IP del VPS. È esattamente il fallimento che il vincolo chiede di evitare.
- *Servire `/media` da .NET anche in produzione*: sposta banda e latenza su Kestrel, rinuncia a `sendfile`, e paga il costo del middleware pipeline su ogni thumbnail.

**Rationale sull'immutabilità.** `expires 1y` + `immutable` è sicuro **solo** se un URL non cambia mai contenuto. Il design lo garantisce con una regola: **i file non si sovrascrivono mai.** "Sostituire l'immagine di un prodotto" = nuovo upload → nuova `Chiave` → si riassegna `ImmagineId`. Il vecchio `MediaAsset` resta finché qualcuno lo elimina esplicitamente. Questa regola paga tre volte: cache aggressiva sicura, backup incrementale banalmente corretto (§D9), e nessuna finestra in cui un file è mezzo riscritto.

**Codice.**

```csharp
// Program.cs — risoluzione MEDIA_ROOT, stesso stile fail-fast di CONNECTION_STRING
string mediaRoot = Environment.GetEnvironmentVariable("MEDIA_ROOT")
    ?? (builder.Environment.IsDevelopment()
        ? Path.Combine(builder.Environment.ContentRootPath, "media")
        : throw new InvalidOperationException(
            "MEDIA_ROOT non impostata. In ambienti non-Development impostare la variabile " +
            "d'ambiente MEDIA_ROOT (in Docker: /app/media, bind mount di /opt/duedgusto/media)."));
builder.Services.AddSingleton(new MediaRoot(mediaRoot));

// … dopo app.UseAuthorization(), prima di app.MapControllers()
if (app.Environment.IsDevelopment())
{
    Directory.CreateDirectory(mediaRoot);

    // .webp esplicito: se il provider di default non lo mappasse, con
    // ServeUnknownFileTypes = false ogni variante WebP darebbe un 404 muto in dev
    // e sembrerebbe un bug della pipeline invece che del content-type.
    var contentTypes = new FileExtensionContentTypeProvider();
    contentTypes.Mappings[".webp"] = "image/webp";

    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(mediaRoot),
        RequestPath = "/media",
        ContentTypeProvider = contentTypes,
        ServeUnknownFileTypes = false,
        OnPrepareResponse = ctx =>
            ctx.Context.Response.Headers.CacheControl = "public,max-age=31536000,immutable",
    });
}
```

```nginx
# deploy/nginx/duedgusto.conf — PRIMA di "location / { try_files … }" per leggibilità
# (nginx sceglie comunque il prefisso più lungo, ma l'ordine aiuta chi legge)
location /media/ {
    alias /opt/duedgusto/media/;   # entrambe le barre finali: senza, nginx concatena male
    try_files $uri =404;           # niente fallback su index.html: un media mancante è un 404
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header X-Content-Type-Options "nosniff" always;
    access_log off;
}
```

---

### D4 — `Attivo` (cassa) vs `VisibileSulSito` (vetrina): intenzione e stato, mai fusi

**Il gap.** [`VenditeQueries.cs:37`](../../../backend/GraphQL/Vendite/VenditeQueries.cs) filtra `.Where(p => p.Attivo)`. Un prodotto disattivato in cassa sparisce dalla griglia vetrina ma resta `VisibileSulSito = true` a database: in Fase 2 verrebbe pubblicato senza che nessuno possa più vederlo, né correggerlo, dall'admin.

**Choice — tre mosse, nessuna delle quali scrive in cassa.**

1. **`VisibileSulSito` è un'_intenzione_, `Attivo` è uno _stato_. Non si toccano a vicenda.**
   `VisibileSulSito` significa "voglio questo prodotto sul sito". `Attivo` significa "questo prodotto è in vendita alla cassa". Sono due proprietà di due domini diversi e nessuna delle due scrive sull'altra.

2. **La pubblicazione effettiva è la _congiunzione_, calcolata in lettura e mai persistita.**
   Un campo derivato di sola lettura su `ProdottoType`, che diventa la fonte unica della regola per la Fase 2:

   ```csharp
   // ProdottoType.cs
   Field<BooleanGraphType>("pubblicatoSulSito")
       .Description("Attivo in cassa E marcato visibile sul sito. È la regola unica di pubblicazione: " +
                    "l'API pubblica di Fase 2 filtra su questa, non su VisibileSulSito da sola.")
       .Resolve(ctx => ctx.Source.Attivo && ctx.Source.VisibileSulSito);
   ```

3. **La griglia admin vede _tutti_ i prodotti, attivi e non**, con `Attivo` e `pubblicatoSulSito` come colonne visibili in sola lettura. Un prodotto `VisibileSulSito = true, Attivo = false` è così **visibile e diagnosticabile**, con un chip "Non attivo in cassa" che spiega perché non compare sul sito. Il come è in §D8.

**Alternatives considered.**
- 🔴 *Azzerare `VisibileSulSito` quando si disattiva un prodotto.* **Scartata, ed è la più pericolosa delle tre.** Richiederebbe che `UpsertProdottoAsync` — codice della cassa — scrivesse un campo vetrina: esattamente il confine che questo change esiste per difendere, e romperebbe il test che lo pinna. In più distruggerebbe dati: disattivare un prodotto stagionale per due settimane e riattivarlo lascerebbe il flag a `false`, con nome, descrizione e immagine intatti ma il prodotto silenziosamente fuori dal sito.
- *Un solo flag (`VisibileSulSito` implica `Attivo`)*: il listino cassa contiene codici tecnici ("SCONTRINO", "STORNO") che non devono finire online per errore. Opt-in separato è l'unica scelta sicura, ed è già la scelta del piano.
- *Filtro server-side `includiNonAttivi: Boolean` sulla query*: non serve — vedi §D5, la griglia scarica comunque tutto e il filtro è client-side, gratis.

**Rationale.** La congiunzione calcolata in lettura ha una proprietà che la persistenza non ha: **non può andare fuori sincrono.** Non esiste alcuno stato del database in cui `pubblicatoSulSito` mente, perché non è uno stato. E la regola vive in una riga sola, che la Fase 2 riusa invece di reimplementare — la classe di bug "l'admin dice pubblicato, il sito non lo mostra" è resa impossibile per costruzione, non per disciplina.

---

### D5 — `prodotti` non è una connection Relay: se ne aggiunge una, non si converte quella esistente

**Il gap.** `vendite { prodotti }` è una lista piatta con `limite`/`scostamento`. Ogni altra griglia AG Grid del progetto consuma una connection Relay via `useGetAll`. `VetrinaProdottiList` non può copiare `FornitoreList` verbatim.

**Verifica decisiva:** `grep -rn "prodotti|mutateProdotto|categorieProdotto" duedgusto/src` → **una sola occorrenza, ed è testo dentro la wiki**. Nel backend, nessun test tocca `prodotti`. La query **non ha consumatori**, né frontend né test.

**Choice.** Aggiungere `connection { prodotti }` in [`ConnectionQueries.cs`](../../../backend/GraphQL/Connection/ConnectionQueries.cs), sul pattern esatto di `fornitori` (righe 123-140). **`VenditeQueries.prodotti` resta invariata.**

```csharp
// ConnectionQueries.cs — accanto a fornitori
// Anagrafica prodotti per l'admin: restituisce ANCHE i non attivi, come utenti e ruoli
// restituiscono anche i disabilitati. Il ramo connection è l'anagrafica, non il listino
// operativo — quello resta vendite { prodotti }, invariata e con il suo filtro Attivo.
Field<ConnectionType<ProdottoType>>("prodotti")
    .Argument<IntGraphType>("first", "Number of items to return")
    .Argument<IntGraphType>("cursor", "Offset for pagination (deprecated, use after)")
    .Argument<StringGraphType>("after", "Cursor after which to return items")
    .Argument<StringGraphType>("where", "Filter condition")
    .Argument<StringGraphType>("orderBy", "Order by clause")
    .ResolveAsync(async context =>
        await GraphQLService.GetConnectionAsync<Prodotto>(
            context,
            context.GetArgument<string>("where"),
            context.GetArgument<string>("orderBy"),
            prodotto => prodotto.ProdottoId.ToString(),
            query => query.Include(p => p.Immagine).OrderBy(p => p.Codice)));
```

Con questa, `VetrinaProdottiList` usa `useGetAll` **verbatim** come `FornitoreList`:

```tsx
const { data: prodotti, refetch } = useGetAll<ProdottoVetrina>({
  fragment: prodottoVetrinaFragment,
  queryName: "prodotti",
  fragmentBody: "...ProdottoVetrinaFragment",
  fetchPolicy: "network-only",
});
```

**Alternatives considered.**
- *Convertire `vendite { prodotti }` a Relay*: modifica al ramo cassa, contro il principio del change. Zero benefici, visto che non ha consumatori da migrare.
- *Adattare la griglia alla paginazione offset esistente*: significherebbe scrivere un hook di paginazione nuovo per una pagina sola, mentre `useGetAll` esiste, è testato ed è quello che ogni altra lista usa. E la prima pagina prodotti del progetto diventerebbe l'unica con un meccanismo suo.
- *Argomenti tipizzati `soloVetrina` / `includiNonAttivi` sulla connection*: **non sarebbero raggiungibili.** `useQueryParams` genera la query a runtime con esattamente `$where: String, $pageSize: Int, $orderBy: String, $cursor: Int`; un argomento extra richiederebbe di scrivere la query a mano (pattern di `useQueryCashRegistersByMonth`) e rinunciare a `useGetAll`. Inoltre `ApplyLikeWhereClause` ([GraphQLService.cs:189-237](../../../backend/Services/GraphQL/GraphQLService.cs)) gestisce **solo LIKE su stringhe**: un filtro booleano non è nemmeno esprimibile via `where`.

**Rationale — e perché la paginazione non è un problema.**
`useGetAll` fa un loop `while (hasNextPage)` e scarica **tutte** le pagine. Su un listino da bar — **centinaia di prodotti, non decine di migliaia** — con `pageSize: 100` sono 2-4 round trip, e `Datagrid` è a row model client-side: filtro, ordinamento e ricerca diventano istantanei, senza un round trip per tastierata. È il compromesso giusto a questa scala ed è già quello che `FornitoreList` accetta.

**Il limite oltre cui questa scelta va rivista, scritto adesso perché non si scopra sul campo:** oltre **~2.000 prodotti** il primo caricamento comincia a farsi sentire e conviene passare al pattern load-more di `useFetchData`. Nulla del design cambia: stessa connection, stesso tipo, si sostituisce l'hook.

**Corollario su `Include(p => p.Immagine)`:** senza, il thumbnail in griglia farebbe una query per riga (lazy loading è disabilitato nel progetto, quindi in realtà darebbe `null` e nessuna immagine). L'`Include` nel `queryConfigurator` è l'unico punto in cui va messo.

---

### D6 — Media CRUD in GraphQL; REST solo per il multipart

**Choice.** Un solo endpoint REST nuovo — **`POST /api/media`** — più `GET /api/media/configurazione` (costanti, §D1). Tutto il resto è GraphQL:

| Operazione | Dove | Perché |
|---|---|---|
| Upload multipart | `POST /api/media` (REST) | Il link Apollo non ha `createUploadLink`; introdurlo per un endpoint solo è una dipendenza npm e una catena di link in più |
| Elenco / ricerca media | `connection { mediaAssets }` | La macchina della connection esiste; il frontend sa già consumarla |
| Patch alt/didascalia/ordinamento/pubblicato | `vetrina { mutateMediaAsset }` | — |
| Eliminazione | `vetrina { eliminaMediaAsset }` | — |
| Campi vetrina prodotto | `vetrina { mutateProdottoVetrina }` | — |

**Divergenza dichiarata dalla proposal**, che prevedeva `GET`/`PATCH`/`DELETE` REST su `MediaController`.

**Rationale.** Tre argomenti, il primo dei quali è **scritto nel codebase**:

1. [`AutorizzazioneAnonimaTests.cs:21-23`](../../../backend/DuedGusto.Tests/Integration/GraphQL/AutorizzazioneAnonimaTests.cs) stabilisce la dottrina del progetto: *"Se un ramo deve davvero essere raggiungibile senza login, NON aggiungerlo a un'allowlist qui: esponilo come endpoint REST sotto `/api/public/*`"*. REST è la corsia del **pubblico**; GraphQL è quella del **privato**. Il CRUD media è privato e admin-only: appartiene a GraphQL. Un ramo root `vetrina` viene inoltre **coperto automaticamente** dal test enumerativo (che legge i rami `dallo schema`), mentre un controller REST no.
2. `ProdottoType.immagine` deve comunque risolvere un `MediaAssetType`: il tipo GraphQL va scritto in ogni caso. Aggiungere DTO REST paralleli per la stessa entità significa due forme da tenere allineate a ogni campo nuovo.
3. `DELETE` con 409 diventa un `ExecutionError` con l'elenco dei prodotti nel messaggio — che il frontend Apollo gestisce già nativamente, senza il ramo `if (status === 409)` in `makeRequest`.

**Costo accettato.** Dopo un upload REST la cache Apollo non sa nulla del nuovo media: `MediaLibrary` chiama `refetch()` alla fine dell'upload. Due righe.

⚠️ **Conseguenza sui Success Criteria della proposal:** il criterio *"`DELETE` su un `MediaAsset` referenziato risponde **409**"* va riformulato in termini di comportamento — *"il tentativo di eliminare un `MediaAsset` referenziato viene rifiutato, l'errore nomina i prodotti che lo usano, e nessun file né record viene cancellato"*. Il comportamento è integralmente preservato; cambia il codice di trasporto. Da recepire in `sdd-spec`.

---

### D7 — Ramo GraphQL `vetrina`, non `vendite`

**Choice.** Nuovo ramo root `vetrina` in `GraphQLMutations`, accanto a `vendite`:

```csharp
Field<VetrinaMutations>("vetrina").Resolve(context => new { });
```

**Divergenza dichiarata dalla proposal**, che collocava `mutateProdottoVetrina` nel ramo `vendite`.

**Alternatives considered.** *Ramo `vendite`*: `mutateProdottoVetrina` opera su `Prodotto`, che vive lì. Argomento reale ma più debole di quelli contro.

**Rationale.** Il ramo è la prima cosa che un lettore vede e gli dice in che territorio si trova. Mettere la mutation della vetrina dentro `vendite` significa che la domanda "sto scrivendo codice della cassa?" torna ad avere risposta ambigua — la stessa ambiguità che ha prodotto il rischio di azzeramento che questo change esiste per prevenire. Inoltre le Fasi 2-5 aggiungeranno `mutateImpostazioniVetrina`, `mutateEvento`, `mutatePromozione`, `mutatePrenotazione`: nessuna ha a che fare con le vendite, e tutte hanno bisogno di una casa. La si crea adesso, quando costa una riga.

---

### D8 — `mutateProdottoVetrina`: non può creare, non può uscire dal perimetro

**Choice.**

```csharp
// backend/GraphQL/Vetrina/VetrinaMutations.cs
Field<ProdottoType>("mutateProdottoVetrina")
    .Argument<NonNullGraphType<IntGraphType>>("prodottoId", "ID di un prodotto ESISTENTE")
    .Argument<NonNullGraphType<ProdottoVetrinaInputType>>("input", "Soli campi vetrina")
    .ResolveAsync(async context => await MutateProdottoVetrinaAsync(context));
```

Tre garanzie strutturali, non tre controlli:

1. **`prodottoId` è `NonNull` e deve esistere → la mutation non può creare un prodotto.** Non c'è nessun `input.ProdottoId is > 0 ? update : insert`. Non potendo creare, non può inventare `Codice`, `Prezzo` o `AliquotaIva`: metà del confine è imposta dalla firma.
2. **`ProdottoVetrinaInput` contiene esattamente i 10 campi vetrina.** Non ha `Codice`, non ha `Prezzo`, non ha `Attivo`. Il resolver non ha il dato per scrivere fuori perimetro, anche volendo.
3. **Assegnazione totale _dentro_ il perimetro**, stesso stile di `UpsertProdottoAsync` — deliberatamente, per simmetria e leggibilità. È sicuro qui e non lo è là, per una ragione precisa: **i campi vetrina hanno un solo scrittore** (questa mutation, da questa griglia), mentre i campi cassa ne hanno molti.

```csharp
prodotto.VisibileSulSito     = input.VisibileSulSito;
prodotto.NomeVetrina         = input.NomeVetrina;
prodotto.DescrizioneVetrina  = input.DescrizioneVetrina;
prodotto.CategoriaVetrina    = input.CategoriaVetrina;
prodotto.PrezzoVetrina       = input.PrezzoVetrina;
prodotto.ImmagineId          = input.ImmagineId;
prodotto.OrdinamentoVetrina  = input.OrdinamentoVetrina;
prodotto.Allergeni           = input.Allergeni;
prodotto.Novita              = input.Novita;
prodotto.Consigliato         = input.Consigliato;
prodotto.UpdatedAt           = DateTime.UtcNow;
// NIENTE Codice/Nome/Prezzo/Categoria/UnitaDiMisura/Attivo/AliquotaIva: non sono nell'input
```

**Validazioni prima del save**, sullo stile di `UpsertProdottoAsync`:
- `PrezzoVetrina` se valorizzato deve essere `>= 0` → `ExecutionError` leggibile;
- `ImmagineId` se valorizzato deve esistere e essere `Pubblicato` → `ExecutionError`, invece di lasciar esplodere la FK con un errore MySQL;
- `GuardUtenteAmministratore` come **prima** istruzione del resolver, prima di qualunque lettura.

**Il confine si pinna con un test _strutturale_, non solo comportamentale.**
Due test comportamentali (uno per direzione) sono necessari ma non bastano: passano anche il giorno in cui qualcuno aggiunge un campo vetrina a `ProdottoInput` senza aggiornarli. Il terzo test è quello che non si può dimenticare:

```csharp
[Fact]
public void ProdottoInput_NonContieneCampiVetrina()
{
    // ProdottoInput assegna OGNI campo esplicitamente (UpsertProdottoAsync:340-348).
    // Se un campo vetrina finisse qui, il primo upsert della cassa che non lo invia
    // lo azzererebbe in massa su tutti i prodotti. Questo test rompe la CI nel momento
    // esatto in cui qualcuno lo aggiunge, senza che nessuno debba ricordarsene.
    typeof(ProdottoInput).GetProperties().Select(p => p.Name).Should().BeEquivalentTo(
        "ProdottoId", "Codice", "Nome", "Descrizione", "Prezzo",
        "Categoria", "UnitaDiMisura", "Attivo", "AliquotaIva");
}

[Fact]
public void ProdottoVetrinaInput_NonContieneCampiCassa()
{
    string[] campiCassa = ["Codice", "Nome", "Descrizione", "Prezzo", "Categoria",
                           "UnitaDiMisura", "Attivo", "AliquotaIva"];
    typeof(ProdottoVetrinaInput).GetProperties().Select(p => p.Name)
        .Should().NotIntersectWith(campiCassa);
}
```

È lo stesso spirito di `AutorizzazioneAnonimaTests`: il test non verifica il codice di oggi, **impedisce la classe di errore di domani**.

---

### D9 🔴 — Storage su disco, bind mount, e l'UID che nessuno aveva guardato

**Layout.**

```
/opt/duedgusto/media/                          ← host. FUORI da frontend/ (deploy.sh:46 e first-deploy.sh:350)
  2026/08/caffe-esterno-a1b2c3/
      400.webp   400.jpg
      800.webp   800.jpg
      1200.webp  1200.jpg
      1600.webp  1600.jpg
```

**docker-compose.yml** — primo `volumes:` del servizio `backend`:

```yaml
    volumes:
      - /opt/duedgusto/media:/app/media
    environment:
      MEDIA_ROOT: /app/media
```

🔴 **Il problema che la proposal non vede: l'UID.**
[`backend/Dockerfile:17`](../../../backend/Dockerfile) fa `groupadd -r appuser && useradd -r -g appuser appuser` e `USER appuser`. **`useradd -r` assegna un UID di sistema non deterministico** (il primo libero scendendo da 999), che può cambiare al variare dell'immagine base. Su un bind mount, l'UID è l'unica cosa che il kernel confronta: un `chown` fatto oggi sull'UID sbagliato produce un container che **non riesce a scrivere i media**, con un `UnauthorizedAccessException` al primo upload in produzione e nient'altro in dev, dove il container non c'è.

**Choice.** **Fissare l'UID nel Dockerfile** e usare lo stesso numero negli script di deploy:

```dockerfile
RUN groupadd -r -g 10001 appuser && useradd -r -u 10001 -g appuser appuser
```

```bash
# deploy.sh / first-deploy.sh / setup-vps.sh — PRIMA di "docker compose up"
# I media NON stanno sotto frontend/dist: quella directory viene svuotata da rm -rf
# a ogni deploy (riga 46 qui sotto). Vedi design.md §D9.
mkdir -p "$APP_DIR/media"
chown -R 10001:10001 "$APP_DIR/media"   # 10001 = UID di appuser, fissato in backend/Dockerfile
chmod -R 755 "$APP_DIR/media"           # 755: nginx (www-data) legge, solo appuser scrive
```

E un commento a **riga 46 di `deploy.sh`** e **riga 350 di `first-deploy.sh`**, accanto ai due `rm -rf`:

```bash
# ATTENZIONE: questo rm -rf cancella tutto il contenuto di frontend/dist.
# I media vivono in $APP_DIR/media, FUORI da qui, ed è deliberato: metterli
# sotto dist significherebbe perderli tutti al deploy successivo, con il
# database pieno di riferimenti a file inesistenti e nessun errore visibile.
rm -rf "$APP_DIR/frontend/dist/"*
```

**Alternatives considered.** *Volume Docker nominato invece del bind mount*: nginx sul host non potrebbe leggerlo senza conoscere il path interno di Docker, e il backup dovrebbe passare da `docker cp`. Il bind mount è l'unica forma che tiene insieme scrittura dal container e lettura da nginx.

---

### D10 🔴 — `backup.sh`: mirror append-only, non tar rotanti

**Il vincolo.** [`backup.sh`](../../../deploy/scripts/backup.sh) fa **solo** `mysqldump` (righe 33-39). Un ripristino ricrea ogni `MediaAsset.Chiave` e nessun file.

**Choice.** **`rsync -a` senza `--delete` verso `$BACKUP_DIR/media/`**, eseguito **dopo** il dump, in `if`, e **senza rotazione**.

```bash
# --- Backup media (dopo il dump: un problema qui non deve mai precederlo) ---
MEDIA_DIR="/opt/duedgusto/media"
MEDIA_BACKUP="$BACKUP_DIR/media"

if [[ -d "$MEDIA_DIR" ]]; then
    log "Sincronizzazione media..."
    mkdir -p "$MEDIA_BACKUP"
    # Niente --delete: i media sono immutabili (design.md §D3), quindi il mirror
    # accumula la storia completa e un file cancellato per errore resta recuperabile.
    # L'if è obbligatorio: con "set -e" un rsync fallito fuori da una condizione
    # abortirebbe lo script DOPO un dump database perfettamente riuscito.
    if rsync -a "$MEDIA_DIR/" "$MEDIA_BACKUP/"; then
        log "Media sincronizzati: $(du -sh "$MEDIA_BACKUP" | cut -f1) in $MEDIA_BACKUP"
    else
        log "WARN: sync media fallito. Il backup del database resta valido."
    fi
else
    log "Directory media non trovata ($MEDIA_DIR), skip."
fi
```

**Alternatives considered.**
- *`tar -czf media_$TIMESTAMP.tar.gz` con la stessa rotazione a 30 giorni del dump*: è quello che suggerisce la proposal, ma su una libreria da ~200 immagini × 8 varianti (~160 MB) significa **~5 GB di tar quasi identici** su un VPS piccolo, e comunque WebP e JPEG sono già compressi: il `-z` non recupera quasi nulla.
- *`rsync --delete`*: propagherebbe al backup ogni eliminazione, incluse quelle sbagliate. Il backup smetterebbe di essere un backup.

**Rationale.** La rotazione a 30 giorni è giusta per il dump SQL — ogni dump è uno **snapshot completo e ridondante**, tenerne 30 è ragionevole. È sbagliata per i media, che sono **contenuto unico e immutabile**: ruotarli significa cancellare l'unica copia. Le due politiche divergono perché i due dati sono diversi, e il commento nello script lo dice.

L'immutabilità stabilita in §D3 rende `rsync` senza `--delete` **banalmente corretto**: nessun file cambia mai, quindi non esiste il caso "sincronizzato a metà scrittura". Costo per notte: O(file nuovi).

**Procedura di ripristino, da documentare e provare una volta:**
```bash
gunzip -c /opt/duedgusto/backups/duedgusto_<ts>.sql.gz | docker exec -i duedgusto-mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" duedgusto
rsync -a /opt/duedgusto/backups/media/ /opt/duedgusto/media/
chown -R 10001:10001 /opt/duedgusto/media && chmod -R 755 /opt/duedgusto/media
```

**Rischio residuo dichiarato:** il mirror è sullo **stesso disco**. Protegge da cancellazione accidentale e da un ripristino di database, **non** da perdita del disco. Vale già oggi per i dump SQL; una copia off-site è fuori scope in questa fase, ma va detta.

---

### D11 — Pipeline immagine: l'ordine è la specifica

**Choice — nove passi, in quest'ordine esatto.**

```
1. Pre-volo, zero I/O   ContentType in allow-list · Length <= 20 MB          → 400 leggibile
2. Semaforo             SemaphoreSlim(2).WaitAsync(timeout 30s)             → 503 "riprova"
3. Identify             Image.Identify(stream) — SOLO header, nessun decode
                        · W*H <= 50 Mpx  · W,H >= 200 px  · FrameCount == 1  → 400 leggibile
                        · se lancia → non è un'immagine, qualunque cosa dica il ContentType
4. Decode ridotto       DecoderOptions { TargetSize = 1600 }  ← il vero freno alla memoria
5. AutoOrient           image.Mutate(x => x.AutoOrient())      ← PRIMA di ogni resize
6. Strip metadati       Exif = Iptc = Xmp = Icc = null         ← DOPO AutoOrient
7. Varianti             per w in [400,800,1200,1600] con w <= sorgente:
                        Resize(Max, Lanczos3) → WebP q80 + JPEG q82
8. LQIP                 clone → 20 px → WebP q40 → base64 → Placeholder
9. Persistenza          scrivi in "{chiave}.tmp/" → Directory.Move → INSERT MediaAsset
```

**Perché l'ordine è la specifica, punto per punto.**

**(3) prima di (4) — il vincolo esplicito della proposal.** `Image.Identify` legge **solo l'header**: restituisce `ImageInfo { Width, Height, FrameCount }` senza allocare un bitmap. Un JPEG da 12 Mpx decompresso occupa ~48 MB (`Rgb24`, 3 byte/pixel — confermato: `JpegDecoder.Decode` non generico usa `Rgb24`); a 50 Mpx sarebbero ~150 MB. Rifiutare **prima** del decode è ciò che tiene in piedi il container. `stream.Position = 0` fra (3) e (4).

**(4) è il freno che la proposal non prevedeva.** `DecoderOptions.TargetSize` fa fare al decoder JPEG lo **scaling IDCT** (1/2, 1/4, 1/8) durante la decompressione: un 4000×3000 con `TargetSize = 1600` viene decodificato a 2000×1500 (~9 MB) e poi ridotto, invece di materializzare 36 MB. Non è una nostra ottimizzazione, è una feature del decoder. ⚠️ **Vale per JPEG**: PNG e WebP decodificano a piena risoluzione e poi scalano — ed è precisamente per loro che il tetto di (3) resta la garanzia dura, non un di più.

**(5) prima di (7).** `AutoOrient` legge il tag EXIF `Orientation` e applica rotate/flip, poi lo riazzera a `TopLeft`. Se il resize venisse prima, una foto verticale da telefono (che sul sensore è orizzontale con `Orientation = 6`) verrebbe ridotta **sull'asse sbagliato** e uscirebbe schiacciata. `Larghezza`/`Altezza` salvati in `MediaAsset` sono quelli **dopo** AutoOrient, cioè quelli che il browser vedrà: è ciò che rende l'attributo `width`/`height` corretto e azzera il CLS in Fase 2.

**(6) dopo (5), ed è l'errore classico.** Azzerare l'ExifProfile prima di AutoOrient rende AutoOrient un no-op silenzioso: nessun errore, e **tutte** le foto verticali ruotate di 90°. Dopo (5) l'orientamento è già cotto nei pixel e l'EXIF non serve più a niente. Si azzerano `ExifProfile` (dove vive il **GPS**), `IptcProfile`, `XmpProfile` e anche `IccProfile` — quest'ultimo perché consegnare un profilo colore sconosciuto sul web è peggio che assumere sRGB.

**(7) mai upscaling.** Si genera solo per `w <= sorgente.Width`, altrimenti si producono file più grandi **e** più sfocati dell'originale. Se la sorgente è più stretta di 400 px nessuna larghezza del set qualifica: scatta il fallback e si genera **una** variante alla larghezza nativa. **L'insieme delle varianti non è mai vuoto**, quindi il frontend ha sempre almeno un URL valido — ed è `LarghezzeDisponibili` a dire quali, invece di lasciarlo indovinare.

**(9) file prima, riga dopo.** I due modi di fallire non sono equivalenti: file senza riga = spazzatura invisibile e ripulibile; riga senza file = immagine rotta nella UI e nel sito. Si sceglie il fallimento che non mente. La directory temporanea evita che un crash a metà lasci una `Chiave` con 3 varianti su 8 — che sarebbe un file *presente* e *incompleto*, il caso peggiore dei tre.

**Doppio freno alla memoria** (le due misure sono indipendenti, e servono entrambe):
```csharp
// Program.cs — tetto duro sull'allocatore: limita il danno di UN file patologico
Configuration.Default.MemoryAllocator = MemoryAllocator.Create(new MemoryAllocatorOptions
{
    AllocationLimitMegabytes = 128,             // singolo buffer
    AccumulativeAllocationLimitMegabytes = 256, // totale vivo
});
```
Il `SemaphoreSlim(2)` limita la **concorrenza** (quanti file insieme), l'allocatore limita l'**ampiezza** (quanto può costare uno solo). Nessuno dei due sostituisce l'altro.

**Naming e slug.** `{anno}/{mese}/{slug}-{6char}`: `slug` da `NomeOriginale` senza estensione — minuscole, diacritici rimossi, non-alfanumerici → `-`, collassato, max 60 caratteri, fallback `"media"` se vuoto. `6char` da `RandomNumberGenerator` su un alfabeto senza caratteri ambigui (`0 O 1 l I`). Unicità garantita dall'indice UNIQUE su `Chiave`, con un retry sulla collisione.

**Originale non conservato — decisione, con il suo costo.** Raddoppierebbe lo spazio e, soprattutto, rimetterebbe sotto `/media` — servito da nginx a chiunque conosca l'URL — proprio il file con l'EXIF GPS che il passo (6) ha appena rimosso. Il master è la variante 1600. **Costo accettato: non sarà mai possibile rigenerare varianti sopra 1600 px** senza ricaricare la foto.

**Licenza.** `SixLabors.ImageSharp` 3.x è **Six Labors Split License**: gratuita sotto $1M di fatturato annuo. Da annotare con un commento nel `.csproj` accanto al `PackageReference`, dove la vedrà chi aggiorna le dipendenze.

---

### D12 — Gating a tre livelli e seed dei menu

**Choice.** Pattern Wiki ([SeedMenus.cs:838-921](../../../backend/SeedData/SeedMenus.cs)), tre livelli di cui **uno solo è sicurezza**:

| Livello | Dove | Cosa fa | È sicurezza? |
|---|---|---|---|
| 1 | Seed: `AssegnaRuoli` su `.Where(r => r.Amministratore \|\| r.Nome == "SuperAdmin")` | Il menu non compare | No: cosmesi |
| 2 | `SitoGuard.tsx` — `useStore(s => Boolean(s.utente?.ruolo?.amministratore))` | La pagina mostra un Alert | No: cosmesi |
| 3 | **`GuardUtenteAmministratore` su ogni scrittura** | Errore dal backend | 🔴 **Sì, l'unico** |

`.Authorize()` verifica solo *"autenticato"*. Senza il livello 3, un utente autenticato non amministratore scrive sul sito chiamando GraphQL o `POST /api/media` direttamente, saltando i primi due livelli che sono solo UI.

**Un problema di forma dell'errore, da risolvere in fase di apply.** `GuardUtenteAmministratore` lancia `ExecutionError`, un tipo GraphQL: dentro un controller REST diventerebbe un **500**. Si promuove la versione booleana — oggi duplicata come `private static IsAmministratore` in [`AuthMutations.cs:42-50`](../../../backend/GraphQL/Authentication/AuthMutations.cs) — a metodo pubblico condiviso:

```csharp
// GestioneCassaGuards.cs
public static async Task<bool> IsUtenteAmministratore(AppDbContext db, int utenteId) { … }

public static async Task GuardUtenteAmministratore(AppDbContext db, int utenteId)
{
    if (!await IsUtenteAmministratore(db, utenteId))
        throw new ExecutionError("Operazione riservata agli amministratori: …");
}
```
Il `MediaController` usa la booleana e restituisce `StatusCode(403, new { message = "…" })` — con un **corpo JSON `{ message }`**, come fa già `AuthController`, perché è la forma che `uploadRequest` sa leggere. Una query, due forme d'errore, zero duplicazione.

L'id utente si ottiene con `jwtHelper.GetUserID(User)` nel controller e con lo stesso helper via `GraphQLUserContext` nei resolver ([pattern in GestioneCassaMutations.cs:36-38](../../../backend/GraphQL/GestioneCassa/GestioneCassaMutations.cs)): un solo posto definisce "chi è l'utente corrente".

**Seed — `backend/SeedData/SeedMenusSito.cs`**, invocato in `Program.cs` dentro `if (seedOnStartup)`, dopo `SeedMenus.Initialize`.

⚠️ **La regola di idempotenza è diversa per padri e figli**, e la versione semplificata ("lookup per `Percorso`, mai per `Titolo`") è **sbagliata per i padri**: i menu padre hanno `Percorso = string.Empty` e sono indistinguibili dal solo percorso. Il pattern reale di `SeedMenus.cs` (righe 118, 211, 304, 428, 615, **854**) è:

| | Lookup | Esempio |
|---|---|---|
| **Padre** | `Titolo == "Sito" && Percorso == string.Empty` | riga 854 per "Wiki" |
| **Figlio** | `Percorso == "/gestionale/sito/media"` | riga 889 |

Il cleanup dei duplicati Dashboard ([SeedMenus.cs:59-76](../../../backend/SeedData/SeedMenus.cs)) è la prova documentata di cosa succede sbagliando.

| Voce | Titolo | Percorso | Icona | Pos. | `NomeVista` | `PercorsoFile` |
|---|---|---|---|---|---|---|
| Padre | `Sito` | `""` | `Globe` | 9 | `""` | `""` |
| Figlio 1 | `Libreria media` | `/gestionale/sito/media` | `Images` | 1 | `MediaLibrary` | `sito/MediaLibrary.tsx` |
| Figlio 2 | `Prodotti vetrina` | `/gestionale/sito/prodotti` | `ShoppingBag` | 2 | `VetrinaProdottiList` | `sito/VetrinaProdottiList.tsx` |

⚠️ **`PercorsoFile` è relativo a `src/components/pages/`** — verificato nel codice (`wiki/RegistroCassaWiki.tsx`), **non** il path completo che documenta `duedgusto/CLAUDE.md`. Si segue il codice.

`UpdateMenuIfNeeded` e `AssegnaRuoli` sono `private static` in `SeedMenus`: si promuovono a **`internal static`** e si riusano da `SeedMenusSito`. Copiarle produrrebbe due implementazioni della stessa idempotenza destinate a divergere.

Icone da aggiungere a [`iconMapping.tsx`](../../../duedgusto/src/components/layout/sideBar/iconMapping.tsx): **`Globe`, `Images`, `ShoppingBag`** — verificato che non ci sono; `BookOpen` c'è già. `lucide-react` è già dipendenza e l'aggiunta al `Record` le rende disponibili ovunque (sidebar, `IconFactory`, tendina icone di `MenuForm`) senza altre modifiche.

---

## Data Flow

### Upload — dove ogni limite parla, e chi risponde

```
MediaLibrary                nginx            Kestrel/MVC       MediaController        ImmagineProcessor      FS      DB
     │                        │                   │                   │                      │                │       │
     │ file.size > 20MB? ─────┤ (pre-check locale: nessun byte in rete)
     │   sì → messaggio in italiano, STOP        │                   │                      │                │       │
     │                        │                   │                   │                      │                │       │
     │ POST /api/media ──────>│                   │                   │                      │                │       │
     │ FormData(file)         │ >24M? → 413 ──────┤                   │                      │                │       │
     │ Bearer + XHR progress  │───────────────────>│ >22MB? → 413      │                      │                │       │
     │                        │                   │──────────────────>│                      │                │       │
     │                        │                   │        IsUtenteAmministratore? no → 403 {message}          │       │
     │                        │                   │                   │ ContentType/Length ──┤                │       │
     │                        │                   │                   │  fuori regola → 400 {message}          │       │
     │                        │                   │                   │─── Semaphore(2) ────>│                │       │
     │                        │                   │                   │   Identify (header)  │                │       │
     │                        │                   │                   │   >50Mpx → 400       │                │       │
     │                        │                   │                   │   Decode TargetSize 1600              │       │
     │                        │                   │                   │   AutoOrient → strip → 8 varianti + LQIP      │
     │                        │                   │                   │                      │─ tmp/ ────────>│       │
     │                        │                   │                   │                      │─ Move ────────>│       │
     │                        │                   │                   │<─────────────────────┤                │       │
     │                        │                   │                   │─────────────── INSERT MediaAsset ────────────>│
     │<─────────────── 201 { mediaAssetId, chiave, larghezze, placeholder } ─────────────────────────────────────────│
     │                                                                                                               │
     │ refetch() della connection GraphQL  (la cache Apollo non sa nulla dell'upload REST — §D6)
```

### 401 a metà upload — il caso che fa perdere il file se progettato male

```
MediaLibrary        uploadRequest      politicaRefresh    tokenRefreshManager     backend
     │                    │                   │                   │                  │
     │ upload(fd) ───────>│                   │                   │                  │
     │                    │ invia(false):     │                   │                  │
     │                    │  · onProgress(0)  │                   │                  │
     │                    │  · XHR #1 nuovo   │                   │                  │
     │<── 0…78% ──────────│  · getAuthHeaders() ─────────── token SCADUTO ──────────>│
     │                    │<────────────────────────────── 401 ──────────────────────│
     │                    │──── valuta(401) ─>│                   │                  │
     │                    │                   │ executeTokenRefresh() ──────────────>│
     │                    │                   │   (dedup globale: se un refresh è già in corso, attende quello)
     │                    │                   │<────────── nuovo token in localStorage │
     │                    │<─── "riprova" ────│                   │                  │
     │                    │ invia(true):      │                   │                  │
     │                    │  · onProgress(0)  ← altrimenti la barra torna indietro    │
     │                    │  · XHR #2 NUOVO   ← un XHR già send() non è riusabile     │
     │                    │  · getAuthHeaders() RILETTO ← altrimenti rimanda lo scaduto│
     │                    │  · stesso FormData ← non è uno stream, non si consuma     │
     │<── 0…100% ─────────│───────────────────────────────────────────────────────────>│
     │<─── 201 ───────────│<────────────────────────────── 201 ──────────────────────│
```

Se il secondo tentativo dà ancora 401 → `failOnForbidden: true` → `"abbandona"` → `onRefreshFails()`. **Un solo retry**, esattamente come `makeRequest`: due significherebbe caricare 60 MB per un token che non tornerà valido.

### Serving — la simmetria dev/prod

```
                       MediaAsset.Chiave = "2026/08/caffe-a1b2c3"     (identico ovunque)
                                     │
                       `${API_ENDPOINT}/media/${chiave}/800.webp`     (una sola espressione)
                                     │
              ┌──────────────────────┴──────────────────────┐
        DEVELOPMENT                                    PRODUCTION
   https://localhost:4000                          https://<SERVER_IP>
              │                                              │
     Kestrel · UseStaticFiles                         nginx · location /media/
     PhysicalFileProvider(MEDIA_ROOT)                 alias /opt/duedgusto/media/
     backend/media/                                   expires 1y, immutable
                                                             │
                                              bind mount ──> /app/media (uid 10001)
```

---

## File Changes

### Backend — nuovi

| File | Descrizione |
|---|---|
| `backend/Models/MediaAsset.cs` | Entità metadati. Nessun binario |
| `backend/Services/Media/MediaLimiti.cs` | Costanti: 20 MB, 50 Mpx, `[400,800,1200,1600]`, MIME ammessi. **Pinnata da test** |
| `backend/Services/Media/ImmagineProcessor.cs` | I nove passi di §D11 |
| `backend/Services/Media/IMediaStorage.cs` | Astrazione dello storage (oggi filesystem, domani S3 senza toccare il processor) |
| `backend/Services/Media/FileSystemMediaStorage.cs` | Scrittura in `{chiave}.tmp/` + `Directory.Move` |
| `backend/Services/Media/SlugGenerator.cs` | Slug + suffisso random crypto |
| `backend/Controllers/MediaController.cs` | **Solo** `POST /api/media` + `GET /api/media/configurazione` |
| `backend/GraphQL/Vetrina/VetrinaMutations.cs` | `mutateProdottoVetrina`, `mutateMediaAsset`, `eliminaMediaAsset` |
| `backend/GraphQL/Vetrina/Types/MediaAssetType.cs` | Output, con `urlRelativo`/`larghezze` derivati |
| `backend/GraphQL/Vetrina/Types/MediaAssetInputType.cs` | Patch alt/didascalia/ordinamento/pubblicato/focale |
| `backend/GraphQL/Vetrina/Types/ProdottoVetrinaInputType.cs` | **Esattamente i 10 campi vetrina** |
| `backend/SeedData/SeedMenusSito.cs` | Menu "Sito" + 2 voci, admin-only, idempotente |
| `backend/Migrations/*_AddMediaAsset.cs` | Migrazione 1 |
| `backend/Migrations/*_AddCampiVetrinaProdotto.cs` | Migrazione 2 |

### Backend — modificati

| File | Cosa cambia |
|---|---|
| `backend/Models/Prodotto.cs` | +10 campi vetrina + navigation `Immagine` |
| `backend/DataAccess/AppDbContext.cs` | `DbSet<MediaAsset>`, config `MediaAsset` (UNIQUE su `Chiave`), config dei 10 campi, FK `Restrict` |
| `backend/GraphQL/Vendite/Types/ProdottoType.cs` | +campi vetrina in lettura, `immagine`, `pubblicatoSulSito` (§D4) |
| `backend/GraphQL/Connection/ConnectionQueries.cs` | +`prodotti` (§D5), +`mediaAssets` |
| `backend/GraphQL/GraphQLMutations.cs` | +ramo `vetrina` (§D7) |
| `backend/GraphQL/GestioneCassa/GestioneCassaGuards.cs` | +`IsUtenteAmministratore` booleana (§D12) |
| `backend/GraphQL/Authentication/AuthMutations.cs` | `IsAmministratore` privata → delega alla condivisa |
| `backend/SeedData/SeedMenus.cs` | `UpdateMenuIfNeeded`/`AssegnaRuoli` da `private` a `internal` |
| `backend/Program.cs` | `MEDIA_ROOT`, `UseStaticFiles` in Development, `MemoryAllocator`, `SeedMenusSito.Initialize` |
| `backend/duedgusto.csproj` | +`SixLabors.ImageSharp` 3.x + commento sulla licenza |
| `backend/Dockerfile` | 🔴 UID/GID fissi a 10001 (§D9) |
| `backend/.gitignore` | +`media/` |

### Backend — **invariati, e va verificato che lo restino**

| File | Perché |
|---|---|
| `backend/GraphQL/Vendite/VenditeMutations.cs` | 🔴 `mutateProdotto` e `UpsertProdottoAsync` non si toccano |
| `backend/GraphQL/Vendite/Types/ProdottoInputType.cs` | 🔴 Il cuore del change. Pinnato da test strutturale (§D8) |
| `backend/GraphQL/Vendite/VenditeQueries.cs` | 🔴 **Divergenza dalla proposal**: non serve modificarlo, la connection nuova risolve il problema (§D5) |

### Frontend

| File | Azione | Descrizione |
|---|---|---|
| `duedgusto/src/api/politicaRefresh.tsx` | Nuovo | Decisione 401 condivisa (§D2) |
| `duedgusto/src/api/uploadRequest.tsx` | Nuovo | XHR multipart con progress (§D2) |
| `duedgusto/src/api/makeRequest.tsx` | Modificato | Righe 48-62 delegano a `politicaRefresh`. Firma e comportamento invariati |
| `duedgusto/src/api/__tests__/politicaRefresh.test.tsx` | Nuovo | Tre esiti in isolamento |
| `duedgusto/src/api/__tests__/uploadRequest.test.tsx` | Nuovo | Retry con XHR mockato |
| `duedgusto/src/components/pages/sito/SitoGuard.tsx` | Nuovo | Gate client, pattern `WikiLayout.tsx:36,50-56` |
| `duedgusto/src/components/pages/sito/MediaLibrary.tsx` | Nuovo | Card grid, upload, edit, delete |
| `duedgusto/src/components/pages/sito/MediaCard.tsx` | Nuovo | Card singola |
| `duedgusto/src/components/pages/sito/MediaUploadArea.tsx` | Nuovo | Drop zone + progress per file |
| `duedgusto/src/components/pages/sito/MediaPickerDialog.tsx` | Nuovo | Selettore immagine per la griglia prodotti |
| `duedgusto/src/components/pages/sito/VetrinaProdottiList.tsx` | Nuovo | AG Grid editing inline |
| `duedgusto/src/components/pages/sito/mediaUrl.tsx` | Nuovo | `mediaUrl(chiave, larghezza, formato)` — **unico punto** che compone URL (§D3) |
| `duedgusto/src/graphql/vetrina/fragments.tsx` | Nuovo | `mediaAssetFragment`, `prodottoVetrinaFragment` (template string, non `gql`) |
| `duedgusto/src/graphql/vetrina/queries.tsx` | Nuovo | Connection tipizzate |
| `duedgusto/src/graphql/vetrina/mutations.tsx` | Nuovo | `mutationMutateProdottoVetrina`, `mutationMutateMediaAsset`, `mutationEliminaMediaAsset` |
| `duedgusto/src/graphql/vetrina/useSubmitProdottoVetrina.tsx` | Nuovo | Pattern `useSubmitMenu.tsx` |
| `duedgusto/src/graphql/vetrina/useUploadMedia.tsx` | Nuovo | Wrapper su `uploadRequest` + stato progress |
| `duedgusto/src/@types/vetrina.d.ts` | Nuovo | `MediaAsset`, `ProdottoVetrina` |
| `duedgusto/src/components/layout/sideBar/iconMapping.tsx` | Modificato | +`Globe`, `Images`, `ShoppingBag` |

### Infrastruttura

| File | Cosa cambia |
|---|---|
| `docker-compose.yml` | Primo `volumes:` sul servizio `backend` + `MEDIA_ROOT` |
| `deploy/nginx/duedgusto.conf` | +`location /media/`, +`location /api/media` con `client_max_body_size 24M` |
| `deploy/scripts/deploy.sh` | `mkdir`+`chown 10001` media prima di `up`; commento al `rm -rf` riga 46 |
| `deploy/scripts/first-deploy.sh` | Idem; commento al `rm -rf` riga 350 |
| `deploy/scripts/setup-vps.sh` | `mkdir -p "$APP_DIR/media"` accanto alle righe 90-92 |
| `deploy/scripts/backup.sh` | 🔴 Sezione media in `rsync`, dopo il dump, senza rotazione (§D10) |

---

## Interfaces / Contracts

### EF Core — `MediaAsset`

```csharp
public class MediaAsset
{
    public int MediaAssetId { get; set; }
    public string Chiave { get; set; } = string.Empty;          // "2026/08/caffe-a1b2c3" — UNIQUE, senza /media
    public string NomeOriginale { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;        // MIME del sorgente
    public int Larghezza { get; set; }                          // DOPO AutoOrient
    public int Altezza { get; set; }
    public string LarghezzeDisponibili { get; set; } = string.Empty; // "400,800,1200,1600"
    public string? TestoAlternativo { get; set; }
    public string? Didascalia { get; set; }
    public string? Focale { get; set; }                         // "50% 40%" per object-position
    public string? Placeholder { get; set; }                    // LQIP data URI base64, <= 4 KB
    public string Cartella { get; set; } = "generale";
    public int Ordinamento { get; set; }
    public bool Pubblicato { get; set; } = true;
    public long ByteTotali { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // 🔴 Navigazione inversa: si scrive INSIEME al lato FK su Prodotto (migrazione 2), mai prima.
    //    Da sola, questa collezione basta a far scoprire a EF Core la relazione uno-a-molti, che
    //    materializza una foreign key OMBRA "MediaAssetId" su Prodotti dentro AddMediaAsset —
    //    una colonna che non è nemmeno uno dei dieci campi vetrina (il nome corretto è ImmagineId).
    //    Lo stato finale del modello è esattamente quello scritto qui: è l'ORDINE di scrittura a
    //    essere vincolato, non il contenuto. Vedi §"Le due migrazioni".
    public ICollection<Prodotto> Prodotti { get; set; } = [];
}
```

**La navigazione inversa è l'unico campo di questo blocco con un vincolo di _sequenza_.** Il blocco descrive lo stato finale dell'entità, e in quello stato `Prodotti` c'è. Ma scriverla nel momento in cui si crea `MediaAsset.cs` fa nascere una FK ombra `MediaAssetId` su `Prodotti` già nella migrazione 1, che a quel punto non è più revertibile indipendentemente da `AddCampiVetrinaProdotto` — cioè si perde esattamente la proprietà per cui le migrazioni sono due.

**`LarghezzeDisponibili` è un'aggiunta rispetto alla proposal, e serve.** Una sorgente da 900 px produce solo `[400, 800]`. Senza questo campo, Fase 2 emetterebbe un `srcset` con quattro voci di cui due 404 — e un `srcset` con URL rotti degrada in modo silenzioso e diverso da browser a browser. Con il campo, l'`srcset` si costruisce da un dato invece che da un'assunzione.

### EF Core — campi vetrina su `Prodotto`

```csharp
    // ── Campi vetrina (sito pubblico) ────────────────────────────────────────
    // 🔴 NESSUNO di questi campi deve mai comparire in ProdottoInput: UpsertProdottoAsync
    //    assegna ogni campo esplicitamente e li azzererebbe in massa. Vedi design.md §D8.
    public bool VisibileSulSito { get; set; }                   // default FALSE, opt-in
    public string? NomeVetrina { get; set; }
    public string? DescrizioneVetrina { get; set; }
    public string? CategoriaVetrina { get; set; }               // separata da Categoria (contabile)
    public decimal? PrezzoVetrina { get; set; }                 // null = fallback a Prezzo
    public int? ImmagineId { get; set; }
    public MediaAsset? Immagine { get; set; }
    public int OrdinamentoVetrina { get; set; }
    public string? Allergeni { get; set; }
    public bool Novita { get; set; }
    public bool Consigliato { get; set; }
```

### Configurazione `OnModelCreating`

```csharp
modelBuilder.Entity<MediaAsset>(entity =>
{
    entity.ToTable("MediaAssets").HasCharSet("utf8mb4").UseCollation("utf8mb4_unicode_ci")
          .HasKey(x => x.MediaAssetId);
    entity.Property(x => x.MediaAssetId).ValueGeneratedOnAdd();
    entity.Property(x => x.Chiave).HasMaxLength(255).IsRequired();
    entity.HasIndex(x => x.Chiave).IsUnique();           // ← garantisce l'unicità dello slug
    entity.Property(x => x.NomeOriginale).HasMaxLength(255).IsRequired();
    entity.Property(x => x.MimeType).HasMaxLength(100).IsRequired();
    entity.Property(x => x.LarghezzeDisponibili).HasMaxLength(100).IsRequired();
    entity.Property(x => x.TestoAlternativo).HasMaxLength(500);
    entity.Property(x => x.Didascalia).HasMaxLength(500);
    entity.Property(x => x.Focale).HasMaxLength(20);
    entity.Property(x => x.Placeholder).HasColumnType("text");
    entity.Property(x => x.Cartella).HasMaxLength(100).HasDefaultValue("generale");
    entity.Property(x => x.Pubblicato).HasDefaultValue(true);
    entity.HasIndex(x => new { x.Cartella, x.Ordinamento });    // elenco per cartella ordinato
    entity.Property(x => x.CreatedAt).HasColumnType("datetime").HasDefaultValueSql("CURRENT_TIMESTAMP");
    entity.Property(x => x.UpdatedAt).HasColumnType("datetime")
          .HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
});

// dentro modelBuilder.Entity<Prodotto>(...) esistente
entity.Property(x => x.VisibileSulSito).HasDefaultValue(false);   // ← esplicito: backfill a false
entity.Property(x => x.NomeVetrina).HasMaxLength(255);
entity.Property(x => x.DescrizioneVetrina).HasColumnType("text");
entity.Property(x => x.CategoriaVetrina).HasMaxLength(100);
entity.Property(x => x.PrezzoVetrina).HasColumnType("decimal(10,2)");   // convenzione valute
entity.Property(x => x.OrdinamentoVetrina).HasDefaultValue(0);
entity.Property(x => x.Allergeni).HasMaxLength(255);
entity.Property(x => x.Novita).HasDefaultValue(false);
entity.Property(x => x.Consigliato).HasDefaultValue(false);

entity.HasOne(x => x.Immagine)
      .WithMany(x => x.Prodotti)
      .HasForeignKey(x => x.ImmagineId)
      .OnDelete(DeleteBehavior.Restrict);      // eliminare un media referenziato deve fallire
entity.HasIndex(x => x.VisibileSulSito);       // filtro dell'API pubblica di Fase 2
```

### Contratto REST — `POST /api/media`

```
POST /api/media                          [Authorize] + IsUtenteAmministratore
Content-Type: multipart/form-data
[RequestSizeLimit(23068672)] [RequestFormLimits(MultipartBodyLengthLimit = 23068672)]

  file       IFormFile   (obbligatorio, UNO solo)
  cartella   string?     (default "generale")
  alt        string?

201 → { mediaAssetId, chiave, larghezza, altezza, larghezzeDisponibili, placeholder, mimeType }
400 → { message }   MIME non ammesso · > 20 MB · > 50 Mpx · < 200 px · animata · non decodificabile
403 → { message }   non amministratore
409 → { message }   collisione di chiave irrisolta dopo i retry
503 → { message }   semaforo saturo, "riprova fra qualche secondo"
```

**Ogni errore ha un corpo JSON `{ message }` in italiano**, come `AuthController`. È la forma che `uploadRequest` sa leggere e mostrare.

### Contratto GraphQL

```graphql
type MediaAsset {
  mediaAssetId: Int!
  chiave: String!                 # "2026/08/caffe-a1b2c3" — senza /media, senza host
  nomeOriginale: String!
  mimeType: String!
  larghezza: Int!
  altezza: Int!
  larghezzeDisponibili: [Int!]!
  testoAlternativo: String
  didascalia: String
  focale: String
  placeholder: String
  cartella: String!
  ordinamento: Int!
  pubblicato: Boolean!
  byteTotali: Long!
  createdAt: DateTime!
  updatedAt: DateTime!
}

extend type Prodotto {
  visibileSulSito: Boolean!
  nomeVetrina: String
  descrizioneVetrina: String
  categoriaVetrina: String
  prezzoVetrina: Decimal
  immagine: MediaAsset
  ordinamentoVetrina: Int!
  allergeni: String
  novita: Boolean!
  consigliato: Boolean!
  pubblicatoSulSito: Boolean!     # DERIVATO: attivo && visibileSulSito — §D4. Sola lettura
}

input ProdottoVetrinaInput {      # esattamente 10 campi. Zero campi cassa.
  visibileSulSito: Boolean!
  nomeVetrina: String
  descrizioneVetrina: String
  categoriaVetrina: String
  prezzoVetrina: Decimal
  immagineId: Int
  ordinamentoVetrina: Int!
  allergeni: String
  novita: Boolean!
  consigliato: Boolean!
}

type VetrinaMutation {
  mutateProdottoVetrina(prodottoId: Int!, input: ProdottoVetrinaInput!): Prodotto
  mutateMediaAsset(mediaAssetId: Int!, input: MediaAssetInput!): MediaAsset
  eliminaMediaAsset(mediaAssetId: Int!): Boolean
}

extend type ConnectionQuery {
  prodotti(first: Int, after: String, cursor: Int, where: String, orderBy: String): ProdottoConnection
  mediaAssets(first: Int, after: String, cursor: Int, where: String, orderBy: String): MediaAssetConnection
}
```

### Frontend — composizione URL, punto unico

```tsx
// duedgusto/src/components/pages/sito/mediaUrl.tsx
//
// UNICO punto del frontend che compone un URL di media. API_ENDPOINT punta, in
// entrambi gli ambienti, all'host che serve /media/ (dev: .NET UseStaticFiles;
// prod: nginx alias). Nessun ramo per ambiente — vedi design.md §D3.
export function mediaUrl(chiave: string, larghezza: number, formato: "webp" | "jpg" = "webp"): string {
  return `${(window as Global).API_ENDPOINT}/media/${chiave}/${larghezza}.${formato}`;
}

export function mediaSrcSet(chiave: string, larghezze: number[], formato: "webp" | "jpg" = "webp"): string {
  return larghezze.map((w) => `${mediaUrl(chiave, w, formato)} ${w}w`).join(", ");
}
```

---

## UI — le due pagine

### `VetrinaProdottiList.tsx` — AG Grid, la pagina d'uso quotidiano

Layout secondo `react-best-practices` §1-2, identico alle sei liste esistenti:

```tsx
<SitoGuard>
  <ListToolbar hideNewButton hideDeleteButton /* … */ />
  <Box className="scrollable-box" sx={{ marginTop: 1, paddingX: 2, overflow: "auto",
                                        height: "calc(100dvh - 64px - 48px)" }}>
    <Typography id="view-title" variant="h5" gutterBottom>Prodotti vetrina</Typography>
    <Datagrid<ProdottoVetrinaRow> gridId="vetrina-prodotti" height="calc(100% - 50px)"
      items={righe} columnDefs={columnDefs} readOnly={false} hideToolbar
      getRowId={({ data }) => data.prodottoId.toString()}
      validationSchema={prodottoVetrinaSchema}
      onCellValueChanged={handleCellValueChanged} onGridReady={handleGridReady} />
  </Box>
</SitoGuard>
```

🔴 **`hideNewButton` + `hideDeleteButton` + nessun `getNewRow`.** È il confine di §D8 espresso nella UI: senza `getNewRow`, Tab sull'ultima cella **non** crea una riga. Questa griglia non può creare né eliminare prodotti — l'anagrafica prodotti resta della cassa. La regola è imposta dalla forma del componente, non da un promemoria.

| Colonna | Editabile | Editor / renderer |
|---|---|---|
| `codice` | **no** | filtro testo, `width: 110` |
| `nome` | **no** | filtro testo, `flex: 2` |
| `prezzo` | **no** | `valueFormatter` € |
| `attivo` | **no** | `Chip` — lo stato cassa, sempre visibile (§D4) |
| `pubblicatoSulSito` | **no** | `Chip` verde/grigio + tooltip *"Visibile sul sito ma non attivo in cassa: non verrà pubblicato"* quando diverge |
| `visibileSulSito` | sì | `agCheckboxCellEditor` |
| `nomeVetrina` | sì | testo — placeholder `nome` se vuoto |
| `categoriaVetrina` | sì | `agRichSelectCellEditor` con `allowTyping`, valori = categorie vetrina già usate |
| `prezzoVetrina` | sì | `agNumberCellEditor` `{ min: 0, precision: 2 }` — vuoto = *"come cassa"* |
| `immagine` | sì | `cellRenderer` thumbnail (`placeholder` → `400.webp`); click → `MediaPickerDialog` |
| `ordinamentoVetrina` | sì | `agNumberCellEditor` |
| `novita`, `consigliato` | sì | `agCheckboxCellEditor` |
| `allergeni` | sì | testo |
| `descrizioneVetrina` | sì | `agLargeTextCellEditor` |

**Persistenza per riga**, come `SpeseDataGrid`: `onCellValueChanged` → `mutateProdottoVetrina(prodottoId, <intera riga vetrina>)`. In errore si ripristina il valore precedente nella cella e si mostra un toast — non si lascia la griglia a mostrare un valore che il server ha rifiutato.

**Filtro "mostra non attivi"** (§D4): toggle nella toolbar → `api.setFilterModel` su `attivo`. Client-side, zero round trip, perché `useGetAll` ha già tutto.

### `MediaLibrary.tsx` — card, non griglia

Card MUI su layout Tailwind `grid grid-cols-12`, sul modello di `MonthlyView.tsx:83-163` (unico precedente Card nel progetto). Ogni card: `CardMedia` con `400.webp` e il `placeholder` come `background-image` (niente salto di layout durante il caricamento), nome originale, dimensioni, cartella, badge "non pubblicato", azioni Modifica/Elimina.

- **Upload**: `<input type="file" multiple accept={mimeAmmessi}>` + drop zone. **Un `uploadRequest` per file**, in `Promise.all` con concorrenza limitata a 2 (specchia il semaforo backend: inviarne 8 insieme significa 6 richieste che aspettano il semaforo e possono scadere in 503).
- **Pre-check** su `file.size` e `file.type` contro `/api/media/configurazione` (§D1) — l'utente vede il messaggio prima che parta un byte.
- **Progress** per file da `xhr.upload.onprogress`.
- **Modifica**: dialog con alt, didascalia, cartella, ordinamento, pubblicato → `mutateMediaAsset`.
- **Elimina**: `useConfirm` → `eliminaMediaAsset`. Se referenziato, l'errore GraphQL nomina i prodotti e **niente viene cancellato** (§D6).
- Al termine di un upload: `refetch()` della connection (§D6).

---

## Testing Strategy

| Layer | Cosa | Come |
|---|---|---|
| **Unit .NET** | 🔴 `ProdottoInput` non contiene campi vetrina | Test **strutturale** su `GetProperties()` — §D8 |
| **Unit .NET** | 🔴 `ProdottoVetrinaInput` non contiene campi cassa | Intersezione vuota fra i due set |
| **Unit .NET** | `MediaLimiti.MaxByteFile == 20 MB` | Pinning, ricorda di aggiornare nginx |
| **Unit .NET** | Pipeline: `> 50 Mpx` rifiutata **senza decode** | Header JPEG sintetico; asserire che `Identify` basti |
| **Unit .NET** | AutoOrient prima dello strip | JPEG con `Orientation = 6`: verificare che l'output sia ruotato **e** senza EXIF |
| **Unit .NET** | Strip completo | `ExifProfile`/`Iptc`/`Xmp`/`Icc` tutti `null` nell'output; **nessun tag GPS** |
| **Unit .NET** | Mai upscaling, insieme mai vuoto | Sorgente 900 px → `LarghezzeDisponibili == "400,800"`. Sorgente 300 px → nessuna larghezza del set è `<= 300`, scatta il fallback: **una** variante alla larghezza nativa, `LarghezzeDisponibili == "300"` |
| **Unit .NET** | Slug | Accenti, spazi, stringa vuota, > 60 char, caratteri di path (`../`) neutralizzati |
| **Integration .NET** | 🔴 `mutateProdotto` non azzera i campi vetrina | Prodotto con vetrina piena → `UpsertProdottoAsync` con payload cassa → vetrina **intatta**. In `SalesTests.cs`, accanto alla region esistente |
| **Integration .NET** | 🔴 `mutateProdottoVetrina` non tocca i campi cassa | Direzione opposta |
| **Integration .NET** | `mutateProdottoVetrina` con id inesistente → errore, nessuna creazione | Conta i prodotti prima/dopo |
| **Integration .NET** | Non amministratore rifiutato su ogni scrittura | In `PrivilegiAmministrativiTests.cs` |
| **Integration .NET** | Ramo `vetrina` nega l'anonimo | **Automatico**: `AutorizzazioneAnonimaTests` enumera i rami dallo schema |
| **Integration .NET** | `eliminaMediaAsset` referenziato → rifiuto + nomi prodotti + nulla cancellato | — |
| **Integration .NET** | `connection { prodotti }` include i non attivi | Seed 1 attivo + 1 non attivo → 2 risultati |
| **Integration .NET** | Seed idempotente | `SeedMenusSito.Initialize` × 3 → **un** padre "Sito", **due** figli |
| **Unit React** | `politicaRefresh`: `procedi` / `riprova` / `abbandona` | `refreshToken` mockato |
| **Unit React** | `uploadRequest`: 401 → refresh → **secondo XHR** con **header riletto** | XHR mockato; asserire due istanze e due `getAuthHeaders()` |
| **Unit React** | `uploadRequest`: 401 al retry → `onRefreshFails`, **nessun terzo tentativo** | — |
| **Unit React** | `uploadRequest`: `onProgress(0)` all'inizio del retry | Sequenza di chiamate |
| **Unit React** | `uploadRequest`: 413 con corpo HTML → messaggio leggibile, non `SyntaxError` | — |
| **Unit React** | `makeRequest` invariato | **I 4 test esistenti devono passare senza modifiche** |
| **Unit React** | `mediaUrl`/`mediaSrcSet` | `API_ENDPOINT` mockato |
| **Unit React** | `VetrinaProdottiList`: `codice`/`nome`/`prezzo` non editabili, nessun `getNewRow` | Testing Library sulle `columnDefs` |
| **Manuale / E2E** | Upload reale → 8 file su disco → `exiftool` senza GPS → immagine da nginx | Success criteria della proposal |
| **Manuale** | **Simulazione deploy**: dopo `deploy.sh` i media ci sono ancora | 🔴 Il rischio principale di §D9 |
| **Manuale** | **Simulazione restore**: `backup.sh` + restore ricostruisce DB **e** file, zero 404 | 🔴 §D10 |
| **Manuale** | Upload da 15 MB e da 30 MB: messaggi leggibili, non 413 nudi | §D1 |

---

## Migration / Rollout

### Le due migrazioni: l'ordine vincola lo _scaffolding_, non solo l'apply

Il modo preciso di dirlo — più utile del semplice "prima la 1, poi la 2":

> Se si aggiungono **entrambe** le modifiche al modello e poi si lancia `migrations add AddMediaAsset`, EF genera **una sola migrazione con dentro tutto**. L'ordine non è un vincolo sull'esecuzione, è un vincolo su **quando si scrive il codice del modello**.

**Procedura obbligata:**

```bash
cd backend

# ── Passo 1: SOLO MediaAsset ────────────────────────────────────────────────
#   Models/MediaAsset.cs + DbSet<MediaAsset> + config OnModelCreating.
#   NIENTE campi vetrina su Prodotto in questo momento — e NIENTE collezione
#   ICollection<Prodotto> Prodotti su MediaAsset: da sola farebbe nascere qui
#   una FK ombra "MediaAssetId" su Prodotti.
EF_MIGRATIONS=1 dotnet ef migrations add AddMediaAsset

# ── Passo 2: SOLO ORA i campi vetrina ───────────────────────────────────────
#   I 10 campi su Prodotto.cs + config + FK Restrict verso MediaAsset,
#   e la navigazione inversa ICollection<Prodotto> Prodotti su MediaAsset.
EF_MIGRATIONS=1 dotnet ef migrations add AddCampiVetrinaProdotto
```

`EF_MIGRATIONS=1` è obbligatorio: senza, `ServerVersion.AutoDetect` apre una connessione e il comando richiede un MySQL in esecuzione ([Program.cs:93-95](../../../backend/Program.cs)).

Entrambe si applicano da sole all'avvio ([Program.cs:291](../../../backend/Program.cs)).

**Le due migrazioni sono strettamente additive**: una tabella nuova e dieci colonne nullable o con default. **Nessuna riga esistente viene riscritta**, nessun dato di cassa viene toccato. `VisibileSulSito` nasce `false` su tutti i prodotti esistenti: al primo avvio dopo il deploy, il sito ha zero prodotti pubblicati, che è lo stato corretto.

**Perché due e non una** (l'argomento reale, oltre alla FK): sono **indipendentemente revertibili**. `AddMediaAsset` serve anche alle Fasi 2-5 (galleria, eventi, promozioni, sezioni pagina), che non hanno nulla a che vedere con `Prodotto`. Fonderle significherebbe che un rollback dei campi vetrina trascina via anche la tabella dei media di tutte le altre fasi.

### Ordine di rollout

1. `SixLabors.ImageSharp` nel `.csproj` + `dotnet build`
2. Migrazione 1 → `dotnet ef database update` locale, verifica dello schema
3. Migrazione 2 → idem
4. `MediaController` + pipeline + test unitari → **verificabile con `curl` da solo**, senza UI
5. `UseStaticFiles` + `mediaUrl` → l'immagine si vede nel browser in dev
6. Ramo `vetrina` + connection + test del confine → **verificabile con GraphiQL da solo**
7. `MediaLibrary`
8. `VetrinaProdottiList`
9. Seed menu → riavvio ×3, verifica di non duplicazione
10. Infrastruttura: `Dockerfile` (UID), `docker-compose`, nginx, script di deploy, `backup.sh`
11. **Primo deploy sul VPS con verifica a mano** di `/opt/duedgusto/media` (owner `10001`, mode `755`) prima di fidarsi dello script

Ogni gradino è verificabile senza il successivo. Nessuno di essi tocca la cassa.

### Rollback

Come da proposal, con una precisazione: le migrazioni **si lasciano in produzione**. Una tabella vuota e dieci colonne inutilizzate non hanno alcun effetto sulla cassa; la migrazione `down` invece **cancella i dati di vetrina inseriti**. `/opt/duedgusto/media` sopravvive a qualunque revert del codice — rimuoverlo è un'azione manuale e deliberata.

**Punto di non ritorno: non ce n'è in questa fase.** I media non sono ancora esposti pubblicamente (l'API pubblica arriva in Fase 2), quindi un rollback non produce link rotti verso l'esterno.

---

## Divergenze dalla proposal (da recepire in `sdd-spec`)

Tutte discendono dallo stesso principio — *non toccare il ramo cassa, usare la macchina che il progetto ha già* — e sono state verificate sul codice reale.

| # | Proposal | Design | Perché |
|---|---|---|---|
| 1 | `GET`/`PATCH`/`DELETE` media in REST | **GraphQL**; REST solo per `POST` multipart | §D6 — la dottrina è scritta in `AutorizzazioneAnonimaTests:21-23`: REST = pubblico, GraphQL = privato |
| 2 | `mutateProdottoVetrina` nel ramo `vendite` | Nuovo ramo **`vetrina`** | §D7 — le Fasi 2-5 hanno bisogno di quella casa, e il ramo dice al lettore in che territorio si trova |
| 3 | `VenditeQueries.cs` **modificato** (`includiNonAttivi`) | `VenditeQueries.cs` **invariato**; nuova `connection { prodotti }` | §D5 — `prodotti` non ha consumatori; la connection permette di copiare `FornitoreList` verbatim |
| 4 | `backup.sh` con tar + rotazione 30gg | **`rsync` append-only, senza rotazione** | §D10 — ruotare i media significa cancellare l'unica copia |
| 5 | — | **UID fissato a 10001** nel `Dockerfile` | §D9 — `useradd -r` assegna un UID non deterministico; il `chown` del bind mount sbaglierebbe bersaglio |
| 6 | — | **`LarghezzeDisponibili`** su `MediaAsset` | Sorgenti piccole producono meno varianti; senza il campo, Fase 2 emette `srcset` con 404 |
| 7 | — | **`pubblicatoSulSito`** derivato su `ProdottoType` | §D4 — la regola di pubblicazione vive in una riga sola e non può andare fuori sincrono |
| 8 | Success criterion *"`DELETE` risponde 409"* | *"il tentativo è rifiutato, l'errore nomina i prodotti, nulla viene cancellato"* | Conseguenza di #1: comportamento identico, trasporto diverso |

---

## Open Questions

Nessuna bloccante. Tre punti da decidere in fase di apply, ciascuno con la raccomandazione già presa:

- [ ] **`Allergeni` testo libero vs lista controllata.** Raccomandazione: **testo libero** (`varchar(255)`) in questa fase. Una tassonomia dei 14 allergeni UE è utile ma è una decisione di Fase 2, quando il template Astro dirà come vanno resi. Migrare da testo libero a lista controllata più tardi è una migrazione additiva.
- [ ] **Soglia megapixel: 50.** Copre ogni smartphone in circolazione (48 Mpx è il massimo comune) e, combinata con `TargetSize`, non arriva mai a materializzare un bitmap intero. Se dai log emergessero rifiuti legittimi, si alza il numero in `MediaLimiti` — non c'è nient'altro da cambiare.
- [ ] **`Cartella`: elenco libero o insieme chiuso?** Raccomandazione: **stringa libera con default `"generale"`** ora, insieme chiuso in Fase 2 quando si sapranno le cartelle vere (`gallery`, `eventi`, `prodotti`, `hero`). L'indice `(Cartella, Ordinamento)` è già pronto per entrambe le forme.
