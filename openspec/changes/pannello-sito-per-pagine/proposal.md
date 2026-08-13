# Proposal: Il pannello «Sito» modellato sulle pagine (pannello-sito-per-pagine)

> Richiesta dell'utente, testuale:
> *«vorrei che ogni pagina del sito fosse una voce di menu nel sotto menu Sito dell'app e che lì
> mi dici quante immagini posso caricare e i testi da cambiare»*

**Moduli coinvolti: entrambi** (backend .NET + frontend React), **più il sito Astro** se il design
scioglie il nodo B con gli slot nominati (vedi Approach §3).
**Migrazioni database: nessuna nella forma minima; una additiva** se si adottano gli slot nominati.

---

> ### 🔴 Correzione in corso d'opera: i campi scrivibili erano **30**, non 31 — e adesso sono **33**
>
> **Questa proposta è stata scritta con il numero sbagliato**, e lo ripeteva in **nove** punti
> (otto volte in cifre, una in lettere). Il numero è stato corretto al task
> [8.3](./tasks.md), **dopo** che le fasi 1-7 erano già state applicate: la correzione è annotata
> qui invece di essere fatta in silenzio, perché il numero compare nei messaggi di fallimento dei
> test e chi legge questa proposta per capire un test rosso deve sapere quale numero è quello vero
> e quando è cambiato.
>
> | Momento | Campi scrivibili di `ImpostazioniVetrina` | Partizione |
> |---|---|---|
> | Come questa proposta diceva | ~~31~~ | — |
> | 🔴 Stato **reale** prima del change | **30** | 20 + 4 + 2 + 4 |
> | Dopo la **Fase 3** (i tre slot immagine nuovi) | **33** | 20 + 5 + 3 + 5 |
>
> **Da dove viene il 30.** Tre conteggi indipendenti concordano: l'elenco letterale di
> `ImpostazioniVetrinaInput_HaEsattamenteICampiScrivibili`, le proprietà di
> `ImpostazioniVetrinaInput` e le chiavi di `ValoriImpostazioniVetrina`
> ([design.md §D15](./design.md) punto 1, risoluzione 1 di [tasks.md](./tasks.md)).
>
> **Da dove viene il 33.** I tre identificativi degli slot immagine — `ImmagineEroeHomeId`,
> `ImmagineRitrattoLocaleId`, `ImmagineEroeAperitivoId` — **sono scrivibili**; non lo sono le tre
> **navigazioni** omonime (risoluzione 2 di [tasks.md](./tasks.md), task 3.11).
>
> ⚠️ Nel testo qui sotto **30 è il numero di prima del change**, ed è quello giusto in ogni punto
> in cui compare: la proposta descrive lo stato di partenza. Chi cerca il numero **di adesso** deve
> leggere 33.

## Intent

Il pannello «Sito» oggi è modellato sulle **entità**: quattro voci, una per tabella —
[Libreria media](../../../backend/SeedData/SeedMenusSito.cs), Prodotti vetrina, Impostazioni sito,
Recensioni sito. È lo specchio fedele di **come i dati sono conservati**.

L'utente non amministra tabelle: amministra **cinque pagine**. E le due domande che si pone davanti
a una pagina — *quante foto ci stanno* e *quali testi la governano* — oggi non hanno risposta in
nessun punto del prodotto:

1. **I testi sono in un'unica scheda da 30 campi.** `ImpostazioniVetrinaPage.tsx` è un modulo
   Formik con **undici sezioni**. Chi vuole cambiare la storia del locale deve sapere che si chiama
   «Pagina "Il locale"» e che quel campo, e non un altro, decide cosa si legge su `/locale`.
   Nessuna riga dell'interfaccia lo dice: lo dice il codice del sito, che l'amministratore non
   legge.
2. **Le immagini non hanno un'appartenenza.** Esiste **una sola galleria ordinata**
   (`Cartella == "galleria" && Pubblicato`, ordinata per `Ordinamento`,
   [PublicController.cs:581-594](../../../backend/Controllers/PublicController.cs)), e la
   **posizione** decide il ruolo. Quattro pagine su cinque ne pescano, con indici **sovrapposti**:

   | Pagina | Codice | Posizioni consumate |
   |--------|--------|---------------------|
   | `/` | [index.astro:85-86](../../../sito/src/pages/index.astro) | 1ª = eroe · 2ª-4ª = griglia |
   | `/menu` | [menu.astro:68](../../../sito/src/pages/menu.astro) | 1ª-3ª = foto in coda al listino |
   | `/locale` | [locale.astro:38-39](../../../sito/src/pages/locale.astro) | 2ª = ritratto (ripiego 1ª) · 3ª-5ª = quadrate |
   | `/aperitivo` | [aperitivo.astro:50](../../../sito/src/pages/aperitivo.astro) | **l'ultima**, `galleria.at(-1)` |
   | `/contatti` | — | nessuna |

   Con cinque foto caricate, la seconda è **contemporaneamente** la prima della griglia della home,
   la seconda foto del menu e il ritratto di `/locale`. E 🔴 **caricare una sesta foto sposta
   l'eroe dell'aperitivo**, perché quella pagina prende l'ultima: un'aggiunta innocua a una pagina
   ne cambia un'altra, senza alcun errore da nessuna parte.

   Il commento a [index.astro:82-84](../../../sito/src/pages/index.astro) dichiara la premessa che
   oggi non è vera: *«L'ordine è **editoriale** — lo decide l'amministratore dalla libreria media —
   quindi qui non si sceglie nulla, si legge»*. L'amministratore **non può** decidere un ordine di
   cui non conosce il significato.

3. **Un campo vuoto non è un campo vuoto: è una pagina che non esiste.** `/aperitivo` e `/locale`
   rispondono **404** quando `AperitivoTesto` / `StoriaTesto` sono vuoti
   ([aperitivo.astro:30-39](../../../sito/src/pages/aperitivo.astro),
   [locale.astro:25-34](../../../sito/src/pages/locale.astro)) e spariscono da intestazione, piè di
   pagina, 404 e sitemap ([rotte.ts:39-50](../../../sito/src/lib/rotte.ts)). Sono **due pagine su
   cinque**, e la scheda di amministrazione mostra quei campi come due caselle di testo qualunque.

Obiettivo: che l'amministratore apra «Sito → Il locale» e veda, in un posto solo, *questa pagina
oggi è pubblicata, usa 4 immagini che sono queste, e i testi che la governano sono questi due —
gli altri li eredita dal sito e si cambiano lì*.

## Scope

### In Scope

**Forma del pannello**
- Una **voce di menu per ogni pagina del sito**, nel sottomenu «Sito»: Home, Menu, Aperitivo,
  Il locale, Contatti — le stesse cinque di [`rotte.ts`](../../../sito/src/lib/rotte.ts), con le
  stesse etichette.
- Una **scheda di pagina** per ognuna, che dichiara in modo esplicito: stato di pubblicazione,
  **numero esatto** di immagini che la pagina ospita, testi **di sua proprietà** (modificabili lì),
  testi **ereditati dal sito** (in sola lettura, con il collegamento a dove si cambiano), e le
  altre sorgenti che la alimentano (prodotti, recensioni, orari).
- Riordino del sottomenu: prima le pagine, poi le risorse trasversali (Libreria media, Prodotti
  vetrina, Recensioni sito) e la scheda del sito.
- La scheda **Impostazioni sito** sopravvive, ridotta ai campi realmente trasversali (identità,
  indirizzo, contatti, social, SEO di default, aspetto, ganci spenti) e rinominata di conseguenza.

**Proprietà dei campi**
- Una **mappa pagina → campi** esplicita e in **un posto solo**, che dichiari per ogni campo di
  `ImpostazioniVetrina` quale pagina lo *legge* e quale lo *possiede*.
- Regola di partizione: un campo è **letto** da quante pagine si vuole, ma è **modificato** da una
  sola. `AperitivoTitolo`/`AperitivoTesto`/`AperitivoPunti` compaiono anche sulla home
  ([index.astro:207-219](../../../sito/src/pages/index.astro)) e restano di proprietà della pagina
  Aperitivo.
- Un test che fa **fallire** la build quando una pagina del sito legge un campo che la mappa non le
  attribuisce: senza, la mappa diverge dal sito al primo campo aggiunto, e diverge in silenzio.

**Scrittura**
- Riprogettazione del percorso di salvataggio in modo che **il salvataggio di una scheda non possa
  azzerare un campo di un'altra** (nodo A, Approach §2). La forma la sceglie il design.
- La proprietà oggi garantita — *un campo valorizzato si deve poter svuotare*
  ([spec impostazioni-vetrina](../../specs/impostazioni-vetrina/specs.md)) — MUST sopravvivere
  intatta.

**Immagini**
- «Quante immagini ospita questa pagina» diventa una **domanda con risposta**, e la risposta è
  visibile nella scheda della pagina (nodo B, Approach §3).
- La libreria media dichiara, accanto a ogni immagine della galleria, **quali ruoli sta ricoprendo
  adesso**.

**Seed e navigazione**
- Cinque voci nuove in [`SeedMenusSito.cs`](../../../backend/SeedData/SeedMenusSito.cs), idempotenti
  (ricerca per `Percorso`), assegnate ai soli ruoli con flag `Amministratore`.
- Le icone corrispondenti registrate in
  [`iconMapping.tsx`](../../../duedgusto/src/components/layout/sideBar/iconMapping.tsx).

### Out of Scope

- **Un CMS a blocchi generico** (entità `SezionePagina` con payload JSON): rinviato, vedi
  Alternative §3.
- **Prenotazioni, eventi, promozioni, piatto del giorno**: restano dove sono, ganci spenti.
- **Modifica degli orari da qualunque scheda di pagina**: vietata per costruzione, vedi Approach §6.
- **Il redesign del sito e il catalogo** del change `vetrina-redesign-mockup`: indipendenti.
- **Rendere l'ordine della galleria irrilevante ovunque**: le griglie di più foto restano pescate
  dalla galleria anche nella forma raccomandata; solo le immagini con un ruolo singolo diventano
  esplicite.
- **Riscrittura di `mutateProdottoVetrina`, `mutateMediaAsset`, `mutateRecensioneVetrina`**: le tre
  mutation restano invariate. La scheda di una pagina le richiama, non le sostituisce.

## Approach

### 1. La scheda di pagina, non il form della tabella

Le rotte del gestionale sono già dinamiche e vengono dal database (`Menu.Percorso` +
`Menu.PercorsoFile`, relativo a `duedgusto/src/components/pages/` —
[SeedMenusSito.cs:82](../../../backend/SeedData/SeedMenusSito.cs)): **cinque voci non costano più di
una**. Ogni scheda risponde, nell'ordine, alle tre domande che l'utente pone:

- **Esiste?** — badge di stato. Per `/aperitivo` e `/locale`: *«Non pubblicata: manca il testo, e
  finché manca la pagina risponde 404 e non compare nel menu del sito»*. Non un asterisco: la prima
  riga della scheda.
- **Quante immagini?** — il numero, gli spazi che le ospitano e cosa succede a lasciarli vuoti.
- **Quali testi?** — quelli di proprietà, modificabili; quelli ereditati, in sola lettura e con il
  collegamento a dove si cambiano.

⚠️ **Fatto che va detto adesso**: dei 30 campi scrivibili di `ImpostazioniVetrina`, soltanto **dieci**
sono specifici di una pagina — `ClaimVetrina` e i tre della reputazione (home), `StoriaTitolo` e
`StoriaTesto` (locale), i quattro dell'aperitivo. `/menu` e `/contatti` **non possiedono alcun testo
proprio**: la descrizione SEO di `/menu` è perfino scritta a mano nel sorgente
([menu.astro:73](../../../sito/src/pages/menu.astro)). Le loro schede sono quindi in larga parte
**mappe di ciò che le governa altrove** — che è comunque la risposta alla domanda posta — e la
scoperta suggerisce un'estensione naturale (titolo e descrizione SEO per pagina) che questa proposta
**nomina ma non include**: è una migrazione, e va decisa a parte.

### 2. 🔴 Nodo A — l'assegnazione totale non sopravvive alla divisione in schede

[`ApplicaImpostazioniVetrinaAsync`](../../../backend/GraphQL/Vetrina/VetrinaMutations.cs) (righe
444-537) assegna **ogni** campo a ogni invocazione, righe 491-529, sotto un commento che vieta
esplicitamente l'alternativa (righe 488-490):

```csharp
// ── ASSEGNAZIONE TOTALE ──────────────────────────────────────────────────────────
// 🔴 Nessun `if (!string.IsNullOrEmpty(...))` qui dentro, oggi né mai: è la riga che
//    renderebbe impossibile svuotare un campo, e la spec lo chiama per nome.
```

**Non è un difetto: è il requisito.** La spec `impostazioni-vetrina` lo impone perché la forma
condizionale di `updateBusinessSettings` produce il guasto opposto — un campo che non si può più
svuotare — e il test [`Mutation_ConUnCampoOpzionaleSvuotato_PersisteLAssenza`](../../../backend/DuedGusto.Tests/Integration/GraphQL/ImpostazioniVetrinaTests.cs)
(riga 82) diventa rosso, **e nessun altro**, se qualcuno la reintroduce.

Ciò che rende sicura l'assegnazione totale è una condizione che **la divisione in schede rompe**:
oggi esiste **un solo scrittore che possiede tutti i campi**. Le due difese poggiano entrambe su
quel fatto:

- [`ImpostazioniVetrinaInput_HaEsattamenteICampiScrivibili`](../../../backend/DuedGusto.Tests/Integration/GraphQL/ImpostazioniVetrinaTests.cs)
  (riga 427) pinna per riflessione i 30 nomi dell'input;
- il test frontend *«ogni valore del modulo finisce nell'input: nessun campo si perde per strada»*
  ([ImpostazioniVetrinaPage.test.tsx:143](../../../duedgusto/src/components/pages/sito/__tests__/ImpostazioniVetrinaPage.test.tsx))
  confronta `Object.keys(valori)` con l'input prodotto.

🔴 Il secondo test verifica *«il modulo non perde i campi che conosce»*, **non** *«il salvataggio non
azzera i campi che il modulo non conosce»*. Su una scheda che ne conoscesse cinque su trenta,
**passerebbe verde mentre il salvataggio ne azzera ventisei.** La difesa non scala, e il guasto che
dovrebbe fermare è già avvenuto una volta: `turnstileSiteKey` viene tuttora **trasportato senza
essere mostrato** proprio per questo
([impostazioniVetrinaModulo.tsx:69-74](../../../duedgusto/src/components/pages/sito/impostazioniVetrinaModulo.tsx)).
Con cinque schede, quel trucco diventa **cinque superfici di trasporto invisibile** invece di una.

Le tre uscite, con il loro costo — **la scelta è del design, non di questa proposta**:

| | Forma | Costo |
|---|---|---|
| **A1** | Ogni scheda rispedisce tutti i 30 campi (leggi-modifica-riscrivi) | Nessun cambio di schema, ma due amministratori su due schede diverse = **aggiornamento perso**, e ogni scheda nuova deve ricordarsi di trasportare tutto |
| **A2** | La mutation diventa parziale (semantica *patch*) | 🔴 Rompe *«un campo si deve poter svuotare»*: servirebbe distinguere «assente» da «null», che è precisamente ciò che la spec ha scelto di non fare |
| **A3** | Una mutation per scheda, **totale sul proprio sottoinsieme** | Preserva lo svuotamento *dentro* la scheda ed elimina la sovrapposizione — **richiede che la partizione dei 30 campi sia totale e disgiunta** (⚠️ **33** dopo la Fase 3 — vedi il riquadro in testa), e che il test di riflessione diventi *l'unione degli input è esattamente l'insieme dei campi scrivibili* |

A3 è la sola che conserva entrambe le proprietà, e il vincolo che impone — partizione totale e
disgiunta — è esattamente la regola di proprietà del §1. ⚠️ Due **grappoli di validazione incrociata**
la vincolano ulteriormente: `Latitudine`/`Longitudine` e `PunteggioGoogle`/`NumeroRecensioniGoogle`
si validano a coppie ([VetrinaMutations.cs:545-598](../../../backend/GraphQL/Vetrina/VetrinaMutations.cs))
e i due membri di una coppia **non possono finire su schede diverse**.

### 3. 🔴 Nodo B — «quante immagini» oggi non ha risposta

Il problema non è che manchi un conteggio: è che **le stesse foto servono più pagine**, e nessun
dato dice quale foto è per cosa. Tre uscite:

| | Forma | Costo |
|---|---|---|
| **B1** | Una cartella per pagina (`galleria-home`, `galleria-locale`…) | 🔴 Cambia il contratto pubblico di `/api/public/galleria` e il valore canonico `"galleria"` che la spec `media-assets` pinna; e la stessa foto del locale andrebbe **caricata due volte** per stare su due pagine |
| **B2** | **Slot nominati** per le immagini con un ruolo singolo; la galleria resta per le griglie | Una migrazione additiva + il sito legge gli slot invece degli indici. **Non è un pattern nuovo**: `ImmagineOgId` è già uno slot nominato sulla stessa entità |
| **B3** | Nessun cambio: la scheda **spiega** la convenzione posizionale | Zero rischio, e risponde alla domanda — ma lascia intatta la trappola: caricare la sesta foto continua a spostare l'eroe dell'aperitivo |

**Leaning, da confermare in design: B2 in forma ibrida.** Tre immagini portano un ruolo singolo e
riconoscibile — l'eroe della home, il ritratto di `/locale`, l'eroe di `/aperitivo` — e diventano
slot espliciti; le **griglie** di tre foto restano pescate dalla galleria, perché sono davvero *«foto
del locale»* e va bene che compaiano su più pagine. La risposta alla domanda dell'utente diventa
allora dicibile pagina per pagina:

- **Home** — 1 immagine dedicata (eroe) + 3 dalla galleria
- **Menu** — 3 dalla galleria
- **Aperitivo** — 1 immagine dedicata (eroe)
- **Il locale** — 1 immagine dedicata (ritratto) + 3 dalla galleria
- **Contatti** — nessuna

B3 resta il ripiego onesto se il design giudica troppo caro toccare il sito: risponde alla domanda
posta, senza sciogliere il nodo che la rende difficile.

⚠️ In **ogni** variante la libreria media MUST dichiarare i ruoli attivi di ciascuna immagine: è lì
che si trascina per riordinare, ed è lì che oggi si cambia l'eroe della home senza saperlo.

### 4. Lo stato di pubblicazione è un dato di prima riga

Il backend decide che una sezione è assente **solo in base al corpo del testo**: un titolo senza
testo non basta ([PublicController.cs:453-464](../../../backend/Controllers/PublicController.cs)).
La scheda deve dire la stessa cosa con le stesse parole — *senza questo testo la pagina risponde 404
e sparisce dal menu del sito* — perché è l'unico punto del prodotto in cui **svuotare un campo
cancella un URL**.

⚠️ Corollario sulla voce di menu del gestionale: la scheda di `/aperitivo` **esiste sempre**, anche
quando la pagina del sito non esiste. Nasconderla sarebbe togliere l'unico posto da cui la si può
creare.

### 5. La mappa pagina → campi è l'artefatto, non la documentazione

Oggi *«quale campo governa quale pagina»* è conoscenza che vive **solo dentro i sorgenti `.astro`**,
e il pannello non ne ha copia. Renderla esplicita crea una seconda scrittura, e due scritture
divergono: qualcuno aggiunge un campo a `locale.astro`, la scheda «Il locale» non lo impara mai, e
l'amministratore ha una mappa che mente.

→ La mappa MUST essere **una sola** e MUST essere **verificata**: un test che confronta i campi
dichiarati con quelli effettivamente letti dalle pagine del sito, e che diventa rosso quando le due
liste divergono. È lo stesso principio già applicato a `rotte.ts`, che è *«le pagine del sito, in un
posto solo»* e che intestazione, piè di pagina, 404 e sitemap leggono tutti dallo stesso filtro
([rotte.ts:54-64](../../../sito/src/lib/rotte.ts)).

### 6. Ciò che le schede non devono diventare

**Gli orari.** Vivono in `BusinessSettings` e hanno **una sola sorgente, la cassa**
([PublicController.cs:387-398](../../../backend/Controllers/PublicController.cs)). Sono letti dalla
home, da `/contatti` e dal piè di pagina di ogni pagina: **tre schede** avrebbero un motivo
plausibile per offrirli. Nessuna deve. Lo sbarramento esiste già a tre livelli — il modello non li
possiede, l'input GraphQL li rifiuta a livello di schema, e un test lo pinna con `[InlineData]` su
`openingTime`/`closingTime`/`operatingDays`/`timezone`
([ImpostazioniVetrinaTests.cs:393](../../../backend/DuedGusto.Tests/Integration/GraphQL/ImpostazioniVetrinaTests.cs))
— e resta invariato. Le schede li mostrano **in sola lettura**, con il collegamento alle impostazioni
della cassa, come già fa la pagina attuale
([ImpostazioniVetrinaPage.tsx:578-590](../../../duedgusto/src/components/pages/sito/ImpostazioniVetrinaPage.tsx)).

Stessa regola per **prodotti** e **recensioni**: la scheda `/menu` mostra quanti prodotti sono
pubblicati e rimanda alla griglia esistente; non diventa una seconda griglia prodotti.

### 7. Menu, icone e rotte

Il sottomenu passa da **4 a 9** voci. Il padre «Sito» sta a `Posizione = 9` con icona `Globe`; i
quattro figli attuali occupano le posizioni 1-4. Le cinque pagine vanno **davanti** (posizioni 1-5) e
le risorse trasversali scalano, il che significa **riscrivere la `Posizione` di voci esistenti dal
seed** — `UpdateMenuIfNeeded` lo fa già, ma è la prima volta che si usa per riordinare invece che per
creare.

⚠️ **Icone**: `iconMapping.tsx` ha 29 nomi, e `Globe`/`Images`/`ShoppingBag`/`Store`/`Star` sono già
impegnati dal ramo Sito. Le cinque pagine richiedono quasi certamente **cinque icone nuove** da
aggiungere alla mappa. Il seed le nomina come stringa e un nome mancante **non dà errore**: la voce
compare senza icona ([iconMapping.tsx:65-67](../../../duedgusto/src/components/layout/sideBar/iconMapping.tsx)).
Le due liste vanno allineate a mano, e la verifica va nei criteri di successo.

## Alternative considerate e scartate

1. **Lasciare il pannello com'è e scrivere la mappa nella wiki interna.** La sezione Wiki esiste già
   ed è admin-only: sarebbe la strada più economica. **Scartata** perché sposta la verità in un
   documento che diverge dal codice al primo campo aggiunto, e soprattutto perché **non risponde
   alla domanda sulle immagini**: quella risposta oggi non esiste nemmeno per chi legge il codice —
   va costruita, non documentata.
2. **Una sola pagina «Contenuti del sito» con schede a linguette invece di N voci di menu.**
   **Scartata** per due ragioni: l'utente ha chiesto voci di menu, e le rotte dinamiche rendono N
   voci gratuite; ma soprattutto le linguette condividerebbero **un solo form**, cioè
   esattamente il modulo unico da 30 campi che è la causa del nodo A. Sarebbero il problema di oggi
   con una decorazione sopra.
3. **Un CMS a blocchi generico** (`SezionePagina`: pagina, tipo, ordine, payload JSON) — era già
   previsto come fase futura dal piano originale. **Scartato per ora**: il sito Astro rende sezioni
   **fisse e tipizzate**, non generiche, e un payload JSON perderebbe le validazioni per campo che
   le spec pretendono (URL assoluti, coordinate accoppiate, formato `HH:mm`, immagine esistente e
   pubblicata). Sarebbe un modello più potente e un prodotto peggiore.
4. **Una cartella media per pagina.** **Scartata**: cambia il contratto pubblico e costringe a
   caricare due volte la stessa foto per usarla su due pagine (opzione B1, §3).
5. **Derivare le schede leggendo i sorgenti `.astro` a build time.** **Scartata**: il gestionale non
   può dipendere dalla build del sito. Ma il **confronto** fra la mappa dichiarata e i sorgenti resta
   ed è il test del §5.
6. **Portare l'amministrazione dentro il sito Astro** (`/admin`). **Scartata**: duplicherebbe
   autenticazione, ruoli, refresh dei token e gate amministrativo, che nel gestionale esistono già e
   sono provati.
7. **Mostrare solo i testi e rinunciare al conteggio delle immagini.** **Scartata**: è metà della
   richiesta, ed è la metà che l'utente non può ricavare da solo.

## Affected Areas

| Area | Impatto | Descrizione |
|------|---------|-------------|
| `backend/SeedData/SeedMenusSito.cs` | Modificato | +5 voci pagina; **riordino** delle 4 esistenti; idempotenza per `Percorso` |
| `backend/GraphQL/Vetrina/VetrinaMutations.cs` | Modificato | Nodo A: partizione della scrittura (forma decisa in design). 🔴 L'assegnazione totale **dentro** ogni scheda resta |
| `backend/GraphQL/Vetrina/Types/ImpostazioniVetrinaInputType.cs` | Modificato | Uno o N input, secondo la scelta A1/A2/A3 |
| `backend/GraphQL/Vetrina/VetrinaQueries.cs` | Modificato | Lettura per scheda + stato di pubblicazione calcolato |
| `backend/Models/ImpostazioniVetrina.cs` | Modificato **solo con B2** | Slot immagine nominati, sul modello di `ImmagineOgId` |
| `backend/Migrations/*` | Nuovo **solo con B2** | Migrazione additiva: colonne nullable + FK verso `MediaAsset`, senza navigazione inversa |
| `backend/Controllers/PublicController.cs` | Modificato **solo con B2** | Gli slot nel DTO di `site` |
| `backend/DuedGusto.Tests/**` | Modificato | 🔴 Il pin per riflessione diventa *unione degli input = campi scrivibili*; nuovi test sull'assenza di azzeramento incrociato |
| `duedgusto/src/components/pages/sito/` | Nuovo | Cinque schede di pagina + il componente condiviso di scheda |
| `duedgusto/src/components/pages/sito/ImpostazioniVetrinaPage.tsx` | Modificato | Ridotta ai campi trasversali; le sezioni editoriali migrano nelle schede |
| `duedgusto/src/components/pages/sito/impostazioniVetrinaModulo.tsx` | Modificato | 🔴 Il modulo si divide: ogni parte MUST conservare la proprietà provata dal test di riflessione |
| `duedgusto/src/components/pages/sito/MediaLibrary.tsx` | Modificato | Ruoli attivi accanto a ogni immagine della galleria |
| `duedgusto/src/components/layout/sideBar/iconMapping.tsx` | Modificato | ~5 icone nuove, allineate a mano col seed |
| `duedgusto/src/graphql/vetrina/**` | Modificato | Query e mutation per scheda |
| `sito/src/pages/*.astro` | Modificato **solo con B2** | Lettura degli slot al posto degli indici |
| `sito/src/lib/rotte.ts` | Invariato | 🔴 Resta la sorgente unica delle pagine: il pannello la **rispecchia**, non la duplica |
| `openspec/specs/impostazioni-vetrina/` | Delta | Amministrazione per pagina, proprietà dei campi, scrittura partizionata |
| `openspec/specs/media-assets/`, `api-pubblica/`, `consumo-api-pubblica/` | Delta **solo con B2** | Slot nominati accanto alla galleria |

## Risks

| Rischio | Probabilità | Mitigazione |
|---------|-------------|-------------|
| 🔴 Una scheda azzera i campi di un'altra al salvataggio, in silenzio | **Alta se sbagliamo il design** | Nodo A §2: partizione totale e disgiunta + il pin di riflessione riscritto come *unione = insieme*. È il rischio principale del change |
| 🔴 Il test frontend esistente resta **verde** su un modulo parziale che azzera | **Certa senza intervento** | Va riscritto prima di dividere il modulo, non dopo: verifica il modulo contro **l'insieme dei campi scrivibili**, non contro se stesso |
| 🔴 Aggiornamento perso fra due schede aperte insieme | Media (certa con A1) | Argomento decisivo contro A1; con A3 il problema non esiste per costruzione |
| La mappa pagina → campi diverge dai sorgenti del sito | **Alta nel tempo** | Test di §5. Senza, il pannello mente con sicurezza — il modo peggiore di sbagliare per uno strumento di orientamento |
| Le due coppie a validazione incrociata finiscono su schede diverse | Media | Vincolo dichiarato in §2; da pinnare in design |
| `/aperitivo` e `/locale` cancellate per errore svuotando un testo | Media | Lo stato di pubblicazione in prima riga + conferma esplicita quando il salvataggio **fa sparire** una pagina già pubblicata |
| Icona mancante in `iconMapping`: voce senza icona, **nessun errore** | **Alta** | Verifica esplicita nei criteri di successo; le due liste si allineano nello stesso commit |
| Il riordino del seed cambia la `Posizione` di voci esistenti al riavvio di un'installazione viva | Media | `UpdateMenuIfNeeded` è idempotente ma è la prima volta che lo si usa per riordinare: da provare su tre riavvii con dati reali |
| Un sottomenu da 9 voci diventa più difficile da percorrere di uno da 4 | Media | Ordine deliberato (pagine, poi risorse) e distinzione visiva; da verificare sul campo, non da dichiarare risolto |
| **Con B2**: il sito legge slot che nessuno ha ancora valorizzato dopo la migrazione | **Alta al primo deploy** | Ripiego dichiarato sulla posizione attuale della galleria finché lo slot è vuoto, e la scheda che lo dice — mai una pagina senza immagine dopo un aggiornamento |
| **Con B2**: la migrazione tocca la tabella dei media | Bassa | Relazione **senza navigazione inversa**, come già fatto per `ImmagineOg`, e verifica che lo script non contenga alterazioni di tabelle esistenti |

## Rollback Plan

Il rollback è progettato per non perdere contenuti: nessun testo e nessuna immagine viene cancellato
in nessun passo.

1. **Menu** — `Visibile = false` sulle cinque voci nuove (o revoca di `AssegnaRuoli`) le fa sparire
   senza cancellare record; ripristinare le `Posizione` originali delle quattro esistenti riporta il
   sottomenu com'era. Rimuovere le voci dal seed impedisce che rinascano al riavvio.
2. **Frontend** — revert delle schede e ripristino di `ImpostazioniVetrinaPage.tsx` nella forma
   unica. Nessun'altra pagina del gestionale dipende da loro.
3. **GraphQL** — con **A3**, tornare all'input unico è additivo all'incontrario: la mutation
   originale resta valida perché i 30 campi non cambiano nome. 🔴 **Va fatto prima del frontend**,
   altrimenti una scheda ancora in linea scrive su una mutation che non esiste più.
4. **Con B2** — la migrazione è **additiva** (colonne nullable + FK): lasciarla in produzione è
   innocuo. Il sito torna agli indici della galleria con un revert dei `.astro`; ⚠️ gli slot
   valorizzati vanno **riportati nell'ordine della galleria prima** del revert, altrimenti la scelta
   editoriale fatta nel frattempo si perde silenziosamente.
5. **Contenuti** — nessun rollback li tocca: vivono nella riga singleton, che questo change non
   ricrea mai (`IdSingleton = 1`).

**Punto di non ritorno**: l'unico è al punto 4, e solo se qualcuno ha usato gli slot per scegliere
immagini che l'ordine della galleria non riprodurrebbe.

## Dependencies

- **Nessuna nuova dipendenza** NuGet o npm: MUI v6, AG Grid, `lucide-react` e Formik+Zod bastano.
- **`SitoGuard`** e `GuardUtenteAmministratore` esistono e si riusano invariati.
- **`MediaPickerDialog`** esiste: gli slot immagine, se adottati, non introducono un secondo percorso
  di scelta ([spec impostazioni-vetrina](../../specs/impostazioni-vetrina/specs.md)).
- **`rotte.ts`** è già la sorgente unica delle pagine: il pannello vi si allinea.
- **Nessuna dipendenza dal deploy o dal dominio**: tutto verificabile in locale.
- ⚠️ **Con B2**: `dotnet ef migrations add` non gira con il backend acceso, e la migrazione va
  **rigenerata dopo** aver ricostruito il progetto.

## Success Criteria

> **Spuntati al task [8.3](./tasks.md) con la prova accanto**, non a memoria. Ogni riga nomina il
> task che la dimostra; le righe 🔴 nominano anche la **mutazione** eseguita, perché un test verde
> che nessuno ha mai visto fallire non è una prova. La tabella completa, con i nomi dei test
> diventati rossi, sta in [tasks.md → «Esito misurato — Fase 8»](./tasks.md).
>
> 🔴 **Un criterio su quattordici resta aperto** ed è dichiarato tale invece di essere spuntato per
> analogia: il tredicesimo, verificato per tre quarti.

- [x] `dotnet build`, `dotnet test`, `npm run ts:check`, `npm run lint`, `npm run test` (gestionale e
      sito) passano
      → **task 8.4**: sei comandi verdi — backend **825/825**, gestionale **844/844**, sito
      **134/134**, `ts:check`/`lint`/`astro check` a **0**
- [x] Sotto «Sito» compaiono **cinque voci pagina** con le stesse etichette di `rotte.ts`, e ognuna
      apre la propria scheda
      → **6.9** (nove voci, `Percorso` preesistenti invariati) + **6.18** (tre riavvii sul database
      reale) + **6.13**, che confronta le due liste; mutazioni **6.13 ①②**: un'etichetta cambiata in
      un solo posto e una sesta rotta aggiunta al solo `rotte.ts` fanno **rosso**
- [x] Ogni scheda dichiara un **numero esatto** di immagini, e quel numero coincide con ciò che la
      pagina rende davvero
      → **6.17** + **7.7**. Mutazione **6.17 A**: spostando `fotoMenu` da una pagina all'altra si
      muovono **insieme** il conteggio della scheda e l'etichetta della libreria — la prova che la
      dichiarazione è una sola. Mutazione **7.7 A**: `MAX_MOMENTI` da 3 a 4 in `index.astro` rende
      rosso il numero dichiarato dalla scheda Home
- [x] La libreria media mostra, per ogni immagine della galleria, **i ruoli che sta ricoprendo**
      → **6.8**, con il nome della pagina e mai un indice; un'immagine senza ruolo dice **perché**.
      La sorgente è la stessa dichiarazione che alimenta i conteggi (**6.17**)
- [x] 🔴 **Nessun azzeramento incrociato**: salvare ognuna delle cinque schede lascia invariati tutti
      i campi che non le appartengono — provato campo per campo, e **verificato per mutazione**
      (togliendo un campo dalla sua scheda il test diventa rosso)
      → **5.9**, parametrizzato sulla **definizione dei gruppi** e non copiato quattro volte.
      Mutazione **5.10**: `AperitivoPunti` tolto dal proprio input e assegnato da un valore assente
      → rosso che **nomina il campo azzerato**. Prova end-to-end sul backend reale al **5.18**: dopo
      `mutatePaginaHome` i campi cambiati sull'intera riga sono **uno solo**
- [x] 🔴 **Lo svuotamento continua a funzionare**: cancellare il link Facebook e salvare persiste
      l'assenza; il test esistente `Mutation_ConUnCampoOpzionaleSvuotato_PersisteLAssenza` passa
      senza modifiche di sostanza
      → **5.11**: `git diff` su quel blocco è **vuoto** — non «senza modifiche di sostanza», senza
      modifiche affatto. Accanto, una `[Theory]` su cinque campi delle tre mutation nuove, perché la
      proprietà è di **ogni canale di scrittura**, non della mutation che ce l'aveva
- [x] 🔴 **L'unione degli input è esattamente l'insieme dei campi scrivibili**: né un campo orfano
      (che nessuna scheda potrebbe più modificare) né un campo condiviso da due schede
      → **5.7** (il pin per riflessione contro il **modello**, non contro un elenco scritto a mano) e
      **1.4** sul lato frontend. Quattro mutazioni: **5.8 ①** orfano e **5.8 ②** conteso falliscono
      su **test diversi**; **1.5** e **1.6** fanno lo stesso sul modulo; **5.14** dimostra che la
      rete è viva **contro i costruttori riscritti a mano**
- [x] Le schede di `/aperitivo` e `/locale` dichiarano **in prima riga** che la pagina non esiste
      quando il testo è vuoto, e chiedono conferma esplicita prima di un salvataggio che la fa
      sparire
      → **6.6** (criterio identico a quello del server: decide **solo il corpo** del testo) + **6.7**
      + **6.15**, dove l'asserzione che conta è la seconda: **senza conferma nessuna mutation parte**
- [x] Nessuna scheda offre un campo di **orario**; ognuna che li mostra li mostra in sola lettura e
      indica dove si cambiano
      → **5.12**: da 6 a **24 casi generati** (quattro mutation × sei campi vietati), col rifiuto
      dalla **validazione del documento** — cioè ereditato da una scheda scritta fra sei mesi —
      e **6.14** sulle tre schede che avrebbero un motivo plausibile per offrirli
- [x] Un test fa **fallire** la build quando una pagina del sito legge un campo che la mappa non le
      attribuisce
      → **7.4**, con **tre** asserzioni e non una. Mutazioni **7.5 ①②③**: lettura non dichiarata,
      voce dichiarata e morta, e ③ la **forma** di una riga spezzata — quest'ultima è quella che
      rende il test *rosso invece che cieco*, e alla prima stesura **non scattava**
- [x] Ogni icona nominata dal seed esiste in `iconMapping.tsx`: **nessuna voce senza icona** nella
      barra laterale
      → **6.11**, che scansiona **tutti** i sorgenti di `backend/SeedData/` e non un elenco scritto a
      mano. Mutazioni **6.12 ①②**: un nome inesistente e la regex rotta; ② scatta sul **conteggio**,
      cioè sull'unico modo in cui un test di scansione può mentire restando verde
- [x] Tre riavvii con `SEED_ON_STARTUP=true` non duplicano alcuna voce, e le `Posizione` restano
      quelle attese
      → **6.18**, sul database di sviluppo **reale** che aveva la sezione nella forma precedente:
      nove figli dopo ognuno dei tre avvii, nessun duplicato, posizioni 1-9, e gli `Id` **27-30**
      delle quattro voci preesistenti invariati — è cambiata solo la `Posizione`
- [ ] 🔴 Un utente autenticato **non amministratore** non raggiunge alcuna scheda né alcuna scrittura,
      nemmeno chiamando GraphQL direttamente
      → ⚠️ **VERIFICATO PER TRE QUARTI, E L'ULTIMO QUARTO È DICHIARATO**. Provati: le quattro
      mutation e le due query respinte a un utente autenticato non amministratore (**5.13**, sei
      test; **7.2**, due test), il gating del menu **sul database reale** (**6.18**: le cinque voci
      nuove ai soli ruoli amministrativi, `Gestore` su nessuna), e `SitoGuard` **riusato invariato**
      da tutte e cinque le schede (`git diff` vuoto). **Non provato**: l'accesso per URL diretto
      nell'app vera con il token di un utente non amministratore (**task 6.19**). Serve la password
      di un utente non amministratore, che **non è annotata in alcun artefatto del repository**, e il
      signin è limitato a 5 tentativi ogni 15 minuti per IP: tentare a indovinare avrebbe bloccato
      l'accesso senza dimostrare nulla. 🔴 **Il criterio resta aperto e richiede l'utente**
- [x] Il **sito non cambia comportamento** a contenuti invariati: stesse pagine, stessi 404, stessa
      sitemap, stesse immagini (con B2, a slot vuoti il ripiego riproduce l'ordine attuale)
      → **0.2** (cattura del «prima») + **4.8** (confronto di **dieci** catture, 5 pagine × 2 stati):
      nove identiche, e la decima è una **differenza deliberata**, dichiarata alla lettera e
      sorvegliata da due mutazioni. ⚠️ **La divergenza va letta, non spuntata**: per decisione
      dell'utente presa in Fase 2, l'eroe di `/aperitivo` **non ha ripiego**, quindi a slot vuoto
      quella pagina perde l'immagine di testata che mostrava prima. È l'unico punto in cui il change
      rompe questo criterio, e lo rompe **apposta** (riquadro del task 2.2). Sulle altre quattro
      pagine la non regressione è provata per confronto di file, non a occhio

---

## Verifiche sul codice

Ogni affermazione è stata verificata sui file reali. Esito.

**Confermate senza riserve**
- Le quattro voci del sottomenu «Sito» e il padre a `Posizione = 9`, icona `Globe`
  ([SeedMenusSito.cs:51-222](../../../backend/SeedData/SeedMenusSito.cs)).
- L'assegnazione totale e il suo commento ([VetrinaMutations.cs:488-490](../../../backend/GraphQL/Vetrina/VetrinaMutations.cs)),
  la funzione alle righe 444-537, le assegnazioni alle righe 491-529.
- Il 404 condizionato di `/aperitivo` e `/locale` e il filtro di navigazione unico
  ([rotte.ts:39-64](../../../sito/src/lib/rotte.ts)), letto da intestazione, piè di pagina, 404 e
  sitemap.
- Gli orari da `BusinessSettings` soltanto, sbarrati a modello, a schema e da un test.
- La galleria unica ordinata e la cartella `"galleria"` come suo unico filtro.

**Divergenze e precisazioni rispetto al briefing**
1. **Le pagine che pescano dalla galleria sono quattro, non due.** Anche `/menu`
   ([menu.astro:68](../../../sito/src/pages/menu.astro), posizioni 1-3) e `/aperitivo`
   ([aperitivo.astro:50](../../../sito/src/pages/aperitivo.astro), `.at(-1)`) ne consumano.
   L'aperitivo è il caso peggiore: prende **l'ultima**, quindi **caricare una foto qualsiasi ne
   cambia l'eroe**. Nessuna pagina «possiede» un'immagine.
2. **`Menu` non ha un campo `Ordinamento`**: il campo d'ordine si chiama **`Posizione`**
   ([Menu.cs:10](../../../backend/Models/Menu.cs)). Esiste anche `NomeVista`, che il seed valorizza.
3. **I campi scrivibili sono 30, non «i testi»**, e **solo dieci sono di una pagina sola**. `/menu` e
   `/contatti` non ne possiedono nessuno: le loro schede sono mappe, non moduli. La descrizione SEO
   di `/menu` è scritta a mano nel sorgente ([menu.astro:73](../../../sito/src/pages/menu.astro)).
4. **Tre campi dell'aperitivo sono letti anche dalla home** ([index.astro:207-219](../../../sito/src/pages/index.astro)):
   la regola non può essere *«un campo, una pagina»*, ma *«un campo, un proprietario»*.
5. **Il test frontend che pinna la trappola non protegge dalla divisione**: confronta il modulo con
   se stesso, quindi un modulo parziale lo supera mentre azzera il resto. È il punto più delicato del
   change.
6. **Due grappoli di validazione incrociata** vincolano la partizione: coordinate e reputazione
   ([VetrinaMutations.cs:545-598](../../../backend/GraphQL/Vetrina/VetrinaMutations.cs)).
7. **Le icone quasi certamente non bastano**: dei 29 nomi in `iconMapping.tsx`, i cinque adatti al
   ramo Sito sono già impegnati. Servono icone nuove, e un nome mancante non produce alcun errore.
8. **Non esiste una cartella `prodotti`**: l'immagine di un prodotto è una FK, non una cartella. Le
   cartelle sono `generale` e `galleria`, insieme **aperto**
   ([CartelleVetrina.cs:18-36](../../../backend/Services/Media/CartelleVetrina.cs)); `eventi`,
   `promozioni` e `hero` sono nominate solo in un commento e non implementate.
9. **`ImmagineOgId` è già uno slot immagine nominato** su `ImpostazioniVetrina`: l'opzione B2 estende
   un pattern esistente invece di introdurne uno.
