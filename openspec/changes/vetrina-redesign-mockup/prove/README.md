# Le prove del redesign

**57 verifiche, 0 fallite** — eseguite il 13 agosto 2026 contro il **bundle costruito**, non
contro il dev server. L'esito integrale è in [`esito.txt`](./esito.txt); le schermate sono le
`.png` di questa cartella.

## Come si rieseguono

Servono tre processi, e vanno avviati in quest'ordine. ⚠️ **Il backend di sviluppo su `:4000`
non va bene**: se gira da prima di questo change il suo `/api/public/site` non ha i campi
editoriali, il sito nasce **degradato**, e le prove misurano una pagina che non è quella vera.

```bash
# 1. Un backend con il codice di questo change, su una porta sua.
cd backend
dotnet build duedgusto.csproj -o /tmp/build-vetrina
ASPNETCORE_URLS=https://localhost:4012 SEED_ON_STARTUP=false ASPNETCORE_ENVIRONMENT=Development \
  dotnet /tmp/build-vetrina/duedgusto.dll

# 2. Il sito, COSTRUITO contro quella porta — API_INTERNA_URL è una variabile di BUILD.
cd ../sito
API_INTERNA_URL=https://localhost:4012 npx astro build
PORT=4399 HOST=127.0.0.1 NODE_EXTRA_CA_CERTS=../backend/.certs/aspnet-dev.pem \
  node dist/server/entry.mjs

# 3. Le prove.
cd ..
node openspec/changes/vetrina-redesign-mockup/prove/verifiche-di-browser.mjs
```

⚠️ Su Windows `pkill` **non ferma** i processi Node: un server rimasto su `:4399` da una
sessione precedente continua a rispondere `200` servendo la build vecchia, e le prove
misurano quella. Il sintomo è che le correzioni «non hanno effetto». Si ferma così:

```powershell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 4399 -State Listen).OwningProcess -Force
```

## Cosa copre

| # | Verifica | Cosa la fa fallire |
|---|---|---|
| 1 | **Assenza di FOUC** — 10 hard reload per ognuno dei tre stati, cache disattivata e rete a 400 kbps, campionando il fondo ogni 50 ms nei primi 400 | 🔴 **un solo** lampo chiaro all'apertura in registro sera. Non «quasi mai» |
| 2 | **Contrasto WCAG** su ogni nodo di testo, risalendo allo sfondo effettivo — **5 pagine × 2 registri × 2 larghezze** (1100 px e 390 px) | una coppia sotto 4.5:1 (3:1 per il testo grande), o un testo nell'arancio di marca in un sottoalbero *giorno* |
| 3 | **La comparsa allo scorrimento** — le sezioni restano visibili dopo che l'osservatore ha fatto il suo giro | una sezione ferma a `opacity: 0`: il contenuto c'è, l'HTML è perfetto, i test unitari sono verdi e il sito è mezzo bianco |
| 4 | **La barra fissa non copre il piè di pagina** a 390 px | il riempimento in fondo al corpo tolto o insufficiente |
| 5 | **Indipendenza dal fuso** — quattro fusi, da Roma a Kiritimati | il registro che cambia con l'orologio del visitatore invece che con quello di Roma |
| 6 | **Il selettore a tre stati** — tre clic, tre reload, `localStorage`, `data-tema`, `data-scelta`, etichetta, e **una sola icona visibile** | il terzo stato perso (il mockup ne ha due), o l'icona scelta dallo script invece che dal CSS |
| 7 | **Nessuna freccia `→` come carattere** in nessuna pagina | U+2192 è **fuori** dal subset latino dei nostri caratteri: verrebbe dal ripiego di sistema |
| 8 | **Zero richieste ai CDN dei caratteri**, su tutte e cinque le pagine | una sola richiesta verso `fonts.gstatic.com` o `fonts.googleapis.com` |

## Le quattro cose che questa prova ha trovato

Tre erano difetti del **misuratore**, e vale la pena scriverlo: un misuratore sbagliato non
dà un errore, dà un numero — e un numero convincente manda a correggere la cosa sbagliata.

1. 🔴 **Il contrasto era un difetto vero, e la causa era l'intestazione translucida.**
   `bg-sfondo/85` produce `color-mix(in oklab, …)`, che il browser riporta come
   `oklab(0.968 0.0012 0.0073 / 0.85)`. Lo script leggeva «i primi tre numeri» come
   componenti RGB — cioè un nero quasi perfetto — e stampava **3.72 identico su ogni
   pagina**. Sembrava un difetto uniforme e reale.
   La correzione è doppia: lo script ora accetta **solo** `rgb()`/`rgba()` e dichiara
   «NON MISURABILE» invece di inventare; e l'intestazione è tornata **opaca**, che è ciò che
   fa il mockup di riferimento — sotto una barra translucida il contrasto dipende da cosa ci
   scorre sotto, cioè non è verificabile una volta per tutte.

2. **L'arancio di marca risultava «testo in giorno» in due punti**: il prezzo della lavagna e
   l'occhiello dell'eroe dell'aperitivo. Erano corretti: vivono in sottoalberi
   `data-tema="sera"`, dove l'arancio pieno fa **7.53**. Il controllo guardava il registro
   della *pagina* invece che del *sottoalbero*, e la reazione naturale a quella segnalazione
   sarebbe stata spegnere proprio la cosa che funziona.

3. **«L'ultima riga del piè di pagina è coperta dalla barra fissa», di 1305 px.** Non era
   coperta: `html { scroll-behavior: smooth }` — aggiunto da questo change — rende `scrollTo`
   animato, e la misura arrivava mentre la pagina era a un terzo del percorso. Con
   `behavior: 'instant'` la riga sta **62 px sopra** la barra.

4. **Le schermate a pagina intera erano bianche sotto la piega.** `fullPage: true` cattura
   ridimensionando il viewport, non scorrendo: l'`IntersectionObserver` non scattava e le
   sezioni restavano a `opacity: 0`. La prima lettura di quelle immagini è stata «mancano
   metà delle sezioni del sito». Ora la prova scorre la pagina prima di catturare — **e
   verifica che dopo lo scorrimento non resti nulla di invisibile**, che è il guasto vero da
   cui quella confusione proteggeva per caso.

## Nota sulle immagini nelle schermate

I rettangoli verdi e il logo bianco non sono difetti: sono i **media di prova** del database
di sviluppo (`prova-cartella-xxuvbm` e simili, generati dalle prove E2E di fasi precedenti).
In produzione ci sono le foto vere.

## ⚠️ Il percorso di import di Playwright

Lo script importa Playwright da `duedgusto/node_modules` per percorso esplicito, con quattro
`../` — prove → change → changes → openspec → radice. **Archiviando il change quel conto non
torna più**: le copie archiviate delle prove di `vetrina-sito-astro` stanno una cartella più
in fondo e non ripartono senza correggere quella riga. Chi archivia questo change deve
aggiungere un `../`.
