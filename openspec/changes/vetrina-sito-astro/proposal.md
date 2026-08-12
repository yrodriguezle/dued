# Proposal: progetto Astro, design system e due pagine vive (vetrina-sito-astro)

> **Fase 2 di 8, seconda metà** del progetto "Sito vetrina 2D Gusto" — il **solo sito pubblico**.
> Piano approvato di riferimento: `~/.claude/plans/chiedevo-una-pianificazione-del-immutable-stream.md`, §1, §6, §9, §11.
> Change precedente, completato: [`vetrina-api-pubblica`](../vetrina-api-pubblica/proposal.md), che
> si chiude dichiarando *"**Blocca**: il change successivo (progetto Astro), che non può iniziare
> senza questo contratto"*. Il contratto ora esiste: questo change è il suo primo consumatore.

## Intent

Il sistema ha oggi un'API pubblica **che nessuno chiama**. Tre rotte anonime rispondono `200` con
JSON, con `Cache-Control` corretto e una superficie chiusa per costruzione — e l'unico modo di
vederle è `curl`. Verifica: **`sito/` non esiste**; la radice del repository contiene `backend/`,
`duedgusto/`, `deploy/`, `docs/`, `openspec/` e nient'altro di eseguibile.

Allo stesso modo esistono, e non sono usati:

1. **I deliverable di marca**, completi e vettoriali, in [`docs/brand/`](../../../docs/brand/README.md)
   — logo, monogramma, wordmark con le bandiere, favicon, `og-default.jpg`. Il README dichiara sé
   stesso "il master, non la cartella del sito" e descrive **quale sottoinsieme** andrà in `sito/`,
   in due posti diversi, *"quando nascerà `sito/` (Fase 2 del piano)"*. Quel momento è questo change.
2. **Il commento più importante della Fase 2**, scritto dentro il DTO che il sito dovrà consumare:

   > *"Chi compone l'URL è il consumatore, e ha **due** prefissi distinti: quello con cui legge le
   > rotte API server-side (rete interna) e quello con cui il **browser** carica le immagini.
   > Confonderli produce markup che funziona in ogni prova server-side e si rompe per ogni
   > visitatore — in sviluppo i due prefissi coincidono, ed è precisamente per questo che l'errore
   > non si vede finché non si va in produzione."*
   > — [ImmaginePubblicaDto.cs:13-17](../../../backend/Controllers/Public/Dto/ImmaginePubblicaDto.cs)

3. **La policy CORS dedicata** `PubblicaSenzaCredenziali`, già registrata
   ([Program.cs:182](../../../backend/Program.cs)) e già applicata al controller
   ([PublicController.cs:57](../../../backend/Controllers/PublicController.cs)), scritta per un
   consumatore browser che non è mai arrivato.

Obiettivo di questo change: **il deliverable verificabile della Fase 2 del piano** —
*"`localhost:4321` mostra il menu reale con le foto reali, nei due temi"*. Non uno scheletro, non
un placeholder: due pagine che leggono `/api/public/site` e `/api/public/menu` e mostrano i
prodotti veri del locale con le fotografie vere caricate dalla libreria media.

## Scope

**Moduli coinvolti: uno solo, ed è nuovo.** `sito/`. **Nessuna modifica a `backend/` né a
`duedgusto/`** — motivazione in Approach §1: il contratto pubblico è già completo e la policy CORS
che serve al browser è **già** registrata e già applicata.
**Migrazioni database richieste: nessuna.** Questo change non tocca il database, non legge il
database, e non ha alcun accesso ad esso se non attraverso tre GET anonime.

### In Scope

**Il progetto**
- `sito/` a pari livello di `backend/` e `duedgusto/`, con `package.json` **indipendente** (niente
  workspaces: scelta consapevole del piano §1, trappola §11.11 accettata).
- `astro.config.mjs`: `output: 'server'`, `adapter: node({ mode: 'standalone' })`, `server.host`,
  `vite: { plugins: [tailwindcss()] }`. **Versione di Astro da pinnare** — vedi Approach §2, è una
  decisione aperta con un blocco reale sotto.
- `export const prerender = true` sulle pagine che non leggono l'API. In questo change **nessuna
  delle due pagine consegnate è prerenderizzata**: entrambe leggono dati vivi. La direttiva si
  introduce con la sua prima pagina statica (`/privacy`, `/404`), che è Fase 3.
- `dev:sito` nel `package.json` di radice e nel `concurrently` di `dev`.
- `tsconfig.json`, `.gitignore`, `README` minimo del progetto.

**Il design system — i due temi**
- `src/styles/global.css`: `@import "tailwindcss"` + i token dei due temi come CSS custom
  properties, con i **valori campionati** dalle locandine (piano §6, riportati integralmente in
  Approach §5). Tema scuro chiamato **`sera`**, mai `notte`.
- 🔴 **Il vincolo dell'arancio scritto nel foglio di stile, accanto al token**: `#FD8502` ha
  contrasto **6.78 sulla lavagna e 2.11 sulla crema**. Di giorno non può portare testo, nemmeno
  grande (2.11 è sotto la soglia 3:1). È l'unico colore comune ai due temi, quindi è anche quello
  che verrà riusato per sbaglio.
- Meccanismo di tema **client-side, sempre** (piano §11.7), con script inline `is:inline` nel
  `<head>`, toggle a tre stati (giorno → sera → auto), `timeZone: "Europe/Rome"`, e l'ora di switch
  passata come **parametro** da `oraInizioTemaSera` — non l'ora corrente, così la risposta resta
  cacheabile. Merita un commento nel codice: è una trappola dichiarata nel piano.
- Assenza di FOUC come **requisito verificabile**, non come impressione.

**Tipografia e marca**
- Font serviti **in locale come `.woff2`**, mai da CDN: `@font-face`, `font-display: swap`,
  `preload` sul solo display.
- **Anton** (display, solo Regular — trappola §11.10), **Allura** (slogan e tocchi calligrafici),
  **Playfair Display Black** deformato orizzontalmente per "Colazione Pranzo Aperitivo".
  ⚠️ Due dei tre **non sono nel repository**: vedi Rischi.
- Sottoinsieme di `docs/brand/` copiato in `sito/`, **nei due posti che il README distingue**:
  `public/` per ciò che va servito verbatim a URL fisse (`favicon.svg`, `apple-touch-icon.png`,
  `og-default.jpg`), `src/assets/` per ciò che va **inline nel DOM** (`logo-2dgusto.svg`,
  `monogramma-2d.svg`), perché è l'unico modo perché `currentColor` segua il tema.
- Slogan *"L'attesa del piacere è essa stessa il piacere"*.

**Il consumo dell'API**
- `src/lib/tipi.ts`: i tipi TypeScript che **rispecchiano i DTO** di `Controllers/Public/Dto/`.
- `src/lib/api.ts`: lettura server-side delle tre rotte, con **due prefissi distinti e
  deliberatamente separati** (Approach §3), timeout e degradazione esplicita.
- `src/components/Immagine.astro`: da `ImmaginePubblicaDto` a `<picture>` + `srcset` **puro**, con
  `width`/`height` dichiarati (zero CLS) e `placeholder` come sfondo. 🔴 **Non** `<Image>` di Astro
  sui media remoti (piano §4): rifarebbe a runtime un'ottimizzazione già fatta dal backend.

**Le due pagine vive**
- `/` — hero, insegna, slogan, orari con stato "aperto ora" derivato da `/api/public/site`, i
  prodotti `consigliato`, una striscia dalla galleria, indirizzo e contatti.
- `/menu` — le categorie di vetrina e i loro prodotti da `/api/public/menu`, con foto, prezzi,
  allergeni e i marcatori `novita`/`consigliato`; il flag di troncamento onorato.
- `Base.astro` con `<head>`, meta di base e i meta Open Graph dai campi SEO di `/api/public/site`.

### Out of Scope

Rinviato alle fasi successive del piano, **non** cancellato:

- **Contenuti editoriali da CMS** (`SezionePagina`, `/api/public/contenuti`, `ContenutiSito.tsx`) e
  **JSON-LD completo** (`CafeOrCoffeeShop`, `Menu`/`MenuItem`, `openingHoursSpecification`),
  `@astrojs/sitemap`, canonical assoluti: sono **Fase 3**. In questo change i testi delle due pagine
  sono **scritti nei template**, e la loro migrazione a CMS è precisamente il lavoro della Fase 3.
- **Prenotazioni**: `/prenota`, `FormPrenotazione.tsx`, `POST /api/public/prenotazioni`, honeypot,
  time trap, email. **Fase 4**. Nessuna isola React di form in questo change.
- **Eventi e promozioni**: `/eventi`, `/eventi/[slug]`, blocco promo in home, piatto del giorno,
  fascione di chiusura straordinaria. **Fase 5**.
- **Go-live**: dominio, `site:` con l'URL definitivo, `Dockerfile`, servizio `sito` in
  `docker-compose.yml`, i tre server block nginx, micro-cache, Let's Encrypt, estensione della CI e
  **ribuild della versioning action**. **Fase 6**. Questo change **non tocca alcun file sotto
  `deploy/`**, né `docker-compose.yml`, né `.github/`.
- **Le altre pagine** del piano §6: `/chi-siamo`, `/contatti`, `/galleria`, `/privacy`, `/cookie`,
  `/404`. Nascono con i contenuti che le riempiono, non prima.
- **Lightbox della galleria** e ogni altra isola interattiva: la sola striscia in home è statica.
- **Rifinitura**: Lighthouse ≥ 95, audit AA completo, analytics. **Fase 7**. Questo change misura il
  contrasto dei token (che è una decisione di design system, e va provata ora) ma non fa
  ottimizzazione di performance.
- **Il backend è invariato**: nessun controller, nessun DTO, nessuna migrazione, nessun seed. Se
  durante l'implementazione emergesse che il contratto pubblico è incompleto, **è un cambio di
  scope da dichiarare**, non una modifica da fare di passaggio.
- **`duedgusto/` è invariato**: l'app admin non condivide codice con il sito. `mediaUrl.tsx` non si
  estrae in un pacchetto comune (Approach §3) — sono due composizioni diverse dello stesso dato.

## Approach

### 1. Nessuna modifica al backend, e perché è già vero

La tentazione naturale, aprendo un consumatore browser, è "aggiungere l'origine di sviluppo alla
allowlist CORS". Non serve, ed è verificato: `PublicController` porta
`[EnableCors("PubblicaSenzaCredenziali")]`, una policy **dedicata** che emette un
`Access-Control-Allow-Origin` costante e **senza credenziali**. Il commento accanto spiega che la
scelta non riguarda l'accesso — l'origine di sviluppo era già ammessa dalla policy globale — ma il
fatto che una risposta dichiarata cacheabile non debba portare `Vary: Origin`.

Conseguenza pratica per questo change: **il percorso caldo non usa CORS affatto** (Astro legge
server-side, piano §8) e il percorso di sviluppo, se un giorno il browser chiamerà le rotte
direttamente, è **già** ammesso. Nessuna riga di backend.

### 2. SSR con adapter Node standalone — l'API è attuale, la **versione** no

Verificato con Context7 sulla documentazione Astro corrente: la forma di configurazione del piano è
**ancora esatta, parola per parola**.

```js
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: true },
});
```

`output: 'server'` esiste, `mode: 'standalone'` esiste, e `export const prerender = true` su una
singola pagina resta il modo documentato di renderla statica dentro un sito server-side. Anche
`node ./dist/server/entry.mjs` è ancora la riga di avvio documentata. **Nessuna delle affermazioni
tecniche del piano §1 è invecchiata.**

Ma la **versione** sì, e con un blocco concreto:

| | Piano | Realtà verificata |
|---|---|---|
| Generazione di Astro | 5 | **6.x è la corrente** (indicizzata a `6.3.1`) |
| Node richiesto | non dichiarato | **Astro 6 richiede `v22.12.0` o superiore**, e le versioni dispari (v23) non sono supportate |
| Node della macchina di sviluppo | — | 🔴 **`v20.19.0`** |
| Vite | — | Astro 6 è passato a **Vite 7** con la Environment API; **tutti** gli adapter ufficiali hanno un nuovo major |

🔴 **Su questa macchina Astro 6 non parte.** Non è un dettaglio da scoprire al primo `npm install`:
è la prima decisione del change, e ha due uscite oneste — aggiornare Node a ≥ 22.12 (che tocca
anche il `node:22-alpine` del Dockerfile di Fase 6, il quale oggi soddisferebbe il vincolo), oppure
pinnare Astro 5, che resta supportata e la cui configurazione è **identica** a quella scritta sopra.
La scelta va fatta in design, non improvvisata dal comportamento di `npm create astro@latest`, che
installerebbe la corrente e fallirebbe.

**Perché SSR e non SSG** resta vero e non si ridiscute: non esiste pipeline di rebuild sul VPS
([deploy.sh](../../../deploy/scripts/deploy.sh) builda solo al deploy), e cambiare il prezzo di un
caffè non può richiedere una build. **Perché non SSG + fetch client-side**: menu e contenuti
diventerebbero invisibili ai crawler, annullando la ragione stessa di scegliere Astro.

### 3. 🔴 I due prefissi — la trappola centrale di questo change

È il rischio che il codice del change precedente ha **scritto in anticipo** dentro il DTO, e va
progettato adesso perché è invisibile fino alla produzione.

| Prefisso | Chi lo usa | Sviluppo | Produzione (Fase 6) |
|---|---|---|---|
| **API** | il **server** Astro, per leggere le tre rotte | `https://localhost:4000` | `http://backend:5000` (rete Docker) |
| **Media** | il **browser**, dentro `src`/`srcset` | stesso host | `/media/…` sull'host pubblico, servito da nginx |

I due **coincidono in sviluppo**, ed è esattamente questo che rende l'errore invisibile: un unico
prefisso produce `<img src="http://backend:5000/media/…">`, che è verde in ogni prova server-side —
la pagina si genera, il markup c'è, nessun test fallisce — e **rotto per ogni visitatore**, perché
`backend` è un nome che esiste solo dentro la rete Docker.

→ Due variabili d'ambiente distinte, con **nomi che non si possono confondere**, un punto solo che
le legge, e una prova che li tiene separati **anche in sviluppo** — cioè proprio dove coincidono.
Il modo preciso è materia di design; il vincolo di questa proposal è che alla fine del change
**esista una configurazione in cui i due prefissi sono diversi e il sito funziona**, e che sia
quella provata, non quella comoda.

⚠️ Il prefisso media è **serving, non dato**: la stessa dottrina di
[`mediaUrl.tsx`](../../../duedgusto/src/components/pages/sito/mediaUrl.tsx) nell'admin, che compone
`${API_ENDPOINT}/media/${chiave}/${larghezza}.${formato}`. Non si condivide quel file: l'admin ha
**un** prefisso (è tutto browser), il sito ne ha **due**. Estrarre una utility comune
significherebbe imporre al sito la forma che vale per l'admin, che è la forma sbagliata.

### 4. 🔴 Il tema è client-side, sempre

Trappola §11.7 del piano, e la ragione è aritmetica: `/api/public/site` è cacheabile 300 secondi e
la Fase 6 metterà un micro-cache nginx davanti alle pagine. Un tema **calcolato server-side** ha due
sole uscite, entrambe guaste: o entra nella chiave di cache e la **frammenta** (due copie di ogni
pagina, e il beneficio del micro-cache si dimezza), o non ci entra e **metà dei visitatori riceve il
tema sbagliato** — quello di chi ha riempito la cache.

→ Il server emette **una sola pagina**, priva di tema. Lo script inline nel `<head>` decide prima
del primo paint, leggendo la preferenza salvata e, in assenza, confrontando l'ora **di Roma** con
`oraInizioTemaSera`, che arriva dall'API come **parametro** e non come "è sera adesso". Il commento
va scritto: è la classe di errore che un lettore futuro correggerebbe "migliorando" il codice.

Requisiti che ne discendono e che non sono opzionali: `is:inline` (senza, Astro processa e deferisce
lo script, e il FOUC torna), `html { transition: none }` fino al primo frame, e la scelta **vanilla
invece che isola React** — otto righe non meritano il runtime di React su ogni pagina, con un budget
dichiarato di < 60kb di JS.

### 5. I colori non si inventano, e uno di essi è una trappola

I valori sono **campionati dalle locandine social vere**, non scelti a occhio, e i due temi non sono
un light/dark generico: sono i **due registri visivi che il locale già usa**.

| | Giorno (crema + oliva) | Sera (lavagna) |
|---|---|---|
| Sfondo | crema `#F2EDE7` | lavagna `#251C19` |
| Inchiostro | nero quasi puro | gesso crema `#F2EDE7` |
| Accento | verde oliva `#41511E` | gesso giallo `#FDDB5B` |
| Accento 2 | arancio `#FD8502` | arancio `#FD8502` |

Tre conseguenze da non perdere:

- 🔴 **L'arancio è l'unico colore comune, ed è quello che non si può usare come si crede**: 6.78 di
  contrasto sulla lavagna, **2.11** sulla crema. Di giorno vive **solo** come riempimento, bordo o
  superficie, con testo nero sopra. Chi scriverà un titolo arancione sul tema chiaro romperà
  l'accessibilità senza vedere nulla di strano — motivo per cui il vincolo va **nel CSS accanto al
  token**, non in un documento.
- **La crema fa doppio lavoro**: fondo di giorno, inchiostro di sera. Non è un caso, è letteralmente
  il gesso sulla lavagna, e usare la stessa variabile per entrambi i ruoli tiene insieme i due temi.
- **La lavagna è marrone, non nera.** `#251C19` è un carboncino caldo; un `#1A1A1A` neutro
  sembrerebbe un dark mode generico invece della loro lavagna.

Ne discende che le CTA **cambiano forma fra i temi**: di giorno oliva pieno con testo crema (7.45),
di sera arancio o giallo su lavagna. Non è un vezzo: è l'unica combinazione che passa in entrambi.

### 6. Tailwind v4 è un plugin Vite — confermato, con una precisazione che il piano non fa

Verificato con Context7: l'installazione in Astro è
`vite: { plugins: [tailwindcss()] }` con `@tailwindcss/vite`, e **`@astrojs/tailwind` non è la
strada**. Il piano §1 lo dice già ed è esatto. Il monorepo è coerente: `duedgusto/package.json`
porta `tailwindcss ^4.2.1` **e** `@tailwindcss/vite ^4.2.1` — stessa versione, stesso modello
mentale, come il piano §6 prometteva.

Due precisazioni emerse dalla documentazione corrente, che il piano non contiene:

1. **La namespace dei font è `--font-*`, non `--font-family-*`.** Quest'ultima appartiene alla
   *alpha* di v4 ed è ancora in circolazione negli esempi vecchi: `--font-family-display` non
   genera `font-display`, genera niente. Le namespace valide sono venti, elencate nella
   documentazione del tema.
2. 🔴 **`@theme inline` per i token che cambiano a runtime.** È esattamente il caso di questo
   progetto: i colori dei due temi sono custom properties riassegnate da un attributo sull'elemento
   radice. La documentazione indica `@theme inline { … }` come la forma per *"referencing runtime
   CSS custom properties"*: inlinea il valore nell'utility invece di far passare la risoluzione da
   una variabile dichiarata su `:root`. Con `@theme` semplice il rischio è una risoluzione
   congelata al contesto della radice, che smette di seguire il tema appena il token viene
   ridefinito in un sottoalbero. Da fissare in design con una prova, non da assumere.

Per il tema, la forma documentata è `@custom-variant`, che permette di legare la variante a un
attributo dato — coerente con `data-tema="sera"` invece di una classe `.dark`.

### 7. Il logo esiste già, e ha una regola che non si può aggirare

`docs/brand/` è completo e **vettoriale dall'origine**: i tracciati sono quelli estratti dai PDF,
non ridisegnati. Questo change non produce asset di marca, ne **consuma un sottoinsieme**.

🔴 **Un SVG dentro `<img>` non eredita `currentColor`.** È un documento isolato: `currentColor` si
risolve al nero e il logo sparisce su fondo scuro. È la ragione per cui il logo esiste in tre
varianti invece che in una sola a colori dinamici, e la ragione per cui il README manda
`logo-2dgusto.svg` in `src/assets/` (inline, segue il tema) e `favicon.svg` in `public/` (servito
verbatim). Sbagliare cartella non produce un errore: produce un logo che sparisce di sera.

⚠️ Le tre parole "Colazione Pranzo Aperitivo" vanno scritte **come testo**, mai prese dall'SVG
dell'insegna: devono poter essere lette, tradotte e indicizzate.

## Affected Areas

| Area | Impatto | Descrizione |
|------|---------|-------------|
| `sito/package.json` | Nuovo | Progetto indipendente, senza workspaces (piano §1) |
| `sito/astro.config.mjs` | Nuovo | `output: 'server'`, adapter Node standalone, plugin Vite di Tailwind |
| `sito/tsconfig.json`, `sito/.gitignore` | Nuovo | Configurazione di base |
| `sito/src/styles/global.css` | Nuovo | `@import "tailwindcss"`, token dei due temi, **il vincolo dell'arancio scritto accanto al token** (§5) |
| `sito/src/layouts/Base.astro` | Nuovo | `<head>`, meta OG dai campi SEO, **script tema `is:inline`** (§4) |
| `sito/src/components/Immagine.astro` | Nuovo | `<picture>` + `srcset` da `ImmaginePubblicaDto`, `width`/`height` dichiarati |
| `sito/src/components/TemaSwitch.astro` | Nuovo | Toggle a tre stati, vanilla, non un'isola |
| `sito/src/lib/api.ts` | Nuovo | Lettura server-side delle tre rotte; 🔴 **i due prefissi separati** (§3) |
| `sito/src/lib/tipi.ts` | Nuovo | Tipi che rispecchiano i DTO di `Controllers/Public/Dto/` |
| `sito/src/pages/index.astro` | Nuovo | Home, dati vivi da `/api/public/site` e `/menu` |
| `sito/src/pages/menu.astro` | Nuovo | Menu, dati e foto vivi |
| `sito/src/assets/fonts/*.woff2` | Nuovo | Anton, Allura, Playfair Display Black. ⚠️ Due su tre da procurare (Rischi) |
| `sito/src/assets/logo-2dgusto.svg`, `monogramma-2d.svg` | Nuovo | Copiati da `docs/brand/`, **inline nel DOM** (§7) |
| `sito/public/favicon.svg`, `apple-touch-icon.png`, `og-default.jpg`, `robots.txt` | Nuovo | Copiati da `docs/brand/`, serviti verbatim |
| `package.json` (radice) | Modificato | `dev:sito` + inserimento nel `concurrently` di `dev` |
| `docs/brand/**` | **Invariato** | È il master del marchio: il sito ne prende copia, non lo modifica |
| `backend/**` | **Invariato** | 🔴 Nessun controller, DTO, migrazione o seed (§1) |
| `duedgusto/**` | **Invariato** | 🔴 Nessuna estrazione di utility condivise (§3) |
| `deploy/**`, `docker-compose.yml`, `.github/**` | **Invariato** | 🔴 Container, nginx, CI e versioning action sono Fase 6 |

## Risks

| Rischio | Probabilità | Mitigazione |
|---------|-------------|-------------|
| 🔴 **Node della macchina di sviluppo è `v20.19.0`, Astro 6 richiede `≥ v22.12.0`** | **Certa senza decisione** | Non è un avviso, è un `npm install` che fallisce. Due uscite: aggiornare Node, o pinnare Astro 5 (supportata, configurazione identica — §2). Decisione aperta n. 1, da chiudere **prima** di creare il progetto |
| 🔴 **Un prefisso solo invece di due** → `<img src="http://backend:5000/…">`: verde in ogni prova server-side, rotto per ogni visitatore | **Alta**, ed è la classe di errore che il DTO documenta in anticipo | §3: due variabili con nomi non confondibili, un punto solo che le legge, e una prova con i due prefissi **diversi** eseguita in sviluppo, dove naturalmente coinciderebbero |
| 🔴 **Allura e Playfair Display non sono nel repository** | **Certa** | Verificato: `duedgusto/src/assets/fonts/` contiene `Anton-Regular.ttf`, `BrunoAce-Regular.ttf`, `ShadowsIntoLight-Regular.ttf`, `Yesteryear-Regular.ttf` — e **nessun `.woff2`** fra questi (gli unici `.woff2` del repo sono i Roboto generati nel `dist/` del frontend). Anton va **convertito**; Allura e Playfair Display Black vanno **procurati e convertiti**, con la licenza verificata. *Divergenza dal piano, che prescriveva Yesteryear — che invece c'è* |
| **Il tema calcolato server-side** "perché è più semplice" | **Media, e cresce con i lettori futuri** | §4: frammenta la cache o serve il tema sbagliato a metà visitatori. Il commento nel codice è parte del deliverable, non decorazione |
| **L'arancio usato per un testo sul tema giorno** (2.11) | **Alta** | §5: è l'unico colore comune ai due temi, quindi il più riusato per analogia. Il vincolo va nel CSS accanto al token, e la verifica del contrasto è un criterio di successo |
| **`@theme` invece di `@theme inline`** sui token che cambiano a runtime | **Media** | §6: i colori si "congelano" al contesto della radice e smettono di seguire il tema in un sottoalbero. Da provare in design, non da assumere in nessuna delle due direzioni |
| **`<Image>` di Astro usato sui media remoti** | Media | Rifarebbe a runtime l'ottimizzazione che il backend ha già fatto, portando `sharp` e binari nativi nel container di Fase 6. `Immagine.astro` produce `<picture>` puro (piano §4) |
| **FOUC**, che non si vede sulla macchina di chi sviluppa | **Media** | Cache calda e rete locale lo nascondono. La verifica è per **hard reload ripetuti** con throttling, non "a me non si vede" |
| **Il flag di troncamento del menu ignorato** | Media | `/api/public/menu` dichiara `troncato` e il totale reale proprio perché il consumatore possa reagire. Ignorarlo riporta esattamente il guasto silenzioso che il change precedente ha speso un criterio a evitare |
| **Orari: il piano dice 7:00–21:00, il locale chiude alle 20:00** | Certa | Il sito **non li scrive**: li legge da `/api/public/site`, che li prende da `BusinessSettings`. È la garanzia strutturale già dimostrata nel change precedente. Il rischio residuo è solo nei testi scritti a mano, che non devono mai citare un orario |
| **Il sito legge il backend in sviluppo su HTTPS con certificato self-signed** | Media | Il backend gira su `https://0.0.0.0:4000` con certificato di sviluppo: una `fetch` da Node può rifiutarlo. Da risolvere in design in modo esplicito e **circoscritto allo sviluppo**, mai disattivando la verifica in una configurazione che possa arrivare in produzione |
| **Il backend non risponde** mentre il sito si renderizza | Media | SSR: se `/api/public/site` fallisce, la pagina fallisce. Serve una degradazione dichiarata (la home mostra l'identità del locale anche senza menu) invece di un 500 al visitatore. La rete vera arriva in Fase 6 con `proxy_cache_use_stale` |
| **Tre `package.json` senza workspaces**: i lockfile divergeranno su TypeScript e i pattern smetteranno di essere copiabili | Certa, **accettata** | Trappola §11.11 del piano, accettata consapevolmente. Va **detta**, non mitigata: la conversione a workspaces è una fase dedicata e fuori scope |
| **`robots.txt` del sito confuso con quello dell'app** | Bassa in questa fase | Il `Disallow: /` va sull'host dell'**app**, non della vetrina (piano §6). Qui il `robots.txt` nasce **permissivo**; il gating dell'admin è Fase 6 e non va anticipato al file sbagliato |

### Decisioni aperte da chiudere in design

1. 🔴 **Versione di Astro e versione di Node** — aggiornare la macchina a Node ≥ 22.12 e prendere
   Astro 6, oppure pinnare Astro 5 su Node 20. È **bloccante**: nessun comando di creazione del
   progetto è corretto finché non è decisa. Va scritta anche in `engines` di `sito/package.json`,
   perché il prossimo a clonare il repo non la riscopra da un errore.
2. **Come si passano i due prefissi** e come si nominano, in modo che la loro confusione sia
   difficile invece che naturale — e come si provano **diversi** in sviluppo (§3).
3. **`@theme` contro `@theme inline`** per i token dei due temi, con una prova che distingue i due
   comportamenti invece di una scelta per somiglianza (§6).
4. **Playfair Display: ×1.55 o ×1.5?** Il README di marca dichiara il fattore **misurato** ×1.55 e
   nella stessa riga suggerisce `scaleX(1.5)` in CSS. Sono due numeri diversi: uno dei due è quello
   giusto, e la scala deve nascere con quello.
5. **Anton ha solo il Regular** (trappola §11.10): la scala tipografica deve dichiarare **adesso**
   cosa si usa dove serve un peso intermedio, non deciderlo a metà lavoro.
6. **Degradazione quando l'API non risponde**: cosa mostra la home, e se `/menu` è una pagina di
   errore o una pagina vuota onesta.

## Rollback Plan

**Il rollback di questo change è il più semplice dell'intero progetto: `rm -rf sito/`.**
Non tocca il database, non modifica dati, non altera alcun comportamento esistente.

1. **Il progetto** — rimuovere la cartella `sito/`. Nessun altro modulo la importa: `backend/` non
   sa che esiste e `duedgusto/` nemmeno.
2. **Radice** — togliere `dev:sito` dal `package.json` e dal `concurrently`. È l'**unica** modifica
   a un file preesistente in tutto il change, ed è di due righe.
3. **Backend** — nulla da revertire: invariato per costruzione (§1). Le tre rotte pubbliche
   continuano a rispondere a `curl` come prima, perché non sono mai state modificate.
4. **Frontend admin** — nulla da revertire: invariato.
5. **Marca** — `docs/brand/` è invariato: il sito ne ha preso copia. Rimuovere `sito/` non fa
   perdere alcun asset, perché il master è altrove. **È la ragione per cui la copia è una copia.**
6. **Database** — nessuna migrazione, nessun dato scritto. Il sito **legge** tre GET anonime.
7. **Infrastruttura** — nulla da revertire: `deploy/`, `docker-compose.yml` e `.github/` non sono
   toccati.

**Punto di non ritorno**: nessuno. Il dominio non è acquistato, il container non esiste, nginx non
punta a nulla: il sito è raggiungibile **solo da `localhost:4321`**. Nessun visitatore esterno può
vederlo, quindi un rollback non produce link rotti verso Internet. Il punto di non ritorno arriverà
con il go-live (Fase 6).

## Dependencies

- **Fase 2 prima metà completata** ✅ verificata nel codice: `PublicController` con le tre rotte
  anonime, i DTO in `Controllers/Public/Dto/`, `ImpostazioniVetrina` e la pagina admin esistono e
  sono in produzione. Il contratto che questo change consuma **è già provato con `curl`**.
- **Fase 1 completata** ✅ `MediaAsset`, la pipeline di varianti e i campi vetrina di `Prodotto`:
  senza foto reali nel database, il deliverable di questa fase non è verificabile.
- **Asset di marca pronti** ✅ `docs/brand/` è completo e vettoriale, con il README che indica quale
  file va in quale cartella del sito.
- **Nessuna dipendenza dal backend in scrittura**: nessuna migrazione, nessun seed, nessuna
  modifica di codice .NET.
- 🔴 **Node ≥ 22.12 se si sceglie Astro 6** — oggi la macchina ha `v20.19.0`. Decisione aperta n. 1.
- **Nuove dipendenze npm**, tutte in `sito/` e nessuna condivisa: `astro`, `@astrojs/node`,
  `tailwindcss`, `@tailwindcss/vite`. ⚠️ `@astrojs/react` e `@astrojs/sitemap`, previsti dal piano
  §1, **non entrano in questo change**: la prima serve alle isole (Fasi 4-5), la seconda alla SEO
  (Fase 3). Una dipendenza installata e non usata è una dipendenza che nessuno verifica.
- **Font da procurare**: Allura e Playfair Display Black non sono nel repository; Anton c'è ma in
  `.ttf` e va convertito. Licenze da verificare prima di committare i binari.
- **Dati veri del locale** ✅ già a database e già esposti da `/api/public/site`: 2D Gusto Bar,
  Via del Costo 99, 36016 Thiene (VI), 07:00–20:00, Instagram @2DGUSTO.
- **Nessuna dipendenza dal dominio né dal VPS**: tutto verificabile in locale con
  `npm run dev` e `npm run build && node dist/server/entry.mjs`.
- **Blocca**: la Fase 3 (contenuti editoriali e SEO), che ha bisogno di pagine su cui inserirli.

## Success Criteria

Ogni criterio dice **come si prova**. Nessuno si chiude per somiglianza.

✅ **Ripercorsi uno per uno in apply il 2026-08-12** (task 12.14). La tabella che associa ogni
criterio alla prova che lo chiude — con il numero del task e il risultato misurato — è
nell'"Esito reale" della Fase 12 di [tasks.md](./tasks.md).

⚠️ Le voci sono **diciotto**, non diciassette come le contava il task 12.15: la differenza è
un errore di conteggio dell'artefatto, non un criterio comparso dopo.

- [x] 🔴 **Il deliverable della Fase 2 del piano, alla lettera**: `localhost:4321` mostra **il menu
      reale con le foto reali, nei due temi**. → Non uno screenshot della home: `/menu` aperta nel
      browser, i prodotti confrontati **uno per uno** con la risposta di
      `curl -sk https://localhost:4000/api/public/menu`, e le immagini che caricano davvero
      (`200` nella scheda di rete, non l'`alt` di un `404`).
- [x] `npm run build` produce un bundle SSR e `node dist/server/entry.mjs` serve entrambe le pagine.
      → Non solo `npm run dev`: il server di sviluppo e il bundle di produzione falliscono in modi
      diversi, e la Fase 6 spedirà il secondo.
- [x] 🔴 **I due prefissi sono distinti, e lo si prova dove naturalmente coinciderebbero.** → Il
      sito si avvia con il prefisso API e quello media **puntati a due valori diversi**, la pagina
      si renderizza e le immagini caricano. Controprova che chiude il criterio: con un prefisso
      solo, il markup generato contiene l'host interno — cioè si **dimostra** che la prova sarebbe
      passata lo stesso, ed è per questo che serve quella con i due valori.
- [x] **Nessun `Codice`, `AliquotaIva` o categoria contabile compare nell'HTML servito.** →
      `curl` sulla pagina renderizzata e ricerca delle stringhe: il contratto pubblico non li
      possiede, quindi il criterio verifica che il sito non li abbia presi da altrove.
- [x] 🔴 **Nessun FOUC**, provato in condizioni sfavorevoli. → Hard reload ripetuti (almeno dieci)
      con cache disabilitata e throttling di rete, su **entrambi** i temi, partendo da ognuno dei
      tre stati del toggle. Un solo lampo bianco all'apertura in tema sera fa fallire il criterio.
- [x] Il tema segue l'ora **di Roma**, non quella del visitatore. → Cambio del fuso orario del
      sistema (o del profilo del browser) a un fuso lontano: il tema **non** cambia. È l'unico modo
      di distinguere una lettura di `Europe/Rome` da un `new Date()` che oggi darebbe lo stesso
      risultato.
- [x] Il toggle a tre stati funziona e **sopravvive al reload**: giorno → sera → auto, con la
      preferenza esplicita che vince sull'ora e "auto" che vi ritorna. → Giro completo nel browser
      con un reload dopo ogni stato.
- [x] 🔴 **L'HTML servito è identico nei due temi.** → `curl` due volte sulla stessa pagina e
      confronto **byte per byte**: se il tema fosse finito server-side, i due corpi
      differirebbero. È la prova che il micro-cache di Fase 6 non verrà frammentato, e si può fare
      solo adesso che il sito nasce.
- [x] **Contrasto misurato, non stimato, su entrambi i temi.** → Strumento di accessibilità del
      browser su `/` e `/menu` nei due temi: nessuna coppia testo/sfondo sotto 4.5:1 (3:1 per il
      testo grande). In particolare: **nessun testo arancione sul tema giorno**, verificato
      ispezionando gli elementi che usano quel token e non solo leggendo il CSS.
- [x] **I font sono serviti dal sito, mai da un CDN.** → Scheda di rete: zero richieste verso
      `fonts.googleapis.com` o `fonts.gstatic.com`, e i `.woff2` caricati da un percorso locale.
      In più: `grep` per quei domini nell'HTML e nel CSS generati.
- [x] **Il logo segue il tema.** → Toggle giorno/sera con il logo visibile: il segno resta leggibile
      su entrambi i fondi. Controprova diagnostica: l'SVG del logo è **inline nel DOM** (ispezione
      dell'elemento mostra `<svg>`, non `<img>`), che è l'unica condizione in cui `currentColor`
      può funzionare.
- [x] Gli orari mostrati e lo stato "aperto ora" vengono **dall'API**, non dal template. → Modifica
      dell'orario di chiusura dalla pagina delle impostazioni della cassa → il sito lo riflette
      entro il tempo di cache → ripristino. È il giro già dimostrato nel change precedente, qui
      chiuso **sul sito** invece che su `curl`. In più: `grep` di `"20:00"` nei sorgenti di `sito/`
      non trova nulla.
- [x] Un prodotto marcato `consigliato` compare in home; togliendo il marcatore **sparisce**. →
      Giro dall'admin, non modifica del database: è la prova che la home legge dati vivi e non una
      lista scritta a mano.
- [x] Il flag di troncamento del menu è **onorato**, non ignorato. → Prova con la risposta
      dell'API che dichiara `troncato: true` (anche simulata): la pagina lo comunica invece di
      mostrare un menu incompleto in silenzio.
- [x] La pagina **degrada in modo dichiarato** se il backend non risponde. → Backend spento, poi
      apertura di `/` e `/menu`: quel che si vede è ciò che la decisione aperta n. 6 avrà stabilito
      — e **non** una pagina di errore di Astro né un 500 nudo.
- [x] 🔴 **Il backend e l'admin sono invariati, alla lettera.** → `git diff --stat` **vuoto** su
      `backend/` e `duedgusto/` dalla base del change a `HEAD`; `dotnet test` e
      `npm run test`/`ts:check`/`lint` del frontend passano **senza che un solo file di test sia
      stato toccato**.
- [x] **Nessun file sotto `deploy/`, `docker-compose.yml` o `.github/` è stato toccato.** →
      `git diff --stat deploy/ docker-compose.yml .github/` vuoto. ⚠️ Il confronto parte dalla base
      **di questo change**, non dall'ultimo commit del precedente: nella storia del progetto esiste
      già un commit di `deploy/` che non appartiene ad alcun change della vetrina, e farlo partire
      da lì produrrebbe una lettura sbagliata.
- [x] La versione di Astro e quella di Node sono **dichiarate**, non implicite. → `engines` in
      `sito/package.json` coerente con la versione di Astro installata, e `npm install` che
      completa su una macchina che rispetta quel vincolo. È il criterio che impedisce alla decisione
      aperta n. 1 di tornare fra un mese come un errore di installazione.

---

## Verifiche Context7 (Astro e Tailwind) e verifiche sul codice

Il piano è anteriore all'implementazione della Fase 1 e alla generazione corrente di Astro. Ogni
affermazione tecnica su Astro e Tailwind è stata verificata sulla documentazione attuale via
Context7; ogni affermazione sul repository, sui file reali.

**Confermate senza riserve (Context7)**
- `output: 'server'` + `adapter: node({ mode: 'standalone' })` è **ancora** la configurazione
  documentata per l'SSR Node, `server.host: true` incluso per gli ambienti containerizzati.
- `export const prerender = true` su una singola pagina o endpoint resta il modo documentato di
  renderla statica dentro un sito `output: 'server'` (e `= false` il suo speculare).
- `node ./dist/server/entry.mjs` è ancora la riga di avvio documentata.
- 🔴 **Tailwind v4 si installa come plugin Vite** — `vite: { plugins: [tailwindcss()] }` con
  `@tailwindcss/vite` — e la guida Astro di Tailwind mostra **esattamente** questo. `@astrojs/tailwind`
  non è la strada. Il piano §1 e §6 sono corretti.
- `@custom-variant` è la direttiva per legare una variante a un attributo dato: coerente con
  `data-tema` invece di una classe `.dark`.
- Il monorepo è già su Tailwind v4 (`tailwindcss` e `@tailwindcss/vite` entrambi `^4.2.1` in
  `duedgusto/package.json`): "stessa versione, stesso modello mentale" del piano §6 è vero.

**Divergenze e precisazioni**
1. 🔴 **La generazione corrente di Astro è la 6, non la 5** (indicizzata a `6.3.1`), e **richiede
   Node `v22.12.0` o superiore** (le versioni dispari come v23 non sono supportate). Astro 6 è
   passato a **Vite 7** con la Environment API, e **tutti** gli adapter ufficiali hanno ricevuto un
   nuovo major. La documentazione mostra inoltre un percorso di aggiornamento **oltre** la 6: la
   versione va **pinnata esplicitamente** e riverificata al momento della creazione del progetto,
   non lasciata decidere a `npm create astro@latest`.
2. 🔴 **La macchina di sviluppo ha Node `v20.19.0`** (`node --version`): con Astro 6 il progetto
   **non parte**. È il primo blocco del change ed è una decisione, non un dettaglio operativo.
3. **La namespace dei font in Tailwind v4 è `--font-*`, non `--font-family-*`**: quest'ultima
   appartiene alla *alpha* e sopravvive negli esempi datati. Le namespace del tema sono venti e
   `--font-family-*` non è fra queste.
4. **`@theme inline` è la forma documentata per i token che referenziano custom properties di
   runtime** — cioè il caso dei due temi di questo progetto. Il piano §6 mostra i token come CSS
   puro e non affronta il loro rapporto con `@theme`: va deciso in design, con una prova.
5. **La tipografia decisa dall'utente diverge dal piano**: il piano §6 prescrive **Yesteryear**
   (che *è* nel repository) per il registro calligrafico; la decisione confermata è **Allura**, con
   **Playfair Display Black** per le tre parole dell'insegna. Verificato:
   `duedgusto/src/assets/fonts/` contiene `Anton-Regular.ttf`, `BrunoAce-Regular.ttf`,
   `ShadowsIntoLight-Regular.ttf`, `Yesteryear-Regular.ttf` — **Allura e Playfair Display non
   esistono nel repository**, e nessuno dei font presenti è in `.woff2`.
6. **Gli orari sono 07:00–20:00 lun–sab, non 7:00–21:00** come scrive il piano §"Dati reali". Vale
   il database. Il sito non li scrive comunque: li legge da `/api/public/site`.
7. **La cartella della galleria è `"galleria"`, non `"gallery"`**: la decisione aperta del change
   precedente è stata chiusa in italiano, con normalizzazione in scrittura
   (`CartelleVetrina.Normalizza`) e uguaglianza secca in lettura. Il sito consuma
   `/api/public/galleria` senza sapere nulla dell'etichetta, ma chi popola la libreria sì.
8. **La policy CORS per il browser esiste già**: `PubblicaSenzaCredenziali`, registrata in
   `Program.cs` e applicata al controller. La "decisione aperta CORS" del change precedente è
   chiusa, e questo change **non ha bisogno di toccare il backend**.
9. **`@astrojs/react` e `@astrojs/sitemap`**, previsti dal piano §1 nello stesso blocco di
   configurazione, **non servono in questa fase**: nessuna isola e nessuna sitemap prima della
   Fase 3. Installarli ora significherebbe portarsi dipendenze non esercitate.
10. **Il backend di sviluppo è su `https://0.0.0.0:4000` con certificato self-signed**: una `fetch`
    server-side da Node può rifiutarlo. Il piano dà per scontato `http://backend:5000`, che è la
    situazione di **produzione** (Fase 6) e non quella in cui questo change si sviluppa.
