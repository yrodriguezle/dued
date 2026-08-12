# Prove del change `vetrina-sito-astro`

Le prove 🧪 che **nessun test rieseguirà**: quelle che hanno bisogno di un browser, e quelle
distruttive che dopo l'apply non si ripetono nelle stesse condizioni. Ogni file inizia col
numero del task che lo motiva.

Gli script si eseguono con Node dalla cartella `prove/`, e prendono l'indirizzo come primo
argomento (default `http://localhost:4321/`):

```bash
cd openspec/changes/vetrina-sito-astro/prove
node 5.8-richieste-font.mjs
```

⚠️ **Playwright arriva da `duedgusto/node_modules/` per percorso esplicito**, e non è
installato in `sito/`: il criterio 12.12 pretende che `sito/package.json` non contenga alcun
automatore di browser, e `duedgusto/` non si tocca. Playwright è **CommonJS**: l'import
nominato fallisce, serve il `default` e poi la destrutturazione.

| # | Prova | Cosa mostra | Esito |
|---|---|---|---|
| 5.8 | [`5.8-richieste-font.mjs`](./5.8-richieste-font.mjs) | Le richieste di carattere del browser vero, con il loro host | ✅ **una sola** richiesta, `localhost:4321/_astro/Anton-latin.Byf51wtH.woff2`; **zero** verso domini Google. Allura e Playfair non partono, perché la pagina non li usa ancora |
| 5.8 | [`5.8-pagina-con-anton.png`](./5.8-pagina-con-anton.png) | La pagina con Anton applicato | — |
| 6.4–6.6 | [`6.5-tema-e-badge.mjs`](./6.5-tema-e-badge.mjs) | L'altra metà della prova di identità: ciò che nell'HTML **non** c'è, nel browser **c'è** | ✅ all'apertura `data-tema="giorno"`, etichetta «Auto», badge «Aperto ora» **svelato**; il toggle gira `giorno → sera → auto`; la scelta sopravvive al reload; `data-pronto` compare dopo il primo frame |
| 6.4–6.6 | `6.5-auto.png`, [`6.5-giorno.png`](./6.5-giorno.png), [`6.5-sera.png`](./6.5-sera.png) | I due registri sulla stessa pagina | — |
| 12.6 (in anticipo) | la stessa prova | Il contesto ha `timezoneId: 'America/Los_Angeles'` — nove ore indietro | ✅ il registro segue **l'ora di Roma**: alle 12:42 italiane il tema automatico è `giorno`, benché a Los Angeles sia notte |
| 7.8 | [`7.8-immagini-e-logo.mjs`](./7.8-immagini-e-logo.mjs) | Due media **reali** della cartella `galleria` e il logo, nei due registri | ✅ entrambe le immagini **200** (`400.webp`, scelto dal ramo WebP di `<picture>`); il logo è `<svg>` nel DOM e gli `<img>` per il logo sono **zero**; `currentColor` calcolato passa da `rgb(2,3,2)` a `rgb(242,237,231)` cambiando registro |
| 7.8 | [`7.8-giorno.png`](./7.8-giorno.png), [`7.8-sera.png`](./7.8-sera.png) | Il logo su crema e su lavagna | ✅ leggibile su entrambi i fondi — è il guasto che un `<img src={logo}>` produrrebbe, e non produce |
| 🎯 8.6 | [`8.6-menu-contro-api.mjs`](./8.6-menu-contro-api.mjs) | **Il deliverable**: ogni prodotto dell'API cercato in pagina con nome, prezzo, descrizione, allergeni, marcatori e stato di rete della sua immagine | ✅ **0 differenze** su 3 prodotti e 3 categorie; entrambe le immagini `200`; `Mojito cubano` a **`0,00 €`** — l'omaggio si stampa |
| 🎯 8.6 | [`8.6-menu-giorno.png`](./8.6-menu-giorno.png), [`8.6-menu-sera.png`](./8.6-menu-sera.png) | Il menu reale nei due registri | — |
| 8.9 | [`8.9-due-prefissi-diversi.mjs`](./8.9-due-prefissi-diversi.mjs) | Prova B: `API_INTERNA_URL` su `localhost`, `PUBLIC_MEDIA_ORIGINE` sull'IP di rete | ✅ la pagina si renderizza (il **server** ha letto) **e** le immagini caricano `200` da `192.168.1.232` (il **browser** ha letto, da un altro host); `naturalWidth` 320 e non 0; il markup non nomina mai `localhost:4000` |
| 8.9 | [`8.9-due-prefissi-diversi.png`](./8.9-due-prefissi-diversi.png) | La stessa pagina con le due origini divergenti | — |
| 🔴 9.3 | [`9.3-fascia-sera-in-tema-giorno.mjs`](./9.3-fascia-sera-in-tema-giorno.mjs) | La fascia «Aperitivo» misurata con `getComputedStyle` nei due registri | ✅ in **tema giorno** il corpo è crema `rgb(242,237,231)` e la fascia è lavagna `rgb(37,28,25)` con il titolo in gesso giallo `rgb(253,219,91)`. È il caso che con `@theme` semplice sarebbe rimasto crema-e-oliva senza alcun errore |
| 🔴 9.3 | [`9.3-home-giorno.png`](./9.3-home-giorno.png), [`9.3-home-sera.png`](./9.3-home-sera.png) | La home intera nei due registri | — |
| 9.6 | [`9.6-consigliato-dai-dati-vivi.mjs`](./9.6-consigliato-dai-dati-vivi.mjs) | Un `consigliato` tolto e rimesso dall'amministrazione | ✅ «Caffè espresso» **presente → assente → presente**; i dieci campi vetrina tornano identici |
| 9.7 | [`9.7-orario-dai-dati-vivi.mjs`](./9.7-orario-dai-dati-vivi.mjs) | La chiusura cambiata sul periodo di programmazione | ✅ sito `07:00 – 20:00` → **`07:00 – 21:30`** → `07:00 – 20:00`, letto **in pagina**; il periodo torna identico |

⚠️ Le prove 9.6 e 9.7 si autenticano come **`e2e-admin`**, il SuperAdmin che il seed crea solo in
Development per l'end-to-end, e variano `X-Forwarded-For` a ogni signin: il rate limit è di 5
tentativi ogni 15 minuti per IP, e quando scatta il sintomo è un `429` seguito da «Access denied»
su ogni query GraphQL — che si legge come un problema di permessi.
