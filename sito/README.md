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

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Dev server su `:4321`, con la CA e l'avviso dei prefissi |
| `npm run build` | Build di produzione (`dist/`, adapter Node standalone) |
| `npm run start:prova` | Avvia il bundle costruito, con la stessa CA e lo stesso avviso |
| `npm test` | I test, con `node:test` del runtime — nessuna dipendenza di test |
| `npm run check` | Controllo dei tipi, `.astro` compresi |

⚠️ Il dev server di Astro 7 **si sgancia dal terminale**: `npm run dev` stampa l'indirizzo e
ritorna. Si ferma con `npx astro dev stop`, si ispeziona con `npx astro dev status` e
`npx astro dev logs`.
