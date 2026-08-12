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
