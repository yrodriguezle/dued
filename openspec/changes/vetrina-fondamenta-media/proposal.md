# Proposal: Fondamenta media + campi vetrina (vetrina-fondamenta-media)

> **Fase 1 di 8** del progetto "Sito vetrina 2D Gusto".
> Piano approvato di riferimento: `~/.claude/plans/chiedevo-una-pianificazione-del-immutable-stream.md`.
> La Fase 0 (sicurezza GraphQL) è **già applicata**: `VenditeMutations.cs:25`, `VenditeQueries.cs:21` e `docker-compose.yml:38` (`ALLOWED_ORIGINS`) lo confermano nel codice.

## Intent

Il progetto complessivo è un sito vetrina pubblico (Astro) per il bar "2D Gusto", con il CMS realizzato come entità EF Core nel backend .NET esistente e amministrato da nuove pagine dell'app React. Questa è la fase che **sblocca tutte le altre**: senza immagini nessuna pagina del sito ha senso, e la collocazione dello storage è la decisione più costosa da cambiare a posteriori, perché i path finiscono nel database.

Oggi mancano entrambi i mattoni:

1. **Nessuna gestione media.** `grep -r "MediaAsset|MediaController|ImageSharp|MEDIA_ROOT"` sull'intero repository non produce alcun risultato: `backend/Controllers/` contiene solo `AuthController.cs`. Non esiste alcun modo di caricare una foto nel sistema.
2. **Nessun dato di vetrina sul listino.** `backend/Models/Prodotto.cs` ha 9 campi, tutti contabili (`Codice`, `Prezzo`, `Categoria`, `AliquotaIva`, `Attivo`…). Non c'è nulla che distingua un prodotto pubblicabile da un codice tecnico della cassa, né un nome/descrizione/immagine pensati per un cliente invece che per un cassiere.
3. **Nessuna UI prodotti.** `duedgusto/src/components/pages/` non ha una cartella prodotti: `mutateProdotto` è documentata nel codice come *"unico punto di amministrazione prodotti, UI fuori scope"* ([VenditeMutations.cs:43](../../../backend/GraphQL/Vendite/VenditeMutations.cs)). La griglia vetrina sarà la **prima** pagina prodotti mai costruita.

Obiettivo: un ciclo completo e verificabile end-to-end — *carichi una foto dall'admin, la vedi servita da nginx, marchi 10 prodotti come visibili sul sito* — senza toccare una riga del flusso di cassa esistente.

## Scope

**Moduli coinvolti: entrambi** (backend .NET + frontend React) **+ infrastruttura di deploy** (docker-compose, nginx, script).
**Migrazioni database richieste: sì, due**, in ordine obbligato (`AddMediaAsset` è prerequisito di `AddCampiVetrinaProdotto`, che la referenzia via FK).

### In Scope

**Backend — modello dati**
- Entità `MediaAsset` in `backend/Models/`: `Chiave` UNIQUE, `NomeOriginale`, `MimeType`, `Larghezza`, `Altezza`, `TestoAlternativo`, `Didascalia`, `Focale`, `Placeholder` (LQIP base64), `Cartella`, `Ordinamento`, `Pubblicato`, metadati temporali. **Nessun binario in DB** — solo metadati; i file vivono sul filesystem.
- Campi vetrina su `Prodotto`: `VisibileSulSito` (**default FALSE**), `NomeVetrina`, `DescrizioneVetrina`, `CategoriaVetrina`, `PrezzoVetrina` (nullable, fallback a `Prezzo`), `ImmagineId` (FK nullable → `MediaAsset`), `OrdinamentoVetrina`, `Allergeni`, `Novita`, `Consigliato`.
- Migrazioni `AddMediaAsset` → `AddCampiVetrinaProdotto` (comando: `EF_MIGRATIONS=1 dotnet ef migrations add <Nome>`; si applicano da sole all'avvio, [Program.cs:291](../../../backend/Program.cs)).

**Backend — upload e immagini**
- `backend/Controllers/MediaController.cs`, `[Authorize]` + `GuardUtenteAmministratore` su ogni scrittura: `POST /api/media` (multipart), `GET /api/media`, `PATCH /api/media/{id}` (alt/didascalia/ordinamento/pubblicato), `DELETE /api/media/{id}` (**409 se referenziata** da un prodotto).
- Nuova dipendenza `SixLabors.ImageSharp` 3.x (licenza Split, gratuita sotto $1M di fatturato).
- Pipeline di elaborazione: valida dimensioni in pixel **prima del decode** → auto-orient EXIF → **strip completo dei metadati** → per ogni larghezza in `[400, 800, 1200, 1600]` genera WebP q80 + JPEG q82 → LQIP 20px base64.
- Naming: `/{anno}/{mese}/{slug}-{6char}/{larghezza}.{webp|jpg}` — il suffisso random evita collisioni ed enumerazione.
- `UseStaticFiles` per `/media` **solo** `if (env.IsDevelopment())`; in produzione serve nginx.

**Backend — GraphQL**
- Mutation `mutateProdottoVetrina(prodottoId, input)` nel ramo `vendite`, **separata** da `mutateProdotto`, che tocca solo i 10 campi vetrina e mai `Codice`/`Nome`/`Prezzo`/`AliquotaIva`/`Attivo`/`Categoria`.
- Estensione di `ProdottoType` con i campi vetrina (lettura) — **senza** toccare `ProdottoInputType`.
- Test xUnit che **pinna il confine**: `mutateProdotto` con un payload senza campi vetrina non deve azzerare i campi vetrina di un prodotto esistente.

**Frontend**
- `duedgusto/src/components/pages/sito/MediaLibrary.tsx` — griglia di card MUI (**non** AG Grid), upload multiplo con progress, edit inline di alt/didascalia/ordinamento, eliminazione con gestione del 409.
- `duedgusto/src/components/pages/sito/VetrinaProdottiList.tsx` — AG Grid (skill `datagrid`). `Codice`/`Nome`/`Prezzo` **read-only**; editing inline dei soli campi vetrina → `mutateProdottoVetrina`. È la pagina d'uso quotidiano.
- `duedgusto/src/components/pages/sito/SitoGuard.tsx` — wrapper sul modello di `wiki/WikiLayout.tsx:36-55`.
- `duedgusto/src/api/uploadRequest.tsx` — nuovo helper multipart (vedi Approach §5).
- Operazioni GraphQL in `duedgusto/src/graphql/vetrina/` + hook.
- Icone nuove registrate in `duedgusto/src/components/layout/sideBar/iconMapping.tsx` (`lucide-react ^1.7.0` già dipendenza).

**Seed e gating**
- Nuovo `backend/SeedData/SeedMenusSito.cs` invocato in `Program.cs` dopo `SeedMenus.Initialize` (file separato: `SeedMenus.cs` è già 916 righe). Menu padre "Sito" (`Icona="Globe"`, `Posizione=9`, subito dopo Wiki che è a 8) con le due voci di questa fase.
- Gating a tre livelli sul pattern Wiki: seed `AssegnaRuoli` su `.Where(r => r.Amministratore || r.Nome == "SuperAdmin")` → `SitoGuard` client-side → **`GestioneCassaGuards.GuardUtenteAmministratore`** su ogni scrittura (l'unico dei tre che è sicurezza).

**Infrastruttura**
- Bind mount `/opt/duedgusto/media:/app/media` sul servizio `backend` di `docker-compose.yml` + env `MEDIA_ROOT` (sarà il **primo** `volumes:` di quel servizio).
- `deploy/nginx/duedgusto.conf`: `location /media/ { alias /opt/duedgusto/media/; expires 1y; }` + `client_max_body_size` adeguato sulla rotta di upload (vedi Rischi).
- `deploy/scripts/deploy.sh`: `mkdir -p /opt/duedgusto/media` + chown **prima** di `docker compose up`, e commento esplicito accanto al `rm -rf` di riga 46.
- `deploy/scripts/backup.sh`: esteso ai media (tar incrementale o rsync verso `$BACKUP_DIR`, stessa rotazione a 30 giorni).

### Out of Scope

Rinviato alle fasi successive del piano, **non** cancellato:

- API pubblica `/api/public/*` e `PublicController` (Fase 2) — in questa fase i media e i flag vetrina esistono ma **non sono ancora esposti a nessun visitatore anonimo**.
- Progetto Astro `sito/`, design system, temi giorno/sera, font, logo SVG (Fase 2).
- Entità `ImpostazioniVetrina`, `SezionePagina`, `Evento`, `Promozione`, `Prenotazione`, `PiattoDelGiorno` e le rispettive migrazioni/admin (Fasi 2-5).
- Contenuti editoriali, SEO/JSON-LD, prenotazioni ed email (Fasi 3-4).
- Split dei server block nginx, Let's Encrypt, container `sito`, versioning action, cutover DNS (Fase 6).
- AVIF: `ImageSharp` 3.x non ha encoder AVIF; WebP copre ~96% dei browser e aggiungerlo domani è un'estensione ai file generati, non tocca schema né URL.
- Migrazione dei media esistenti: non esistono media esistenti. Le foto in `docs/` sono materiale sorgente, non dati da importare.
- Rimozione o refactor di `mutateProdotto` e di `ProdottoInput`: restano **invariati**, è il punto centrale del change.

## Approach

### 1. Ordine di esecuzione

`MediaAsset` prima di tutto — `Prodotto.ImmagineId` è una FK verso di essa, quindi la migrazione 2 non compila senza la 1. Poi il controller (che rende `MediaAsset` popolabile), poi la mutation vetrina, poi le due pagine admin, infine deploy/backup. Ogni gradino è verificabile da solo.

### 2. 🔴 Due mutation, mai un input unico

`UpsertProdottoAsync` ([VenditeMutations.cs:294-353](../../../backend/GraphQL/Vendite/VenditeMutations.cs)) assegna **esplicitamente** ogni campo, nove righe consecutive:

```csharp
prodotto.Codice = codice;
prodotto.Nome = input.Nome;
prodotto.Descrizione = input.Descrizione;
prodotto.Prezzo = input.Prezzo;
prodotto.Categoria = input.Categoria;
prodotto.UnitaDiMisura = input.UnitaDiMisura ?? prodotto.UnitaDiMisura;
prodotto.Attivo = input.Attivo;
prodotto.AliquotaIva = input.AliquotaIva;
prodotto.UpdatedAt = DateTime.UtcNow;
```

Non è un `patch` selettivo: è un'assegnazione totale. Se i campi vetrina finissero in `ProdottoInput`, **il primo upsert della cassa che non li invia li azzererebbe in massa** — nomi, descrizioni, immagini e flag di pubblicazione persi in un colpo, con il sito che si svuota senza che nessuno abbia toccato il sito.

→ `mutateProdotto` e `ProdottoInputType` restano **letteralmente invariati**. La nuova `mutateProdottoVetrina(prodottoId, input)` carica il prodotto per id e scrive solo i 10 campi vetrina. Un test xUnit pinna il confine in entrambe le direzioni.

### 3. 🔴 Storage fuori dalla directory di serving

`deploy/scripts/deploy.sh:46` esegue:

```bash
rm -rf "$APP_DIR/frontend/dist/"*
```

La tentazione di mettere i media in `/opt/duedgusto/frontend/dist/media` è forte — nginx li servirebbe gratis, zero configurazione. Sarebbe **perdita totale al primo deploy successivo**, con il database pieno di riferimenti a file che non esistono più e nessun messaggio d'errore: solo immagini rotte, giorni dopo. La directory è `/opt/duedgusto/media`, fuori da `frontend/`, con un commento esplicito nello script accanto al `rm -rf`.

### 4. 🔴 Backup esteso ai media

`deploy/scripts/backup.sh` fa **solo** `mysqldump` (righe 33-39). Un ripristino da backup odierno ricrea il database con ogni `MediaAsset.Chiave` intatta e ogni file mancante: un sito integro nel DB e completamente rotto a schermo. Lo script viene esteso con un archivio dei media nella stessa cartella `$BACKUP_DIR` e la stessa rotazione a `RETENTION_DAYS=30`, e il fallimento della parte media non deve far fallire il dump del database (che resta la priorità).

### 5. Upload multipart: `makeRequest` non basta

`duedgusto/src/api/makeRequest.tsx` hardcoda `"Content-Type": "application/json;charset=UTF-8"` e `body: JSON.stringify(data)`: **non può inviare un `FormData`**. Serve un `uploadRequest.tsx` fratello che ometta il `Content-Type` (lasciandolo generare al browser col boundary) e **preservi la logica 401 → refresh → retry** di `makeRequest:48-62` — altrimenti un token scaduto a metà upload perde il file senza dirlo all'utente.

### 6. Memoria: validare i pixel prima del decode

Un JPEG 12 Mpx decompresso occupa ~48MB in RAM. Upload concorrenti su un VPS piccolo = OOM del container backend, cioè cassa offline. La pipeline legge l'header dell'immagine (`Image.Identify`, che non decodifica) e rifiuta oltre una soglia di megapixel **prima** di allocare il bitmap.

### 7. Gating: il flag admin non è coperto da `.Authorize()`

`.Authorize()` verifica solo *"autenticato"*. `GestioneCassaGuards.GuardUtenteAmministratore` ([GestioneCassaGuards.cs:94-106](../../../backend/GraphQL/GestioneCassa/GestioneCassaGuards.cs)) legge il flag `Ruolo.Amministratore` — **non** il nome del ruolo, così rinominare un ruolo non sposta i permessi. Senza quella chiamata, un utente autenticato non-admin scrive sul sito via GraphQL diretto, saltando `SitoGuard` che è solo cosmesi.

## Affected Areas

| Area | Impatto | Descrizione |
|------|---------|-------------|
| `backend/Models/MediaAsset.cs` | Nuovo | Entità metadati immagini (nessun binario) |
| `backend/Models/Prodotto.cs` | Modificato | +10 campi vetrina, FK `ImmagineId` |
| `backend/DataAccess/AppDbContext.cs` | Modificato | `DbSet<MediaAsset>`, indice UNIQUE su `Chiave`, FK `Prodotto → MediaAsset` con `DeleteBehavior.Restrict` |
| `backend/Migrations/*_AddMediaAsset.cs` | Nuovo | Migrazione 1 (prerequisito) |
| `backend/Migrations/*_AddCampiVetrinaProdotto.cs` | Nuovo | Migrazione 2 (dipende dalla 1) |
| `backend/Controllers/MediaController.cs` | Nuovo | POST multipart / GET / PATCH / DELETE, admin-only |
| `backend/Services/Media/*` | Nuovo | Pipeline ImageSharp: validazione, strip EXIF, varianti, LQIP; astrazione dello storage |
| `backend/GraphQL/Vendite/VenditeMutations.cs` | Modificato | +`mutateProdottoVetrina`. `mutateProdotto` e `UpsertProdottoAsync` **invariati** |
| `backend/GraphQL/Vendite/Types/ProdottoType.cs` | Modificato | Campi vetrina in lettura + risoluzione `immagine` |
| `backend/GraphQL/Vendite/Types/ProdottoVetrinaInputType.cs` | Nuovo | Input dei soli 10 campi vetrina |
| `backend/GraphQL/Vendite/Types/ProdottoInputType.cs` | **Invariato** | 🔴 Non toccare: vedi Approach §2 |
| `backend/GraphQL/Vendite/VenditeQueries.cs` | Modificato | `prodotti` deve poter includere i non attivi per la griglia vetrina (vedi Rischi) |
| `backend/SeedData/SeedMenusSito.cs` | Nuovo | Menu padre "Sito" + 2 voci, admin-only, idempotente |
| `backend/Program.cs` | Modificato | `SeedMenusSito.Initialize`, `MEDIA_ROOT`, `UseStaticFiles` solo in Development |
| `backend/duedgusto.csproj` | Modificato | `SixLabors.ImageSharp` 3.x |
| `backend/DuedGusto.Tests/**` | Nuovo | Test pipeline immagini, guard admin, e il test che pinna il confine `mutateProdotto` |
| `duedgusto/src/components/pages/sito/MediaLibrary.tsx` | Nuovo | Griglia card, upload multiplo |
| `duedgusto/src/components/pages/sito/VetrinaProdottiList.tsx` | Nuovo | AG Grid, editing inline campi vetrina |
| `duedgusto/src/components/pages/sito/SitoGuard.tsx` | Nuovo | Gate client-side su `ruolo.amministratore` |
| `duedgusto/src/api/uploadRequest.tsx` | Nuovo | Helper multipart con refresh token (§5) |
| `duedgusto/src/graphql/vetrina/**` | Nuovo | Query/mutation/hook vetrina |
| `duedgusto/src/components/layout/sideBar/iconMapping.tsx` | Modificato | Icone `Globe`, `Images`, `ShoppingBag` |
| `docker-compose.yml` | Modificato | Bind mount media + `MEDIA_ROOT` sul servizio `backend` |
| `deploy/nginx/duedgusto.conf` | Modificato | `location /media/` + `client_max_body_size` sull'upload |
| `deploy/scripts/deploy.sh` | Modificato | `mkdir -p` media + chown; commento sul `rm -rf` di riga 46 |
| `deploy/scripts/backup.sh` | Modificato | 🔴 Backup dei media oltre al `mysqldump` |

## Risks

| Rischio | Probabilità | Mitigazione |
|---------|-------------|-------------|
| 🔴 Campi vetrina azzerati in massa da un upsert della cassa | **Alta se sbagliamo il design** | `ProdottoInput` invariato + mutation separata + test xUnit che pinna il confine. È la ragione principale per cui questo change esiste come fase a sé |
| 🔴 Media cancellati dal `rm -rf` di `deploy.sh:46` | Alta se collocati male | `/opt/duedgusto/media` fuori da `frontend/`; commento nello script; verifica esplicita con un deploy simulato nei criteri di successo |
| 🔴 Ripristino da backup con ogni immagine 404 | Certa senza intervento | `backup.sh` esteso; test di ripristino documentato |
| **`client_max_body_size 10M`** su `/api/` ([duedgusto.conf:77](../../../deploy/nginx/duedgusto.conf)): una foto da smartphone moderno supera i 10MB → **413 prima ancora di raggiungere .NET** | **Alta** | Alzare il limite sulla rotta media (es. 25M) **e** validare lo stesso limite lato .NET; messaggio d'errore leggibile invece di un 413 nudo. *Vincolo non presente nel piano, emerso dal codice* |
| **`prodotti` filtra `.Where(p => p.Attivo)`** ([VenditeQueries.cs:36](../../../backend/GraphQL/Vendite/VenditeQueries.cs)): un prodotto disattivato in cassa sparisce dalla griglia vetrina ma resta `VisibileSulSito = true` a DB → in Fase 2 verrebbe pubblicato senza che nessuno possa più vederlo in admin | **Media** | Decisione da prendere in design: la griglia vetrina espone i non attivi (argomento `includiNonAttivi`) **e** l'API pubblica di Fase 2 filtra comunque `Attivo && VisibileSulSito`. *Gap non presente nel piano* |
| OOM del container backend su upload concorrenti (48MB per un JPEG 12 Mpx) | Media | `Image.Identify` + soglia megapixel **prima** del decode; limite di concorrenza sull'endpoint |
| EXIF GPS nelle foto del locale pubblicato su Internet | **Alta senza strip** | Strip completo dei metadati nella pipeline, non opzionale; verifica con `exiftool` nei criteri di successo |
| Seed duplicato del menu "Sito" a ogni restart (`SEED_ON_STARTUP` gira sempre) | Media | Lookup del padre per `Titolo == "Sito" && Percorso == string.Empty` e dei figli per `Percorso` — **il pattern reale di `SeedMenus.cs`**, dove i menu padre hanno `Percorso` vuoto e non sono distinguibili dal solo percorso. Il cleanup dei duplicati Dashboard ([SeedMenus.cs:81-86](../../../backend/SeedData/SeedMenus.cs)) è la prova di cosa succede sbagliando |
| `PercorsoFile` scritto col path completo invece che relativo | Media | Nel codice reale è **relativo a `src/components/pages/`** (es. `wiki/RegistroCassaWiki.tsx`), non il path completo documentato in `duedgusto/CLAUDE.md`. Seguire il codice: `sito/MediaLibrary.tsx` |
| `VetrinaProdottiList` non può copiare `FornitoreList`: `prodotti` è una lista piatta con `limite`/`scostamento` (default 100), **non** una connection Relay come tutte le altre griglie del progetto | Media | Da risolvere in design: o si converte `prodotti` a Relay, o la griglia gestisce la paginazione offset. Non improvvisare in fase di apply |
| Eliminazione di un `MediaAsset` referenziato da un prodotto | Media | `DeleteBehavior.Restrict` a livello EF **e** 409 esplicito dal controller con l'elenco dei prodotti che la usano |
| Licenza ImageSharp fraintesa | Bassa | Split License: gratuita sotto $1M di fatturato annuo. Da annotare nel design e nel `csproj` |

## Rollback Plan

**Il rollback è progettato per essere non distruttivo: nessuno dei dati della cassa viene toccato in nessun momento.**

1. **Frontend** — revert dei commit delle pagine `sito/`, di `uploadRequest.tsx` e delle icone. Nessun'altra pagina dipende da loro: l'app torna esattamente com'era.
2. **Menu** — impostare `Visibile = false` sul menu "Sito" e figli (o revocare `AssegnaRuoli`) fa sparire la sezione senza cancellare record. Rimuovere l'invocazione di `SeedMenusSito.Initialize` da `Program.cs` impedisce che rinasca al restart.
3. **GraphQL** — rimuovere `mutateProdottoVetrina` e i campi vetrina da `ProdottoType`. Poiché `mutateProdotto` e `ProdottoInputType` non sono mai stati toccati, **la cassa non ha nulla da revertire**.
4. **Controller e pipeline** — rimuovere `MediaController` e `Services/Media/`; rimuovere `SixLabors.ImageSharp` dal `csproj`.
5. **Database** — le due migrazioni sono **additive** (nuova tabella + colonne nullable/con default). Lasciarle in produzione è innocuo: colonne inutilizzate e una tabella vuota non hanno effetto sulla cassa. Se serve rimuoverle davvero: `dotnet ef migrations remove` in sviluppo, oppure una migrazione inversa `DropCampiVetrinaProdotto` → `DropMediaAsset` **in quest'ordine** (la FK va rimossa prima della tabella referenziata). **La migrazione down cancella i dati di vetrina inseriti**: prima esportarli, o accettare la perdita consapevolmente.
6. **Filesystem** — `/opt/duedgusto/media` sopravvive a qualunque revert del codice: nessun file va perso durante un rollback. Rimuoverlo è un'azione manuale e deliberata.
7. **Infrastruttura** — rimuovere `location /media/` da nginx, il bind mount da `docker-compose.yml` e la sezione media da `backup.sh`. Le modifiche a `deploy.sh` (`mkdir -p` e commento) sono innocue e possono restare.

**Punto di non ritorno**: non ce n'è in questa fase. I media non sono ancora esposti pubblicamente (l'API pubblica arriva in Fase 2), quindi un rollback non produce link rotti verso l'esterno.

## Dependencies

- **Fase 0 completata** ✅ verificata nel codice: `this.Authorize()` di classe in `VenditeMutations.cs:25` e `VenditeQueries.cs:21`, `ALLOWED_ORIGINS` in `docker-compose.yml:38`.
- **Nuova dipendenza NuGet**: `SixLabors.ImageSharp` 3.x (Split License).
- **Nessuna nuova dipendenza npm**: MUI v6, AG Grid Enterprise 33 e `lucide-react ^1.7.0` sono già nel progetto.
- **`GestioneCassaGuards.GuardUtenteAmministratore`** e il flag `Ruolo.Amministratore` esistono già (migrazione `20260808154340_AddAmministratoreToRuolo`) — riuso gratuito.
- **Accesso al VPS** per creare `/opt/duedgusto/media` con i permessi corretti al primo deploy (lo script lo farà, ma il primo giro va verificato a mano).
- **Nessuna dipendenza dal dominio**: tutto questo change è verificabile in locale e in produzione sull'app esistente.

## Success Criteria

> **Stato al 12 agosto 2026: tutte le fasi chiuse, Fase 9 compresa.** I criteri segnati 🔒
> si chiudevano soltanto in produzione e nominavano il task che li avrebbe chiusi: nessuno è
> stato dichiarato raggiunto per somiglianza, e ora ognuno porta la prova che lo chiude.
>
> ⚠️ **Due criteri non poggiano su una prova eseguita**, e vanno letti sapendolo:
> - *«La cassa funziona esattamente come prima»* — la metà contabile (registro, vendite,
>   chiusura mensile, fornitori) è **dichiarata conclusa dall'amministratore**, che è
>   l'autorità giusta per quel criterio ma non è un comando ripetibile. La metà del confine
>   cassa/vetrina è invece provata in produzione (task 9.8 ①).
> - *«10 prodotti in vetrina»* resta `[~]`: il meccanismo è provato, i dieci prodotti sono
>   contenuto editoriale. Il 12 agosto l'anagrafica prodotti in produzione è risultata
>   **vuota** — la cassa lavora su totali giornalieri — e ne è stato creato **uno**.

- [x] `dotnet build` e `dotnet test` passano; `npm run ts:check`, `npm run lint` e `npm run test` passano
  → **487/487** backend, **755/755** frontend, `ts:check` e `lint` puliti.
- [x] Le due migrazioni si applicano in sequenza su un database esistente senza perdita di dati
  → Applicate su un database con dati di cassa reali; conteggio prodotti e campi contabili invariati byte per byte (task 1.5 e 1.9).
- [x] Un amministratore carica una foto da `MediaLibrary`, e `ls …/2026/…` mostra **4 larghezze × 2 formati** più il record in `MediaAsset`
  → In sviluppo: 8 file per una sorgente 2508×951 (task 2.10) e caricamento **dall'interfaccia** con record creato (Fase 6). 🔒 Su `/opt/duedgusto/media` lo chiude il task 9.2.
- [x] `exiftool` sui file generati **non** mostra GPS né alcun metadato EXIF
  → Provato con `exiftool` su una sorgente con GPS/EXIF/IPTC/XMP iniettati (task 2.10) e pinnato dal test `Elaborazione_RimuoveOgniProfiloEIlGps`.
- [x] 🔒 L'immagine è raggiungibile via `https://<host>/media/…` servita da **nginx** (non da .NET) con `expires 1y` → task 9.3. In sviluppo la serve .NET con lo stesso `Cache-Control: public,max-age=31536000,immutable`, e `nginx -t` sulla `location /media/` passa.
- [x] 🔒 Un upload da 15MB non produce un 413 opaco ma un errore leggibile → task 9.7. I quattro limiti sono in ordine decrescente dall'esterno verso l'interno e `uploadRequest` traduce un 413 con corpo HTML in un messaggio leggibile (test 7.14).
- [x] Un'immagine oltre la soglia di megapixel viene rifiutata **senza** che la memoria del container esploda
  → Rifiuto sulla sola intestazione, provato con un JPEG la cui intestazione dichiara 12000×10000 (test 7.2).
- [x] Il tentativo di eliminare un `MediaAsset` referenziato viene **rifiutato**, l'errore **nomina i prodotti** che lo usano, e nessun file né record viene cancellato
  → Riformulazione dichiarata in design §D6 (comportamento identico, trasporto GraphQL invece di `DELETE`/409). Provato dal test 7.8 e sul campo in Fase 3.
- [~] 10 prodotti marcati `VisibileSulSito = true` da `VetrinaProdottiList`, con nome/descrizione/categoria vetrina e immagine associata
  → Il meccanismo è provato **dall'interfaccia** su un prodotto reale (Fase 6): scrittura per riga, immagine assegnata dal selettore, campi cassa invariati. I dieci prodotti veri sono contenuto editoriale, non codice: si popolano quando il listino di cassa entrerà in vetrina.
- [x] 🔴 **Il test del confine passa**: un `mutateProdotto` con payload di sola cassa **non** azzera i campi vetrina del prodotto
  → Tre test in Fase 3, **verificati per mutazione**: iniettando le violazioni falliscono davvero.
- [x] Un utente autenticato **non amministratore** riceve un errore dal backend su ogni scrittura media/vetrina, anche chiamando GraphQL e REST direttamente
  → Cinque casi GraphQL (incluse le due letture di `connection { mediaAssets }`) e `POST /api/media` con **403 e corpo JSON**, senza alcun effetto collaterale (test 7.9).
- [x] 🔒 🔴 **Simulazione di deploy**: dopo `deploy.sh` i file in `/opt/duedgusto/media` sono ancora tutti lì → task 9.4.
- [x] 🔒 🔴 **Simulazione di ripristino**: `backup.sh` produce un mirror che contiene i media, e un restore ricostruisce DB **e** file senza 404 → task 9.5.
- [x] Un riavvio del backend con `SEED_ON_STARTUP=true` **non** duplica il menu "Sito"
  → Tre avvii reali: un padre e due figli a database (Fase 4), più il test di idempotenza 7.10.
- [x] La cassa funziona esattamente come prima: registro, vendite, chiusura mensile, fornitori
  → I 431 test preesistenti passano senza modifiche e il ramo GraphQL della cassa è invariato (`git diff --stat` vuoto sui tre file, task 3.12). 🔒 Il giro completo in produzione è il task 9.8.

---

## Verifiche sul codice (divergenze rispetto al briefing)

Ogni affermazione critica è stata verificata sui file reali. Esito:

**Confermate senza riserve**
- `UpsertProdottoAsync` assegna esplicitamente ogni campo → il rischio di azzeramento è reale.
- `deploy.sh:46` esegue `rm -rf "$APP_DIR/frontend/dist/"*`.
- `backup.sh` fa **solo** `mysqldump` (righe 33-39), nessuna traccia di file.
- `Prodotto.cs` non ha alcun campo vetrina; nessun `MediaAsset`/`MediaController`/`ImageSharp` nel repository; `Controllers/` contiene solo `AuthController.cs`.

**Divergenze e precisazioni**
1. **Numeri di riga spostati**: `UpsertProdottoAsync` è a **294-353**, non 291-350. La Fase 0 ha aggiunto `this.Authorize()` di classe (riga 25) e rimosso l'`.Authorize()` di campo su `mutateProdotto`, spostando tutto di 3 righe. La sostanza è identica.
2. **`client_max_body_size 10M`** su `location /api/` — vincolo non menzionato nel piano che **blocca l'upload di foto reali** prima ancora che raggiungano .NET.
3. **`makeRequest.tsx` non può fare multipart** — hardcoda JSON. Serve un helper nuovo che preservi il refresh token.
4. **`Program.cs` non ha `UseStaticFiles`** — servire i media in Development è codice da aggiungere, non configurazione da attivare.
5. **`prodotti` filtra `.Where(p => p.Attivo)`** — un prodotto disattivato in cassa sparisce dall'admin vetrina ma resta pubblicabile a DB. Gap da chiudere in design.
6. **`prodotti` non è una connection Relay** (`limite`/`scostamento`) — `VetrinaProdottiList` non può copiare `FornitoreList` verbatim.
7. **Nessuna pagina prodotti esiste nel frontend** — `VetrinaProdottiList` è la prima in assoluto; non c'è un fratello da imitare per la parte listino.
8. **"Lookup per `Percorso`, mai per `Titolo`" è vero solo per i figli** — i menu padre hanno `Percorso` vuoto e `SeedMenus.cs` li cerca per `Titolo == "X" && Percorso == string.Empty` (righe 118, 211, 304, 428, 615, 854). Il seed di "Sito" deve seguire lo stesso pattern, non la regola semplificata.
9. **`docker-compose.yml` non ha `volumes:` sul servizio `backend`** — il bind mount dei media sarà il primo.
