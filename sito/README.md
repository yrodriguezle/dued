# Sito vetrina — 2 D Gusto

Il sito pubblico della caffetteria, separato dal gestionale. Astro in SSR: legge i dati veri
dal backend .NET a ogni richiesta, senza database proprio e senza pannello proprio — i
contenuti si modificano dall'app di cassa, sezione **Sito**.

Non è l'app di cassa e non ne condivide nulla: né dipendenze, né componenti, né stili.
`duedgusto/` è React + MUI; qui non c'è React e non c'è MUI.

## Requisiti

| | |
|---|---|
| **Node** | **≥ 22.12** — è un vincolo, non un consiglio: `npm install` si rifiuta di partire su una versione inferiore (`.npmrc` con `engine-strict`). La versione è scritta in `.nvmrc` |
| **Backend** | in esecuzione su `https://localhost:4000` (dalla radice: `npm run dev:backend`) |
| **MySQL** | quello del gestionale — il sito legge i dati veri, non dati finti |

## Primo avvio

**1. Esporta il certificato di sviluppo** (una volta per macchina). Il backend è HTTPS con il
certificato self-signed di ASP.NET, che `fetch` di Node rifiuta finché non conosce la CA:

```bash
cd backend
mkdir .certs
dotnet dev-certs https --export-path ./.certs/aspnet-dev.pem --format PEM --no-password
```

Il file resta fuori dal repository (`*.pem` e `*.key` sono già ignorati) ed è un certificato
**di macchina**, non un artefatto del progetto.

Se lo dimentichi non devi ricordartelo: `npm run dev` stampa questo stesso comando e si ferma.

**2. Crea il `.env`:**

```bash
cd sito
cp .env.example .env
```

**3. Avvia:**

```bash
npm install
npm run dev          # http://localhost:4321
```

### Dalla radice, tutto insieme

```bash
npm run dev          # backend :4000, app di cassa :4001, sito :4321
npm run dev:sito     # solo il sito
```

⚠️ **La prima schermata del sito può essere degradata, ed è atteso.** I tre processi partono
insieme, quindi il sito fa la sua prima lettura mentre il backend sta ancora salendo: la home
mostra marca e slogan con l'avviso «alcune informazioni non sono raggiungibili», e `/menu`
risponde `503`. Sparisce al primo reload. Non è un difetto, è la degradazione che funziona —
e visto che le risposte degradate dicono `no-store`, non resta niente in cache a ricordarsene.

## I due prefissi, e l'avviso che vedrai ogni giorno

Il sito ha **due** origini configurate, non una, perché due sono i lettori:

| Variabile | Chi la usa | In sviluppo | In produzione |
|---|---|---|---|
| `API_INTERNA_URL` | il **server** Astro, per leggere `/api/public/…` | `https://localhost:4000` | la rete interna di Docker |
| `PUBLIC_MEDIA_ORIGINE` | il **browser**, dentro `src`/`srcset` delle foto | `https://localhost:4000` | l'host pubblico del sito |

🔴 **In sviluppo coincidono, ed è esattamente per questo che l'errore non si vede.** Un sito
che componesse gli URL delle immagini con il prefisso dell'API funzionerebbe alla perfezione
su questa macchina e spedirebbe in produzione un `<img>` per ogni foto che punta all'host
*interno* del backend, irraggiungibile da chi visita il sito.

Per questo `npm run dev` stampa un avviso quando i due valori sono uguali. Non è una guardia
— è lecito che coincidano — è una diagnosi che compare da sé nel punto in cui il guasto è per
definizione invisibile. Per provarli distinti, dai alla seconda l'IP di rete della macchina:

```bash
PUBLIC_MEDIA_ORIGINE=https://192.168.1.42:4000 npm run dev
```

## Perché `npm run dev` non è `astro dev`

Per una ragione sola: `NODE_EXTRA_CA_CERTS` deve stare nell'ambiente **prima** che Node
parta. Node la legge all'avvio del processo, prima che Astro carichi qualunque `.env` —
scriverla lì produce un file che sembra configurato e un `fetch failed` senza causa.
`scripts/dev.mjs` la imposta nel processo padre, e il figlio la eredita quando parte.

🔴 **Mai `NODE_TLS_REJECT_UNAUTHORIZED=0`**, in nessuna forma e in nessun file. È globale al
processo: spegne la verifica per *ogni* connessione TLS, e si copia-incolla fra macchine
finché non finisce in un compose di produzione. `NODE_EXTRA_CA_CERTS` **aggiunge**
un'autorità invece di togliere una difesa. Un test in `test/` pretende zero occorrenze della
variabile vietata nei sorgenti, e sa fallire: è stato verificato per mutazione.

## Se il certificato dà problemi

Esiste una via d'uscita già nel repository — il backend ha un profilo `http` sulla stessa
porta:

```bash
cd backend && dotnet run --launch-profile http
# e in sito/.env:  API_INTERNA_URL=http://localhost:4000
```

⚠️ **Il costo, da sapere prima e non dopo**: il refresh token dell'amministratore è un cookie
`Secure=true`, quindi in questa modalità **l'app di cassa non fa più login**. È una sessione
"solo vetrina" per sbloccarsi, non una configurazione alternativa permanente.

## Come si prova «il backend è giù» senza spegnere quello di sviluppo

È la domanda che si ripresenta ogni volta, e la risposta è che **non si spegne** quello su
`:4000`. Ci sono due modi, e servono a cose diverse.

**(a) Puntare l'API su una porta libera.** Nessun ascoltatore produce lo stesso esito `rete`
di un backend spento, è deterministico e non tocca niente. È quello che usano i test.

```bash
API_INTERNA_URL=http://127.0.0.1:49999 npm run build && npm run start:prova
```

**(b) Una seconda istanza, e si spegne quella.** Serve per la transizione *su → giù → su*,
che il modo (a) non può riprodurre:

```bash
cd backend
ASPNETCORE_URLS=https://localhost:4012 SEED_ON_STARTUP=false \
  ASPNETCORE_ENVIRONMENT=Development dotnet run --no-build --no-launch-profile
```

⚠️ **`--no-build` non è opzionale**: l'istanza su `:4000` tiene bloccata `bin/`, e senza quel
flag la seconda muore provando a copiarci sopra l'eseguibile.

⚠️ E il sito va **ricostruito** puntando a `4012`: `API_INTERNA_URL` è una variabile di
**build**, non di runtime (vedi sopra).

## Cosa succede quando il backend non risponde

| | `/` | `/menu` |
|---|---|---|
| **Codice** | `200` | `503` con `Retry-After: 120` |
| **Cache** | `no-store` | `no-store` |
| **Cosa resta** | marca, insegna, slogan — asset **locali**, quindi contenuto vero | un avviso leggibile |

🔴 Le due scelte hanno ragioni **diverse**, e non è una simmetria da imporre. `/` è l'URL che
la gente digita e che i motori tengono in indice, e la sua pagina degradata ha ancora
qualcosa da dire. `/menu` esiste per un dato: una pagina `200` senza prodotti sarebbe **un
menu vuoto indicizzabile**.

🔴 `no-store` su ogni risposta degradata: senza, il micro-cache congelerebbe la pagina rotta
per sessanta secondi **dopo** che il backend è tornato su — il guasto durerebbe più del
guasto.

Chi guarda il sito vede meno; **chi guarda i log sa perché**: ogni assenza lascia una riga
sullo stdout con il motivo (`rete`, `timeout`, `http`, `formato`) e l'URL.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Dev server su `:4321`, con la CA e l'avviso dei prefissi |
| `npm run build` | Build di produzione (`dist/`, adapter Node standalone) |
| `npm run start:prova` | Avvia il bundle costruito, con la stessa CA e lo stesso avviso |
| `npm test` | I test, con `node:test` del runtime — nessuna dipendenza di test |
| `npm run check` | Controllo dei tipi, `.astro` compresi |

## Le cinque verifiche che restano manuali

🔴 **Non sono un elenco di buoni propositi: se non hanno un modo di essere eseguite, verranno
dichiarate fatte per somiglianza** — che è il modo in cui un criterio di successo smette di
significare qualcosa. Ognuna qui sotto ha il comando che la esegue.

L'automazione dell'audit e della regressione visiva è **Fase 7 del progetto**: qui non entra
alcun automatore di browser, alcun motore di audit e alcun DOM simulato — sarebbero tre
dipendenze pesanti esercitate da nessuno. Gli script di prova vivono **fuori** da `sito/`, in
`openspec/changes/vetrina-sito-astro/prove/`, e importano Playwright da `duedgusto/` per
percorso esplicito.

Si eseguono contro il **bundle costruito**, non contro il dev server: i due falliscono in modi
diversi, e in produzione va il secondo.

```bash
cd sito && npm run build
PORT=4399 NODE_EXTRA_CA_CERTS=../backend/.certs/aspnet-dev.pem node dist/server/entry.mjs

cd ../openspec/changes/vetrina-sito-astro/prove
node 12-verifiche-di-browser.mjs     # 1, 2, 3 e il logo
node 5.8-richieste-font.mjs          # 5
node 8.6-menu-contro-api.mjs         # 4
```

| # | Verifica | Come si esegue | Cosa la fa fallire |
|---|---|---|---|
| 1 | **Assenza di FOUC** | `12-verifiche-di-browser.mjs` — dieci hard reload per ognuno dei tre stati del selettore, con **cache disattivata** e **rete rallentata**, campionando il fondo ogni 50 ms nei primi 400 | 🔴 **un solo** lampo chiaro all'apertura in registro sera. Non «quasi mai», non «solo la prima volta» |
| 2 | **Misura del contrasto** | Idem — calcola il rapporto WCAG di ogni nodo di testo risalendo allo sfondo effettivo, su **entrambe** le pagine e **entrambi** i registri | una coppia sotto 4.5:1 (3:1 per il testo grande), o un testo che risolve al colore dell'arancio |
| 3 | **Indipendenza dal fuso** | Idem — quattro fusi (`Europe/Rome`, `America/Los_Angeles`, `Asia/Tokyo`, `Pacific/Kiritimati`) | il registro che cambia con il fuso del visitatore: significherebbe che si legge l'orologio locale invece di quello di Roma |
| 4 | **Immagini che caricano davvero** | `8.6-menu-contro-api.mjs` — confronta la pagina con la risposta dell'API prodotto per prodotto, e legge lo **stato di rete** di ogni immagine | un `404`, che a colpo d'occhio somiglia a «non è ancora stata caricata» |
| 5 | **Zero richieste ai CDN dei font** | `5.8-richieste-font.mjs` — filtra le richieste per `resourceType === 'font'` e ne stampa gli host | una sola richiesta verso `fonts.gstatic.com` o `fonts.googleapis.com` |

⚠️ **Le verifiche 2 e 3 vanno fatte sullo stato stabile.** Il selettore del tema ha
`transition-colors`: misurando subito dopo il cambio di registro si legge un colore **a metà
strada** fra i due, e il contrasto risulta fuori soglia senza che nulla sia rotto. Lo script
attende 600 ms; se lo si rifà a mano, aspettare.

⚠️ Il dev server di Astro 7 **si sgancia quando l'output non è un terminale** — cioè sotto
`concurrently`, in uno script, in CI. `npm run dev` stampa l'indirizzo e **ritorna**, ma il
server resta vivo. Si ferma con `npx astro dev stop`, si ispeziona con `npx astro dev status`
e `npx astro dev logs`.

⚠️ **Conseguenza da conoscere**: se resta un server orfano su `:4321`, il successivo **non
fallisce** — Astro prende la porta libera dopo (`4322`, poi `4323`…) e lo dice in una riga che
è facile non leggere. Il sintomo è che le modifiche «non si vedono», perché il browser sta
guardando il server vecchio. `npx astro dev status` risponde in un secondo.
