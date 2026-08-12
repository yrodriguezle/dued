# Proposal: API pubblica + impostazioni vetrina (vetrina-api-pubblica)

> **Fase 2 di 8, prima metà** del progetto "Sito vetrina 2D Gusto" — il **solo backend pubblico**.
> Il progetto Astro `sito/` (seconda metà della Fase 2) è un change successivo e distinto.
> Piano approvato di riferimento: `~/.claude/plans/chiedevo-una-pianificazione-del-immutable-stream.md`, §1, §2, §3, §5, §6, §9.
> Change precedente, completato: [`vetrina-fondamenta-media`](../vetrina-fondamenta-media/proposal.md).

## Intent

La Fase 1 ha costruito i dati e non li ha esposti a nessuno. Oggi nel sistema esistono immagini
elaborate, campi vetrina sui prodotti e una regola di pubblicazione — e **zero visitatori anonimi
che possano vederli**. Tre punti del codice lo dicono a voce alta, ognuno rimandando esattamente a
questo change:

1. `entity.HasIndex(x => x.VisibileSulSito);` preceduto dal commento **"Filtro dell'API pubblica di
   Fase 2"** ([AppDbContext.cs:448-449](../../../backend/DataAccess/AppDbContext.cs)) — l'indice
   esiste, la query che lo userebbe no.
2. `ProdottoType.pubblicatoSulSito` si descrive come *"la regola unica su cui filtrerà l'API
   pubblica — chiunque filtri diversamente sta inventando un secondo criterio"*
   ([ProdottoType.cs:49-53](../../../backend/GraphQL/Vendite/Types/ProdottoType.cs)). Il consumatore
   di quella regola non è ancora stato scritto.
3. `VenditeQueries.cs:20` avverte che *"il listino pubblico del sito vetrina NON passa da qui, ma da
   `/api/public/menu`"* — una rotta che **non esiste**.

Verifica: `grep -rn "PublicController|api/public" backend/ duedgusto/src` produce **quattro
occorrenze, tre delle quali sono commenti**. L'unica rotta pubblica reale è
`app.MapGet("/api/public/business-name", …)` ([Program.cs:358](../../../backend/Program.cs)), una
minimal API di sei righe che il frontend chiama al bootstrap prima del login
([main.tsx:43](../../../duedgusto/src/main.tsx)). Non esiste alcun `PublicController`, nessuna
cartella `Controllers/Public/`, nessuna entità `ImpostazioniVetrina`.

Manca inoltre **la fonte dei dati del locale**: indirizzo, geolocalizzazione, social, meta SEO di
default e ora di switch del tema non hanno oggi alcun posto dove vivere. `BusinessSettings` ha 11
campi, tutti operativi (orari, valuta, IVA, costo del giornale) e tutti letti da cassa e chiusure
mensili.

Obiettivo di questo change: **un contratto JSON pubblico, stabile e verificabile con `curl`**, che
la seconda metà della Fase 2 possa consumare senza inventare nulla — e una pagina admin da cui il
proprietario compili i dati del locale.

## Scope

**Moduli coinvolti: entrambi** (backend .NET + frontend React). **Nessuna modifica a
infrastruttura o deploy** — vedi Approach §4.
**Migrazioni database richieste: sì, una sola**, `AddImpostazioniVetrina`, puramente additiva (una
tabella nuova, nessuna colonna aggiunta a tabelle esistenti).

### In Scope

**Backend — modello dati**
- Entità `ImpostazioniVetrina` in `backend/Models/`, **singleton**, tenuta separata da
  `BusinessSettings` (motivazione in Approach §2): insegna pubblica, indirizzo completo,
  geolocalizzazione, contatti, social, meta SEO di default, immagine OG (FK nullable →
  `MediaAsset`), `OraInizioTemaSera`, e i campi prenotazione del piano §2 (`PrenotazioniAttive`,
  `PrenotazioniPreavvisoOre`, `PrenotazioniCopertiMax`) più `TurnstileSiteKey` come **gancio spento**
  — colonne che nascono ora perché la migrazione è una sola e additiva, e che **nessun codice di
  questa fase legge**.
- Migrazione `AddImpostazioniVetrina` (comando: `EF_MIGRATIONS=1 dotnet ef migrations add <Nome>`;
  si applica da sola all'avvio, [Program.cs:312](../../../backend/Program.cs)).
- `backend/SeedData/SeedImpostazioniVetrina.cs` idempotente, con i dati reali del locale già
  raccolti nel piano (Via del Costo 99, 36016 Thiene (VI); Instagram @2DGUSTO; insegna "2D Gusto
  Bar"). Il seed crea il record se manca e **non sovrascrive** ciò che l'admin ha già editato.

**Backend — API pubblica**
- `backend/Controllers/PublicController.cs`, `[AllowAnonymous]`, `[Route("api/public")]`, con
  **tre** rotte e nient'altro:

  | Rotta | `Cache-Control` | Contenuto |
  |---|---|---|
  | `GET /api/public/site` | `public, max-age=300` | Identità del locale: `ImpostazioniVetrina` **+** orari e nome da `BusinessSettings` (Approach §2) |
  | `GET /api/public/menu` | `public, max-age=60` | Categorie vetrina → prodotti `Attivo && VisibileSulSito`. **Limite hard 300 item** |
  | `GET /api/public/galleria` | `public, max-age=300` | `MediaAsset` pubblicati della cartella di galleria (Rischi: l'etichetta è una decisione aperta) |

- DTO **record** espliciti in `backend/Controllers/Public/Dto/` — **mai** un'entità EF serializzata.
  I DTO del menu non hanno `Codice`, `AliquotaIva`, `CreatedAt`, `UpdatedAt`, `UnitaDiMisura`,
  `Categoria` (contabile) né `Attivo`: non li omettono in serializzazione, **non li possiedono**.
- Estrazione della regola di pubblicazione e del fallback prezzo in un punto condiviso, riusato sia
  da `ProdottoType` sia dal controller (Approach §3).
- Test xUnit che **pinnano la superficie**: struttura dei DTO, filtro di pubblicazione,
  raggiungibilità anonima, limite 300, fallback del prezzo.

**Backend — GraphQL admin**
- Nuovo ramo query root `vetrina { impostazioni }` in `GraphQLQueries`, con `this.Authorize()` di
  classe — così è **coperto automaticamente** da `AutorizzazioneAnonimaTests`, che enumera i rami
  dallo schema.
- `vetrina { mutateImpostazioniVetrina }` nel `VetrinaMutations` esistente, con
  `GuardAmministratore` come prima istruzione del resolver, esattamente come le tre mutation già lì.
- `ImpostazioniVetrinaType` + `ImpostazioniVetrinaInputType` in `backend/GraphQL/Vetrina/Types/`.

**Frontend**
- `duedgusto/src/components/pages/sito/ImpostazioniVetrinaPage.tsx` — MUI consentito (è admin), sul
  pattern verbatim di [`settings/SettingsDetails.tsx`](../../../duedgusto/src/components/pages/settings/SettingsDetails.tsx):
  Formik + schema Zod + `FormikToolbar` + `useConfirm` + toast. Avvolta in `SitoGuard`.
- Selezione dell'immagine OG tramite il `MediaPickerDialog` **già esistente**.
- Operazioni GraphQL in `duedgusto/src/graphql/vetrina/` (cartella già presente:
  `queries.tsx`, `mutations.tsx`, `fragments.tsx`).
- Terza voce nella sezione "Sito" di `SeedMenusSito.cs` (`Posizione = 3`), con icona nuova
  registrata in `iconMapping.tsx`.

### Out of Scope

Rinviato alle fasi successive del piano, **non** cancellato:

- **Le altre rotte pubbliche**: `GET /api/public/eventi`, `/eventi/{slug}`, `/promozioni`,
  `/contenuti` e `POST /api/public/prenotazioni`. Appartengono alle Fasi 3-5 e **non** vengono
  aggiunte al `PublicController` in questa fase, nemmeno come stub.
- **Le entità che quelle rotte servirebbero**: `SezionePagina`, `Evento`, `Promozione`,
  `Prenotazione`, `PiattoDelGiorno` e le rispettive migrazioni, admin e seed.
- **Il progetto Astro `sito/`** e tutto ciò che lo accompagna: design system, doppio tema
  giorno/sera, font `.woff2`, logo SVG, JSON-LD, sitemap, `Immagine.astro`. È la seconda metà della
  Fase 2, come change separato.
- **Email, MailKit, `IHostedService`, antispam**: dipendono dalle prenotazioni (Fase 4).
- **Infrastruttura**: micro-cache nginx, split dei server block, Let's Encrypt, container `sito`,
  versioning action, cutover DNS. Sono Fase 6, e questo change **non tocca alcun file sotto
  `deploy/`** né `docker-compose.yml` (Approach §4).
- **`GET /api/public/business-name` resta dov'è**, invariata: è una rotta distinta, già in
  produzione, chiamata dal bootstrap dell'app prima del login (Rischi).
- **Il ramo GraphQL della cassa resta invariato**: `mutateProdotto`, `ProdottoInputType`,
  `UpsertProdottoAsync` e `VenditeQueries.prodotti` non vengono toccati. Il confine è pinnato dai
  test strutturali della Fase 1 e questo change non ha ragione di avvicinarvisi.
- **Rate limiting delle rotte pubbliche**: valutato e non incluso — vedi Rischi, dove è dichiarato
  come rischio accettato con la sua mitigazione minima.

## Approach

### 1. REST, non GraphQL — la dottrina è già scritta nel codice

La decisione non si ridiscute perché è già presa **due volte nel codebase**, e con parole precise:

> *"REST è la corsia del pubblico, GraphQL quella del privato"*
> — [MediaController.cs:28-35](../../../backend/Controllers/MediaController.cs)

> *"Se un ramo deve davvero essere raggiungibile senza login, NON aggiungerlo a un'allowlist qui:
> esponilo come endpoint REST sotto `/api/public/*`, dove la superficie è **chiusa per costruzione**
> invece che aperta per default."*
> — [AutorizzazioneAnonimaTests.cs:21-23](../../../backend/DuedGusto.Tests/Integration/GraphQL/AutorizzazioneAnonimaTests.cs)

Lo schema GraphQL è montato con `AuthorizationRequired = false`
([Program.cs:303](../../../backend/Program.cs)): la protezione è interamente per campo, quindi un
modulo che nasce senza `this.Authorize()` **è pubblico**. È già successo, con un account takeover
anonimo. Un controller REST ha il difetto opposto, che qui è una virtù: ciò che non è scritto non
esiste.

Questo change è il **primo consumatore** di quella dottrina: fino a oggi `/api/public/*` era una
promessa in un commento.

### 2. 🔴 `ImpostazioniVetrina` separata da `BusinessSettings`, e gli orari non si duplicano

`BusinessSettings` ha **11 campi, tutti operativi** — `OpeningTime`, `ClosingTime`,
`OperatingDays`, `Timezone`, `Currency`, `VatRate`, `GiornaleImportoSabato`… — letti e scritti da
cassa e chiusure mensili, con `PeriodoProgrammazione` e `GiornoNonLavorativo` appesi come
navigazioni. Aggiungerci venti campi di marketing significa **toccare un'entità critica a ogni
modifica del sito**, e mettere il rischio di un errore di cassa sul percorso di "cambio il link
Instagram".

Ma "due entità" non deve diventare "due verità". La regola:

| Dato | Sorgente unica |
|---|---|
| Nome attività, orari di apertura/chiusura, giorni operativi, timezone | **`BusinessSettings`** — la cassa li possiede già |
| Indirizzo, geo, social, meta SEO, `OraInizioTemaSera`, immagine OG | **`ImpostazioniVetrina`** |

`GET /api/public/site` **compone le due**, e non è un dettaglio implementativo: è ciò che rende
impossibile la classe di bug "il sito dice aperto fino alle 21, la cassa alle 19". Gli orari del
JSON-LD `openingHoursSpecification` (piano §6) nasceranno da lì, cioè dagli stessi campi che
generano il registro giornaliero.

### 3. La regola di pubblicazione ha già un posto; deve restare uno solo

`ProdottoType` espone due campi derivati con una descrizione che è, di fatto, un divieto:

```csharp
Field<NonNullGraphType<BooleanGraphType>>("pubblicatoSulSito")
    .Description("… È la regola unica su cui filtrerà l'API pubblica — chiunque filtri "
        + "diversamente sta inventando un secondo criterio.")
    .Resolve(context => context.Source.Attivo && context.Source.VisibileSulSito);
```

Il problema pratico: sono **resolver GraphQL**, non metodi chiamabili. Un `PublicController` che
scrivesse `.Where(p => p.Attivo && p.VisibileSulSito)` produrrebbe esattamente il secondo criterio
che il commento vieta — identico oggi, libero di divergere domani. Lo stesso vale per il fallback
`PrezzoVetrina ?? Prezzo`, dove l'insidia è più sottile: **`0` è un prezzo valido (omaggio) e non
deve ricadere sul listino**, e chi reimplementa il fallback con un `> 0` sbaglia senza accorgersene.

→ Entrambe le regole si estraggono in un punto condiviso (predicato `Expression<Func<Prodotto,bool>>`
traducibile in SQL, così l'indice su `VisibileSulSito` resta utile), e `ProdottoType` viene
riscritto per **chiamare** quel punto invece di duplicarlo. La forma precisa è materia di design;
il vincolo di questa proposal è che alla fine del change **esista una sola espressione della regola
nel repository**, verificabile con `grep`.

### 4. Nessuna modifica a `deploy/` — e perché il caching funziona lo stesso

Il piano §3 associa a ogni rotta una cache di 300s/60s e il piano §8 descrive un micro-cache nginx.
Verifica sul codice: **`grep -rn "proxy_cache" deploy/nginx/` non produce alcun risultato.** Gli
unici `expires` presenti sono su `location /media/` (riga 64) e `/assets/` (riga 76). Il micro-cache
nasce insieme al server block della vetrina, in Fase 6, che è anche il momento in cui esisterà un
container da mettere dietro la cache.

Inoltre nel backend **non è registrato alcun middleware di caching**: nessun `AddResponseCaching`,
nessun `AddOutputCache` in `Program.cs`.

→ Il caching di questa fase è **un contratto di header, non una cache**: le tre rotte emettono
`Cache-Control: public, max-age=N`. Non è un compromesso al ribasso — è ciò che rende il micro-cache
di Fase 6 **corretto per default**, perché nginx onora il `Cache-Control` dell'upstream. Emetterlo
adesso significa che in Fase 6 si aggiunge una `proxy_cache_path` e funziona; ometterlo adesso
significa scoprire in Fase 6 che le rotte non erano cacheabili. Il costo di scriverlo ora è una riga
per rotta.

### 5. `[AllowAnonymous]` esplicito anche se oggi è ridondante

`builder.Services.AddControllers()` ([Program.cs:81](../../../backend/Program.cs)) non registra
alcun filtro globale e non esiste `FallbackPolicy`: un controller senza `[Authorize]` è già
anonimo. `[AllowAnonymous]` si scrive comunque, per due ragioni: dichiara l'intenzione a chi legge
(il fratello `MediaController` porta `[Authorize]` sulla stessa riga, e il contrasto è
l'informazione), e sopravvive al giorno in cui qualcuno aggiungerà una fallback policy per chiudere
il resto dell'app.

### 6. Il limite di 300 item non è un `Take(300)` silenzioso

`/api/public/menu` non ha paginazione, e non deve averla: un menu di bar è una pagina sola. Il
limite hard del piano §3 esiste per impedire che un listino cresciuto per altre ragioni (codici
tecnici, importazioni) produca una risposta da megabyte su ogni richiesta anonima. Ma un `Take(300)`
nudo tronca **senza dirlo**: il sito mostrerebbe un menu incompleto e nessuno lo saprebbe mai.
→ Il DTO dichiara il troncamento (conteggio totale e flag), e il superamento del limite si logga
come warning lato server. Chi guarda il sito vede meno piatti; chi guarda i log sa perché.

## Affected Areas

| Area | Impatto | Descrizione |
|------|---------|-------------|
| `backend/Models/ImpostazioniVetrina.cs` | Nuovo | Entità singleton, separata da `BusinessSettings` (§2) |
| `backend/DataAccess/AppDbContext.cs` | Modificato | `DbSet<ImpostazioniVetrina>`, configurazione in `OnModelCreating`, FK nullable → `MediaAsset` per l'immagine OG |
| `backend/Migrations/*_AddImpostazioniVetrina.cs` | Nuovo | Migrazione additiva: **una tabella nuova, nessuna colonna su tabelle esistenti** |
| `backend/SeedData/SeedImpostazioniVetrina.cs` | Nuovo | Record iniziale con i dati reali del locale, idempotente, non sovrascrive gli edit dell'admin |
| `backend/SeedData/SeedMenusSito.cs` | Modificato | Terza voce "Impostazioni sito", `Posizione = 3`, stesso pattern di idempotenza delle due esistenti |
| `backend/Program.cs` | Modificato | `SeedImpostazioniVetrina.Initialize` dopo `SeedMenusSito`. `MapGet("/api/public/business-name")` **invariata** |
| `backend/Controllers/PublicController.cs` | Nuovo | `[AllowAnonymous]`, tre GET, `Cache-Control` per rotta |
| `backend/Controllers/Public/Dto/*.cs` | Nuovo | DTO record: superficie pubblica chiusa per costruzione |
| `backend/GraphQL/Vetrina/VetrinaQueries.cs` | Nuovo | Ramo query root `vetrina`, `this.Authorize()` di classe |
| `backend/GraphQL/GraphQLQueries.cs` | Modificato | Registrazione del ramo `vetrina` |
| `backend/GraphQL/Vetrina/VetrinaMutations.cs` | Modificato | +`mutateImpostazioniVetrina`, con `GuardAmministratore` come prima istruzione |
| `backend/GraphQL/Vetrina/Types/ImpostazioniVetrina{,Input}Type.cs` | Nuovo | Tipi GraphQL admin |
| `backend/GraphQL/Vendite/Types/ProdottoType.cs` | Modificato | I due campi derivati **chiamano** la regola condivisa invece di implementarla (§3) |
| `backend/GraphQL/Vendite/VenditeMutations.cs` | **Invariato** | 🔴 Il confine con la cassa non si avvicina nemmeno |
| `backend/GraphQL/Vendite/Types/ProdottoInputType.cs` | **Invariato** | 🔴 Idem |
| `backend/DuedGusto.Tests/Unit/Controllers/PublicControllerTests.cs` | Nuovo | Struttura DTO, filtro, limite 300, fallback prezzo |
| `backend/DuedGusto.Tests/Integration/GraphQL/*` | Modificato | Il ramo `vetrina` query entra automaticamente nell'enumerazione anonima; guard admin sulla nuova mutation |
| `duedgusto/src/components/pages/sito/ImpostazioniVetrinaPage.tsx` | Nuovo | Pattern `SettingsDetails.tsx`, dentro `SitoGuard` |
| `duedgusto/src/graphql/vetrina/{queries,mutations,fragments}.tsx` | Modificato | Query/mutation impostazioni |
| `duedgusto/src/components/layout/sideBar/iconMapping.tsx` | Modificato | Icona della terza voce |
| `deploy/**`, `docker-compose.yml` | **Invariato** | 🔴 Nessuna modifica: il micro-cache e i server block sono Fase 6 (§4) |

## Risks

| Rischio | Probabilità | Mitigazione |
|---------|-------------|-------------|
| 🔴 **Un campo contabile finisce nella risposta pubblica** (`Codice`, `AliquotaIva`, `CreatedAt`) perché qualcuno serializza l'entità o aggiunge una property al DTO | **Media, e cresce nel tempo** | DTO record che **non possiedono** quei campi + test strutturale che pinna l'elenco esatto delle property, nello spirito di `ProdottoInput_NonContieneCampiVetrina` della Fase 1. Il test rompe la CI nel momento in cui il campo viene aggiunto, non quando qualcuno lo nota online |
| 🔴 **La regola di pubblicazione viene duplicata** nel controller invece di riusata → il sito mostra un prodotto che la cassa considera ritirato | **Alta se non si estrae** | §3: una sola espressione nel repository, verificabile con `grep`. È il rischio che `ProdottoType.cs:49-53` descrive testualmente |
| **`/api/public/business-name` è una minimal API su `Program.cs:358`, non un controller**, ed è chiamata dal bootstrap del frontend ([main.tsx:43](../../../duedgusto/src/main.tsx)) **prima del login** | **Media** | Non si tocca e non si sposta dentro `PublicController`: i template di rotta non collidono, ma `MapControllers()` è alla riga 297 e la `MapGet` alla 358 — un errore qui rompe il caricamento dell'app, non una pagina. Criterio di successo dedicato. *Divergenza dal piano, che la dava per "rotta distinta" senza dire che è una minimal API* |
| **`Cartella` di default è `"generale"`, non `"gallery"`** | **Certa senza decisione** | Il piano §3 vuole `/api/public/galleria` filtrata su `Cartella="gallery"`, ma nel codice reale il default è `"generale"` in **cinque punti** ([MediaAsset.cs:65](../../../backend/Models/MediaAsset.cs), [AppDbContext.cs:501](../../../backend/DataAccess/AppDbContext.cs), la migrazione, [MediaLibrary.tsx:25](../../../duedgusto/src/components/pages/sito/MediaLibrary.tsx), `ImmagineProcessor.cs:486`) e **nessun media ha mai avuto `Cartella = "gallery"`**: la rotta risponderebbe sempre `[]`. Decisione aperta, vedi sotto |
| **Le GET pubbliche non sono rate-limited**: `AuthRateLimitMiddleware.RateLimitedPaths` ([riga 24-28](../../../backend/Middleware/AuthRateLimitMiddleware.cs)) è un dizionario hardcoded con due sole voci, entrambe `/api/auth/*` | **Media** | Sono la **prima superficie anonima non limitata** del sistema, su un VPS piccolo. Mitigazione minima di questa fase: `Cache-Control` corretto (§4) + limite 300 (§6), che rendono ogni risposta piccola e cacheabile. L'aggiunta al dizionario costa una riga ed è disponibile, ma un rate limit su GET pubbliche di un sito vetrina penalizza i crawler tanto quanto gli abusi: **decisione da prendere in design**, non da improvvisare. *Gap non presente nel piano* |
| **CORS**: `app.UseCors("AllowSpecificOrigins")` ([Program.cs:260](../../../backend/Program.cs)) è globale e la policy usa `AllowCredentials()` con allowlist di host | **Media in sviluppo** | Il percorso caldo non ne dipende (Astro legge server-side, piano §8), ma durante lo sviluppo della seconda metà della Fase 2 il browser su `localhost:4321` potrebbe chiamarle direttamente. Da decidere in design: policy CORS dedicata e permissiva sulle sole GET pubbliche (senza credenziali) oppure `localhost:4321` in `ALLOWED_ORIGINS`. Non bloccante per questo change, bloccante per il successivo |
| **`LarghezzeDisponibili` è un CSV** ([MediaAsset.cs:40](../../../backend/Models/MediaAsset.cs)) | Bassa | Il DTO pubblico espone un `int[]`, come fa già `MediaController.LeggiLarghezze` ([riga 145](../../../backend/Controllers/MediaController.cs)). Il sito non deve parsare un CSV per costruire un `srcset` |
| **Il DTO espone `chiave` o URL assoluti?** | Media | La dottrina della Fase 1 è netta: la chiave non conosce l'ambiente, il prefisso `/media` è *serving* e non dato ([mediaUrl.tsx](../../../duedgusto/src/components/pages/sito/mediaUrl.tsx), design §D3). Il DTO espone la **chiave**; chi compone l'URL è il consumatore. Da confermare in design come si passa il prefisso ad Astro |
| Il singleton `ImpostazioniVetrina` diventa due record | Media | `BusinessSettings` è già di fatto un singleton **senza vincolo** (`FirstOrDefaultAsync()` a [Program.cs:360](../../../backend/Program.cs)): il pattern esistente si affida al seed. Da decidere in design se replicarlo o irrigidirlo (chiave fissa a 1 + upsert nel resolver) |
| Il seed sovrascrive i dati che l'admin ha già inserito a ogni restart (`SEED_ON_STARTUP` gira sempre) | **Alta senza attenzione** | Il seed **crea** e non aggiorna, a differenza di `SeedMenus.UpdateMenuIfNeeded` che riallinea di proposito. Un menu riallineato è desiderabile, un indirizzo riscritto è perdita di lavoro |
| Seed duplicato della terza voce di menu | Media | Lookup del figlio per `Percorso`, come le due voci esistenti in `SeedMenusSito.cs:85,119`; il padre resta quello già seedato |
| Una risposta pubblica cacheata contiene un `Set-Cookie` | Bassa | Le rotte sono anonime e non impostano cookie; nginx per default non cachea risposte con `Set-Cookie`. Da non introdurre e da verificare con `curl -I` |

### Decisioni aperte da chiudere in design

1. **Etichetta della cartella di galleria** — `"gallery"` (piano) contro una scelta coerente con
   l'italiano del codebase; in entrambi i casi serve renderla **selezionabile dalla libreria media**,
   altrimenti nessuno potrà mai popolarla.
2. **Rate limiting delle GET pubbliche** — dentro `AuthRateLimitMiddleware` o niente.
3. **CORS per le tre rotte pubbliche** — policy dedicata o allowlist estesa.
4. **Unicità del singleton** — replicare il pattern permissivo di `BusinessSettings` o irrigidirlo.

## Rollback Plan

**Il rollback è non distruttivo per definizione: questo change non modifica alcun dato esistente.**
Non tocca tabelle esistenti, non riscrive righe, non altera il ramo cassa.

1. **API pubblica** — rimuovere `PublicController.cs` e `Controllers/Public/`. Nessun consumatore
   interno: il frontend admin non chiama `/api/public/*` (l'unica chiamata pubblica del frontend è
   `business-name`, che questo change non tocca). L'app continua a funzionare identica.
2. **Regola condivisa** — se l'estrazione di §3 va rivista, `ProdottoType` torna alle due
   `Resolve` inline: sono cinque righe e il comportamento osservabile dello schema è invariato, per
   costruzione.
3. **GraphQL admin** — rimuovere `VetrinaQueries`, la sua registrazione in `GraphQLQueries` e
   `mutateImpostazioniVetrina`. Le tre mutation della Fase 1 restano intatte.
4. **Menu** — `Visibile = false` sulla terza voce (o revoca di `AssegnaRuoli`) la fa sparire senza
   cancellare record; rimuovere il blocco da `SeedMenusSito.cs` impedisce che rinasca al restart.
   Le due voci della Fase 1 non sono coinvolte.
5. **Frontend** — revert di `ImpostazioniVetrinaPage.tsx` e delle operazioni GraphQL. Nessun'altra
   pagina dipende da loro.
6. **Database** — la migrazione è **additiva e isolata**: una tabella nuova, zero colonne aggiunte
   altrove. Lasciarla in produzione è innocuo (una tabella con una riga che nessuno legge). Se serve
   rimuoverla: `dotnet ef migrations remove` in sviluppo, o una migrazione inversa
   `DropImpostazioniVetrina`. **Il down cancella i dati del locale inseriti dall'admin**: sono pochi
   campi e si riscrivono, ma vanno esportati o persi consapevolmente.
7. **Infrastruttura** — nulla da revertire: questo change non tocca `deploy/` né
   `docker-compose.yml` (§4).

**Punto di non ritorno**: nessuno in questa fase. Il sito Astro non esiste ancora, quindi nessun
consumatore esterno dipende dal contratto JSON e un rollback non produce link rotti verso Internet.
Il punto di non ritorno arriverà con il go-live (Fase 6), quando il contratto diventerà pubblico
davvero.

## Dependencies

- **Fase 1 completata** ✅ verificata nel codice: `MediaAsset`, i dieci campi vetrina di `Prodotto`,
  `MediaController`, `VetrinaMutations` e le due pagine admin esistono e sono in produzione.
- **Fase 0 completata** ✅ `this.Authorize()` su tutti i rami root e `AutorizzazioneAnonimaTests`
  che lo pinna enumerando lo schema.
- **Nessuna nuova dipendenza NuGet**: nessuna libreria di caching, nessun serializzatore aggiuntivo.
  `System.Text.Json` di ASP.NET Core basta per i DTO record.
- **Nessuna nuova dipendenza npm**: MUI, Formik, Zod e `MediaPickerDialog` sono già nel progetto.
- **`GestioneCassaGuards.GuardUtenteAmministratore` / `IsUtenteAmministratore`** già promossi a
  metodi condivisi nella Fase 1 — riuso gratuito per la nuova mutation.
- **Nessuna dipendenza dal dominio né dal VPS**: tutto questo change è verificabile in locale con
  `curl` e `dotnet test`, e in produzione sull'app esistente.
- **Blocca**: il change successivo (progetto Astro), che non può iniziare senza questo contratto.

## Success Criteria

Ogni criterio dice **come si prova**. Nessuno si chiude per somiglianza.

> **Stato al 12 agosto 2026.** Le Fasi 1-10 sono chiuse e la Fase 11 è stata eseguita. L'unico
> criterio che si chiude soltanto in produzione è segnato 🔒 e nomina il task che lo chiuderà
> (11.1): non è stato dichiarato raggiunto per analogia con la prova in sviluppo.

- [x] `dotnet build` e `dotnet test` passano; `npm run ts:check`, `npm run lint` e `npm run test`
      passano. → Conteggi confrontati con il baseline della Fase 1 (487 backend, 755 frontend):
      nessun test preesistente modificato per farlo passare.
  → **667/667** backend (487 → 667, +180) e **772/772** frontend (755 → 772, +17), `ts:check` e
  `lint` puliti (task 11.7). Quattro file di test preesistenti risultano modificati e **nessuno**
  è stato indebolito: `AutorizzazioneAnonimaTests` +1/−1 (la sola aggiunta di `"vetrina"`, task
  8.5), `PrivilegiAmministrativiTests` +94/−0 e `MediaControllerTests` +56/−0 (puramente
  additivi), `VetrinaMediaTests` +231/−3 — le tre righe sono i **conteggi** del seed dei menu, che
  passano da 2 a 3 figli e da 3 a 4 righe di ruolo perché questo change aggiunge una voce per
  progetto, ed è lo stesso numero che il criterio sul riavvio pretende qui sotto. Divergenza
  dichiarata: il task 11.7 prevedeva **due** modifiche a test esistenti, non tre.
  ⚠️ La suite frontend è stata eseguita **tre volte** — 771, 771, poi **772 con uscita 0**: il
  rosso ripetuto è un test **preesistente** e sensibile ai tempi (`useFetchData`, non toccato da
  questo change) che da solo passa 17/17 in 7,9s. È annotato come difetto noto della suite nel
  task 11.7, e non è stato modificato per farlo passare.
- [x] La migrazione si applica su un database con dati di cassa reali senza perdita.
      → `dotnet ef migrations script` mostra **solo** `CREATE TABLE`; conteggio di `Prodotti`,
      `BusinessSettings` e `MediaAssets` identico prima e dopo.
  → Task 3.5 e 3.6: lo script contiene solo `CREATE TABLE`, `CREATE INDEX` e la riga di storico;
  applicata su un database con 607 registri storici, conteggi identici e `SHOW CREATE TABLE` di
  `MediaAssets`, `Prodotti` e `BusinessSettings` **identici byte per byte** prima e dopo.
- [~] 🔴 Le tre rotte rispondono **200 con JSON a un client senza alcun token**.
      → `curl -sk https://<host>/api/public/{site,menu,galleria}` da una shell senza header
      `Authorization` e senza cookie, in Development e in produzione.
  → **In sviluppo: chiuso** (task 5.17, ripetuto il 12 agosto in Fase 11 — `site`, `menu` e
  `galleria` rispondono `200`); le tre risposte con un token amministratore sono identiche byte
  per byte a quelle anonime. 🔒 **In produzione lo chiude il task 11.1**, che richiede il deploy.
- [x] 🔴 **Lo stesso dato non è raggiungibile via GraphQL anonimo**: `AutorizzazioneAnonimaTests`
      resta verde **e** copre il nuovo ramo `vetrina` query. → Il test enumera dallo schema, quindi
      il ramo nuovo compare nella lista dei casi senza che nessuno lo aggiunga a mano: si verifica
      leggendo l'output di `dotnet test --logger "console;verbosity=detailed"`.
  → Task 8.5: il test è diventato rosso all'introduzione del ramo e l'unica modifica è stata
  aggiungere `"vetrina"` all'elenco; le tre `Theory` enumerative coprono `Query.vetrina` da sole.
  Prova dal vivo in 8.11: anonimo su `query { vetrina { impostazioni } }` →
  `ACCESS_DENIED`.
- [x] 🔴 **La risposta di `/api/public/menu` non contiene mai `codice`, `aliquotaIva`, `createdAt`,
      `updatedAt`, `unitaDiMisura`, `categoria` (contabile) né `attivo`.** → Due prove indipendenti:
      `curl … | jq 'paths | join(".")' | sort -u` sull'output reale, **e** un test strutturale che
      asserisce l'elenco **esatto** delle property del DTO — il primo prova oggi, il secondo
      impedisce domani.
  → Entrambe eseguite. Sul JSON reale (task 5.17): nessuna delle **54** chiavi delle tre risposte
  appartiene all'elenco riservato. Sulla struttura (task 5.10): pin esatto per riflessione,
  ricorsivo sui tipi annidati, **verificato per mutazione** (5.11) — un `AliquotaIva` aggiunto a
  un record di secondo livello rende rossi 2 test su 18 e il messaggio nomina
  `CategoriaMenuDto.AliquotaIva`.
- [x] Un prodotto con `VisibileSulSito = true` e `Attivo = false` **non compare** in
      `/api/public/menu`. → Test che ne crea uno e conta gli elementi della risposta; e la
      controprova, `Attivo = true, VisibileSulSito = false`, altrettanto assente.
  → Task 5.12, più la controprova **sul dominio vero** in 5.17: il prodotto `VETR-F5-902`
  (`Attivo = 0`) non compare nel menu della rotta viva e **non è conteggiato**
  (`totaleProdottiPubblicati: 3` su 4 righe marcate visibili).
- [x] 🔴 **La regola di pubblicazione esiste in un punto solo.**
      → `grep -rn "VisibileSulSito" backend/ --include=*.cs` restituisce l'entità, la
      configurazione EF, la mutation che la scrive e **una sola** espressione di filtro; nessuna
      seconda congiunzione `Attivo && VisibileSulSito` nel controller.
  → Task 1.7, e non come `grep` manuale ma come test permanente
  (`RegolaPubblicazioneUnicaTests`), **verificato per mutazione** (1.8): una seconda congiunzione
  aggiunta in un file del ramo vetrina lo rende rosso **nominando il file di troppo**.
- [x] `PrezzoVetrina = null` → il DTO espone il `Prezzo` di listino; `PrezzoVetrina = 0` → il DTO
      espone **0**. → Due test distinti: il secondo è quello che si dimentica, ed è quello che
      trasforma un omaggio in un prezzo pieno sul sito.
  → Due volte: sulla regola (1.5, mutazione 1.6) e sul percorso completo del controller (5.13,
  con la sua mutazione). E sul JSON reale: `VETR-PROVA` ha `PrezzoVetrina = 0.00` e
  `Prezzo = 8.00`, e la rotta espone **`"prezzo":0.00`**. ⚠️ Scoperta del task 5.13: il test
  strutturale di unicità **non** protegge da questa mutazione (la riscrittura con `> 0` non
  contiene alcun `??`) — è la ragione per cui le due prove sono separate.
- [x] Con più di 300 prodotti pubblicabili la risposta ne contiene 300, **dichiara il troncamento**
      e ne resta un warning nei log. → Test con 301 prodotti che asserisce conteggio, campo di
      troncamento e messaggio.
  → Task 5.14. Il troncamento avviene **in SQL** (`ORDER BY OrdinamentoVetrina, ProdottoId LIMIT
  300`, ordine totale): con 301 prodotti si perde sempre lo stesso, l'ultimo per ordinamento, e
  non un'intera categoria a caso.
- [x] Gli header di cache sono quelli dichiarati. → `curl -I` mostra
      `Cache-Control: public, max-age=300` su `site` e `galleria`, `max-age=60` su `menu`, e
      **nessun `Set-Cookie`** su nessuna delle tre.
  → Task 6.7, e con una correzione al metodo: **`curl -I` non va usato** su queste rotte — manda
  un HEAD, le action sono `[HttpGet]` e la risposta è `405` con la policy CORS **globale**, cioè
  l'opposto di ciò che si voleva leggere. Su GET vere (`curl -sk -o /dev/null -D -`):
  `public,max-age=300` su `site` e `galleria`, `public,max-age=60` su `menu`, **nessun**
  `Set-Cookie`, `Vary`, `Expires` o `Pragma`. Riletto il 12 agosto in Fase 11, identico.
  `public,max-age=300` **senza spazio** dopo la virgola è la stessa direttiva di
  `public, max-age=300`: ASP.NET la emette così, e il criterio si legge, non si confronta con una
  stringa.
- [x] `GET /api/public/business-name` risponde ancora, e **l'app si avvia**: login completato e
      titolo dell'attività visibile in header. → Prova dall'interfaccia, non solo con `curl`: è il
      bootstrap di `main.tsx` a doverne uscire intatto.
  → Task 11.2, provato **nel browser**: la chiamata di bootstrap si osserva a `200`, prima del
  login `window.BUSINESS_NAME` vale `"duedgusto"` e il titolo mostrato è `"duedgusto"`; dopo il
  login l'header mostra lo stesso valore. **Con controprova**: bloccando la rotta, la stessa
  pagina mostra il ripiego `"DuedGusto"` e `window.BUSINESS_NAME` è `undefined` — il valore
  giusto viene da lì e non è una coincidenza.
- [x] Un amministratore compila indirizzo, social e ora del tema sera da
      `ImpostazioniVetrinaPage`, salva, e i valori **compaiono in `/api/public/site`** entro il
      tempo di cache. → Giro completo dall'interfaccia + `curl` sulla rotta pubblica, non lettura
      del database.
  → Task 11.3, dall'interfaccia e mai dal database: indirizzo scritto nella pagina →
  `"via":"Via della Prova 11"` sulla rotta pubblica → ripristinato a `"Via del Costo 99"`. E il
  giro speculare sugli **orari**, che appartengono alla cassa: chiusura portata a `21:00` dalla
  pagina delle impostazioni della cassa → `"chiusura":"21:00"` sulla rotta pubblica, con **tutto
  il resto della risposta invariato** → ripristinata a `20:00`. È la dimostrazione che gli orari
  hanno una sola sorgente. (Task 9.10 aveva già chiuso il giro su geo, social, SEO e immagine OG.)
- [x] Un utente autenticato **non amministratore** riceve un errore su
      `mutateImpostazioniVetrina` e sulla query `vetrina { impostazioni }`, chiamando GraphQL
      direttamente. → Due casi nel gruppo dei test sui privilegi amministrativi, con verifica che
      **nessuna scrittura** sia avvenuta.
  → Task 8.10 (5 casi nuovi in `PrivilegiAmministrativiTests`) e prova dal vivo in 10.6: con il
  token di un utente Gestore la chiamata GraphQL **diretta** risponde *«Operazione riservata agli
  amministratori»*, e la pagina non si apre nemmeno digitando l'URL a mano perché le route del
  frontend nascono dai menu dell'utente. Doppio gating dimostrato su entrambi gli strati.
- [x] Un riavvio del backend con `SEED_ON_STARTUP=true` **non duplica** la terza voce di menu e
      **non sovrascrive** le impostazioni già editate dall'admin. → Tre avvii consecutivi: conteggio
      dei figli di "Sito" fermo a 3 e campo modificato a mano ancora al suo valore.
  → Task 10.4: tre avvii reali, un padre e **tre** figli dopo ognuno (non nove), e gli
  identificativi restano `27, 28, 29` — le voci non vengono ricreate, che è più forte del solo
  conteggio. Task 4.4: indirizzo, Instagram e telefono modificati a mano sopravvivono a tre
  riavvii, mentre l'insegna che nessuno aveva toccato non viene riscritta.
- [x] 🔴 **La cassa è invariata, alla lettera.** → `git diff --stat` **vuoto** su
      `VenditeMutations.cs`, `ProdottoInputType.cs` e `VenditeQueries.cs`; i test strutturali del
      confine della Fase 1 passano senza modifiche.
  → Task 11.4: `git diff --stat <base>..HEAD` **vuoto** su tutti e tre; nel ramo
  `backend/GraphQL/Vendite/` l'unico file toccato è `ProdottoType.cs` (+11/−6), previsto dal task
  1.2. `ConfineVetrinaCassaTests` passa **4/4 senza essere stato toccato**.
- [x] **Nessun file sotto `deploy/` né `docker-compose.yml` è stato toccato.**
      → `git diff --stat deploy/ docker-compose.yml` vuoto (§4).
  → Task 11.4: vuoto dalla base del change (`7839f97`) a `HEAD`. ⚠️ Precisazione necessaria: fra
  il commit finale del change precedente e il primo di questo esiste `c0fb942`
  (*fix(deploy): la pipeline smette di chiedere privilegi che non ha*), che tocca `deploy/` e
  **non appartiene a questo change**. Un confronto fatto partire da lì mostrerebbe quattro file
  modificati e sarebbe una lettura sbagliata.

---

## Verifiche sul codice (divergenze rispetto al piano)

Il piano è anteriore all'implementazione della Fase 1. Ogni affermazione critica è stata verificata
sui file reali. Esito:

**Confermate senza riserve**
- Nessun `PublicController`, nessuna cartella `Controllers/Public/`, nessuna entità
  `ImpostazioniVetrina`: `Controllers/` contiene `AuthController.cs` e `MediaController.cs`.
- La dottrina "REST è la corsia del pubblico" è scritta in due punti del codice
  (`MediaController.cs:28-35`, `AutorizzazioneAnonimaTests.cs:21-23`) e non va ridiscussa.
- `Prodotto` ha i dieci campi vetrina, `PrezzoVetrina` è `decimal?` con fallback dinamico, e
  `AppDbContext` ha già l'indice su `VisibileSulSito` **etichettato per questa fase**.
- `BusinessSettings` è operativa e critica: separare `ImpostazioniVetrina` è la scelta giusta.

**Divergenze e precisazioni**
1. **Il micro-cache nginx non esiste**: `grep -rn "proxy_cache" deploy/nginx/` → zero risultati. La
   tabella cache del piano §3 si realizza in questa fase come **header `Cache-Control`**, e il
   micro-cache arriva in Fase 6 col server block della vetrina.
2. **Nessun middleware di caching registrato** in `Program.cs` (né `AddResponseCaching` né
   `AddOutputCache`): "cache 300s" è un contratto verso il client e verso il futuro reverse proxy,
   non una cache server-side.
3. **`/api/public/business-name` è una minimal API** (`Program.cs:358`), non un controller, ed è
   sul percorso di bootstrap del frontend prima del login (`main.tsx:43`). Convive con
   `[Route("api/public")]`, ma non si sposta.
4. **`Cartella` di default è `"generale"`**, in cinque punti del codice; **nessun media ha mai avuto
   `"gallery"`**. La rotta `/api/public/galleria` come descritta nel piano risponderebbe sempre
   vuota. Decisione aperta.
5. **Le rotte pubbliche non sono rate-limited**: `RateLimitedPaths` è un dizionario hardcoded con
   due sole voci `/api/auth/*`. Gap non presente nel piano.
6. **`app.UseCors` è globale con `AllowCredentials()`**: da chiarire prima che il progetto Astro
   provi a chiamare le rotte dal browser in sviluppo.
7. **`pubblicatoSulSito` e `prezzoEffettivoVetrina` esistono già** ma come resolver GraphQL, non
   come regole richiamabili: il riuso richiede un'estrazione, non una semplice chiamata.
8. **`LarghezzeDisponibili` è un CSV** nel modello: il DTO pubblico deve normalizzarlo in `int[]`,
   riusando la conversione già presente in `MediaController`.
9. **Non esiste una cartella `Integration/Controllers`** nei test: i test dei controller vivono in
   `Unit/Controllers` (`AuthControllerTests.cs`, `MediaControllerTests.cs`) e
   `AutorizzazioneAnonimaTests` copre **solo GraphQL** — la superficie REST pubblica ha bisogno dei
   propri test, non è coperta da quel meccanismo enumerativo.
10. **`SeedMenusSito.cs` ha già due figli** (`Posizione` 1 e 2) e il padre "Sito": la terza voce si
    aggiunge, il padre non si ricrea.
