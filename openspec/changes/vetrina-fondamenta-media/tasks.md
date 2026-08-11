# Tasks: Fondamenta media + campi vetrina (vetrina-fondamenta-media)

> Artefatti di riferimento: [proposal.md](./proposal.md), [design.md](./design.md) (§D1-D12),
> [specs/](./specs/) — 4 spec, 29 requirement, 111 scenari.
>
> **Come leggere questo file.** Ogni task ha una *Verifica*: chi lo chiude deve poter
> dimostrare che è chiuso, con un comando o un'osservazione. Ogni fase si apre con la
> ragione per cui esiste e si chiude con lo stato in cui lascia l'albero. **Le fasi sono
> ordinate perché ognuna sia provabile da sola**: alla fine della Fase 2 si carica
> un'immagine con `curl` senza una riga di frontend; alla fine della Fase 3 si scrive un
> campo vetrina da GraphiQL senza una pagina.
>
> **Tre risoluzioni di conflitto già decise, da non rimettere in discussione durante l'apply:**
> 1. 🔴 **La spec `sicurezza` vince sul design §D12**: il guard amministratore va **anche
>    sulla lettura** `connection { mediaAssets }`, non solo sulle scritture (task 3.10).
> 2. 🔴 **`prezzoEffettivoVetrina` esiste** (spec `vetrina-prodotti` §"Prezzo mostrato in
>    vetrina"). Il blocco GraphQL del design lo omette per lacuna, non per scelta: è lo
>    stesso principio di `pubblicatoSulSito`, la regola del fallback vive in un posto solo
>    (task 3.3).
> 3. **Il nome corretto del campo derivato è `pubblicatoSulSito`** (non `pubblicatoSilSito`).
>
> **Tre test pinnano il confine e stanno in Fase 3, non in Fase 7** (3.13, 3.14, 3.15):
> sono la ragione per cui questa change esiste come fase a sé, e devono essere verdi nel
> momento esatto in cui i tipi che pinnano vengono creati.

---

## Fase 1 — Modello dati e migrazioni

**Perché esiste.** `Prodotto.ImmagineId` è una FK verso `MediaAsset`: senza la tabella, la
seconda migrazione non compila. E l'ordine delle due migrazioni è un vincolo sullo
**scaffolding**, non sull'apply — sbagliarlo non dà errore, dà una migrazione sola con
dentro tutto (task 1.4 e 1.8).

**Task di migrazione database (1.4, 1.5, 1.8, 1.9) separati da quelli di codice
applicativo**, come da `openspec/config.yaml` → `rules.tasks`.

- [x] 1.1 **Dipendenza ImageSharp** — aggiungi `<PackageReference Include="SixLabors.ImageSharp" Version="3.*" />` a `backend/duedgusto.csproj`, con un commento accanto: *Six Labors Split License — gratuita sotto $1M di fatturato annuo*.
  *Verifica*: `cd backend && dotnet build` esce 0 e il commento è visibile nel `.csproj` a chi aggiorna le dipendenze.

- [x] 1.2 **Entità `MediaAsset`** — crea `backend/Models/MediaAsset.cs` con i campi di design.md §"Interfaces / Contracts" (`Chiave`, `NomeOriginale`, `MimeType`, `Larghezza`, `Altezza`, `LarghezzeDisponibili`, `TestoAlternativo`, `Didascalia`, `Focale`, `Placeholder`, `Cartella`, `Ordinamento`, `Pubblicato`, `ByteTotali`, `CreatedAt`, `UpdatedAt`). **Nessun campo binario**: il placeholder LQIP è testo base64. 🔴 **Niente ancora la navigazione inversa `ICollection<Prodotto> Prodotti`**: da sola basta a far scoprire a EF Core la relazione uno-a-molti e a far nascere una FK **ombra** `MediaAssetId` su `Prodotti` dentro la migrazione 1 — una colonna che non è nemmeno uno dei dieci campi vetrina (il nome corretto è `ImmagineId`) — violando il vincolo del task 1.4. Si dichiara nel task 1.6, insieme al lato FK.
  *Verifica*: `dotnet build` esce 0; nessuna proprietà è `byte[]` o `Stream`; nessuna proprietà di navigazione verso `Prodotto`.

- [x] 1.3 **`DbSet` e configurazione `MediaAsset`** — in `backend/DataAccess/AppDbContext.cs`: `DbSet<MediaAsset> MediaAssets`, blocco `modelBuilder.Entity<MediaAsset>` con `ToTable("MediaAssets")`, charset/collation `utf8mb4`, **indice UNIQUE su `Chiave`**, indice `(Cartella, Ordinamento)`, `Placeholder` come `text`, `Cartella` default `"generale"`, `Pubblicato` default `true`, timestamp con `CURRENT_TIMESTAMP` (design.md §"Configurazione OnModelCreating").
  *Verifica*: `dotnet build` esce 0. **NON aggiungere ancora nulla a `Prodotto`** — è il vincolo del task 1.4.

- [x] 1.4 🔴 **Scaffolding migrazione 1 — `AddMediaAsset`** — con **solo** i task 1.2 e 1.3 applicati al modello e **nessun campo vetrina su `Prodotto`**, esegui da `backend/`:
  ```bash
  EF_MIGRATIONS=1 dotnet ef migrations add AddMediaAsset
  ```
  `EF_MIGRATIONS=1` è obbligatorio: senza, `ServerVersion.AutoDetect` apre una connessione e serve un MySQL in esecuzione ([Program.cs:93-95](../../../backend/Program.cs)).
  *Verifica*: il file `backend/Migrations/*_AddMediaAsset.cs` contiene **una sola** `CreateTable("MediaAssets")` e **zero** `AddColumn` sulla tabella `Prodotti`. Se compare anche una sola `AddColumn` su `Prodotti`, la migrazione è sbagliata: `dotnet ef migrations remove`, azzera dal modello i campi vetrina **e la navigazione inversa `ICollection<Prodotto> Prodotti` su `MediaAsset`** (una `AddColumn` di nome `MediaAssetId` è la firma della FK ombra, e viene da lì), rilancia.

- [x] 1.5 **Applicazione migrazione 1 in locale** — `EF_MIGRATIONS=1 dotnet ef database update` su un database che contiene già dati di cassa.
  *Verifica*: `SHOW CREATE TABLE MediaAssets` mostra l'indice UNIQUE su `Chiave`; `SELECT COUNT(*) FROM Prodotti` è identico a prima.

- [x] 1.6 **Dieci campi vetrina su `Prodotto` e navigazione inversa su `MediaAsset`** — in `backend/Models/Prodotto.cs` aggiungi `VisibileSulSito`, `NomeVetrina`, `DescrizioneVetrina`, `CategoriaVetrina`, `PrezzoVetrina`, `ImmagineId`, `Immagine`, `OrdinamentoVetrina`, `Allergeni`, `Novita`, `Consigliato`, preceduti dal commento di protezione di design.md §"EF Core — campi vetrina": *🔴 NESSUNO di questi campi deve mai comparire in `ProdottoInput`*. **Nello stesso momento**, e non prima, aggiungi a `backend/Models/MediaAsset.cs` la navigazione inversa `ICollection<Prodotto> Prodotti`, con il commento che spiega perché non poteva stare nel task 1.2 (FK ombra su `Prodotti` dentro la migrazione 1). Lo stato finale del modello è quello di design.md §"Interfaces / Contracts": cambia solo il momento in cui lo si scrive.
  *Verifica*: `dotnet build` esce 0; i 9 campi contabili preesistenti sono invariati (`git diff backend/Models/Prodotto.cs` mostra solo aggiunte); `MediaAsset.Prodotti` esiste ed è il lato inverso di `Prodotto.Immagine`.

- [x] 1.7 **Configurazione dei campi vetrina e della FK** — in `AppDbContext.OnModelCreating`, dentro il blocco `Prodotto` esistente: default espliciti (`VisibileSulSito`/`Novita`/`Consigliato` = `false`, `OrdinamentoVetrina` = `0`), `PrezzoVetrina` come `decimal(10,2)`, `DescrizioneVetrina` come `text`, lunghezze massime, **FK `Immagine` con `OnDelete(DeleteBehavior.Restrict)`** e indice su `VisibileSulSito`.
  *Verifica*: `dotnet build` esce 0.

- [x] 1.8 🔴 **Scaffolding migrazione 2 — `AddCampiVetrinaProdotto`** — **solo ora**, da `backend/`:
  ```bash
  EF_MIGRATIONS=1 dotnet ef migrations add AddCampiVetrinaProdotto
  ```
  *Verifica*: il file generato contiene **solo** `AddColumn` su `Prodotti` + `CreateIndex` + `AddForeignKey` verso `MediaAssets` con `ReferentialAction.Restrict`, e **nessuna** `CreateTable`. Le due migrazioni restano due file distinti (sono indipendentemente revertibili: `AddMediaAsset` serve anche alle Fasi 2-5).

- [x] 1.9 **Applicazione migrazione 2 e prova di additività** — `EF_MIGRATIONS=1 dotnet ef database update` sullo stesso database popolato del task 1.5.
  *Verifica* (spec `vetrina-prodotti` → *Migrazione su listino già popolato*): su ogni prodotto preesistente `VisibileSulSito = 0`, `Novita = 0`, `Consigliato = 0`, `OrdinamentoVetrina = 0`, `PrezzoVetrina IS NULL`, `ImmagineId IS NULL`; `Codice`, `Nome`, `Prezzo`, `Categoria`, `UnitaDiMisura`, `Attivo`, `AliquotaIva` byte per byte come prima (confronta un dump `SELECT` prima/dopo).

- [x] 1.10 **`.gitignore` del backend** — aggiungi `media/` a `backend/.gitignore` (crealo se non esiste), così che i media caricati in sviluppo non finiscano in un commit.
  *Verifica*: `git check-ignore -v backend/media/2026` risponde con la regola.

**Uscita di fase.** `dotnet build` e `dotnet test` passano, il database ha tabella e colonne nuove, la cassa funziona esattamente come prima. Nessun comportamento nuovo è ancora osservabile — ed è corretto.

---

## Fase 2 — Pipeline immagini e upload REST

**Perché esiste.** È il pezzo che rende `MediaAsset` popolabile, ed è **verificabile con
`curl` da solo**, senza una riga di frontend. L'ordine dei nove passi della pipeline non è
un dettaglio implementativo: è la specifica (design.md §D11) — invertire (5) e (6) ruota
silenziosamente ogni foto verticale, e saltare (3) manda in OOM il container, cioè la cassa
offline.

- [x] 2.1 **`MediaLimiti`** — crea `backend/Services/Media/MediaLimiti.cs` con `MaxByteFile = 20 * 1024 * 1024`, `MaxMegapixel = 50`, `LatoMinimoPx = 200`, `LarghezzeVarianti = [400, 800, 1200, 1600]`, `MimeAmmessi = ["image/jpeg", "image/png", "image/webp"]`, qualità WebP 80 / JPEG 82. **Unico punto** del backend in cui questi numeri esistono, con un commento incrociato verso `deploy/nginx/duedgusto.conf` (§D1).
  *Verifica*: `grep -rn "20 \* 1024 \* 1024\|20971520" backend/` trova **una sola** occorrenza.

- [x] 2.2 **`SlugGenerator`** — crea `backend/Services/Media/SlugGenerator.cs`: minuscole, diacritici rimossi, non-alfanumerici → `-`, collasso dei separatori, max 60 caratteri, fallback `"media"` se vuoto; suffisso di 6 caratteri da `RandomNumberGenerator` su un alfabeto senza `0 O 1 l I`.
  *Verifica*: nessun output contiene `/`, `\` o `..` (spec `media-assets` → *Nome file ostile non esce dalla radice*). Test in 7.5.

- [x] 2.3 **Astrazione e implementazione dello storage** — crea `backend/Services/Media/IMediaStorage.cs` e `FileSystemMediaStorage.cs`: scrittura di tutte le varianti in `{chiave}.tmp/` seguita da `Directory.Move`, più la cancellazione ricorsiva della cartella di una chiave. Il processor non conosce il filesystem (domani S3 senza toccarlo).
  *Verifica*: un fallimento simulato a metà scrittura non lascia una cartella `{chiave}/` con un sottoinsieme di varianti (spec `media-assets` → *Atomicità dell'upload*). Test in 7.6.

- [x] 2.4 **`ImmagineProcessor` — i nove passi nell'ordine di §D11** — crea `backend/Services/Media/ImmagineProcessor.cs`: (1) pre-volo MIME+lunghezza, (2) `SemaphoreSlim(2)` con timeout 30s, (3) `Image.Identify` per Mpx/lato minimo/`FrameCount == 1` **senza decode**, (4) `DecoderOptions { TargetSize = 1600 }`, (5) `AutoOrient`, (6) strip di `ExifProfile`/`Iptc`/`Xmp`/`Icc`, (7) varianti WebP+JPEG per `w <= sorgente` con fallback a **una** variante nativa se la sorgente è più stretta di 400 px, (8) LQIP 20 px WebP q40 base64, (9) persistenza tmp → `Move`. `stream.Position = 0` fra (3) e (4). `Larghezza`/`Altezza` persistiti sono quelli **dopo** AutoOrient.
  *Verifica*: `dotnet build` esce 0; i passi sono riconoscibili nell'ordine leggendo il metodo dall'alto. Comportamento coperto dai test 7.1-7.4.

- [x] 2.5 **`Program.cs`: `MEDIA_ROOT`, allocatore, DI** — risoluzione fail-fast di `MEDIA_ROOT` (default `ContentRootPath/media` **solo** in Development, altrimenti `InvalidOperationException` con messaggio che nomina `/app/media`), `Configuration.Default.MemoryAllocator` con `AllocationLimitMegabytes = 128` e `AccumulativeAllocationLimitMegabytes = 256`, registrazione di `MediaRoot`, `IMediaStorage`, `ImmagineProcessor`.
  *Verifica*: avviare con `ASPNETCORE_ENVIRONMENT=Production` e senza `MEDIA_ROOT` fallisce all'avvio con quel messaggio, non al primo upload.

- [x] 2.6 **Guard amministratore in forma booleana condivisa** — in `backend/GraphQL/GestioneCassa/GestioneCassaGuards.cs` promuovi la logica a `public static Task<bool> IsUtenteAmministratore(AppDbContext, int)` e riscrivi `GuardUtenteAmministratore` per delegarvi; fai delegare anche `IsAmministratore` privata di [`AuthMutations.cs:42-50`](../../../backend/GraphQL/Authentication/AuthMutations.cs). Una query, due forme d'errore (§D12).
  *Verifica*: `grep -rn "Ruolo.*Amministratore" backend/GraphQL/` mostra **una sola** implementazione della lettura del flag; `dotnet test` passa senza modifiche ai test esistenti.

- [x] 2.7 **`MediaController` — `POST /api/media`** — crea `backend/Controllers/MediaController.cs` con `[Authorize]` di classe, `[RequestSizeLimit(23068672)]` + `[RequestFormLimits(MultipartBodyLengthLimit = 23068672)]` sull'action, **un solo file per richiesta** (`file`, `cartella` default `"generale"`, `alt`). Guard amministratore con `IsUtenteAmministratore` → `StatusCode(403, new { message })`. Mappa gli esiti della pipeline su `400/403/409/503`, **ogni errore con corpo JSON `{ message }` in italiano** come `AuthController`. Risposta `201` con `{ mediaAssetId, chiave, larghezza, altezza, larghezzeDisponibili, placeholder, mimeType }`.
  *Verifica*: `curl -k -H "Authorization: Bearer <token-admin>" -F "file=@foto.jpg" https://localhost:4000/api/media` risponde 201; con un token non admin risponde **403 con corpo JSON**, non 500.

- [x] 2.8 **`GET /api/media/configurazione`** — stessa classe, `[Authorize]` ma **senza** guard amministratore (espone solo costanti): restituisce `MediaConfigurazioneDto(MaxByteFile, MaxMegapixel, LarghezzeVarianti, MimeAmmessi)` letti da `MediaLimiti`.
  *Verifica*: `curl` con un token di utente **non** amministratore risponde 200 con `maxByteFile: 20971520`.

- [x] 2.9 **`UseStaticFiles` per `/media` solo in Development** — in `Program.cs`, dopo `app.UseAuthorization()` e prima di `app.MapControllers()`, dentro `if (app.Environment.IsDevelopment())`: `Directory.CreateDirectory(mediaRoot)`, `FileExtensionContentTypeProvider` con mapping esplicito `.webp`, `PhysicalFileProvider(mediaRoot)`, `RequestPath = "/media"`, `ServeUnknownFileTypes = false`, `Cache-Control: public,max-age=31536000,immutable`.
  *Verifica*: dopo l'upload del task 2.7, `https://localhost:4000/media/2026/08/<slug>-<6char>/800.webp` apre l'immagine nel browser con `Content-Type: image/webp`; in `Production` la stessa URL **non** è servita da .NET.

- [x] 2.10 **Prova end-to-end con `curl` e `exiftool`** — carica una foto reale da smartphone (con GPS) e ispeziona il risultato.
  *Verifica*: `ls backend/media/2026/*/<slug>-*/` mostra **8 file** (4 larghezze × 2 formati); `exiftool backend/media/2026/*/<slug>-*/*.jpg` **non** mostra alcun tag GPS né EXIF/XMP/IPTC dell'originale; nella cartella **non** esiste alcun file che sia l'originale non elaborato.

**Uscita di fase.** Un amministratore può caricare immagini con `curl` e vederle nel browser in sviluppo. Nessun frontend, nessun GraphQL nuovo. La cassa è intatta.

> **Verifiche eseguite l'11 agosto 2026.** `dotnet build` 0 errori, `dotnet test` **407/407 verdi
> senza modifiche ai test esistenti**. Upload reale: 201 da amministratore, **403 con corpo JSON**
> da un utente autenticato non amministratore; sorgente 2508×951 con GPS/EXIF/IPTC/XMP iniettati →
> **8 file** (400/800/1200/1600 × webp+jpg), `exiftool` non trova **alcun** gruppo EXIF/XMP/IPTC/ICC
> né tag GPS, e nella cartella non c'è l'originale. La stessa sorgente marcata `Orientation=6` esce
> **951×2508 con due varianti**: è la prova che AutoOrient precede lo strip — se l'ordine fosse
> invertito uscirebbe 2508 con quattro varianti, senza alcun errore. `../../etc/passwd.jpg` →
> chiave `2026/08/passwd-<suffisso>`, nulla creato fuori dalla radice. `MEDIA_ROOT` assente in
> `Production` fallisce a [Program.cs:107](../../../backend/Program.cs), e con la variabile
> impostata l'avvio supera quel punto: il fail-fast dipende esattamente da lei.
>
> **Due verifiche restano comportamentalmente scoperte fino alla Fase 7**, come i task stessi
> prevedono: l'atomicità sotto fallimento simulato (2.3 → test 7.6) non è stata provocata, e la
> matrice completa degli slug (2.2 → test 7.5) è coperta qui solo dai due casi passati per HTTP.

---

## Fase 3 — GraphQL: ramo `vetrina`, tipi e connection

**Perché esiste.** È il pezzo dove il confine con la cassa si **impone strutturalmente** —
`ProdottoVetrinaInput` non ha i campi contabili, quindi il resolver non ha il dato per
scrivere fuori perimetro anche volendo. È verificabile con GraphiQL da solo, prima che
esista una pagina. **I tre test che pinnano il confine (3.13-3.15) chiudono questa fase**:
sono la ragione per cui la change esiste come fase a sé.

- [x] 3.1 **`MediaAssetType`** — crea `backend/GraphQL/Vetrina/Types/MediaAssetType.cs` con i campi di design.md §"Contratto GraphQL", incluso `larghezzeDisponibili: [Int!]!` derivato dalla stringa CSV persistita.
  *Verifica*: `dotnet build` esce 0; la query di introspezione mostra `larghezzeDisponibili` come lista di `Int!` non nullable.

- [x] 3.2 **`MediaAssetInputType`** — crea `backend/GraphQL/Vetrina/Types/MediaAssetInputType.cs` con **esattamente** `testoAlternativo`, `didascalia`, `focale`, `cartella: String!`, `ordinamento: Int!`, `pubblicato: Boolean!`. **Nessun** campo tecnico (`chiave`, `mimeType`, `larghezza`, `altezza`, `larghezzeDisponibili`, `placeholder`, `byteTotali`).
  *Verifica* (spec `media-assets` → *Il tipo di input non espone i campi tecnici*): una mutation che tenta di passare `chiave` viene rifiutata dalla validazione dello schema, non dal resolver.

- [x] 3.3 **`ProdottoType`: campi vetrina e i due derivati** — in `backend/GraphQL/Vendite/Types/ProdottoType.cs` aggiungi i 10 campi vetrina in **sola lettura**, la risoluzione di `immagine` verso `MediaAssetType`, e i **due** campi derivati mai persistiti:
  - `pubblicatoSulSito: Boolean!` → `ctx.Source.Attivo && ctx.Source.VisibileSulSito` (§D4);
  - `prezzoEffettivoVetrina: Decimal!` → `ctx.Source.PrezzoVetrina ?? ctx.Source.Prezzo` — fallback **dinamico**, valutato a ogni lettura, con `PrezzoVetrina = 0` trattato come valore valorizzato e non come assenza.
  Entrambi con `Description` che dichiara che sono la regola unica su cui filtrerà la Fase 2.
  *Verifica* (spec `vetrina-prodotti`): su un prodotto con `Prezzo = 3.80` e `PrezzoVetrina = 0.00`, `prezzoEffettivoVetrina` vale `0.00` e non `3.80`; con `PrezzoVetrina = null` vale `3.80` e segue gli aggiornamenti di listino della cassa senza alcuna scrittura vetrina.

- [x] 3.4 **`ProdottoVetrinaInput` + `ProdottoVetrinaInputType`** — crea la classe POCO e il tipo GraphQL in `backend/GraphQL/Vetrina/Types/ProdottoVetrinaInputType.cs` con **esattamente 10 proprietà**: `VisibileSulSito`, `NomeVetrina`, `DescrizioneVetrina`, `CategoriaVetrina`, `PrezzoVetrina`, `ImmagineId`, `OrdinamentoVetrina`, `Allergeni`, `Novita`, `Consigliato`. **Zero campi cassa.**
  *Verifica*: pinnata dal test strutturale 3.14.

- [x] 3.5 **`VetrinaMutations` e ramo root** — crea `backend/GraphQL/Vetrina/VetrinaMutations.cs` con `this.Authorize()` a livello di tipo, e registra il ramo in `backend/GraphQL/GraphQLMutations.cs`: `Field<VetrinaMutations>("vetrina").Resolve(context => new { })` (§D7).
  *Verifica*: `AutorizzazioneAnonimaTests` — che enumera i rami **dallo schema** — copre automaticamente `vetrina` e continua a passare senza aggiungerlo ad alcuna allowlist (spec `sicurezza` → *Il nuovo ramo GraphQL non è raggiungibile in anonimo*).

- [x] 3.6 **`mutateProdottoVetrina`** — nel ramo `vetrina`: `prodottoId: Int!` di un prodotto **esistente** (nessun ramo `insert`), `input: ProdottoVetrinaInput!`. `GuardUtenteAmministratore` come **prima istruzione del resolver**, prima di qualunque lettura. Assegnazione totale dei 10 campi + `UpdatedAt`, nient'altro. Validazioni prima del save: `PrezzoVetrina` negativo → errore esplicito; `ImmagineId` valorizzato deve **esistere ed essere `Pubblicato`** → errore applicativo leggibile, non l'errore MySQL della FK; `Allergeni` vuoto o di soli spazi → persistito come **`null`** (unica rappresentazione del vuoto). Nessun rifiuto di `VisibileSulSito = true` su prodotto non attivo: è uno stato ammesso e innocuo.
  *Verifica* (spec `vetrina-prodotti`): id inesistente → errore e `SELECT COUNT(*) FROM Prodotti` invariato; `prezzoVetrina = -1` → errore e valore precedente intatto; `visibileSulSito = true` su prodotto con `Attivo = false` → successo, `pubblicatoSulSito = false`, campi cassa invariati.

- [x] 3.7 **`mutateMediaAsset`** — nel ramo `vetrina`, guard amministratore per prima. Scrive **solo** i metadati editoriali dell'input; `Chiave`, `MimeType`, `Larghezza`, `Altezza`, `LarghezzeDisponibili`, `Placeholder`, `ByteTotali` e i file su disco restano intatti; aggiorna `UpdatedAt`. Valida il formato di `Focale` (`"<0-100>% <0-100>%"`): un valore non conforme (`"molto a sinistra"`, `"140%"`) viene **rifiutato** e il valore precedente resta. Portare `Pubblicato` a `false` su un asset referenziato da almeno un prodotto con `pubblicatoSulSito = true` **segnala** i prodotti coinvolti senza modificarli.
  *Verifica* (spec `media-assets`): dopo una modifica del testo alternativo, `md5sum` di tutte le varianti su disco è invariato.

- [x] 3.8 **`eliminaMediaAsset`** — nel ramo `vetrina`, guard amministratore per prima. Se referenziato da almeno un prodotto: **rifiuto** con un errore il cui messaggio **nomina i prodotti**, senza cancellare record né file. Se non referenziato: rimuove il record **e tutti i file** della cartella della chiave, tramite `IMediaStorage`.
  *Verifica* (spec `media-assets` → *Eliminazione di un asset in uso*): asset assegnato a due prodotti → l'errore contiene entrambi i nomi, il record esiste ancora e `ls` sulla cartella mostra tutte le varianti.

- [x] 3.9 **`connection { prodotti }`** — in `backend/GraphQL/Connection/ConnectionQueries.cs`, sul pattern esatto di `fornitori` (righe 123-140), con `queryConfigurator` = `query => query.Include(p => p.Immagine).OrderBy(p => p.Codice)`. **Restituisce anche i non attivi**: è l'anagrafica, non il listino operativo. L'`Include` è l'unico punto in cui va messo (senza, il thumbnail in griglia sarebbe sempre `null`).
  *Verifica* (spec `vetrina-prodotti`): con 5 prodotti attivi e 2 disattivati, la connection ne restituisce 7; `OrderBy(Codice)` rende l'ordine stabile fra due letture identiche.

- [x] 3.10 🔴 **`connection { mediaAssets }` — con il guard amministratore anche in LETTURA** — stessa `ConnectionQueries.cs`, ordinamento `(Cartella, Ordinamento)` con criterio deterministico di parità (`CreatedAt`). **Il resolver della connection chiama il guard amministratore esattamente come le mutation.**
  > Questa riga è quella facile da dimenticare: il design §D12 parla di guard sulle sole scritture, la spec `sicurezza` lo richiede **anche sulla lettura** dei media — *"in questa fase non esiste alcun consumatore anonimo né non amministrativo dei media"*. **La spec è più stretta e vince.**
  *Verifica* (spec `sicurezza` → *Utente non amministratore in lettura sui media*): un utente autenticato con `Amministratore = false` che interroga `connection { mediaAssets }` riceve un errore di privilegi insufficienti, non una lista vuota e non una lista piena. Test in 7.9.

- [x] 3.11 **Fragment e query lato server verificati da GraphiQL** — prova manuale del ciclo completo: upload REST (Fase 2) → `connection { mediaAssets }` → `mutateProdottoVetrina` con quell'`immagineId` → rilettura del prodotto con `immagine { chiave larghezzeDisponibili placeholder }`.
  *Verifica*: il ciclo funziona interamente da GraphiQL, senza una riga di frontend.

- [x] 3.12 🔴 **Prova che il ramo cassa non è stato toccato** — controllo esplicito di fine fase.
  *Verifica*: `git diff --stat backend/GraphQL/Vendite/VenditeMutations.cs backend/GraphQL/Vendite/Types/ProdottoInputType.cs backend/GraphQL/Vendite/VenditeQueries.cs` è **vuoto**. (`ProdottoType.cs` è invece modificato, ed è previsto.)

- [x] 3.13 🔴 **Test strutturale `ProdottoInput_NonContieneCampiVetrina`** — in `backend/DuedGusto.Tests/Unit/GraphQL/`: `typeof(ProdottoInput).GetProperties().Select(p => p.Name).Should().BeEquivalentTo("ProdottoId", "Codice", "Nome", "Descrizione", "Prezzo", "Categoria", "UnitaDiMisura", "Attivo", "AliquotaIva")`, con il commento che spiega **perché** (`UpsertProdottoAsync` assegna ogni campo esplicitamente: un campo vetrina qui verrebbe azzerato in massa dal primo upsert della cassa).
  *Verifica*: aggiungendo temporaneamente `VisibileSulSito` a `ProdottoInput`, il test **fallisce**; rimosso, torna verde.

- [x] 3.14 🔴 **Test strutturale `ProdottoVetrinaInput_NonContieneCampiCassa`** — stesso file. **Deve ispezionare le proprietà del tipo via reflection**, non essere un controllo manuale in code review:
  ```csharp
  string[] campiCassa = ["Codice", "Nome", "Descrizione", "Prezzo", "Categoria",
                         "UnitaDiMisura", "Attivo", "AliquotaIva"];
  typeof(ProdottoVetrinaInput).GetProperties().Select(p => p.Name)
      .Should().NotIntersectWith(campiCassa);
  ```
  È la difesa contro il giorno in cui qualcuno aggiunge un campo cassa all'input della vetrina senza aggiornare i test comportamentali — quelli passerebbero comunque.
  *Verifica*: aggiungendo temporaneamente `Prezzo` a `ProdottoVetrinaInput`, il test **fallisce**.

- [x] 3.15 🔴 **Test comportamentali del confine, nelle due direzioni** — in `backend/DuedGusto.Tests/Integration/GraphQL/SalesTests.cs`, accanto alla region prodotti esistente:
  - prodotto con vetrina completamente valorizzata → `mutateProdotto` con payload di sola cassa → **tutti e dieci** i campi vetrina invariati e i campi contabili aggiornati;
  - prodotto con cassa valorizzata → `mutateProdottoVetrina` con tutti i 10 campi → **tutti** i campi contabili invariati;
  - scritture alternate ripetute dai due canali → nessuno dei due gruppi risulta mai azzerato dall'altro.
  *Verifica*: `cd backend && dotnet test --filter "FullyQualifiedName~Sales"` passa.

**Uscita di fase.** Il confine con la cassa è pinnato da tre test — uno strutturale per input, uno comportamentale bidirezionale — e il ciclo media→prodotto funziona da GraphiQL. Nessuna pagina esiste ancora.

> **Verifiche eseguite l'11 agosto 2026.** `dotnet test` **431/431** (erano 407: +24).
>
> **I test del confine sono stati verificati per mutazione, non solo eseguiti.** Aggiungendo
> `VisibileSulSito` a `ProdottoInput` e `Prezzo` a `ProdottoVetrinaInput`, **3 test su 4
> falliscono**; rimossi, tornano verdi. Stessa prova sul guard di `connection { mediaAssets }`:
> commentandolo, `Operatore_LeggeConnectionMediaAssets_Rifiutata` fallisce — il task 3.10 è
> chiuso davvero e non per costruzione.
>
> **`AutorizzazioneAnonimaTests` ha fatto il suo mestiere**: le Theory per-ramo hanno coperto
> `vetrina` da sole, senza allowlist; è invece fallito `SchemaEspone_TuttiIRamiRootAttesi`, la
> sentinella d'inventario, che ha chiesto conferma esplicita del nuovo ramo. Aggiornato.
>
> **Ciclo end-to-end** su istanza separata: `connection { mediaAssets }` → `mutateProdottoVetrina`
> con `immagineId` → rilettura con `immagine { chiave larghezzeDisponibili }`. Casi limite
> provati sul campo: `prezzoVetrina = 0` dà `prezzoEffettivoVetrina = 0` e **non** ricade sul
> listino; la cassa che riscrive nome e prezzo lascia **tutti e dieci** i campi vetrina intatti;
> `allergeni` di soli spazi persiste `null`; l'eliminazione di un media in uso è rifiutata con un
> errore che **nomina il prodotto** e non tocca né record né file; l'eliminazione di uno libero
> rimuove riga e cartella insieme.
>
> ⚠️ **Scelta di implementazione**: la logica delle tre mutation vive in metodi statici
> (`ApplicaCampiVetrinaAsync`, `AggiornaMediaAssetAsync`, `EliminaMediaAssetAsync`) accanto ai
> resolver, sul modello di `UpsertProdottoAsync`. I test del confine esercitano così la scrittura
> vera invece del trasporto GraphQL. Il guard resta la **prima istruzione del resolver**, come
> prescritto: non è stato spostato dentro i metodi statici.
>
> **Anticipata parte del task 7.9**: i cinque test di privilegio sul ramo `vetrina` — incluse le
> due letture di `connection { mediaAssets }` — sono già in `PrivilegiAmministrativiTests`.
> Restano da fare in Fase 7 il caso `POST /api/media` (403 con corpo JSON) e la verifica che non
> resti alcun effetto collaterale.

---

## Fase 4 — Seed dei menu e gating della sezione

**Perché esiste.** Le route del frontend sono generate dai record di menu del database
([ProtectedRoutes.tsx](../../../duedgusto/src/components/routes)): senza il seed, le pagine
della Fase 6 non sono raggiungibili. E il gating va seminato **prima** che le pagine
esistano, non dopo, altrimenti la prima cosa che si prova è una sezione visibile a tutti.

- [x] 4.1 **Promozione dei metodi condivisi del seed** — in `backend/SeedData/SeedMenus.cs` porta `UpdateMenuIfNeeded` e `AssegnaRuoli` da `private static` a `internal static`. Copiarle produrrebbe due implementazioni della stessa idempotenza destinate a divergere.
  *Verifica*: `dotnet build` esce 0; `SeedMenus.cs` non guadagna alcuna logica nuova (`git diff` mostra solo i due modificatori).

- [x] 4.2 **`SeedMenusSito`** — crea `backend/SeedData/SeedMenusSito.cs` (file separato: `SeedMenus.cs` è già 916 righe). ⚠️ **La regola di idempotenza è diversa per padri e figli**: il padre si cerca per `Titolo == "Sito" && Percorso == string.Empty` (i menu padre hanno percorso vuoto e non sono distinguibili dal solo percorso — pattern reale di `SeedMenus.cs:854`), i figli per `Percorso`. Voci:

  | Voce | Titolo | Percorso | Icona | Pos. | `NomeVista` | `PercorsoFile` |
  |---|---|---|---|---|---|---|
  | Padre | `Sito` | `""` | `Globe` | 9 | `""` | `""` |
  | Figlio 1 | `Libreria media` | `/gestionale/sito/media` | `Images` | 1 | `MediaLibrary` | `sito/MediaLibrary.tsx` |
  | Figlio 2 | `Prodotti vetrina` | `/gestionale/sito/prodotti` | `ShoppingBag` | 2 | `VetrinaProdottiList` | `sito/VetrinaProdottiList.tsx` |

  ⚠️ **`PercorsoFile` è relativo a `src/components/pages/`** — verificato nel codice (`wiki/RegistroCassaWiki.tsx`), **non** il path completo documentato in `duedgusto/CLAUDE.md`. Si segue il codice.
  *Verifica*: `dotnet build` esce 0.

- [x] 4.3 **Gating dei ruoli nel seed** — `AssegnaRuoli` sulle tre voci filtrando `.Where(r => r.Amministratore || r.Nome == "SuperAdmin")`, esattamente come il pattern Wiki.
  *Verifica* (spec `sicurezza` → *Menu della sezione riservato ai soli ruoli amministrativi*): `SELECT` sulla tabella di associazione mostra le voci "Sito" assegnate ai soli ruoli con flag amministrativo; un utente non amministratore non vede la sezione nella sidebar.

- [x] 4.4 **Invocazione in `Program.cs`** — dentro `if (seedOnStartup)`, **dopo** `SeedMenus.Initialize`.
  *Verifica*: il backend si avvia e la voce "Sito" compare nella sidebar di un amministratore (le pagine daranno 404 finché non esiste la Fase 6 — è atteso).

- [x] 4.5 **Prova di idempotenza** — riavvia il backend **tre volte** con `SEED_ON_STARTUP=true`.
  *Verifica*: `SELECT COUNT(*) FROM Menus WHERE Titolo = 'Sito'` vale **1** e i figli sono **2**, non 3 e 6. (Il cleanup dei duplicati Dashboard in `SeedMenus.cs:59-76` è la prova documentata di cosa succede sbagliando.)

**Uscita di fase.** La sezione "Sito" esiste nella navigazione dei soli amministratori, con due voci che puntano a componenti non ancora scritti.

> **Verifiche eseguite l'11 agosto 2026.** `dotnet build` 0 errori, `dotnet test` **431/431**
> (nessuna variazione: il seed non è ancora coperto da test, arriverà col task 7.10).
>
> Il seed è stato eseguito **tre volte** su una seconda istanza (porta 4010, `SEED_ON_STARTUP=true`)
> per non fermare il backend dell'utente. Dopo i tre giri: **un** padre `Sito` (`Percorso` vuoto,
> `Globe`, posizione 9 — la prima libera, la Wiki occupa la 8) e **due** figli,
> `/gestionale/sito/media` e `/gestionale/sito/prodotti`. Non 3 e 6.
>
> **Gating verificato a database, non per lettura del codice**: le sei righe di `ruolomenu` per le
> tre voci nominano solo `SuperAdmin` e `Admin`; l'unico ruolo con `Amministratore = 0` in
> anagrafica — `Gestore` — non ha **alcuna** assegnazione (query di controllo: 0 righe).
>
> `git diff backend/SeedData/SeedMenus.cs` mostra **solo i due modificatori** `private` →
> `internal`, nessuna logica nuova: l'idempotenza resta scritta in un posto solo.
>
> ⚠️ Fino al task 5.8 le tre icone `Globe`/`Images`/`ShoppingBag` non sono in `iconMapping.tsx`
> e la sidebar mostra il fallback; le due voci portano a componenti inesistenti fino alla Fase 6.
> Entrambe le cose sono attese e previste dai task.

---

## Fase 5 — Frontend: trasporto e contratti condivisi

**Perché esiste.** `makeRequest` hardcoda `Content-Type: application/json` e
`JSON.stringify`: non può inviare un `FormData`. Ma la logica preziosa non è il trasporto,
è la **politica** `401 → refresh → un solo retry` (righe 48-62). Duplicarla in
`uploadRequest` significa due copie che divergono al primo bugfix applicato a una sola
(§D2). Questa fase non contiene alcuna UI: è tutta infrastruttura che le pagine consumano.

- [x] 5.1 **`politicaRefresh.tsx`** — crea `duedgusto/src/api/politicaRefresh.tsx` con `valutaStatoAutenticazione(status, { failOnForbidden, refreshToken }): Promise<"procedi" | "riprova" | "abbandona">`. **Non conosce il trasporto**: riceve uno status, decide. Chiama `onRefreshFails()` prima di restituire `"abbandona"` sul refresh fallito.
  *Verifica*: `npm run ts:check` passa; il file non importa né `fetch` né `XMLHttpRequest`.

- [x] 5.2 🔴 **`makeRequest.tsx` delega la politica** — sostituisci le righe 48-62 con una chiamata a `valutaStatoAutenticazione`. **Firma e comportamento osservabili invariati**: il retry resta la chiamata ricorsiva che rilegge gli header in cima (riga 14).
  *Verifica*: **i 4 test esistenti di `duedgusto/src/api/__tests__/makeRequest.test.tsx` passano senza una sola modifica**. Sono la rete di sicurezza del refactor: se richiedono di essere riscritti, il refactor ha cambiato più di quanto doveva ed è da rifare.

- [x] 5.3 **`uploadRequest.tsx`** — crea `duedgusto/src/api/uploadRequest.tsx` (XHR, non `fetch`: `fetch` non espone alcun evento di progresso in upload). Tre condizioni che il design impone e che sono la parte facile da sbagliare:
  1. **nuovo `XMLHttpRequest` a ogni tentativo** — la funzione `invia()` lo costruisce al suo interno; un XHR già `send()`-ato non è reinviabile (il `FormData` invece si riusa: non è uno stream, non si consuma);
  2. **`getAuthHeaders()` letto _dentro_ `invia()`** — leggerlo una volta sola rimanderebbe lo stesso token scaduto, prenderebbe un secondo 401 e con `failOnForbidden: true` finirebbe in logout: file perso *e* utente buttato fuori;
  3. **`onProgress(0)` all'inizio del retry** — altrimenti la barra torna indietro dal 100% e sembra rotta.
  Nessun `Content-Type` (lo genera il browser col boundary). `JSON.parse` della risposta **dentro un try/catch**: su un 413 di nginx il corpo è HTML e deve produrre *"Il file supera il limite consentito dal server"*, non un `SyntaxError`.
  *Verifica*: `npm run ts:check` passa. Comportamento coperto dai test 7.11-7.14.

- [x] 5.4 **`mediaUrl.tsx`** — crea `duedgusto/src/components/pages/sito/mediaUrl.tsx` con `mediaUrl(chiave, larghezza, formato = "webp")` e `mediaSrcSet(chiave, larghezze, formato)`. **Unico punto del frontend che compone un URL di media**, senza alcun ramo per ambiente: `API_ENDPOINT` punta, in entrambi gli ambienti, all'host che serve `/media/` (§D3).
  *Verifica*: `grep -rn "/media/" duedgusto/src --include=*.tsx` trova la composizione dell'URL **solo** in questo file.

- [x] 5.5 **Tipi TypeScript** — crea `duedgusto/src/@types/vetrina.d.ts` con `MediaAsset` e `ProdottoVetrina` allineati al contratto GraphQL, `pubblicatoSulSito` e `prezzoEffettivoVetrina` inclusi come campi di sola lettura.
  *Verifica*: `npm run ts:check` passa.

- [x] 5.6 **Operazioni GraphQL della vetrina** — crea `duedgusto/src/graphql/vetrina/fragments.tsx` (`mediaAssetFragment`, `prodottoVetrinaFragment` come **template string**, non `gql` — convenzione del progetto), `queries.tsx` e `mutations.tsx` (`mutationMutateProdottoVetrina`, `mutationMutateMediaAsset`, `mutationEliminaMediaAsset`).
  *Verifica*: `npm run ts:check` e `npm run lint` passano.

- [x] 5.7 **Hook di scrittura e di upload** — crea `duedgusto/src/graphql/vetrina/useSubmitProdottoVetrina.tsx` (pattern di `useSubmitMenu.tsx`) e `useUploadMedia.tsx` (wrapper su `uploadRequest` con stato di progresso per file).
  *Verifica*: `npm run ts:check` passa.

- [x] 5.8 **Icone della sidebar** — aggiungi `Globe`, `Images`, `ShoppingBag` al `Record` di `duedgusto/src/components/layout/sideBar/iconMapping.tsx` (verificato: non ci sono; `lucide-react` è già dipendenza).
  *Verifica*: la sezione "Sito" nella sidebar mostra le tre icone invece del fallback, e le nuove icone compaiono nella tendina di `MenuForm`.

**Uscita di fase.** `npm run ts:check`, `npm run lint` e `npm run test` passano. Il trasporto multipart esiste e la politica di refresh è in un posto solo. Nessuna pagina nuova è ancora visibile.

> **Verifiche eseguite l'11 agosto 2026.** `npm run ts:check` e `npm run lint` puliti,
> `npm run test` **730/730 su 91 file**.
>
> 🔴 **Il task 5.2 è passato alla sua prova**: i test di `makeRequest.test.tsx` sono verdi
> **senza una sola modifica**. Erano la rete di sicurezza del refactor, non un contorno.
>
> ⚠️ **Una precisazione emersa scrivendo il codice**: `"abbandona"` copre **due** situazioni
> che i chiamanti devono distinguere — refresh fallito (la politica ha già chiamato
> `onRefreshFails`) e 401 sull'ultimo tentativo (non lo chiama). `makeRequest` restituisce
> `null` solo nel primo caso e lascia il secondo scorrere nella gestione errori, che è
> esattamente il comportamento che i test preesistenti pinnano: un 401 con
> `failOnForbidden: true` **lancia** il messaggio del server, non restituisce `null`.
> `uploadRequest` chiama `onRefreshFails()` da sé quando il secondo tentativo è ancora 401.
>
> `grep -rn "/media/" duedgusto/src --include=*.tsx` trova la composizione dell'URL **solo**
> in `mediaUrl.tsx`; `grep -rn "20971520\|20 \* 1024" duedgusto/src` non trova **nulla** — il
> frontend non ha una propria costante di limite da far divergere.
>
> Aggiunte due costanti a `httpStatusCodes.tsx` (`403`, `413`) e il tipo globale
> `UploadRequest` accanto a `MakeRequest`, sullo stile del file.

---

## Fase 6 — Frontend: le due pagine di amministrazione

**Perché esiste.** È la prima interfaccia prodotti mai costruita nel progetto: non c'è un
fratello da imitare per la parte listino. Il confine di §D8 va espresso **nella forma dei
componenti** (nessun `getNewRow`, nessun pulsante di creazione), non in un promemoria.

- [ ] 6.1 **`SitoGuard.tsx`** — crea `duedgusto/src/components/pages/sito/SitoGuard.tsx` sul modello di `wiki/WikiLayout.tsx:36,50-56`: legge `useStore(s => Boolean(s.utente?.ruolo?.amministratore))` e mostra un `Alert` invece del contenuto. È **cosmesi, non sicurezza** — la sicurezza è il guard backend delle Fasi 2-3.
  *Verifica*: un utente non amministratore che naviga alla route vede l'avviso.

- [ ] 6.2 **`MediaCard.tsx`** — crea la card singola: `CardMedia` con `400.webp` e il `placeholder` base64 come `background-image` (niente salto di layout durante il caricamento), nome originale, dimensioni, cartella, badge "non pubblicato", azioni Modifica/Elimina.
  *Verifica*: `npm run ts:check` passa; la card usa `mediaUrl()` e non compone URL a mano.

- [ ] 6.3 **`MediaUploadArea.tsx`** — drop zone + `<input type="file" multiple>` con `accept` **letto da `/api/media/configurazione`**, pre-check su `file.size` e `file.type` contro le costanti del server, barra di progresso per file, concorrenza limitata a **2** (specchia il `SemaphoreSlim(2)` del backend: inviarne 8 insieme significa 6 richieste che aspettano e possono scadere in 503).
  *Verifica* (spec `media-assets` → *File troppo grande rifiutato prima dell'invio*): selezionando un file da 30 MB, il messaggio di limite superato compare e **nessun byte parte** (pannello Network vuoto). Il frontend **non** ha una propria costante di limite: `grep -rn "20971520\|20 \* 1024" duedgusto/src` non trova nulla.

- [ ] 6.4 **`MediaLibrary.tsx`** — crea la pagina: griglia di card MUI su layout `grid grid-cols-12` (modello `MonthlyView.tsx:83-163`, unico precedente Card nel progetto), **non** AG Grid. Carica `/api/media/configurazione` al mount; consuma `connection { mediaAssets }`; dialog di modifica (alt, didascalia, cartella, ordinamento, focale, pubblicato) → `mutateMediaAsset`; eliminazione con `useConfirm` → `eliminaMediaAsset`, **mostrando l'errore che nomina i prodotti senza alcun trattamento speciale del caso**; `refetch()` al termine di ogni upload (la cache Apollo non sa nulla di un upload REST).
  *Verifica* (spec `media-assets`): dopo un upload il media compare nell'elenco **senza ricaricare la pagina**; l'eliminazione di un asset in uso mostra un messaggio che nomina i prodotti e la card resta al suo posto.

- [ ] 6.5 **`MediaPickerDialog.tsx`** — selettore di immagine riusabile dalla griglia prodotti, che legge la stessa connection e restituisce un `mediaAssetId`. Mostra solo gli asset con `pubblicato = true` (un asset ritirato non deve poter rientrare da una porta laterale).
  *Verifica*: un asset con `Pubblicato = false` non è selezionabile dal dialog.

- [ ] 6.6 **`VetrinaProdottiList.tsx` — struttura e colonne** — crea la pagina AG Grid (skill `datagrid`) dentro `SitoGuard`, layout secondo `react-best-practices` §1-2 come le sei liste esistenti. 🔴 **`hideNewButton` + `hideDeleteButton` + nessun `getNewRow`**: è il confine di §D8 espresso nella UI — senza `getNewRow`, Tab sull'ultima cella **non** crea una riga. Colonne in sola lettura: `codice`, `nome`, `prezzo`, `attivo` (Chip), `pubblicatoSulSito` (Chip verde/grigio). Colonne editabili: `visibileSulSito`, `nomeVetrina`, `categoriaVetrina`, `prezzoVetrina`, `immagine`, `ordinamentoVetrina`, `novita`, `consigliato`, `allergeni`, `descrizioneVetrina` con gli editor di design.md §"UI".
  *Verifica* (spec `vetrina-prodotti`): tentare di modificare `codice`/`nome`/`prezzo`/`attivo`/`pubblicatoSulSito` non apre l'editor e non invia alcuna mutation; percorrere con Tab l'ultima cella dell'ultima riga **non** crea una riga nuova.

- [ ] 6.7 **`VetrinaProdottiList.tsx` — dati, persistenza e diagnostica** — consuma `connection { prodotti }` con `useGetAll` **verbatim** come `FornitoreList` (esaurisce le pagine seguendo i cursori). `onCellValueChanged` → `mutateProdottoVetrina(prodottoId, <intera riga vetrina>)`, persistenza per riga come `SpeseDataGrid`; **in errore ripristina il valore precedente nella cella** e mostra un toast, invece di lasciare la griglia a mostrare un valore che il server ha rifiutato. Tooltip sulla riga divergente (`visibileSulSito = true` con `attivo = false`): *"Visibile sul sito ma non attivo in cassa: non verrà pubblicato"*. Segnalazione del prodotto visibile e **privo di immagine**. Toggle "mostra non attivi" in toolbar via `api.setFilterModel`, **client-side, zero round trip**.
  *Verifica* (spec `vetrina-prodotti`): il filtro sui non attivi non genera alcuna richiesta di rete (pannello Network); un prodotto con `Attivo = false` e `VisibileSulSito = true` è presente, segnalato, e **ogni** suo campo vetrina resta modificabile.

**Uscita di fase.** Il ciclo completo funziona in sviluppo dall'interfaccia: carichi una foto dalla libreria, la assegni a un prodotto dalla griglia, marchi 10 prodotti come visibili sul sito.

---

## Fase 7 — Test automatici

**Perché esiste.** I tre test che pinnano il confine con la cassa sono già in Fase 3 (3.13,
3.14, 3.15) — lì è dove servono. Questa fase copre **tutto il resto** della matrice di
design.md §"Testing Strategy", scenario per scenario.

### Backend — unit

- [ ] 7.1 **Pinning dei limiti** — `MediaLimiti.MaxByteFile == 20 * 1024 * 1024`. Cambiarlo deve diventare un gesto deliberato che ricorda di aggiornare `deploy/nginx/duedgusto.conf` (§D1); il commento nel test lo dice.
  *Verifica*: `dotnet test --filter "MediaLimiti"` passa.

- [ ] 7.2 **Rifiuto oltre soglia _senza decode_** — header JPEG sintetico che dichiara 12000×10000: la pipeline rifiuta sulla base del solo `Image.Identify`, e il bitmap non viene mai allocato.
  *Verifica* (spec `media-assets` → *Immagine con troppi pixel rifiutata senza decodifica*): il test asserisce che nessun `Image<T>` viene materializzato; nessun file e nessun record vengono creati.

- [ ] 7.3 **AutoOrient prima dello strip** — JPEG con `Orientation = 6`: l'output è **ruotato correttamente** *e* privo di EXIF, e `Larghezza`/`Altezza` persistiti sono quelli **dopo** la rotazione. È l'errore classico: azzerare l'ExifProfile prima di AutoOrient lo rende un no-op silenzioso e ruota di 90° tutte le foto verticali.
  *Verifica*: `dotnet test --filter "AutoOrient"` passa.

- [ ] 7.4 **Strip completo e mai upscaling** — `ExifProfile`/`Iptc`/`Xmp`/`Icc` tutti `null` nell'output e **nessun tag GPS**; sorgente 900 px → `LarghezzeDisponibili == "400,800"`; sorgente 300 px → fallback a **una** variante nativa, `LarghezzeDisponibili == "300"`; l'insieme **non è mai vuoto**.
  *Verifica*: `dotnet test --filter "Immagine"` passa; per ogni valore di `LarghezzeDisponibili` il file corrispondente esiste in entrambi i formati.

- [ ] 7.5 **Slug** — accenti, spazi, stringa vuota (→ `"media"`), oltre 60 caratteri, e caratteri di path (`../../etc/passwd.jpg`) neutralizzati.
  *Verifica* (spec `media-assets` → *Nome file ostile non esce dalla radice*): nessuno slug prodotto contiene `/`, `\` o `..`.

- [ ] 7.6 **Atomicità** — scrittura di una variante che fallisce → nessun record `MediaAsset`, nessun file parziale sotto la radice, errore leggibile al client.
  *Verifica*: dopo il fallimento simulato, la radice dei media è identica a prima (nessuna cartella `.tmp` residua).

### Backend — integration

- [ ] 7.7 **`mutateProdottoVetrina` non può creare** — `prodottoId` inesistente → errore esplicito; conta i prodotti prima e dopo.
  *Verifica*: i due conteggi coincidono.

- [ ] 7.8 **`eliminaMediaAsset` referenziato** — rifiuto, messaggio che nomina i prodotti, record e file intatti; poi azzeramento del riferimento e seconda eliminazione che va a buon fine rimuovendo **tutti** i file.
  *Verifica*: `dotnet test --filter "MediaAsset"` passa.

- [ ] 7.9 🔴 **Privilegi amministrativi su tutta la superficie** — in `backend/DuedGusto.Tests/Integration/GraphQL/PrivilegiAmministrativiTests.cs`: un utente autenticato con `Amministratore = false` è rifiutato su `mutateProdottoVetrina`, `mutateMediaAsset`, `eliminaMediaAsset`, **`connection { mediaAssets }` (lettura!)** e `POST /api/media` (**403 con corpo JSON**, non 500). In nessuno dei casi resta un effetto collaterale: nessun record, nessun file.
  *Verifica* (spec `sicurezza`, tutti gli scenari di rifiuto): `dotnet test --filter "Privilegi"` passa. Il caso `connection { mediaAssets }` è quello che il design §D12 non prevedeva — se manca, il task 3.10 non è chiuso.

- [ ] 7.10 **`connection { prodotti }` include i non attivi + seed idempotente** — seed di 1 prodotto attivo e 1 non attivo → 2 risultati; `SeedMenusSito.Initialize` invocato 3 volte → **un** padre "Sito" e **due** figli.
  *Verifica*: `dotnet test` passa.

### Frontend — unit

- [ ] 7.11 **`politicaRefresh`** — crea `duedgusto/src/api/__tests__/politicaRefresh.test.tsx`: i tre esiti (`procedi` su status non-401, `abbandona` con `failOnForbidden`, `riprova` su refresh riuscito, `abbandona` + `onRefreshFails` su refresh fallito) in isolamento, con `refreshToken` mockato.
  *Verifica*: `npm run test -- politicaRefresh` passa.

- [ ] 7.12 **`uploadRequest`: il retry è fatto bene** — crea `duedgusto/src/api/__tests__/uploadRequest.test.tsx` con XHR mockato: 401 → refresh → **secondo XHR (istanza diversa)** con **`getAuthHeaders()` riletto** (asserire **due** istanze e **due** chiamate). È il test che coglie la classe di bug "rimando lo stesso token scaduto".
  *Verifica*: `npm run test -- uploadRequest` passa.

- [ ] 7.13 **`uploadRequest`: un solo retry e progresso azzerato** — 401 anche al secondo tentativo → `onRefreshFails`, **nessun terzo tentativo**; `onProgress(0)` è la prima chiamata di ogni tentativo (asserire la sequenza).
  *Verifica*: `npm run test -- uploadRequest` passa.

- [ ] 7.14 **`uploadRequest`: 413 con corpo HTML** — la risposta non-JSON del web server produce *"Il file supera il limite consentito dal server"* e **nessun `SyntaxError` propagato**.
  *Verifica*: `npm run test -- uploadRequest` passa.

- [ ] 7.15 **`mediaUrl` / `mediaSrcSet`** — con `API_ENDPOINT` mockato: URL corretta per chiave+larghezza+formato, `srcset` con i descrittori `w` nell'ordine ricevuto.
  *Verifica*: `npm run test -- mediaUrl` passa.

- [ ] 7.16 **`VetrinaProdottiList`: il confine nella forma del componente** — Testing Library sulle `columnDefs`: `codice`, `nome`, `prezzo`, `attivo`, `pubblicatoSulSito` hanno `editable: false`; **nessun `getNewRow`** è passato al `Datagrid`; `hideNewButton` e `hideDeleteButton` sono attivi.
  *Verifica*: `npm run test -- VetrinaProdottiList` passa.

- [ ] 7.17 **Suite completa verde** — `cd backend && dotnet test` e `cd duedgusto && npm run test && npm run ts:check && npm run lint`.
  *Verifica*: tutti e quattro escono 0, e **i ~234 test backend e ~471 frontend preesistenti passano senza modifiche**.

**Uscita di fase.** La CI è verde e i tre test del confine rompono la build nel momento esatto in cui qualcuno lo attraversa.

---

## Fase 8 — Infrastruttura di deploy (modifiche ai file, verificabili in locale)

**Perché esiste.** Tutto quello che segue è invisibile in sviluppo e catastrofico in
produzione: i media sotto `frontend/dist/` spariscono al primo deploy successivo, un UID
sbagliato fa fallire il primo upload in produzione con un `UnauthorizedAccessException`, e
un `backup.sh` che ignora i file ricostruisce un database perfetto pieno di immagini 404.
**Questa fase modifica i file e li verifica leggendoli**; la prova sul campo è la Fase 9.

- [ ] 8.1 🔴 **UID/GID fissati nel `Dockerfile`** — in `backend/Dockerfile` sostituisci `groupadd -r appuser && useradd -r -g appuser appuser` con:
  ```dockerfile
  RUN groupadd -r -g 10001 appuser && useradd -r -u 10001 -g appuser appuser
  ```
  `useradd -r` assegna un UID di sistema **non deterministico** (il primo libero scendendo da 999), che può cambiare al variare dell'immagine base. Su un bind mount l'UID è l'unica cosa che il kernel confronta: un `chown` sull'UID sbagliato produce un container che non riesce a scrivere i media.
  *Verifica*: `docker build` del backend, poi `docker run --rm --entrypoint id <image>` restituisce `uid=10001 gid=10001`. Senza questo task, il primo upload in produzione fallisce e **in sviluppo non si vede**, perché in sviluppo il container non c'è.

- [ ] 8.2 **Bind mount e `MEDIA_ROOT` in `docker-compose.yml`** — aggiungi al servizio `backend` (sarà il **primo** `volumes:` di quel servizio) `- /opt/duedgusto/media:/app/media` e l'env `MEDIA_ROOT: /app/media`.
  *Verifica*: `docker compose config` mostra il mount e la variabile.

- [ ] 8.3 **nginx: `location /media/`** — in `deploy/nginx/duedgusto.conf`, **prima** di `location / { try_files … }`: `alias /opt/duedgusto/media/;` (entrambe le barre finali), `try_files $uri =404` (nessun fallback su `index.html`: un media mancante è un 404), `expires 1y`, `add_header Cache-Control "public, immutable"`, `add_header X-Content-Type-Options "nosniff" always`, `access_log off`.
  *Verifica*: `nginx -t` sul file passa.

- [ ] 8.4 🔴 **nginx: `location /api/media` dedicata con `client_max_body_size 24M`** — una `location` **dedicata** alla sola rotta di upload, con un commento incrociato verso `MediaLimiti.MaxByteFile`. **Non allargare** il limite della `location /api/` esistente ([duedgusto.conf:77](../../../deploy/nginx/duedgusto.conf), `10M`): applicherebbe 24M anche a `/api/auth/signin`, che è anonimo e rate-limitato.
  *Verifica* (spec `media-assets` → *Le altre rotte API mantengono il limite precedente*): nel file, `location /api/` ha ancora `client_max_body_size 10M` e il valore 24M compare **solo** dentro `location /api/media`. I quattro limiti risultano in ordine decrescente di permissività: nginx 24M > Kestrel/MVC 22MB > applicazione 20MB, con il client a 20MB che rifiuta per primo.

- [ ] 8.5 🔴 **Commento di protezione sul `rm -rf` — in DUE file** — accanto a `rm -rf "$APP_DIR/frontend/dist/"*` di **`deploy/scripts/deploy.sh:46`** *e* di **`deploy/scripts/first-deploy.sh:350`** (verificati entrambi):
  ```bash
  # ATTENZIONE: questo rm -rf cancella tutto il contenuto di frontend/dist.
  # I media vivono in $APP_DIR/media, FUORI da qui, ed è deliberato: metterli
  # sotto dist significherebbe perderli tutti al deploy successivo, con il
  # database pieno di riferimenti a file inesistenti e nessun errore visibile.
  ```
  *Verifica*: `grep -c "I media vivono in" deploy/scripts/deploy.sh deploy/scripts/first-deploy.sh` restituisce **1 per ciascuno dei due file**. Uno solo dei due non basta: `first-deploy.sh` è quello che gira sulla macchina nuova.

- [ ] 8.6 **Creazione della directory media negli script** — in `deploy.sh`, `first-deploy.sh` e `setup-vps.sh` (accanto alle righe 90-92), **prima** di `docker compose up`:
  ```bash
  mkdir -p "$APP_DIR/media"
  chown -R 10001:10001 "$APP_DIR/media"   # 10001 = UID di appuser, fissato in backend/Dockerfile
  chmod -R 755 "$APP_DIR/media"           # 755: nginx (www-data) legge, solo appuser scrive
  ```
  *Verifica*: `grep -n "10001" deploy/scripts/*.sh` trova il numero nei tre script, e in ognuno il blocco precede l'avvio dei container.

- [ ] 8.7 🔴 **`backup.sh`: mirror `rsync` append-only, senza rotazione** — estendi `deploy/scripts/backup.sh` **dopo** il `mysqldump` (righe 33-39) con la sezione di design.md §D10: `rsync -a "$MEDIA_DIR/" "$MEDIA_BACKUP/"` **senza `--delete`**, dentro un `if` (con `set -e`, un `rsync` fallito fuori da una condizione aborterebbe lo script **dopo** un dump perfettamente riuscito), e **fuori** dalla rotazione a `RETENTION_DAYS=30`. Il commento nello script deve dichiarare **perché** le due politiche divergono: ogni dump SQL è uno snapshot completo e ridondante, i media sono contenuto **unico e immutabile** — ruotarli significa cancellare l'unica copia.
  *Verifica*: `grep -n "delete" deploy/scripts/backup.sh` **non** trova `--delete`; il comando `find ... -mtime +$RETENTION_DAYS -delete` continua a puntare **solo** ai file `.sql.gz` e mai a `$BACKUP_DIR/media`. Documenta nello stesso commento la procedura di ripristino (dump + `rsync` inverso + `chown 10001:10001`).

- [ ] 8.8 **Documentazione del rischio residuo** — nel commento di `backup.sh`: il mirror è sullo **stesso disco**. Protegge da cancellazione accidentale e da un ripristino di database, **non** dalla perdita del disco. Vale già oggi per i dump SQL; una copia off-site è fuori scope in questa fase, ma va detta.
  *Verifica*: la frase è nel file.

**Uscita di fase.** Tutti i file di infrastruttura sono modificati e leggibili; `nginx -t` e `docker compose config` passano. Nulla è ancora stato provato sul campo.

---

## Fase 9 — Verifiche sul VPS 🔒

> 🔒 **Questa fase richiede accesso SSH al VPS e non è verificabile in locale.** I tre
> rischi 🔴 della proposal — media cancellati dal `rm -rf`, primo upload che fallisce per
> permessi, ripristino con ogni immagine 404 — si manifestano **solo** in produzione: in
> sviluppo il container non c'è, `deploy.sh` non gira e `backup.sh` nemmeno. Raggruppate
> qui perché vanno eseguite in una sessione sola, con l'accesso già aperto.
>
> Prerequisito: Fasi 1-8 chiuse e mergiate; la chiave SSH sbloccata.

- [ ] 9.1 **Primo deploy e proprietà della directory** — esegui il deploy e ispeziona `/opt/duedgusto/media` **prima di fidarsi dello script**.
  *Verifica* (spec `media-assets` → *La proprietà della directory coincide con il processo*): `stat -c '%u:%g %a' /opt/duedgusto/media` restituisce `10001:10001 755`, e lo stesso numero è l'UID del processo backend dentro il container (`docker compose exec backend id`).

- [ ] 9.2 **Primo upload reale in produzione** — carica un'immagine dalla `MediaLibrary` in produzione.
  *Verifica* (spec `media-assets` → *Il primo upload dopo un deploy pulito riesce*): l'upload va a buon fine, `ls /opt/duedgusto/media/2026/*/` mostra **8 file**, e nei log del container **non** compare alcun `UnauthorizedAccessException`.

- [ ] 9.3 **Serving da nginx, non da .NET** — `curl -I https://<host>/media/<chiave>/800.webp`.
  *Verifica* (spec `media-assets` → *Media serviti dal web server in produzione*): la risposta ha `Cache-Control: public, immutable` ed `Expires` a un anno; la richiesta **non** compare nei log dell'applicazione .NET. E `www-data` legge ma **non** può scrivere nella directory.

- [ ] 9.4 🔴 **Simulazione di deploy: i media sopravvivono** — conta i file, esegui `deploy.sh` **per intero**, riconta.
  *Verifica* (spec `media-assets` → *Deploy simulato non perde i media*): `find /opt/duedgusto/media -type f | wc -l` è identico prima e dopo; ogni `MediaAsset.Chiave` a database corrisponde ancora a file esistenti; le URL delle varianti rispondono 200. È il rischio principale di §D9 e l'unico modo di chiuderlo è eseguirlo.

- [ ] 9.5 🔴 **Simulazione di ripristino** — esegui `backup.sh`, poi ripristina dump **e** mirror su un ambiente pulito seguendo la procedura documentata nel task 8.7.
  *Verifica* (spec `media-assets` → *Ripristino senza immagini rotte*): per **ogni** `MediaAsset` a database esistono i file corrispondenti; **nessuna URL di variante risponde 404**.

- [ ] 9.6 **Il mirror non ruota e non propaga le eliminazioni** — elimina un asset dal sistema, riesegui `backup.sh`.
  *Verifica* (spec `media-assets` → *Un media eliminato per errore resta recuperabile* e *Nessuna rotazione sul mirror*): i file dell'asset eliminato sono **ancora** nel mirror; nessun file del mirror viene rimosso per anzianità mentre la rotazione a 30 giorni continua ad applicarsi ai soli `.sql.gz`. Una seconda esecuzione senza nuovi upload non riscrive nulla.

- [ ] 9.7 **I quattro limiti di corpo, dal vero** — carica una foto da **15 MB** e poi un file da **30 MB** attraverso nginx.
  *Verifica* (spec `media-assets` → *Il limite di corpo non produce errori opachi*): il file da 15 MB **raggiunge il backend** ed è elaborato; quello da 30 MB produce un messaggio leggibile in italiano e **non** un 413 nudo generato da nginx. E `POST /api/auth/signin` con un corpo da 15 MB continua a essere rifiutato a 10M: l'innalzamento riguarda la sola rotta media.

- [ ] 9.8 **La cassa funziona esattamente come prima** — giro completo in produzione: registro, vendite, chiusura mensile, fornitori.
  *Verifica*: nessuna regressione osservabile; è l'ultimo criterio di successo della proposal e quello che non si può delegare a un test.

**Uscita di fase.** I tre rischi 🔴 della proposal sono chiusi con prove eseguite, non con argomenti.

---

## Fase 10 — Chiusura

**Perché esiste.** Tre decisioni sono state prese con una raccomandazione già scritta ma
lasciate aperte nel design: vanno confermate esplicitamente, non ereditate per silenzio.

- [ ] 10.1 **Conferma delle tre Open Questions** — annota la decisione presa su: `Allergeni` testo libero (`varchar(255)`), soglia megapixel a 50, `Cartella` stringa libera con default `"generale"`. Tutte e tre sono migrabili in modo additivo in Fase 2, ed è la ragione per cui si può decidere adesso.
  *Verifica*: le tre voci in design.md §"Open Questions" risultano spuntate con la decisione confermata.

- [ ] 10.2 **Checklist dei Success Criteria della proposal** — ripercorri i 14 criteri di [proposal.md](./proposal.md) §"Success Criteria", con la riformulazione dichiarata in §D6: *"il tentativo di eliminare un `MediaAsset` referenziato viene rifiutato, l'errore nomina i prodotti che lo usano, e nessun file né record viene cancellato"* sostituisce *"`DELETE` risponde 409"* (comportamento identico, trasporto diverso).
  *Verifica*: ogni criterio ha un task che lo chiude o una prova eseguita che lo dimostra.

- [ ] 10.3 **Pronto per `sdd-verify`** — `dotnet build`, `dotnet test`, `npm run ts:check`, `npm run lint`, `npm run test` tutti verdi sul branch della change.
  *Verifica*: la pipeline `.github/workflows/deploy.yml` passa su push.
