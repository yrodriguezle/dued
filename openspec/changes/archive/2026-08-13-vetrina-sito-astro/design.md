# Design: progetto Astro, design system e due pagine vive (vetrina-sito-astro)

> Fase 2 di 8 del progetto "Sito vetrina 2D Gusto", **seconda metà** — il solo sito pubblico.
> Proposal di riferimento: [proposal.md](./proposal.md), in particolare le **sei decisioni aperte**,
> che questo documento chiude in §D1 (versioni), §D2 (i due prefissi), §D3 (HTTPS self-signed),
> §D4 (degradazione), §D6 (`@theme inline`), §D9 (Playfair ×1.55) e §D10 (Anton solo Regular).
> Change precedente: [`vetrina-api-pubblica/design.md`](../vetrina-api-pubblica/design.md) — se ne
> eredita la dottrina della **superficie chiusa per costruzione** (§D2 di quel documento), il
> **contratto di header di cache** (§D4) e l'idioma del **test che legge i sorgenti** (§D1).
> Piano approvato: `~/.claude/plans/chiedevo-una-pianificazione-del-immutable-stream.md`, §1, §6, §11.

---

## Technical Approach

Il change consegna **un progetto e due pagine**, ma la parte difficile non è nessuna delle due: è
che quattro classi di errore di questo change sono **invisibili sulla macchina di chi sviluppa** e
diventano visibili solo dopo il go-live o solo per metà dei visitatori.

| Errore | Dove si vede in sviluppo | Dove si vede davvero |
|---|---|---|
| Un prefisso solo invece di due | **Mai**: i due valori coincidono | Ogni `<img>` del sito, in produzione |
| Tema calcolato server-side | **Mai**: un visitatore alla volta | Micro-cache di Fase 6, metà visitatori |
| `@theme` invece di `@theme inline` | **Mai**: alla radice i due sono identici | Il primo sottoalbero con un tema proprio |
| Arancio su testo, tema giorno | **Mai**: si legge benissimo, è solo 2.11 | L'audit di accessibilità, o mai |

Da qui l'unico principio che governa il documento, ed è lo stesso del change precedente applicato a
un dominio diverso:

> **Non basta che il codice sia giusto: deve esistere una configurazione in cui quello sbagliato
> fallisce.** Ogni volta che una decisione poteva chiudersi con "ricordarsi di", il design sceglie
> la forma in cui la cosa sbagliata **non si può scrivere** (l'utility non esiste, §D7), oppure
> **si annuncia da sola** (l'avviso allo start quando i due prefissi coincidono, §D2), oppure
> **rompe un test che legge i sorgenti** (§D14).

Quattro pezzi, in ordine obbligato, ognuno verificabile da solo:

1. **Il progetto e le versioni** (§D1, §D3): `sito/` esiste, `npm install` completa o **fallisce
   dicendo perché**, e una `fetch` verso il backend di sviluppo funziona **senza disattivare TLS**.
2. **Il confine dei due prefissi** (§D2): due moduli virtuali, due file, tre prove.
3. **Il design system** (§D5, §D6, §D7, §D8, §D9, §D10, §D11): due temi client-side, token che
   seguono il tema anche in un sottoalbero, arancio che non può portare testo, tre font locali.
4. **Le due pagine** (§D4, §D12, §D13): dati veri, immagini vere, e una degradazione **dichiarata**
   quando il backend non risponde.

**Dodici decisioni divergono** dalla lettera della proposal o del piano. Sono dichiarate, non
nascoste, e riassunte nella tabella finale.

---

## Architecture Decisions

### D1 🔴 — Astro **7.2.1** pinnato su Node ≥ 22.12, e `engine-strict` che fa fallire l'installazione invece di rimandare l'errore

**Chiude la decisione aperta n. 1 della proposal.**

**La decisione dell'utente**, presa fuori da questo documento e non ridiscussa: **Astro 7 con Node
22 LTS**. La CI è già su Node 22 ([`.github/workflows/deploy.yml:53`](../../../.github/workflows/deploy.yml)),
il `node:22-alpine` del Dockerfile di Fase 6 soddisferà il vincolo, ed è la macchina locale
(`v20.19.0`) a essere indietro: l'aggiornamento è in corso in parallelo.

🔴 **Il vincolo di runtime è identico fra la 6 e la 7, ed è la ragione per cui la 7 non costa
niente.** Verificato su npm: `astro@7.2.1` dichiara `engines.node: ">=22.12.0"` e `astro@6.4.8`
dichiara **esattamente lo stesso**. Aggiornando Node — che va aggiornato comunque — la scelta fra le
due generazioni non ha più un prezzo di runtime, e resta solo l'argomento che aveva già escluso
Astro 5: **non nascere su un major da migrare**. Un progetto nuovo che parte un major indietro nasce
con un debito che nessuno ha contratto.

| | Verificato oggi |
|---|---|
| `astro` corrente | **`7.2.1`**, `engines.node: ">=22.12.0"` |
| `astro` più recente della 6 | `6.4.8`, `engines.node: ">=22.12.0"` ← **lo stesso vincolo** |
| `@astrojs/node` corrente | **`11.1.1`**, `peerDependencies: { astro: "^7.0.0" }` |
| `@astrojs/node` per Astro 6 | `10.1.4`, `peer: { astro: "^6.3.0" }` ← ⚠️ incompatibile con la 7 |
| Vite che Astro 7 si porta dietro | **`^8.0.13`** (la 6 si fermava a Vite 7) |
| `@tailwindcss/vite` corrente | `4.3.3`, `peer: { vite: "^5.2.0 \|\| ^6 \|\| ^7 \|\| ^8" }` ✅ |
| 🔴 `@tailwindcss/vite@4.2.1` — la versione di `duedgusto` | `peer: { vite: "^5.2.0 \|\| ^6 \|\| ^7" }` — **niente Vite 8** |
| Prima versione con Vite 8 | **`4.2.2`** |

🔴 **L'unica conseguenza reale del major, e non è quella che ci si aspetta.** Non è l'adapter (basta
prendere l'`11.x` invece del `10.x`): è **Tailwind**. Astro 7 gira su **Vite 8**, e
`@tailwindcss/vite@4.2.1` — la versione letterale dichiarata da
[`duedgusto/package.json`](../../../duedgusto/package.json) — **non lo supporta**. Il range
`^4.2.1` risolverebbe comunque a `4.3.3`, che va bene, ma dichiarerebbe una compatibilità che il suo
estremo inferiore non ha: il giorno in cui un lockfile o un `npm install --prefer-offline`
inchiodasse `4.2.1`, il guasto sarebbe un errore di peer dependency di Vite che nessuno collegherà
a questa riga. Il floor di `sito/` è **`^4.2.2`**, il minimo che *garantisce* Vite 8.

⚠️ **E la simmetria con `duedgusto` si rompe qui, al primo giorno.** La proposal accettava la
trappola §11.11 (*"tre `package.json` senza workspaces: i lockfile divergeranno"*) come una
previsione; questa è la previsione che si avvera subito e con una causa precisa — `duedgusto` gira
su Vite 6 e non ha alcun motivo di alzare il floor, `sito/` gira su Vite 8 e deve. **Stesso
pacchetto, due minimi diversi, per due ragioni entrambe corrette.** Va scritto nel commento, perché
il prossimo che allineerà "le versioni di Tailwind del monorepo" abbassando quella di `sito/`
romperebbe la build senza capire perché.

**Choice.**

```jsonc
// sito/package.json
{
  "name": "sito",
  "private": true,
  "type": "module",
  // 🔴 La versione di Node è un vincolo, non un consiglio: senza .npmrc questo campo è
  //    decorativo e npm installa lo stesso su Node 20, per fallire più tardi e altrove.
  "engines": { "node": ">=22.12.0" },
  "dependencies": {
    // ~ e non ^: le patch entrano, il minor no. Un minor di Astro può cambiare il
    // comportamento del dev server o dell'adapter, e qui non c'è ancora una suite di
    // regressione visiva a raccogliere il pezzo (è Fase 7).
    "astro": "~7.2.1",
    // 🔴 L'11 è l'adapter DELLA 7: peer `astro ^7.0.0`. Il 10.x è quello della 6 e non
    //    si installa insieme alla 7 — è il primo errore che si incontra copiando una
    //    configurazione trovata in giro, perché la maggior parte è ancora della 6.
    "@astrojs/node": "~11.1.1",
    // 🔴 ^4.2.2 e NON ^4.2.1 come duedgusto: Astro 7 gira su Vite 8, e 4.2.1 dichiara
    //    peer `vite ^5.2.0 || ^6 || ^7` — senza Vite 8. 4.2.2 è la prima che lo aggiunge.
    //    Chi "riallinea le versioni di Tailwind del monorepo" abbassando questo floor
    //    rompe la build: duedgusto è su Vite 6 e non ha lo stesso vincolo.
    "tailwindcss": "^4.2.2",
    "@tailwindcss/vite": "^4.2.2"
  }
}
```

```ini
# sito/.npmrc
# 🔴 Senza questa riga "engines" è advisory: npm avvisa e installa. È la differenza fra
#    "npm install fallisce dicendo che serve Node 22.12" e "npm install riesce, poi
#    `astro dev` esplode con un errore di sintassi in un file di node_modules".
engine-strict=true
```

```
22
```
```
# sito/.nvmrc — perché "quale Node" sia una domanda con risposta nel repository
```

```js
// sito/astro.config.mjs
import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: true, port: 4321 },
  vite: { plugins: [tailwindcss()] },
  env: { schema: { /* §D2 */ } },
});
```

**Cosa NON entra**, e la ragione è la stessa per tutte:

| Assente | Perché |
|---|---|
| `site: 'https://…'` | Il dominio non esiste. Un valore inventato oggi produrrebbe canonical e OG che puntano a un host inesistente — vedi §D11 per come si ottiene l'origine assoluta senza. Fase 3/6 |
| `integrations: [react()]` | Nessuna isola in questo change (§Out of Scope). Una dipendenza installata e non usata è una dipendenza che nessuno verifica |
| `integrations: [sitemap()]` | Ha bisogno di `site`, e la SEO è Fase 3 |
| `export const prerender` | Con `output: 'server'` l'on-demand è già il default: entrambe le pagine leggono dati vivi. La direttiva nasce con la prima pagina statica (`/privacy`, `/404`), che è Fase 3 |
| `routeRules` (stabile nella 7) | Vedi §"Cosa la 7 mette a disposizione" sotto: la cache di questo sito è **condizionale** e `routeRules` è statica per rotta |
| `cache: { provider: memoryCache() }` (stabile nella 7) | Idem: duplicherebbe il micro-cache di Fase 6 in un processo che il deploy riavvia |
| `logger: logHandlers.json(…)` (stabile nella 7) | Candidato **di Fase 6**, quando i log saranno quelli di un container e non di un terminale |

**Alternatives considered.**
- *`npm create astro@latest`*: installerebbe **la versione corrente al momento del comando**, che
  oggi è la 7.2.1 e domani non si sa. Il progetto si crea a mano — sono otto file — perché il
  template porta comunque pagine e stili di esempio che nessuno rimuove mai del tutto, e perché il
  criterio di successo chiede una versione **dichiarata**, non ereditata da un comando.
- *`^7.2.1` invece di `~7.2.1`*: il caret ferma comunque prima della 8, quindi tecnicamente
  sufficiente. Rifiutato perché lascia entrare i minor, e un minor di Astro può cambiare il
  comportamento del dev server o dell'adapter: qui non c'è ancora una suite di regressione visiva a
  raccogliere il pezzo (è Fase 7).
- *Pin esatto (`7.2.1`, senza tilde)*: escluderebbe anche le patch di sicurezza, che vanno prese.
- *Astro 6 (`~6.4.8` + `@astrojs/node ~10.1.4`)*: era la scelta precedente di questo documento, e
  regge tecnicamente — la configurazione è **identica** e il vincolo di Node **è lo stesso**.
  Rifiutata perché il suo unico vantaggio (maturità di qualche mese) si paga con un major di
  migrazione già dovuto il giorno della nascita del progetto — che è esattamente l'argomento con
  cui la proposal aveva scartato Astro 5.
- *Astro 5 su Node 20* (decisione aperta n. 1 della proposal): eviterebbe l'aggiornamento di Node,
  che però va fatto comunque — la CI è già su Node 22 e il Dockerfile di Fase 6 la userà.

**Rationale.** Il criterio di successo della proposal — *"la versione di Astro e quella di Node sono
dichiarate, non implicite"* — non si soddisfa scrivendo un numero in `engines`: si soddisfa quando
la macchina sbagliata **si rifiuta di installare**. `.npmrc` con `engine-strict` è la riga che
trasforma una dichiarazione in un vincolo, e costa cinque caratteri.

#### 🔴 Cosa la 7 cambia per le altre tredici decisioni — riverificato, non assunto

Il passaggio dalla 6 alla 7 è stato riverificato sulla **guida di migrazione v6 → v7** e sulla
documentazione corrente. Le tredici decisioni restanti **reggono tutte**, e tre punti della guida le
sfiorano abbastanza da meritare una riga qui invece di una scoperta in apply.

⚠️ **Nota su come sono state fatte le verifiche, perché cambia quanto valgono.** Le quattro API su
cui poggia questo design — `astro:env` con `envField` e i moduli `astro:env/server` /
`astro:env/client` (§D2), `output: 'server'` e `export const prerender` (§D1), `define:vars` +
`is:inline` (§D5), l'adapter Node `mode: 'standalone'` con `HOST`/`PORT` ed `entry.mjs` (§D1) —
erano già state verificate sulla **documentazione corrente**, che descrive la **7**, non la 6.
Valgono quindi per la 7 **per costruzione**, non per estensione; e la guida v6 → v7 non nomina
nessuna delle quattro fra i cambiamenti rompenti. In particolare
**`define:vars` implica ancora `is:inline`** e i due moduli virtuali di `astro:env` sono ancora due.

| Cambiamento della 7 | Tocca | Esito |
|---|---|---|
| **Vite 8** | §D1 | 🔴 **Sì**: il floor di `@tailwindcss/vite` sale a `^4.2.2` (sopra). Nient'altro |
| **Compilatore Rust unico, più severo sull'HTML non valido** — i tag non chiusi ora sono **errori**, l'HTML semanticamente invalido non viene più auto-corretto | §D11, §D12 | ⚠️ Nessuna decisione cambia, ma `<source …/>` e `<link …/>` di §D8/§D12 vanno scritti **auto-chiusi** o il build fallisce. È un miglioramento: prima l'errore era silenzioso. `set:html` di §D11 non è toccato — l'SVG è una stringa di runtime, non markup compilato |
| **`compressHTML: 'jsx'` è il nuovo default** (era `true`) | §D2, §D5 | ⚠️ Nessuna decisione cambia: la compressione è **deterministica**, quindi l'identità byte per byte regge. Ma le asserzioni di §D2 e §D5 devono restare **ricerche di sottostringa**, mai confronti su righe o indentazione |
| **`src/fetch.ts` è un nome riservato** (auto-importato per la configurazione di routing) | §D2 | ⚠️ `src/lib/api.ts` è al sicuro. Da sapere prima che a qualcuno venga in mente di "semplificare" spostandolo in `src/fetch.ts`, che diventerebbe un file di configurazione del router |
| Processore Markdown sostituito (Sätteri), `@astrojs/db` rimosso, internals di `astro:transitions` rimossi, `getContainerRenderer()` deprecato | — | Nessuno: questo change non ha Markdown, non ha database, non ha transizioni e non ha integrazioni UI |
| `queuedRendering` e `advancedRouting` ora di default | — | Nessuno: due pagine piatte, nessun routing avanzato |

**E cosa la 7 mette a disposizione che la 6 non aveva** — la domanda va posta esplicitamente, perché
una decisione presa contro un vincolo che è caduto è una decisione da rifare:

- 🔴 **`routeRules: { '/menu': { maxAge: 60, swr: 60 } }`** (uscito da `experimental`). È la forma
  dichiarativa dell'header di cache di **§D4**. **Non si adotta**, e la ragione è precisa: la cache
  di questo sito è **condizionale sullo stato** — `public, max-age=60` quando i dati ci sono,
  `no-store` quando la pagina è degradata — e `routeRules` è statica per rotta. Adottarla
  significherebbe **due posti** che scrivono `Cache-Control` sulla stessa risposta, con quello
  imperativo che deve sovrascrivere quello dichiarativo esattamente nei casi che contano. Un solo
  punto, in `Astro.response.headers`, come già scritto in §D4. *(In più `swr` reintrodurrebbe la
  `stale-while-revalidate` che il design precedente aveva scartato in §D4 per non avere due posti
  in cui la staleness è configurata.)*
- 🔴 **`cache: { provider: memoryCache() }` e `Astro.cache`** (uscito da `experimental`). È
  esattamente l'alternativa che **§D4 aveva scartato** come "cache in memoria nel processo Astro
  (ultima risposta buona)" — e nella 7 non è più da scrivere a mano, è API di piattaforma. **La
  decisione non cambia**, e i due motivi di §D4 reggono ancora: duplicherebbe ciò che Fase 6 farà
  con `proxy_cache_use_stale`, e vivrebbe in un processo che il deploy riavvia (cioè si svuota
  proprio quando servirebbe di più). **Ma il punto di uscita ora esiste ed è a costo quasi nullo**:
  se in Fase 6 il micro-cache nginx risultasse insufficiente — per esempio perché il backend cade
  più a lungo del TTL — `memoryCache()` è tre righe di configurazione, e questo è il posto in cui
  è scritto che sono tre righe.
- **`logger: logHandlers.json({ level: 'warn' })`** (uscito da `experimental`). Renderebbe
  strutturati i log **di Astro**; le righe di degradazione di §D4 sono applicative e resterebbero
  su `stdout` comunque. Candidato **di Fase 6**, dove i log diventano quelli di un container e
  qualcuno li aggrega — non oggi, dove sono un terminale che si guarda.

---

### D2 🔴 — I due prefissi: due moduli virtuali, due file, e un avviso che si accende dove i due coincidono

**Chiude la decisione aperta n. 2 della proposal.** È la trappola che
[`ImmaginePubblicaDto`](../../../backend/Controllers/Public/Dto/ImmaginePubblicaDto.cs) ha scritto
in anticipo, un change prima che esistesse il consumatore.

**Il vincolo, verificato nel codice e nella configurazione reale.**

| Prefisso | Chi lo usa | Sviluppo | Produzione (Fase 6) |
|---|---|---|---|
| **API** | il **server** Astro (`fetch` in frontmatter) | `https://localhost:4000` | `http://backend:5000` — nome della rete Docker |
| **Media** | il **browser**, dentro `src`/`srcset` | `https://localhost:4000` | `https://www.duedgusto.com` — l'host pubblico |

In sviluppo `/media/` lo serve .NET con `UseStaticFiles` **solo in Development**
([`Program.cs:305-331`](../../../backend/Program.cs)); in produzione lo serve nginx da
`/opt/duedgusto/media/` ([`deploy/nginx/duedgusto.conf:61`](../../../deploy/nginx/duedgusto.conf)).
I due prefissi coincidono **solo** in sviluppo, ed è l'unico ambiente in cui questo change viene
provato.

**Choice — tre strati, ognuno per un guasto diverso.**

**(1) Due moduli virtuali diversi, non due stringhe nello stesso oggetto.** Si usa `astro:env` e non
`import.meta.env`:

```js
// sito/astro.config.mjs
env: {
  schema: {
    // Il server, e solo il server. Chi tentasse di importarlo da astro:env/client
    // riceve un errore di build, non un undefined a runtime.
    API_INTERNA_URL: envField.string({ context: 'server', access: 'public' }),

    // Il browser. Il prefisso PUBLIC_ è tenuto DELIBERATAMENTE anche se lo schema
    // dichiara già il contesto: è la parola che si legge nel file .env, ed è lì che
    // qualcuno deciderà quale valore mettere.
    PUBLIC_MEDIA_ORIGINE: envField.string({ context: 'client', access: 'public' }),
  },
},
```

🔧 **Scoperta in apply il 2026-08-12, e riguarda il deploy: entrambe sono variabili di BUILD.**
`astro:env` inlina nel bundle ogni variabile con `access: 'public'`, **di qualunque contesto** —
quindi anche `API_INTERNA_URL`, che è di contesto *server*. Solo i `secret` restano letti a runtime
(*«Public server variables are in the server bundle»*, documentazione di Astro; misurato).
⚠️ Il modo in cui inganna: passare `API_INTERNA_URL` all'**ambiente** del server costruito non dà
errori e non ha alcun effetto — il sito continua a leggere l'origine con cui è stato costruito.
**Conseguenza per la Fase 6**: l'immagine del container va **costruita** con l'origine di
produzione, e la stessa immagine non si riusa fra ambienti passando una variabile. Se servisse,
`API_INTERNA_URL` andrebbe portata ad `access: 'secret'` con `getSecret()` — ma non è un segreto, e
finché il deploy costruisce per ambiente questa forma è più semplice e più verificabile.

⚠️ **I nomi non condividono un solo morfema**: `API` ≠ `MEDIA`, `INTERNA` ≠ `PUBLIC`, `URL` ≠
`ORIGINE`. Non è vezzo: `API_BASE_URL` e `MEDIA_BASE_URL` — la coppia che il design precedente
suggeriva in tabella (§D11) — differiscono per **una** parola in mezzo, e una copia-incolla
distratta le confonde. Qui non esiste una copia-incolla che produca l'altra.

**(2) Un file per prefisso, e un test che legge i sorgenti.** Idioma verbatim di
[`RegolaPubblicazioneUnicaTests`](../../../backend/DuedGusto.Tests/Unit/Common/RegolaPubblicazioneUnicaTests.cs):

```ts
// sito/src/lib/api.ts — L'UNICO file che importa astro:env/server.
import { API_INTERNA_URL } from 'astro:env/server';

// sito/src/lib/mediaUrl.ts — L'UNICO file che compone un URL di media.
import { PUBLIC_MEDIA_ORIGINE } from 'astro:env/client';

/**
 * 🔴 Stessa dottrina di duedgusto/src/components/pages/sito/mediaUrl.tsx, e
 *    deliberatamente NON lo stesso file: l'admin ha UN prefisso (è tutto browser),
 *    il sito ne ha DUE. Estrarre una utility comune imporrebbe al sito la forma che
 *    vale per l'admin, che è la forma sbagliata.
 */
export function mediaUrl(chiave: string, larghezza: number, formato: 'webp' | 'jpg' = 'webp') {
  return `${PUBLIC_MEDIA_ORIGINE}/media/${chiave}/${larghezza}.${formato}`;
}
```

```js
// sito/test/moduli.test.mjs
test('astro:env/server compare in un file solo', () => {
  assert.deepEqual(sorgentiCheContengono("astro:env/server"), ['src/lib/api.ts']);
});
test('la stringa "/media/" compare in un file solo', () => {
  assert.deepEqual(sorgentiCheContengono("/media/"), ['src/lib/mediaUrl.ts']);
});
```

**(3) 🔴 L'avviso che si accende dove i due coincidono — la risposta a "come si provano diversi in
sviluppo".** All'avvio del dev server e del server di prova, `sito/scripts/dev.mjs` confronta i due
valori:

```
⚠️  I due prefissi coincidono (https://localhost:4000).
    È lecito in sviluppo e sarà un guasto invisibile in produzione: ogni <img> del sito
    porterebbe l'host interno del backend. Per provarli distinti:
        PUBLIC_MEDIA_ORIGINE=https://192.168.1.42:4000 npm run dev
```

Non è una guardia, è **una diagnosi che compare da sé** nel punto in cui il problema è per
definizione invisibile. Chi sviluppa la legge ogni giorno, e la prima volta che la legge sa già cosa
significa.

**La prova che chiude il criterio, e la sua controprova.** Due, e servono entrambe:

| # | Prova | Cosa dimostra |
|---|---|---|
| **A** | `PUBLIC_MEDIA_ORIGINE=https://media.sentinella.invalid npm run build:prova`, poi `curl` su `/menu`: l'HTML contiene `media.sentinella.invalid` **e zero occorrenze** dell'host dell'API | Automatizzabile, deterministica, **senza rete** — è un'asserzione sul markup, non sul caricamento |
| **B** | `npm run dev` con `PUBLIC_MEDIA_ORIGINE` sull'IP di rete locale e `API_INTERNA_URL` su `localhost`: la pagina si renderizza **e le immagini caricano nel browser** | La prova umana: due valori diversi, entrambi funzionanti |

**Controprova richiesta dalla proposal**: con un prefisso solo, la prova A trova l'host dell'API nel
markup e fallisce — cioè si **dimostra** che una prova ingenua sarebbe passata lo stesso, ed è per
questo che serve quella con i due valori.

**Alternatives considered.**
- *`import.meta.env.API_BASE_URL` e `import.meta.env.PUBLIC_MEDIA_BASE_URL`* (la forma del design
  precedente): funziona, ma tutto vive nello stesso oggetto e nello stesso namespace. Un
  `import.meta.env.PUBLIC_MEDIA_BASE_URL` scritto in un file server-side è legale e silenzioso; con
  `astro:env` l'import sbagliato è un errore di build in una direzione, e nell'altra il file che
  potrebbe sbagliare è **uno solo e ha un test sopra**.
- *Un solo prefisso più un flag `MEDIA_SAME_ORIGIN=true`*: riduce le variabili a una e mezza e
  reintroduce esattamente il bug — in sviluppo il flag sarebbe `true` e nessuno proverebbe l'altro
  ramo.
- *Prefisso media **vuoto** in produzione (URL relative, `/media/…`)*: tecnicamente corretto —
  nginx serve `/media/` sullo stesso host della vetrina — ed è la forma più breve. **Rifiutata**
  per due motivi: (a) l'immagine Open Graph **deve** essere assoluta e con il prefisso vuoto non lo
  sarebbe; (b) con il valore vuoto i due prefissi tornano indistinguibili da un errore di
  configurazione (`""` è anche ciò che si ottiene dimenticando la variabile). Un'origine assoluta
  sempre, in tutti gli ambienti.
- *Comporre l'URL nel backend e mandarlo nel DTO*: è precisamente ciò che il DTO **rifiuta di
  fare**, con la sua motivazione scritta: una risposta cacheata 300 secondi che contenesse un
  hostname resterebbe sbagliata per cinque minuti dopo ogni cambio di dominio.

**Rationale.** Nessuno dei tre strati basta da solo. (1) protegge dall'import sbagliato, (2) dal
secondo posto in cui comporre un URL, (3) **dall'ambiente**, che è il guasto vero: il codice può
essere perfetto e la configurazione di prova può comunque non aver mai esercitato il caso.

---

### D3 🔴 — Il backend di sviluppo è HTTPS self-signed: `NODE_EXTRA_CA_CERTS`, mai `NODE_TLS_REJECT_UNAUTHORIZED`

**Il vincolo verificato.** [`launchSettings.json`](../../../backend/Properties/launchSettings.json)
ha due profili sulla **stessa porta 4000**: `http` su `http://0.0.0.0:4000` e `https` su
`https://0.0.0.0:4000`. La radice lancia il secondo
(`"dev:backend": "cd backend && dotnet run --launch-profile https"`), con il certificato di sviluppo
ASP.NET — che `fetch` di Node rifiuta con `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Non sono alternative
simultanee: la porta è una.

**Choice.** `NODE_EXTRA_CA_CERTS` che punta al certificato di sviluppo esportato in PEM.

```bash
cd backend
dotnet dev-certs https --export-path ./.certs/aspnet-dev.pem --format PEM --no-password
```

```
backend/.certs/       ← in .gitignore: è un certificato di macchina, non un artefatto del repo
```

⚠️ **`NODE_EXTRA_CA_CERTS` non funziona da un file `.env`.** Node lo legge **all'avvio del
processo**, prima che Astro carichi qualunque `.env`: scriverlo lì produce un file che sembra
configurato e un `fetch failed` senza causa. Deve stare nell'ambiente **prima** che Node parta —
ed è la ragione per cui `npm run dev` non invoca `astro dev` direttamente:

```js
// sito/scripts/dev.mjs — ~30 righe, zero dipendenze
// 1. risolve il percorso del PEM e, se manca, stampa il comando dotnet esatto invece di
//    lasciare che il primo fetch fallisca con "fetch failed" e nient'altro;
// 2. imposta process.env.NODE_EXTRA_CA_CERTS (il figlio lo eredita al proprio avvio);
// 3. 🔴 confronta i due prefissi e stampa l'avviso di §D2 se coincidono;
// 4. spawn di `astro dev` (o di `node dist/server/entry.mjs` per `start:prova`).
```

⚠️ **Il certificato di sviluppo ASP.NET ha `localhost` come solo SAN.** Quindi
`API_INTERNA_URL` deve essere **esattamente** `https://localhost:4000`: con
`https://127.0.0.1:4000` la verifica fallisce lo stesso, e sembrerebbe che la CA non funzioni.
Va scritto nel `.env.example`, accanto al valore.

**La via d'uscita, dichiarata e circoscritta.** Se il certificato dà problemi (rinnovo, macchina
nuova, WSL), esiste già un profilo `http` nel repository:

```bash
cd backend && dotnet run --launch-profile http    # API_INTERNA_URL=http://localhost:4000
```

⚠️ **Costo da sapere prima**: il refresh token dell'admin è un cookie `Secure=true`, quindi in
questa modalità **l'app di cassa non fa login**. È una sessione "solo vetrina", non una
configurazione alternativa permanente.

**Alternatives considered.**
- 🔴 *`NODE_TLS_REJECT_UNAUTHORIZED=0`*: **rifiutata senza riserve.** È globale al processo,
  disattiva la verifica per **ogni** connessione TLS, e vive in una variabile d'ambiente che si
  copia-incolla fra macchine e finisce in un `docker-compose` "per far partire la cosa".
  Il vincolo della proposal è letterale — *"mai disattivando la verifica in una configurazione che
  possa arrivare in produzione"* — e questa è l'unica opzione che lo viola.
- *Un `undici.Agent({ connect: { rejectUnauthorized: false } })` passato solo alla `fetch` di
  `api.ts`, gated su `import.meta.env.DEV`*: molto meglio della precedente — è circoscritto a una
  chiamata e il ramo è morto nella build di produzione. Rifiutata comunque perché resta **codice
  che disattiva la verifica** dentro un file versionato: chi lo legge fra sei mesi vede una riga
  che spegne TLS e non sa più quale `if` la protegge. `NODE_EXTRA_CA_CERTS` sposta il problema
  dove sta davvero — la macchina non si fida di quella CA — e il codice non ne sa nulla.
- *Terminare TLS in un proxy locale (Caddy/mkcert) davanti al backend*: risolve, e aggiunge un
  componente da installare, configurare e spiegare a chiunque cloni il repo.
- *Passare `http` sempre in sviluppo cambiando `dev:backend`*: romperebbe il login dell'admin per
  tutti, per risolvere un problema di un solo progetto nuovo.

**Rationale.** È l'unica opzione in cui **`fetch` continua a verificare i certificati**. Non si
abbassa una difesa: si aggiunge un'autorità di certificazione all'ambiente di sviluppo, che è
esattamente ciò che quel certificato è. E il costo è una riga in un `.env.example` più un comando
`dotnet` che va eseguito una volta per macchina.

---

### D4 🔴 — Degradazione: `/` risponde **200 con `no-store`**, `/menu` risponde **503 con `Retry-After`**, e l'API non lancia mai

**Chiude la decisione aperta n. 6 della proposal.**

**Il vincolo.** In SSR, una `fetch` che fallisce nel frontmatter **fa fallire la pagina**: Astro
risponde 500 e in sviluppo mostra il proprio overlay di errore. È il comportamento peggiore
possibile per una vetrina, e la rete vera (`proxy_cache_use_stale`) arriva solo in Fase 6.

**Choice — quattro pezzi.**

**(1) `api.ts` non lancia mai.** Restituisce un'unione discriminata, non un `T | null` e non una
promessa che rifiuta:

```ts
export type Esito<T> =
  | { stato: 'ok'; dati: T }
  | { stato: 'assente'; motivo: 'timeout' | 'rete' | 'http' | 'formato'; dettaglio: string };

export async function leggiSito(): Promise<Esito<SitoPubblico>>;
export async function leggiMenu(): Promise<Esito<MenuPubblico>>;
```

⚠️ **Proprietà che ne discende, e va detta**: poiché nessuna delle due rifiuta,
`Promise.all([leggiSito(), leggiMenu()])` **non può cortocircuitare**. Le due letture della home
partono insieme (dimezzando la latenza) senza bisogno di `allSettled`, e un fallimento parziale
resta parziale — `/` con gli orari veri e senza i consigliati è uno stato reale e va reso.

Timeout con `AbortSignal.timeout(3000)`, una costante sola. Ogni `assente` scrive una riga sullo
stdout del processo Node — che in Fase 6 sono i log del container, come il `LogWarning` del
backend è nei log di .NET. **Chi guarda il sito vede meno; chi guarda i log sa perché.**

**(2) Tre stati per pagina, non due.**

| Pagina | `site` ok, `menu` ok | `site` ok, `menu` assente | `site` assente |
|---|---|---|---|
| `/` | Tutto | Identità, orari, contatti; **niente striscia consigliati**, con un avviso al suo posto | Marca, slogan, "Colazione Pranzo Aperitivo"; **avviso in testa**; niente orari, niente indirizzo, niente "aperto ora" |
| `/menu` | Tutto | **503** | **503** |

**(3) 🔴 Il codice di stato è una decisione, e sono due decisioni diverse.**

- **`/` risponde sempre `200`.** È l'URL che la gente digita e che i motori tengono in indice: un
  5xx sulla radice è un segnale forte e sproporzionato rispetto a un backend che non risponde per
  trenta secondi. E la pagina degradata **ha contenuto vero** — il marchio, lo slogan, le tre
  parole — perché quegli asset sono locali (§D11) e non dipendono dall'API.
- **`/menu` risponde `503` con `Retry-After: 120`** e un corpo leggibile, non l'errore di Astro.
  La pagina esiste per un dato, e senza quel dato una pagina `200` vuota è un **menu vuoto
  indicizzabile**: la stessa classe di guasto silenzioso che il change precedente ha speso un
  criterio a evitare con il flag `troncato`. Un 503 è il codice che significa "torna più tardi",
  ed è ciò che va detto sia a un visitatore sia a un crawler.

**(4) 🔴 Una pagina degradata non entra in cache.** È il pezzo che rende la decisione a prova di
Fase 6:

```ts
// stato ok
Astro.response.headers.set('Cache-Control', 'public, max-age=60');
// stato degradato (200 su /) e stato 503 (su /menu)
Astro.response.headers.set('Cache-Control', 'no-store');
```

Senza `no-store`, il micro-cache di Fase 6 congelerebbe la pagina degradata per sessanta secondi
**dopo** che il backend è tornato su. Emettere l'header oggi è la stessa dottrina del §D4 del change
precedente — dichiarare la politica dove nasce il dato, così che il proxy di domani sia corretto
senza una riga di configurazione per rotta.

**L'ora del tema quando l'API è assente.** Lo script anti-FOUC (§D5) ha bisogno di
`oraInizioTemaSera` e degli orari. In stato `assente` si usa `ORA_TEMA_SERA_DI_RIPIEGO = "18:00"`,
in `src/lib/degradazione.ts`, **con il commento che dice cos'è**: non una seconda sorgente di
verità ma un ripiego per un backend irraggiungibile, il cui unico effetto se sbagliato è spostare
di qualche ora un tema automatico su una pagina che sta già dichiarando di essere incompleta.

**Alternatives considered.**
- *Lasciare che la pagina fallisca (500)*: è il comportamento di default, ed è quello che la
  decisione esiste per escludere. Un criterio di successo della proposal lo verifica esplicitamente.
- *`/menu` con `200` e un messaggio*: più gentile, e produce un menu vuoto che un crawler può
  indicizzare. Se in Fase 3 arrivasse un motivo (per esempio: mostrare comunque le categorie da
  cache locale) la decisione si rivede — oggi non c'è nulla da mostrare.
- *Cache in memoria nel processo Astro (ultima risposta buona)*: darebbe la degradazione migliore
  di tutte — il menu di due minuti fa invece di un 503. **Rinviata a Fase 6, dove esiste già** con
  `proxy_cache_use_stale` + `proxy_cache_background_update` in nginx. Farla qui significherebbe due
  cache con due TTL da tenere allineati, e la seconda vivrebbe in un processo che il deploy
  riavvia.
- *Riprovare la `fetch` (2 tentativi)*: raddoppia il tempo peggiore di risposta (6 s) per il caso in
  cui il backend è **giù**, che è il caso in cui i tentativi non servono. Un retry ha senso su una
  scrittura idempotente, non su una GET dietro un timeout di 3 secondi.

---

### D5 🔴 — Il tema è client-side, sempre. E anche lo stato "aperto ora", per la stessa ragione

**Il vincolo (piano §11.7).** `/api/public/site` è cacheabile 300 s e la Fase 6 metterà un
micro-cache nginx davanti alle pagine. Un tema calcolato server-side o **frammenta** la chiave di
cache (due copie di ogni pagina) o **serve il tema sbagliato a metà dei visitatori** — quelli che
non hanno riempito la cache.

**Choice.** Il server emette **una sola pagina, priva di tema**. `<html>` **non porta**
`data-tema`. Uno script `is:inline`, **primo elemento del `<head>` dopo `<meta charset>`**, lo
imposta prima del primo paint.

```astro
<!-- Base.astro — l'ORDINE conta: prima di qualunque <link rel="stylesheet">, così lo
     script gira senza nemmeno aspettare che la richiesta del CSS parta. -->
<script is:inline define:vars={{ oraSera, oraApertura, oraChiusura, giorniOperativi }}>
  // 🔴 NON è "è sera adesso": sono PARAMETRI che arrivano dall'API. Se qui finisse una
  //    decisione già presa server-side, la risposta smetterebbe di essere cacheabile e
  //    metà dei visitatori riceverebbe il tema di chi ha riempito la cache.
  //    Chi "migliora" questo codice spostando il confronto sul server rompe il micro-cache
  //    di Fase 6 senza che nulla diventi rosso.
  // ⚠️ hourCycle:"h23" e NON hour12:false: quest'ultimo restituisce "24:00" a mezzanotte
  //    in alcune versioni di ICU, e "24:00" >= "18:00" darebbe il tema sera all'ora
  //    sbagliata per sessanta minuti l'anno.
  var ora = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date());
  ...
}</script>
```

Verificato su Context7: **`define:vars` su uno `<script>` implica già `is:inline`** — Astro non può
raggruppare uno script che deve rieseguirsi con valori diversi. Si scrive comunque `is:inline`
perché il vincolo è dichiarato dal piano e chi rimuovesse `define:vars` in futuro non deve
riportare il FOUC come effetto collaterale.

**🔴 Il confine "sera" ha due estremi, ed entrambi vengono dall'API.** `ora >= oraSera` da solo dà
il tema **giorno alle due di notte** (`"01:00" >= "18:00"` è falso). L'estremo di uscita non è una
costante inventata: è **`orari.apertura`**, che l'API già espone.

```
sera  ⟺  ora >= oraInizioTemaSera  ∨  ora < orari.apertura
```

Il tema notturno finisce **quando il locale apre**. Nessun numero nuovo, nessun secondo posto in cui
un orario possa divergere dal database — che è la garanzia strutturale già dimostrata dal change
precedente.

**🔴 E lo stato "aperto ora" si calcola nello stesso script, per la stessa ragione.** La proposal lo
descrive come *"derivato da `/api/public/site`"*, il che suggerisce il frontmatter. Ma "aperto ora"
è una funzione dell'**orologio**: renderizzarlo server-side produce un HTML che **cambia da solo nel
tempo** e che quindi (a) resterebbe stantio fino a 60 s nel micro-cache, potendo dire "aperto" dopo
la chiusura, e (b) **farebbe fallire la prova di identità byte per byte** appena due `curl`
cadessero a cavallo di un minuto. È letteralmente la stessa decisione del tema, e va presa allo
stesso modo.

- Gli **orari** (`07:00 – 20:00`, i giorni) sono **dato** e si renderizzano server-side.
- Lo **stato** ("aperto ora" / "chiuso") è **orologio** e si calcola client-side, in un elemento
  reso `hidden` dal server e svelato dallo script — quindi senza salto di layout.
- Senza JavaScript il visitatore vede **gli orari veri** e nessun badge. È una degradazione onesta:
  l'informazione c'è, manca la comodità.

**Toggle a tre stati** (`giorno → sera → auto`), vanilla, chiave `tema` in `localStorage`. Il
bottone è reso dal server con un'etichetta **neutra** e la sua etichetta corrente la scrive lo
script: un'etichetta renderizzata server-side rivelerebbe lo stato, e lo stato è client-side.

**Anti-FOUC, il resto.** `html:not([data-pronto]) *, html:not([data-pronto]) *::before { transition: none !important }`,
con `data-pronto` aggiunto dallo script al frame successivo. L'attributo **non c'è mai** nell'HTML
servito, quindi l'identità byte per byte regge. E `html` porta il `background-color` del token, così
il primissimo pixel dipinto è già del tema giusto.

**La prova che l'HTML è identico byte per byte — quattro asserzioni, non una.**

| # | Prova | Cosa esclude |
|---|---|---|
| 1 | `curl` × 2 sulla stessa URL a distanza di un minuto → `cmp` silenzioso | Ogni stringa che dipende dall'orologio (è la prova che "aperto ora" server-side farebbe fallire) |
| 2 | `curl -H 'Cookie: tema=sera'` vs `-H 'Cookie: tema=giorno'` → identici | Il tema letto da un cookie |
| 3 | `curl -H 'Sec-CH-Prefers-Color-Scheme: dark'` vs `light` → identici | Il tema negoziato dagli header |
| 4 | `grep -c 'data-tema' pagina.html` == **1**, e quell'unica occorrenza è **dentro lo script** | Un `data-tema` finito sul tag `<html>` — cioè il tema deciso dal server, che le prove 1-3 non vedrebbero se il server scegliesse sempre lo stesso |

La (4) è quella che conta: le prime tre passano anche se il server scrive *sempre* `data-tema="giorno"`.

**Alternatives considered.**
- *Cookie letto server-side + `Vary: Cookie`*: dà il tema giusto al primo paint senza script. Costo:
  due varianti in cache per ogni URL, cioè metà del beneficio del micro-cache — e `Vary: Cookie` in
  pratica disabilita la cache condivisa, perché i cookie sono tanti e diversi.
- *`prefers-color-scheme` puro in CSS*: zero JavaScript e HTML davvero identico. Rifiutata perché i
  due temi **non sono light/dark**: sono i due registri del locale, legati all'**ora di Roma**, e
  il visitatore che ha il sistema in dark alle 10 del mattino vedrebbe la lavagna mentre il bar
  serve colazioni. Resta come *tie-break* del solo stato `auto`? No: aggiungerebbe un terzo criterio
  in un posto in più. L'ora di Roma decide, e la preferenza esplicita vince sull'ora.
- *Isola React per il toggle*: otto righe contro il runtime di React su ogni pagina, con un budget
  dichiarato di < 60 kb di JS.
- *`document.write` del `data-tema`*: bloccherebbe il parser ed è deprecato; l'assegnazione di
  `documentElement.dataset` in `<head>` avviene comunque prima del primo paint.

---

### D6 🔴 — `@theme inline`, e la prova che distingue i due comportamenti

**Chiude la decisione aperta n. 3 della proposal.**

**Verificato su Context7, documentazione corrente di Tailwind.** La differenza non è di stile, ed è
documentata con un esempio che si può riprodurre:

| | `@theme { --color-x: var(--c-x) }` | `@theme inline { --color-x: var(--c-x) }` |
|---|---|---|
| CSS generato | `:root { --color-x: var(--c-x) }` + `.bg-x { background: var(--color-x) }` | `.bg-x { background: var(--c-x) }` |
| Dove si risolve `--c-x` | **Su `:root`**, dove `--color-x` è dichiarata | **Sull'elemento** che usa `.bg-x` |

🔴 **E qui sta il motivo per cui la scelta sbagliata non si vedrebbe.** Il tema di pagina vive su
`<html>`, che **è** `:root`: con entrambe le forme il risultato alla radice è identico. La
differenza compare **solo** quando un token viene ridefinito in un **sottoalbero**:

```html
<html>                                   <!-- giorno: --c-sfondo = crema -->
  <section data-tema="sera">             <!-- ridefinisce --c-sfondo = lavagna -->
    <p class="bg-sfondo">…</p>           <!-- @theme: CREMA (sbagliato)
                                              @theme inline: LAVAGNA (giusto) -->
```

**E non è un caso teorico: è un elemento di questo design.** La home ha una **fascia "Aperitivo" che
sta sempre nel registro sera**, qualunque sia il tema della pagina — perché *è* la lavagna del
locale, e i due registri sono due momenti della giornata, non due preferenze. Quella fascia porta
`data-tema="sera"` su un `<section>`. Con `@theme` semplice, ogni utility di colore al suo interno
resterebbe crema-e-oliva: una fascia scura con dentro i colori del giorno, e nessun errore da
nessuna parte.

**Choice.** `@theme inline` per **tutti** i token che cambiano fra i temi; `@theme` semplice per
quelli che non cambiano mai (breakpoint, famiglie di font).

**La prova, automatizzata e senza browser.** Non serve `getComputedStyle`: la differenza è già nel
CSS generato.

```js
// sito/test/css-tema.test.mjs — legge dist/client/**/*.css dopo la build
test('le utility di colore inlinano il token di runtime', () => {
  const css = cssGenerato();
  // Con @theme inline: .bg-sfondo{background-color:var(--c-sfondo)}
  assert.match(css, /\.bg-sfondo\s*\{[^}]*var\(--c-sfondo\)/);
  // Con @theme semplice sarebbe var(--color-sfondo): il test lo esclude per nome.
  assert.doesNotMatch(css, /\.bg-sfondo\s*\{[^}]*var\(--color-sfondo\)/);
});
```

⚠️ **Conseguenza di `inline` da conoscere prima di scrivere CSS a mano**: il nome `--color-sfondo`
non è più il canale attraverso cui passa il valore. Il CSS scritto a mano usa **`--c-sfondo`**, il
nome di runtime, mai `--color-*`. Una sola regola, e il test sopra la rende visibile.

**La variante per i casi che i token non coprono** (il colore dell'arancio del logo, un'ombra che
cambia natura fra i temi):

```css
@custom-variant sera (&:where([data-tema="sera"], [data-tema="sera"] *));
```

Forma documentata per legare una variante a un attributo — coerente con `data-tema="sera"` invece
di una classe `.dark`, e con il `:where()` che tiene la specificità a zero.

**Alternatives considered.**
- *`@theme` semplice*: identica alla radice, quindi passerebbe ogni prova fatta sulla pagina intera.
  È **la scelta che si prende per somiglianza** e che la proposal chiedeva di non prendere così.
- *Nessun `@theme`, solo `:root` + CSS a mano*: perde tutte le utility (`bg-`, `text-`, `border-`)
  e con esse il motivo di usare Tailwind. La documentazione lo dice in una riga: `:root` è per le
  variabili che **non** devono generare utility — che è esattamente il caso dell'arancio (§D7),
  e solo suo.
- *Classi di tema statiche (`.tema-sera .bg-sfondo { … }`)*: funziona e moltiplica ogni utility per
  il numero dei temi nel CSS generato.

---

### D7 🔴 — L'arancio non può portare testo di giorno: **la classe non esiste**

**Il vincolo, misurato (piano §6, non stimato).**

| Token | su sfondo giorno (crema) | su sfondo sera (lavagna) | |
|---|---|---|---|
| Inchiostro `#020302` / gesso `#F2EDE7` | 17.75 | 14.33 | ✅ |
| Inchiostro tenue `#4A562A` / `#C9BCAE` | 6.79 | 8.97 | ✅ |
| Accento oliva `#41511E` / gesso giallo `#FDDB5B` | 7.45 | 12.28 | ✅ |
| **Arancio `#FD8502`** | 🔴 **2.11** | 6.78 | ❌ / ✅ |

**2.11 è sotto persino la soglia 3:1 del testo grande.** Ed è l'unico colore comune ai due temi,
quindi è anche quello che verrà riusato per analogia.

**Choice — l'arancio esce dalla namespace del tema.** La proposal chiede *"il vincolo scritto nel
CSS accanto al token"*. Non basta: un commento non impedisce niente. Il vincolo diventa **la forma
del foglio di stile**.

```css
/* 🔴 --c-arancio NON è in @theme, ed è deliberato. La documentazione di Tailwind lo dice
   in una riga: ":root è per le variabili che NON devono generare utility". Se l'arancio
   fosse --color-arancio, Tailwind genererebbe bg-arancio, border-arancio E text-arancio
   dalla stessa dichiarazione — non si può avere l'una senza l'altra.

   CONTRASTO MISURATO: 6.78 sulla lavagna, 2.11 sulla crema. Di giorno l'arancio è
   riempimento, bordo o superficie, con testo NERO sopra. Mai inchiostro.

   L'accento che porta testo esiste e si chiama --c-accento: oliva di giorno (7.45),
   gesso giallo di sera (12.28). Chi cerca "l'arancio per un titolo" cerca quello. */
:root { --c-arancio: #FD8502; --logo-arancio: var(--c-arancio); }

/* Le SOLE forme in cui l'arancio può comparire. `text-arancio` non è una classe che
   esiste: scriverla non genera CSS, e il testo resta del colore ereditato — cioè
   leggibile. Il default del guasto è sicuro. */
@utility bg-arancio     { background-color: var(--c-arancio); }
@utility border-arancio { border-color: var(--c-arancio); }
@utility fill-arancio   { fill: var(--c-arancio); }
```

**Tre strati, come sempre in questo progetto, perché coprono guasti diversi:**

1. **L'utility non esiste** → protegge dall'errore per analogia, che è il caso comune. Scrivere
   `text-arancio` non produce niente: nessun colore sbagliato, nessun errore, il testo resta nero.
2. **Un test che legge i sorgenti** → protegge dai valori arbitrari, che l'utility mancante non
   ferma:
   ```js
   // sito/test/arancio.test.mjs
   test("nessun testo arancione, in nessuna forma", () => {
     assert.deepEqual(occorrenzeNeiSorgenti(
       /text-\[?#?[Ff][Dd]8502|text-\[var\(--c-arancio\)\]|color:\s*var\(--c-arancio\)/), []);
   });
   ```
3. **La misura sul rendering** → protegge da ciò che nessun `grep` vede (uno `<style>` di
   componente, un colore composto). Strumento di accessibilità del browser su `/` e `/menu` nei due
   temi, come prescrive il criterio di successo. L'audit AA completo resta Fase 7.

**Le CTA cambiano forma fra i temi**, e non è un vezzo: è l'unica combinazione che passa in
entrambi. Giorno: **oliva pieno, testo crema** (7.45). Sera: **arancio o giallo pieno, testo
lavagna**. Una sola classe `.cta`, i cui token cambiano con il tema.

**Costo accettato consapevolmente.** Nella fascia sera l'arancio *potrebbe* legittimamente portare
testo (6.78). Il divieto è **globale** e lì proibisce un uso valido. Si accetta: una regola sola,
senza eccezioni, vale più di 0.28 punti di contrasto in un contesto — e un'eccezione documentata è
il modo in cui una regola smette di essere applicata.

**Alternatives considered.**
- *Commento accanto al token* (lettera della proposal): è il punto di partenza, non l'arrivo. Resta,
  ed è il testo scritto sopra — ma da solo non impedisce niente.
- *Due token, `--color-arancio-su-scuro` e `--color-arancio-superficie`*: genera comunque
  `text-arancio-superficie`, che è un nome che qualcuno scriverà "perché serviva l'arancio".
- *Un lint CSS custom (stylelint)*: una dipendenza e una configurazione per fare ciò che
  l'assenza dell'utility fa gratis.
- *Vietare l'arancio del tutto*: è il colore del logo e l'unico ponte identitario fra i due
  registri. Toglierlo per risolvere un problema di contrasto significherebbe togliere il marchio.

---

### D8 — I tre font: scaricati da Google Fonts **già in woff2 con subset latino**, serviti dal sito

**La decisione dell'utente**, non ridiscussa: **Allura, Playfair Display Black, Anton**, licenza
SIL OFL, convertiti in **woff2 con subset latino** e serviti in locale. Divergenza dal piano §6, che
prescriveva Yesteryear.

**Verifica che cambia il *come*, non il *cosa*.** Google Fonts **serve già** ciò che serve: file
`.woff2`, spezzati per subset, con l'`unicode-range` esatto. Misurato oggi sui file reali:

| Font | Sorgente | `latin` | Note |
|---|---|---|---|
| **Anton** 400 | `css2?family=Anton` | **18 612 B** | Contro i 161 588 B del `.ttf` già nel repo |
| **Allura** 400 | `css2?family=Allura` | **26 488 B** | |
| **Playfair Display** 900 | `css2?family=Playfair+Display:wght@900` | **22 372 B** | ⚠️ Con un peso singolo Google serve un'**istanza statica**, non il file variabile |
| **Corpo** | — | **0 B** | Stack di sistema, §sotto |
| | | **67 472 B** | Totale, tre richieste |

Il subset `latin` di Google ha `unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC,
U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, …`. Verificato che
copra ciò che il sito scrive: accentate italiane (U+00E0…U+00F9 ✅), **€** (U+20AC ✅, e senza
sarebbero i prezzi), apostrofo tipografico ’ e trattini – — (U+2000-206F ✅), ° (U+00B0 ✅).

**Choice.** Si **scaricano** i tre file `latin` e si committano; non si converte il `.ttf`.

```
sito/src/assets/fonts/
├── Anton-latin.woff2
├── Allura-latin.woff2
├── PlayfairDisplay-900-latin.woff2
├── OFL.txt              ← 🔴 la licenza RICHIEDE che accompagni i file
└── PROVENIENZA.md       ← famiglia, versione (v27/v23/v40), URL gstatic esatta, sha256, data
```

`sito/scripts/scarica-font.mjs` (zero dipendenze, `fetch` + `node:crypto` di Node 22) rifà
l'operazione e **verifica gli sha256** contro quelli registrati. Non gira nella build: gira quando
si vuole aggiornare o verificare, e il suo output è riproducibile.

**`@font-face` scritti a mano, con l'`unicode-range` copiato verbatim** da Google:

```css
@font-face {
  font-family: 'Anton'; font-style: normal; font-weight: 400;
  font-display: swap;                       /* mai `block`: il titolo è il contenuto */
  src: url('../assets/fonts/Anton-latin.woff2') format('woff2');
  /* Copiato verbatim: senza, il browser scarica il font anche per testo che non ha
     glifi in quel range — per esempio un nome di prodotto in cirillico. */
  unicode-range: U+0000-00FF, U+0131, …;
}
```

**Preload solo su Anton**, che è il display sopra la piega di entrambe le pagine:

```astro
---
// 🔴 Vite riscrive l'url() del CSS in un percorso con hash di contenuto. Un preload
//    scritto a mano su "/fonts/Anton.woff2" punterebbe a un file DIVERSO da quello che il
//    CSS chiede: il browser ne scaricherebbe due, e il preload comparirebbe come "inutile"
//    negli strumenti invece che come sbagliato.
import antonUrl from '../assets/fonts/Anton-latin.woff2?url';
---
<!-- ⚠️ crossorigin è OBBLIGATORIO anche same-origin: i font si recuperano in modalità CORS
     e senza l'attributo il preload non viene riusato — il font si scarica due volte. -->
<link rel="preload" href={antonUrl} as="font" type="font/woff2" crossorigin />
```

Allura e Playfair **non** si preloadano: sono decorativi e non bloccano la lettura.

**Il corpo: stack di sistema, zero byte.**

```css
--font-corpo: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
```

Il piano §6 prescriveva Roboto *"già dipendenza"* — vero per `duedgusto`, **falso per `sito/`**, che
è un progetto indipendente. Roboto resta nello stack: su Android e ChromeOS il visitatore ottiene
proprio quel carattere, gratis. Il piano stesso definiva il corpo *"neutro al limite dell'anonimo —
giusto così: il carattere lo portano gli altri due"*, ed è precisamente ciò che uno stack di sistema
è.

⚠️ **Nomenclatura, e una trappola di lettura.** La namespace dei font in Tailwind v4 è **`--font-*`**
(`--font-family-*` è della alpha e non genera niente). Ma **non si usa `--font-display`**: `.font-display`
sarebbe una classe utility, e `font-display` è anche il descrittore di `@font-face` — chi cercasse
l'uno troverebbe l'altro. I quattro ruoli si chiamano `--font-titolo`, `--font-firma`,
`--font-insegna`, `--font-corpo`.

**Alternatives considered.**
- *Convertire i `.ttf` con `pyftsubset` (fonttools)*: è la lettura letterale di "si convertono". Costo:
  una toolchain Python che nessun altro pezzo del repository richiede, e un risultato **misurabilmente
  peggiore** — la pipeline della fonderia produce file già ottimizzati, e Anton `latin` pesa 18 kB
  contro un `.ttf` da 161 kB da cui partiremmo. Il risultato che l'utente ha chiesto — woff2, subset
  latino, servito in locale — è **esattamente** ciò che si ottiene, con meno macchina. Resta la via se
  un giorno servisse un subset più stretto (per esempio Playfair ridotto ai soli caratteri di
  "Colazione Pranzo Aperitivo": ~1 kB invece di 22).
- *Servire da Google Fonts*: violerebbe un criterio di successo esplicito (zero richieste verso
  `fonts.gstatic.com`), aggiungerebbe due connessioni a terzi e un problema GDPR.
- *`@fontsource/*`*: comodo, e installa un pacchetto npm per ogni famiglia più il suo CSS, con i
  file dentro `node_modules` — cioè fuori da `PROVENIENZA.md` e fuori dal controllo di versione.
- *Variabile di Playfair Display (`wght@400..900`)*: un file solo per tutti i pesi, e ne serve **uno**.
- *Yesteryear* (piano §6, ed è nel repo): scartato dall'utente. Il piano stesso lo aveva già messo in
  dubbio — *"lo script delle locandine è un pennello moderno, non uno script anni '50"*.

---

### D9 — Playfair Display: **×1.55**, in un token solo, e il vincolo di layout che `scaleX` porta con sé

**Chiude la decisione aperta n. 4 della proposal.**

**Il conflitto, alla lettera.** [`docs/brand/README.md:88-91`](../../../docs/brand/README.md):

> *"**Playfair Display Black stirato in orizzontale ×1.55** — identificato per confronto contro nove
> candidati. […] In CSS si riproduce con `transform: scaleX(1.5)`."*

Due numeri nella stessa riga. Il primo è **misurato** sull'artwork originale; il secondo è quel
numero arrotondato mentre si scriveva l'esempio.

**Choice: ×1.55**, e in **un token solo**.

```css
/* Il fattore è MISURATO sull'insegna, non scelto: le tre parole del sito devono poter
   stare accanto all'insegna vera senza che la differenza si veda. 1.5 e 1.55 differiscono
   del 3.3% — su una riga di 600 px sono 20 px, visibilissimi in un confronto affiancato.
   ⚠️ Il README di docs/brand/ suggerisce scaleX(1.5) nella stessa riga in cui dichiara
      ×1.55: è quel numero arrotondato. Vale il numero misurato. */
:root { --stiramento-insegna: 1.55; }
```

🔴 **E il vincolo che rende necessario il token unico**: `transform` **non partecipa al layout**.
L'elemento continua a occupare la sua larghezza non trasformata, quindi il testo stirato **sborda**
sui vicini e non si centra da solo. La larghezza va riservata a mano — e quella riserva **deve
derivare dallo stesso numero**, altrimenti il giorno in cui il fattore cambia lo spazio resta
quello vecchio, e nessuno collega le due cose.

```css
.insegna { display: inline-block; transform: scaleX(var(--stiramento-insegna));
           transform-origin: center; }
.insegna-riserva { display: inline-block;
                   padding-inline: calc((var(--stiramento-insegna) - 1) / 2 * 100%); }
```

⚠️ Le tre parole restano **testo selezionabile**, mai l'SVG dell'insegna: devono poter essere lette,
tradotte e indicizzate (README di marca, e proposal §7).

**Alternatives considered.**
- *×1.5*: il numero suggerito. Rifiutato perché è il numero misurato ad avere autorità sull'artwork,
  e la riga del README che lo suggerisce non porta una motivazione — è un arrotondamento.
- *`font-stretch` / `font-width`*: sarebbe la via corretta in CSS moderno, perché **partecipa al
  layout**. Non applicabile: "Playfair Display" (la famiglia classica) non ha un asse `wdth`; ha
  `wght` e `opsz`. Su un font senza quell'asse `font-stretch` non fa nulla — e non fallisce: non fa
  nulla, che è peggio.
- *Un font condensato/esteso diverso*: non riprodurrebbe l'insegna, che è **un didone deformato nel
  software di grafica** — la firma sono le aste verticali spessissime accanto a grazie filiformi,
  esattamente ciò che lo stiramento produce e che un font esteso di design non ha.
- *Prendere le tre parole da `insegna-completa-inchiostro.svg`*: vietato dal README e dalla proposal.

**Nota da riportare a `docs/brand/README.md`.** La riga ambigua andrebbe corretta — ma
`docs/brand/**` è **invariato** in questo change (Affected Areas). Si annota come debito: un
change di documentazione da un rigo, che punti al token invece di ripetere un numero.

---

### D10 — Anton ha solo il Regular: la scala lo dichiara, e `font-synthesis: none` lo fa rispettare

**Chiude la decisione aperta n. 5 della proposal** (trappola §11.10 del piano).

**Il vincolo.** Anton esiste in **un solo peso**, 400. Non c'è corsivo, non c'è un 600.

🔴 **Il guasto non è "manca un peso": è che il browser ne inventa uno.** Scrivere `font-weight: 700`
su un elemento in Anton produce un **falso grassetto sintetizzato**, che (a) ispessisce i tratti in
modo non uniforme rovinando proprio ciò che rende Anton un carattere da insegna, e (b) è **diverso
fra i motori** — Chrome, Safari e Firefox sintetizzano con algoritmi diversi. È un guasto che non
appare in nessun log e che chi sviluppa su un motore solo non vede mai.

**Choice — la scala dichiara tre ruoli e nessun peso intermedio esiste in Anton.**

| Ruolo | Famiglia | Peso | Dove | Regola |
|---|---|---|---|---|
| **Display** | Anton | 400 (l'unico) | H1, H2, prezzi | Maiuscolo, `letter-spacing` leggermente negativo, **≥ 28 px**. Sotto quella misura un condensato pesante chiude i contrograffi |
| **Intermedio** | `--font-corpo` | **600/700** | H3, sottotitoli, occhielli, etichette | 🔴 **Non Anton.** Maiuscoletto + `letter-spacing` positivo per tenere il registro senza cambiare famiglia |
| **Firma** | Allura | 400 | Slogan, tocchi calligrafici | **≥ 28 px, mai maiuscolo, mai su prezzi/orari/indirizzo.** Di giorno legata a `--c-accento` (oliva), come nelle locandine — mai a `--c-inchiostro` |
| **Insegna** | Playfair 900 | 900 | Le sole tre parole (§D9) | Un uso solo, in un posto solo |
| Corpo | `--font-corpo` | 400 | Descrizioni, allergeni | |

**E il vincolo si fa rispettare, non solo dichiarare:**

```css
/* 🔴 Anton, Allura e Playfair hanno UN peso ciascuno e nessun corsivo. Senza questa riga
   un font-weight:700 su un titolo produce un grassetto FINTO, diverso da browser a
   browser, che rovina proprio le aste che rendono Anton un carattere da insegna.
   Con questa riga, font-weight:700 su Anton non fa nulla — e "non fa nulla" è visibile
   subito, mentre un grassetto sintetizzato sembra funzionare. */
html { font-synthesis: none; }
```

Pinnato da un test sul CSS generato, accanto a quello di §D6.

**Alternatives considered.**
- *Aggiungere una seconda famiglia condensata con più pesi* (Oswald, Archivo Narrow): risolverebbe
  il problema aggiungendo un quarto file da scaricare e una seconda voce condensata accanto a
  quella del marchio. Il problema che risolve è ipotetico; il costo è certo.
- *Anton per il ruolo intermedio, a misura minore*: è il default a cui si scivola, ed è quello che
  la trappola §11.10 esiste per prevenire — sotto ~20 px un condensato heavy diventa una macchia.
- *Un peso variabile di un'alternativa ad Anton*: cambierebbe il carattere delle insegne dipinte,
  che è la ragione per cui Anton è stato scelto nel merito e non per convenienza.
- *Non dichiarare `font-synthesis`*: è il default del browser, cioè "sintetizza". Il costo di
  scriverlo è una riga; il costo di non scriverlo è un bug che si manifesta su un browser solo.

---

### D11 — Gli asset di marca: due cartelle, e l'`<img>` che fa sparire il logo di sera

**Il vincolo verificato nei file.** `docs/brand/logo-2dgusto.svg` contiene **due** `currentColor` e
**un** `#FD8502` sotto `--logo-arancio`; `monogramma-2d.svg` uno e uno. Sono già scritti per essere
inline.

🔴 **Un SVG dentro `<img src>` non eredita `currentColor`**: è un documento isolato, `currentColor`
si risolve al nero, e il logo **sparisce sul fondo lavagna**. Sbagliare cartella non produce un
errore: produce un logo che scompare di sera.

**Choice — la distinzione del README di marca, applicata alla lettera.**

| Destinazione | File | Perché |
|---|---|---|
| `sito/public/` | `favicon.svg`, `apple-touch-icon.png`, `og-default.jpg`, `robots.txt` | Serviti **verbatim** a URL fisse: il browser li cerca a percorsi precisi, e un hash di contenuto li renderebbe introvabili |
| `sito/src/assets/` | `logo-2dgusto.svg`, `monogramma-2d.svg` | Inseriti **inline nel DOM** — l'unica condizione in cui `currentColor` segue il tema |

```astro
<!-- sito/src/components/Logo.astro -->
---
// L'SVG entra nel DOM come markup, non come risorsa: è la sola forma in cui
// currentColor esiste. Un <img src={logo}> qui è la riga che fa sparire il logo di sera.
import logo from '../assets/logo-2dgusto.svg?raw';
---
<span class="text-inchiostro" style="--logo-arancio: var(--c-arancio)" set:html={logo} />
```

**La controprova diagnostica**, che è anche il criterio di successo: ispezionando l'elemento si deve
vedere `<svg>`, **non** `<img>`.

⚠️ **`robots.txt` nasce permissivo.** Il `Disallow: /` va sull'host dell'**app**, non della vetrina
(piano §6): è Fase 6, e anticiparlo al file sbagliato deindicizzerebbe il sito che stiamo
costruendo.

**L'origine assoluta per l'Open Graph, senza `site:`.** `og:image` deve essere assoluta e il dominio
non esiste ancora (§D1).
- **Immagine OG dall'API** (`seo.immagineOg`): assoluta per costruzione, la compone `mediaUrl` da
  `PUBLIC_MEDIA_ORIGINE` (§D2). ✅ È il caso normale.
- **Ripiego `og-default.jpg`** da `public/`: assoluta via **`new URL('/og-default.jpg', Astro.url)`**.
  `Astro.url` esiste perché il rendering è on-demand, e in sviluppo dà `http://localhost:4321`.
  ⚠️ Dietro nginx dipenderà da `Host` e `X-Forwarded-Proto` — entrambi già inoltrati dalla
  configurazione esistente, ma **da verificare in Fase 6**, quando il proxy davanti al sito
  esisterà. Rischio residuo dichiarato.

`og:url` e `<link rel="canonical">` assoluti restano **Fase 3**, insieme al `site:` e alla sitemap.

**Alternatives considered.**
- *`<img src={logo}>` con la variante `-inchiostro`/`-gesso` scambiata dal CSS*: funziona (due
  `<img>` e un `display:none` per tema) al prezzo di due richieste, un lampo al cambio di tema e la
  perdita del motivo per cui il file `currentColor` esiste.
- *`astro:assets` `<Image>` sull'SVG*: non ottimizza gli SVG e produce comunque un `<img>`.
- *Copiare tutta `docs/brand/` in `sito/`*: il README dichiara sé stesso *"il master, non la cartella
  del sito"*. La copia è **un sottoinsieme**, e la ragione per cui il rollback (`rm -rf sito/`) non
  fa perdere alcun asset.

---

### D12 — `Immagine.astro`: `<picture>` puro, `sizes` obbligatorio, e perché **non** `<Image>`

**Il contratto in ingresso** è `ImmaginePubblicaDto`, verificato nel file: `chiave`,
`larghezzeDisponibili: int[]`, `larghezza`, `altezza`, `testoAlternativo?`, `didascalia?`,
`focale?`, `placeholder?`. Il backend genera **due formati per ogni larghezza**,
`{larghezza}.webp` e `{larghezza}.jpg`
([`ImmagineProcessor.cs:376-377`](../../../backend/Services/Media/ImmagineProcessor.cs)), su
`LarghezzeVarianti = [400, 800, 1200, 1600]`. `Placeholder` è un **data URI completo**
(`data:image/webp;base64,…`, ≤ 2 kB), `Focale` è già nella forma `object-position` (`"50% 40%"`).

**Choice.**

```astro
---
interface Props {
  immagine: ImmaginePubblica;
  sizes: string;                 // 🔴 OBBLIGATORIO — vedi sotto
  priorita?: boolean;            // solo per l'immagine LCP
  classe?: string;
}
---
<picture>
  <source type="image/webp" srcset={srcSet(immagine, 'webp')} sizes={sizes} />
  <img
    src={mediaUrl(immagine.chiave, larghezzaPiuGrande, 'jpg')}
    srcset={srcSet(immagine, 'jpg')} sizes={sizes}
    width={immagine.larghezza} height={immagine.altezza}
    alt={immagine.testoAlternativo ?? ''}
    loading={priorita ? 'eager' : 'lazy'}
    fetchpriority={priorita ? 'high' : 'auto'}
    decoding="async"
    style={`object-position:${immagine.focale ?? '50% 50%'};
            background-image:url(${immagine.placeholder});background-size:cover`}
  />
</picture>
```

**Quattro proprietà, ognuna con la sua ragione:**

1. 🔴 **`srcset` **solo** da `larghezzeDisponibili`, mai dedotto.** La pipeline non fa upscaling: una
   sorgente da 900 px produce `[400, 800]` e basta. Riapplicare la regola di generazione emetterebbe
   URL che rispondono 404, con un guasto che degrada in silenzio e **in modo diverso da browser a
   browser**. È scritto nel modello, [`MediaAsset.cs:35-40`](../../../backend/Models/MediaAsset.cs).
2. 🔴 **`sizes` è una prop obbligatoria.** Ometterlo non è un errore: il browser assume `100vw` e
   scarica la variante più grande **anche per una miniatura**. Un default silenzioso che triplica il
   peso della pagina è peggio di un errore di compilazione — e il componente non può indovinare il
   layout del chiamante.
3. **`width`/`height` dall'originale** → il rapporto d'aspetto è corretto e il CLS è zero, anche se
   la variante servita ha larghezza diversa.
4. **`alt=""` e non `alt={undefined}`** quando `testoAlternativo` manca: una stringa vuota dichiara
   "decorativa" agli screen reader; l'attributo assente li fa leggere l'URL.

🔴 **Non `<Image>` di `astro:assets` sui media remoti** (piano §4): rifarebbe a runtime
l'ottimizzazione che il backend ha già fatto, richiederebbe `image.domains`/`remotePatterns` per
ogni origine, e porterebbe **`sharp` e i suoi binari nativi** nel container di Fase 6.

⚠️ **Correzione misurata in apply il 2026-08-12 — l'ultima metà di quella frase era sbagliata.**
Non usare `<Image>` **non** tiene `sharp` fuori dall'albero: `astro@7.2.1` lo dichiara fra le
proprie `optionalDependencies`, e un `npm install` normale lo installa con i binari nativi di ogni
piattaforma — **29 MB** misurati (1,1 MB in `sharp`, 28 MB in `@img`). Il guadagno reale è un
altro, e resta: sharp non viene mai **caricato** a runtime, e poiché è *opzionale* l'immagine del
container può ometterlo con **`npm ci --omit=optional`**. 🔧 **Fase 6 deve scrivere quel flag nel
Dockerfile**, o i 29 MB entrano comunque. Un test di `sito/test/immagini.test.mjs` pinna che
`sharp` resti `optional: true` nel lockfile, perché è la condizione che rende quel flag
sufficiente.

**Alternatives considered.**
- *`<img>` senza `<picture>`*: perde il WebP (−25/35% di byte), che il backend ha già generato.
- *`sizes` con un default `"100vw"`*: è precisamente il guasto del punto 2, reso ufficiale.
- *Placeholder come `<div>` sotto l'immagine invece che `background-image`*: un nodo in più per
  immagine e un secondo elemento da tenere allineato in dimensione.

---

### D13 — Il troncamento del menu è dichiarato al visitatore, e la home non lo tocca

**Il vincolo.** `MenuPubblicoDto` porta `totaleProdottiPubblicati`, `limiteApplicato` e `troncato`
*"proprio perché il consumatore possa reagire"*. Ignorarli riporta il guasto silenzioso che il
change precedente ha speso un criterio a evitare.

**Choice.**

| Campo | Cosa ne fa il sito |
|---|---|
| `troncato === true` | **`/menu`** mostra, in coda al listino, un avviso leggibile: *"Sono mostrati i primi {limiteApplicato} prodotti di {totaleProdottiPubblicati}. Per il listino completo chiedi in cassa."* + una riga sullo stdout del processo |
| `limiteApplicato` | Compare **nel testo dell'avviso**, non è una costante del sito: il numero arriva dal server e il consumatore non lo indovina |
| `totaleProdottiPubblicati` | Idem. È l'unico modo in cui il visitatore sa **quanto** manca |
| `categorie` vuoto | Stato legittimo (nessun prodotto pubblicato): messaggio dichiarato, **mai** una pagina bianca né un 503 — è diverso da §D4, dove il dato non è arrivato |

🔴 **L'avviso non sta dietro un flag di sviluppo e non è un `console.warn`.** Il visitatore è
l'unico che può reagire (chiedendo in cassa); chi sviluppa lo scopre dai log del backend, che già
emette il suo `LogWarning`.

**E cosa la home NON fa.** `/` usa lo stesso payload per la striscia dei `consigliato`, e **non**
mostra l'avviso: la home espone per natura una selezione, non un listino, quindi non promette
completezza e un avviso di troncamento lì sarebbe rumore. ⚠️ Conseguenza da conoscere: con il menu
troncato, un prodotto `consigliato` oltre il limite **non compare in home**. Il rimedio è
l'`OrdinamentoVetrina`, che è la leva che l'admin già ha.

**Alternatives considered.**
- *Ignorare i tre campi*: la classe di guasto che il DTO documenta.
- *Una seconda chiamata paginata*: la rotta non accetta parametri, deliberatamente (costo fisso per
  risposta), e 300 prodotti su un menu da bar è un tetto che segnala un problema di dati, non un
  limite da aggirare.
- *Avviso solo nei log*: nessuno guarda i log di una vetrina finché non si rompe qualcos'altro.

---

### D14 — I test di `sito/`: `node:test`, zero dipendenze nuove; e cosa resta **dichiaratamente** manuale

**Il vincolo.** La proposal non prevede alcun test runner in `sito/`, e stabilisce che *"una
dipendenza installata e non usata è una dipendenza che nessuno verifica"*. Ma quattro decisioni di
questo documento (§D2, §D6, §D7, §D10) chiudono con "e un test lo scopre".

**Choice.** **`node:test` + `node:assert`**, nel runtime. `"test": "node --test test/"`. Zero
dipendenze aggiunte, e gira su Node 22, che §D1 ha appena reso il pavimento dichiarato.

| Cosa | Come | Da |
|---|---|---|
| `astro:env/server` in un file solo | Scansione dei sorgenti | §D2 |
| `"/media/"` in un file solo | Scansione dei sorgenti | §D2 |
| Nessun testo arancione, in nessuna forma | Scansione dei sorgenti (utility + valori arbitrari) | §D7 |
| Le utility di colore inlinano `var(--c-*)` | Regex sul CSS **generato** dopo la build | §D6 |
| `font-synthesis: none` nel CSS generato | Idem | §D10 |
| 🔴 Il markup usa il prefisso media e **mai** quello API | Build con host sentinella + `fetch` sul server di prova | §D2 |
| L'HTML non porta `data-tema` sul tag `<html>` | `fetch` sul server di prova + regex | §D5 |
| Due `fetch` a un minuto di distanza → corpi identici | Idem, `Buffer.equals` | §D5 |
| `Cache-Control` per stato (60 s / `no-store`) | `fetch` sul server di prova, con e senza backend | §D4 |
| Composizione di `mediaUrl` e `srcSet` | Unitario puro | §D12 |

**Cosa resta manuale, e lo resta consapevolmente** — sono i criteri di successo della proposal, e
richiedono un browser vero:

- **FOUC**: dieci hard reload con cache disabilitata e throttling, sui due temi, dai tre stati del
  toggle. Un lampo bianco all'apertura in sera fa fallire il criterio.
- **Contrasto**: strumento di accessibilità del browser su `/` e `/menu` nei due temi.
- **Fuso orario**: cambio del fuso di sistema a uno lontano → il tema **non** cambia.
- **Immagini che caricano davvero**: `200` nella scheda di rete, non l'`alt` di un `404`.
- **Zero richieste a `fonts.gstatic.com`**: scheda di rete + `grep` sui file generati.

⚠️ Nessun Playwright, nessun `axe`, nessun jsdom in `sito/` in questa fase: l'automazione
dell'audit di accessibilità e della regressione visiva è **Fase 7**, e installarne il tooling ora
significherebbe portarsi tre dipendenze pesanti esercitate da nessuno.

**Alternatives considered.**
- *Vitest*: quello che `duedgusto` usa già, e sarebbe il pattern copiabile. Costo: `vitest` + le sue
  transitive in un progetto che non ha altro bisogno di un bundler di test. `node:test` copre tutto
  ciò che serve qui (asserzioni, `fetch`, filesystem) perché **nessun test di questo elenco ha
  bisogno di un DOM**.
- *Nessun test, tutto manuale*: quattro decisioni resterebbero verificate solo dalla buona volontà,
  e sono le quattro che nessuno vede sbagliate in sviluppo.

---

## Data Flow

```
                          ┌─ SERVER (processo Node di Astro) ───────────────────┐
                          │                                                     │
  Richiesta ─────────────►│  index.astro / menu.astro (frontmatter)             │
                          │        │                                            │
                          │        │  Promise.all — non cortocircuita mai (§D4) │
                          │        ▼                                            │
                          │   src/lib/api.ts ── API_INTERNA_URL (astro:env/     │
                          │        │             server) ─────────────┐         │
                          │        │  AbortSignal.timeout(3000)       │         │
                          │        ▼                                  ▼         │
                          │   Esito<T> : ok | assente        https://localhost:4000
                          │        │                          /api/public/site  │
                          │        ▼                          /api/public/menu  │
                          │   Base.astro                                        │
                          │    ├─ <script is:inline define:vars={oraSera,        │
                          │    │    apertura, chiusura, giorni}>   ← PARAMETRI   │
                          │    ├─ Logo.astro     (set:html → currentColor)       │
                          │    └─ Immagine.astro ── src/lib/mediaUrl.ts          │
                          │                            │  PUBLIC_MEDIA_ORIGINE   │
                          │                            │  (astro:env/client)     │
                          │        Cache-Control: 60s | no-store (§D4)           │
                          └────────│────────────────────────────────────────────┘
                                   ▼
                              HTML — identico byte per byte nei due temi,
                                     e senza alcuna stringa dipendente dall'orologio
                                   │
       ┌───────────────────────────┴──────────────────────────────┐
       ▼                                                          ▼
  BROWSER: lo script in <head> legge localStorage,        BROWSER: <img srcset>
  confronta l'ora di Roma con i parametri,                → https://www.duedgusto.com
  scrive data-tema su <html> PRIMA del primo paint,          /media/{chiave}/{w}.webp
  svela il badge "aperto ora", aggiunge data-pronto.         (nginx, non il backend)

  🔴 I due percorsi NON condividono un prefisso, e in sviluppo coincidono:
     è per questo che dev.mjs avvisa quando i due valori sono uguali (§D2).
```

---

## File Changes

| File | Azione | Descrizione |
|------|--------|-------------|
| `sito/package.json` | Crea | `engines.node >= 22.12.0`, `astro ~7.2.1`, `@astrojs/node ~11.1.1`, 🔴 `tailwindcss`/`@tailwindcss/vite ^4.2.2` — **non** `^4.2.1` come `duedgusto`: Vite 8 (§D1) |
| `sito/.npmrc` | Crea | 🔴 `engine-strict=true` — la riga che rende `engines` un vincolo (§D1) |
| `sito/.nvmrc` | Crea | `22` |
| `sito/.gitignore` | Crea | `node_modules`, `dist`, `.astro`, `.env` |
| `sito/.env.example` | Crea | I due prefissi con i valori di sviluppo, `NODE_EXTRA_CA_CERTS`, e il commento sul SAN `localhost` (§D2, §D3) |
| `sito/astro.config.mjs` | Crea | `output: 'server'`, adapter Node standalone, plugin Vite di Tailwind, `env.schema` (§D1, §D2) |
| `sito/tsconfig.json` | Crea | `extends: "astro/tsconfigs/strict"` |
| `sito/README.md` | Crea | Come si avvia, i due prefissi, il certificato, i comandi di prova |
| `sito/scripts/dev.mjs` | Crea | 🔴 `NODE_EXTRA_CA_CERTS` prima dello spawn + avviso quando i due prefissi coincidono (§D2, §D3) |
| `sito/scripts/scarica-font.mjs` | Crea | Scarica i tre `latin.woff2` da Google e verifica gli sha256 (§D8) |
| `sito/src/styles/global.css` | Crea | `@import "tailwindcss"`, i due registri, `@theme inline`, `@custom-variant sera`, 🔴 l'arancio **fuori** dal tema con le sue tre `@utility`, i tre `@font-face`, `font-synthesis: none` (§D6, §D7, §D8, §D10) |
| `sito/src/layouts/Base.astro` | Crea | `<head>`, meta OG dai campi SEO, preload di Anton con `crossorigin`, 🔴 script tema+orari `is:inline` (§D5, §D8, §D11) |
| `sito/src/components/Immagine.astro` | Crea | `<picture>` + `srcset` puro, `sizes` obbligatorio, `width`/`height`, placeholder e focale (§D12) |
| `sito/src/components/Logo.astro` | Crea | SVG **inline** via `?raw` — l'unica forma in cui `currentColor` segue il tema (§D11) |
| `sito/src/components/TemaSwitch.astro` | Crea | Toggle a tre stati, vanilla, etichetta scritta dallo script (§D5) |
| `sito/src/components/SchedaProdotto.astro` | Crea | Prodotto del menu: nome, descrizione, prezzo, allergeni, marcatori |
| `sito/src/components/AvvisoDegradazione.astro` | Crea | L'avviso dichiarato dello stato `assente` (§D4) |
| `sito/src/lib/tipi.ts` | Crea | Tipi che rispecchiano i DTO di `Controllers/Public/Dto/` |
| `sito/src/lib/api.ts` | Crea | 🔴 **L'unico** importatore di `astro:env/server`; `Esito<T>`, timeout, non lancia mai (§D2, §D4) |
| `sito/src/lib/mediaUrl.ts` | Crea | 🔴 **L'unico** compositore di URL di media, da `astro:env/client` (§D2) |
| `sito/src/lib/degradazione.ts` | Crea | `ORA_TEMA_SERA_DI_RIPIEGO`, con il commento che dice cos'è e cosa non è (§D4) |
| `sito/src/pages/index.astro` | Crea | Home: hero, insegna stirata ×1.55, slogan, orari + badge client-side, consigliati, fascia sera, striscia galleria, contatti |
| `sito/src/pages/menu.astro` | Crea | Menu per categorie di vetrina, con foto, prezzi, allergeni, marcatori e 🔴 il flag di troncamento onorato (§D13) |
| `sito/src/assets/fonts/*.woff2` + `OFL.txt` + `PROVENIENZA.md` | Crea | Anton, Allura, Playfair 900 — subset `latin`, 67 kB in tre file (§D8) |
| `sito/src/assets/logo-2dgusto.svg`, `monogramma-2d.svg` | Crea | Copiati da `docs/brand/`, per l'inline (§D11) |
| `sito/public/favicon.svg`, `apple-touch-icon.png`, `og-default.jpg` | Crea | Copiati da `docs/brand/`, serviti verbatim (§D11) |
| `sito/public/robots.txt` | Crea | ⚠️ **Permissivo**: il `Disallow: /` va sull'host dell'app, ed è Fase 6 |
| `sito/test/*.test.mjs` | Crea | `node:test`, zero dipendenze (§D14) |
| `package.json` (radice) | **Modifica** | `dev:sito` + inserimento nel `concurrently` di `dev`. **Unica modifica a un file preesistente** |
| `backend/.gitignore` (o radice) | **Modifica** | Una riga: `backend/.certs/` (§D3) |
| `backend/**`, `duedgusto/**` | **Invariato** | 🔴 `git diff --stat` vuoto |
| `docs/brand/**` | **Invariato** | È il master: il sito ne prende copia (§D11). Debito annotato: la riga ×1.55/×1.5 del README (§D9) |
| `deploy/**`, `docker-compose.yml`, `.github/**` | **Invariato** | 🔴 Fase 6 |

---

## Interfaces / Contracts

### `src/lib/tipi.ts` — lo specchio dei DTO

```ts
// Rispecchia backend/Controllers/Public/Dto/. Un campo qui che il DTO non ha è un campo
// che sarà sempre undefined; un campo del DTO che manca qui è un dato che il sito ignora.
export interface ImmaginePubblica {
  chiave: string;
  larghezzeDisponibili: number[];   // 🔴 mai dedotte: la pipeline non fa upscaling
  larghezza: number; altezza: number;
  testoAlternativo: string | null; didascalia: string | null;
  focale: string | null;            // già "50% 40%", pronta per object-position
  placeholder: string | null;       // data:image/webp;base64,… ≤ 2 kB
}

export interface ProdottoPubblico {
  id: number; nome: string; descrizione: string | null;
  prezzo: number;                   // già risolto: 0 è un omaggio, non un'assenza
  allergeni: string | null; novita: boolean; consigliato: boolean;
  immagine: ImmaginePubblica | null;
}

export interface MenuPubblico {
  categorie: { nome: string; prodotti: ProdottoPubblico[] }[];
  totaleProdottiPubblicati: number; limiteApplicato: number; troncato: boolean;  // §D13
}

export interface SitoPubblico {
  insegna: string;
  indirizzo: { via: string; cap: string; citta: string; provincia: string; paese: string };
  geo: { latitudine: number; longitudine: number } | null;   // o entrambe o niente
  contatti: { telefono: string | null; email: string | null };
  social: { instagram: string | null; facebook: string | null };
  orari: {
    apertura: string; chiusura: string;                      // "HH:mm"
    giorniOperativi: boolean[] | null;                       // ⚠️ NULLABLE, e va gestito
    timezone: string;
  };
  seo: { titoloDefault: string | null; descrizioneDefault: string | null;
         immagineOg: ImmaginePubblica | null };
  oraInizioTemaSera: string;                                 // "HH:mm", parametro del tema
}
```

⚠️ **`giorniOperativi` è nullable e non è un dettaglio**: il backend lo espone `null` quando il JSON
persistito non è leggibile come sette booleani, perché *"omettere gli orari settimanali è meglio che
dichiararne di sbagliati"*. Il sito, in quel caso, mostra apertura e chiusura **senza** i giorni, e
lo script del badge "aperto ora" si limita al confronto orario.

### `src/styles/global.css` — la forma, non il contenuto completo

```css
@import "tailwindcss";

/* ── I due registri: custom properties di RUNTIME, riassegnate da un attributo ────── */
:root, [data-tema="giorno"] {
  --c-sfondo:#F2EDE7; --c-sfondo-alt:#EAE4DC; --c-superficie:#FDFDFC;
  --c-inchiostro:#020302; --c-inchiostro-tenue:#4A562A;
  --c-accento:#41511E;                 /* oliva — 7.45, porta testo */
  --c-bordo:#D8D2C8;
}
[data-tema="sera"] {
  --c-sfondo:#251C19;                  /* lavagna: carboncino CALDO, non nero neutro */
  --c-sfondo-alt:#2C221D; --c-superficie:#342A23;
  --c-inchiostro:#F2EDE7;              /* la crema fa doppio lavoro: è il gesso */
  --c-inchiostro-tenue:#C9BCAE;
  --c-accento:#FDDB5B;                 /* gesso giallo — 12.28, porta testo */
  --c-bordo:#4C3B33;
}
/* 🔴 L'arancio sta QUI e non in @theme: vedi §D7 */
:root {
  --c-arancio:#FD8502; --logo-arancio:var(--c-arancio);
  --stiramento-insegna: 1.55;          /* §D9 — misurato, non arrotondato */
}

/* ── Ciò che diventa utility. `inline` perché i valori cambiano a runtime (§D6) ───── */
@theme inline {
  --color-sfondo:var(--c-sfondo);           --color-sfondo-alt:var(--c-sfondo-alt);
  --color-superficie:var(--c-superficie);   --color-inchiostro:var(--c-inchiostro);
  --color-inchiostro-tenue:var(--c-inchiostro-tenue);
  --color-accento:var(--c-accento);         --color-bordo:var(--c-bordo);
}
/* Questi non cambiano mai: @theme semplice basta. ⚠️ mai --font-display (§D8) */
@theme {
  --font-titolo:'Anton', sans-serif;  --font-firma:'Allura', cursive;
  --font-insegna:'Playfair Display', Georgia, serif;
  --font-corpo: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
}

@custom-variant sera (&:where([data-tema="sera"], [data-tema="sera"] *));
@utility bg-arancio { background-color: var(--c-arancio); }      /* §D7 */
@utility border-arancio { border-color: var(--c-arancio); }
@utility fill-arancio { fill: var(--c-arancio); }

html { font-synthesis: none; background-color: var(--c-sfondo); }   /* §D10, §D5 */
html:not([data-pronto]) *, html:not([data-pronto]) *::before { transition: none !important; }
```

### `.env.example`

```ini
# Il SERVER legge le rotte API da qui. Rete interna in produzione: http://backend:5000
# ⚠️ Esattamente "localhost": il certificato di sviluppo ASP.NET ha quel solo SAN, e con
#    127.0.0.1 la verifica fallisce anche con la CA importata (§D3).
API_INTERNA_URL=https://localhost:4000

# Il BROWSER carica le immagini da qui. In produzione: https://www.duedgusto.com
# 🔴 In sviluppo coincide con quello sopra ed è precisamente per questo che l'errore di
#    usarne uno solo non si vede. Per provarli distinti, metti qui l'IP di rete locale:
#    PUBLIC_MEDIA_ORIGINE=https://192.168.1.42:4000
PUBLIC_MEDIA_ORIGINE=https://localhost:4000

# ⚠️ Questa NON viene letta da qui: Node la legge all'avvio del processo, prima del .env.
#    La imposta scripts/dev.mjs. È scritta qui solo per dire dove va il file:
#    cd backend && dotnet dev-certs https --export-path ./.certs/aspnet-dev.pem \
#                                         --format PEM --no-password
```

---

## Testing Strategy

| Layer | Cosa | Come |
|---|---|---|
| **Unit (`node:test`)** | 🔴 `astro:env/server` compare in **un file solo** | Scansione dei sorgenti (§D2) |
| **Unit** | 🔴 `"/media/"` compare in **un file solo** | Idem (§D2) |
| **Unit** | 🔴 Nessun testo arancione: utility **e** valori arbitrari | Idem (§D7) |
| **Unit** | `mediaUrl` / `srcSet` usano solo `larghezzeDisponibili` | Puro, con l'array `[400,800]` (§D12) |
| **Unit** | `sizes` mancante → errore di tipo | `tsc` (prop obbligatoria) (§D12) |
| **Unit** | Il confronto orario: `"01:00"` con `oraSera="18:00"` e `apertura="07:00"` → **sera** | La funzione estratta dallo script (§D5) |
| **Build** | 🔴 `.bg-sfondo` contiene `var(--c-sfondo)` e **non** `var(--color-sfondo)` | Regex sul CSS generato (§D6) |
| **Build** | `font-synthesis: none` nel CSS generato | Idem (§D10) |
| **Build** | Zero occorrenze di `fonts.gstatic.com` / `fonts.googleapis.com` | `grep` su `dist/` |
| **Integrazione** | 🔴 Host sentinella: l'HTML di `/menu` contiene `media.sentinella.invalid` e **zero** occorrenze dell'host API | Build + `entry.mjs` + `fetch` (§D2) |
| **Integrazione** | 🔴 Controprova: con un prefisso solo, la stessa asserzione trova l'host interno | Manuale una volta, documentata (§D2) |
| **Integrazione** | 🔴 `<html>` **non** porta `data-tema`; la stringa compare una volta sola, nello script | `fetch` + regex (§D5) |
| **Integrazione** | Due `fetch` a distanza di un minuto → corpi **identici** | `Buffer.equals` (§D5) |
| **Integrazione** | `Cookie: tema=sera` vs `tema=giorno` → corpi identici | Idem (§D5) |
| **Integrazione** | `Cache-Control: public, max-age=60` con backend su; `no-store` con backend giù | `fetch` in due condizioni (§D4) |
| **Integrazione** | Backend giù: `/` risponde **200**, `/menu` risponde **503** con `Retry-After` | Idem (§D4) |
| **Integrazione** | `troncato: true` (risposta simulata) → l'avviso compare in `/menu` | (§D13) |
| **Integrazione** | Nessun `Codice`, `AliquotaIva`, `unitaDiMisura` nell'HTML servito | `grep` sulla pagina renderizzata |
| **Integrazione** | `grep "20:00"` nei sorgenti di `sito/` → **nessun risultato** | Gli orari vengono dall'API, non dai template |
| **Manuale** | 🔴 **Il deliverable**: `/menu` nel browser, prodotti confrontati uno per uno con `curl -sk …/api/public/menu`, immagini `200` in rete | Criterio di successo |
| **Manuale** | 🔴 **Nessun FOUC**: 10 hard reload, cache off, throttling, due temi, tre stati del toggle | Criterio di successo |
| **Manuale** | 🔴 **Contrasto misurato** su `/` e `/menu` nei due temi; nessun testo arancione di giorno | Criterio di successo (§D7) |
| **Manuale** | Fuso di sistema a un fuso lontano → il tema **non** cambia | (§D5) |
| **Manuale** | Toggle giro completo con reload dopo ogni stato | (§D5) |
| **Manuale** | Logo: toggle con il logo visibile; ispezione mostra `<svg>`, non `<img>` | (§D11) |
| **Manuale** | Consigliato tolto dall'admin → sparisce dalla home | Dati vivi |
| **Manuale** | Orario cambiato dalle impostazioni cassa → riflesso sul sito entro il tempo di cache | Dati vivi |
| **Manuale** | `npm run build && node dist/server/entry.mjs` serve entrambe le pagine | Criterio di successo |
| **Manuale** | `npm install` su Node 20 **fallisce** dicendo che serve ≥ 22.12 | (§D1) |

---

## Migration / Rollout

**Nessuna migrazione database.** Il change non tocca il database, non lo legge e non ha accesso ad
esso se non attraverso tre GET anonime.

**Ordine di rollout — ogni gradino verificabile senza il successivo.**

1. **Node ≥ 22.12 sulla macchina** + `sito/` con `package.json`, `.npmrc`, `.nvmrc`, `astro.config.mjs`.
   Verifica: `npm install` completa; su Node 20 **fallisce dicendo perché**.
2. **`scripts/dev.mjs` + il certificato esportato** (§D3). Verifica: `npm run dev` parte, e una
   `fetch` di prova verso `/api/public/site` risponde **senza** `NODE_TLS_REJECT_UNAUTHORIZED`.
3. **`tipi.ts` + `api.ts` + `mediaUrl.ts`** e i due test di scansione (§D2, §D14). Verifica:
   `npm test` verde con **una pagina sola e vuota**.
4. **`global.css`** e i test sul CSS generato (§D6, §D7, §D10). Verifica: `npm run build`, poi le
   regex sul CSS. È il gradino in cui `@theme inline` si dimostra, prima che esista un colore in
   una pagina.
5. **I font** — `scarica-font.mjs`, `PROVENIENZA.md`, `OFL.txt`, i tre `@font-face`, il preload
   (§D8). Verifica: scheda di rete, zero richieste a Google.
6. **`Base.astro`** con lo script `is:inline` e il toggle (§D5). Verifica: le quattro asserzioni di
   identità byte per byte, su una pagina ancora priva di dati.
7. **`Immagine.astro`** (§D12) e **`Logo.astro`** (§D11). Verifica: una pagina di prova con una
   sola immagine reale e il logo nei due temi.
8. **`/menu`** (§D13). Verifica: il confronto uno per uno con `curl`. **È il deliverable della
   fase**, e arriva prima della home perché è la pagina che il piano nomina.
9. **`/`** con la fascia sera annidata — che è anche la verifica visiva di §D6.
10. **Degradazione** (§D4): backend spento, `/` a 200 e `/menu` a 503, header di cache controllati.
11. **`dev:sito` nel `package.json` di radice.** Ultimo, perché è l'unica modifica a un file
    preesistente e va isolata nel diff.

**Rollback.** Come da proposal: `rm -rf sito/`, più due righe nel `package.json` di radice e una
riga di `.gitignore`. Il design aggiunge una precisazione:

- **I font sono binari committati.** Rimuovere `sito/` li rimuove; `PROVENIENZA.md` va perso con
  loro, ed è il motivo per cui contiene gli URL e gli sha256 — sono l'unica cosa che rende
  l'operazione **rifacibile** invece che da riscoprire.

**Punto di non ritorno: nessuno.** Il dominio non è acquistato, il container non esiste, nginx non
punta a nulla: il sito è raggiungibile solo da `localhost:4321`. Nessun visitatore esterno può
vederlo, quindi un rollback non produce link rotti verso Internet.

---

## Divergenze dalla proposal e dal piano (da recepire in `sdd-spec`)

| # | Fonte | Diceva | Design | Perché |
|---|---|---|---|---|
| 1 | Proposal §2 + Rischi | *"Astro 6 è la corrente (indicizzata a 6.3.1)"*; decisione aperta fra Astro 5/Node 20 e Astro 6/Node 22 | **Astro `~7.2.1` + `@astrojs/node ~11.1.1` su Node ≥ 22.12**, con 🔴 `engine-strict=true` | §D1 — la 6 e la 7 dichiarano **lo stesso** `engines.node`, quindi la 7 non costa nulla in più; e nascere un major indietro è ciò per cui la proposal aveva già scartato Astro 5 |
| 1b | — | | 🔴 **Il floor di Tailwind in `sito/` è `^4.2.2`, non `^4.2.1` come `duedgusto`** | §D1 — Astro 7 gira su **Vite 8** e `@tailwindcss/vite@4.2.1` dichiara peer `vite ^5.2.0 \|\| ^6 \|\| ^7`. È la trappola §11.11 (lockfile che divergono) che si avvera il primo giorno, con una causa precisa invece che come previsione |
| 1c | — | | ⚠️ **`<source>`, `<link>` e ogni void element vanno scritti auto-chiusi** | §D1 — nella 7 il compilatore Rust è l'unico e i tag non chiusi sono **errori**, non più auto-corretti. Riguarda §D8 (preload) e §D12 (`<picture>`) |
| 1d | — | | ⚠️ Le asserzioni di §D2 e §D5 restano **ricerche di sottostringa** | §D1 — nella 7 `compressHTML: 'jsx'` è il default: la compressione è deterministica (l'identità byte per byte regge) ma il markup non ha più l'indentazione su cui si sarebbe tentati di asserire |
| 1e | Design, §D4 *Alternatives* | *"cache in memoria nel processo Astro: rinviata a Fase 6, dove esiste già in nginx"* | **La decisione non cambia**, ma nella 7 `cache: { provider: memoryCache() }` è **stabile**: il ripiego, se in Fase 6 servisse, costa tre righe | §D1 — una decisione presa contro un vincolo che è caduto va riesaminata, e questa regge; ma il suo punto di uscita ora è scritto |
| 2 | Design precedente §D11 | `API_BASE_URL` / `PUBLIC_MEDIA_BASE_URL` via `import.meta.env` | **`API_INTERNA_URL` / `PUBLIC_MEDIA_ORIGINE` via `astro:env`**, due moduli virtuali, due file, un avviso allo start quando coincidono | §D2 — i nomi precedenti differiscono per una parola in mezzo; questi non condividono un morfema |
| 3 | Proposal §3 | Prefisso media in produzione: *"`/media/…` sull'host pubblico"* | **Origine assoluta sempre**, in ogni ambiente, mai vuota | §D2 — `og:image` deve essere assoluta, e `""` è anche ciò che si ottiene dimenticando la variabile |
| 4 | Proposal, Rischi | HTTPS self-signed *"da risolvere in design"* | **`NODE_EXTRA_CA_CERTS`** con il PEM esportato, impostato da `scripts/dev.mjs`. Mai `NODE_TLS_REJECT_UNAUTHORIZED` | §D3 — ⚠️ e **non funziona da `.env`**: Node lo legge prima |
| 5 | Proposal, decisione aperta 6 | *"cosa mostra la home, e se `/menu` è errore o pagina vuota"* | **`/` → 200 degradata**, `/menu` → **503 + `Retry-After`**, entrambe con **`Cache-Control: no-store`** | §D4 — senza `no-store` il micro-cache di Fase 6 congelerebbe la degradazione dopo il ripristino |
| 6 | Proposal §"Le due pagine vive" | *"orari con stato «aperto ora» derivato da `/api/public/site`"* | Gli **orari** server-side (sono dato), lo **stato** client-side (è orologio) | 🔴 §D5 — è la **stessa** decisione del tema; server-side farebbe fallire la prova di identità byte per byte e servirebbe "aperto" dopo la chiusura |
| 7 | Piano §6 | Il tema sera scatta a `oraInizioTemaSera` | Sera ⟺ `ora >= oraInizioTemaSera ∨ ora < orari.apertura` | §D5 — senza l'estremo di uscita il tema è **giorno alle due di notte**. L'estremo non è inventato: è l'orario di apertura, che l'API già espone |
| 8 | Proposal, decisione aperta 3 | `@theme` contro `@theme inline`, *"da provare"* | **`@theme inline`**, con la prova sul **CSS generato** e una fascia `data-tema="sera"` annidata in home che la rende load-bearing | §D6 — alla radice i due sono identici, ed è per questo che quello sbagliato spedirebbe |
| 9 | Proposal §5 | *"il vincolo dell'arancio va nel CSS accanto al token"* | Non basta: 🔴 **l'arancio esce da `@theme`** e vive in `:root` + tre `@utility`. `text-arancio` **non esiste** | §D7 — un commento non impedisce niente; un'utility mancante sì, e il default del guasto è sicuro |
| 10 | Proposal, decisione aperta 4 | Playfair: ×1.55 misurato o `scaleX(1.5)` suggerito | **×1.55**, in **un token solo** da cui deriva anche la riserva di spazio | §D9 — `transform` non partecipa al layout, quindi il numero compare due volte e deve essere lo stesso |
| 11 | Piano §6 | Corpo: **Roboto**, *"già dipendenza"* | **Stack di sistema, zero byte** (con Roboto dentro lo stack) | §D8 — vero per `duedgusto`, falso per `sito/`, che è indipendente |
| 12 | Utente | *"si convertono in woff2 con subset latino"* | Si **scaricano già** in woff2 `latin` da Google: 18.6 + 26.5 + 22.4 kB, misurati | §D8 — l'esito richiesto è identico, senza una toolchain Python che nessun altro pezzo del repo usa |
| 13 | Piano §6 | *"`preload` sul solo Anton"* | Preload di Anton **con `crossorigin`** e con l'**URL hashato** importato via `?url` | §D8 — senza `crossorigin` il font si scarica due volte; con un percorso scritto a mano, due file diversi |
| 14 | Proposal, Affected Areas | Nessun test dichiarato in `sito/` | **`node:test`**, zero dipendenze nuove; Playwright/axe restano Fase 7 | §D14 — quattro decisioni chiudono con "un test lo scopre" |
| 15 | Proposal, Rollback | *"unica modifica a un file preesistente: due righe nel `package.json` di radice"* | ~~Sono **due file**: anche una riga di `.gitignore` per `backend/.certs/`~~ → ✅ **CORRETTA in apply il 2026-08-12: la proposal aveva ragione, il file preesistente toccato è UNO.** Il certificato esportato è **già ignorato** e non serve alcuna riga nuova | §D3 — verificato con `git check-ignore -v`, non assunto: `backend/.certs/aspnet-dev.pem` è coperto da `backend/.gitignore:45:*.pem`, e `backend/.certs/aspnet-dev.key` — il **secondo** file, che il design non nominava — da `.gitignore:42:*.key` della radice. `git status --porcelain backend/.certs/` è vuoto |

---

## Open Questions

Nessuna bloccante. Cinque punti da chiudere in fase di apply, ciascuno con la raccomandazione già
presa.

- [x] **`@theme inline` emette ancora `--color-*` su `:root`?** ✅ **CHIUSA in apply il 2026-08-12:
      NO.** Con `inline` il valore viene inlinato nelle utility e la variabile del tema non viene
      dichiarata affatto. La raccomandazione — *non dipenderne* — resta valida e ora è anche
      **superflua**: non c'è niente da cui dipendere.

      ⚠️ **Ma la prima misura diceva il contrario, e come si è scoperto l'inganno vale più della
      risposta.** Il primo build mostrava **una** `--color-*` su `:root` (`--color-sfondo`), e
      sembrava la risposta "sì, le emette comunque". Non era Tailwind: era un **commento** di
      `global.css` che nominava quel nome dentro un `var(…)`. **Tailwind decide quali variabili
      del tema emettere cercando i `var(…)` nel CSS, e guarda anche dentro i commenti.** Provato
      per mutazione: cambiando *solo il nome citato nel commento*, cambiava la variabile emessa
      (`--color-bordo` al posto di `--color-sfondo`). Un test scritto sulla prima osservazione
      avrebbe pinnato un artefatto di un commento credendo di pinnare il comportamento di Tailwind.

      Il commento è stato riscritto per non nominare quella forma, e il test ora asserisce
      l'assenza **di tutte**: risponde alla domanda e impedisce che un commento futuro rimetta per
      sbaglio una variabile inutile nel foglio spedito.

- [x] **`astro:env` richiede il prefisso `PUBLIC_` per le variabili di contesto client?**
      ✅ **CHIUSA in apply il 2026-08-12 (task 3.1): NON è obbligatorio, e si tiene lo stesso.**
      Lo schema dichiara già il contesto, e le build sono passate senza che Astro chiedesse nulla
      sul nome. Resta per la ragione per cui era stato scelto: è la parola che qualcuno legge nel
      `.env` mentre decide quale valore mettere, e *PUBLIC* significa letteralmente **il browser lo
      vedrà**.

      ➕ Ed è emersa una seconda ragione che il design non aveva: `access: 'public'` significa
      anche **inlinato nella build**, per entrambi i contesti (vedi §D2). Il prefisso `PUBLIC_` nel
      nome è l'unico posto in cui quella parola compare a chi legge il `.env`, e ora ne segnala due
      cose invece di una.

- [x] **`Astro.url.origin` dietro nginx** ✅ **CHIUSA in apply il 2026-08-12 (task 6.9): usato,
      con il rischio residuo dichiarato.** È l'unica sorgente di origine assoluta senza `site:`, e
      in sviluppo è corretto — misurato: `og:image` vale
      `http://127.0.0.1:4399/og-default.jpg` sul bundle servito da quella porta, cioè segue l'host
      della richiesta.

      🔧 **Resta da riverificare in Fase 6**, quando davanti alla vetrina nascerà un server block:
      il sintomo di un guasto sarebbe un `og:image` in `http://` su un sito in `https://`, e
      dipende da `Host` e `X-Forwarded-Proto` — che la configurazione nginx esistente **già
      inoltra**, ma per l'app, non per un host che ancora non c'è.

- [x] **Il fallback `og-default.jpg` conviene?** ✅ **CHIUSA in apply il 2026-08-12 (task 6.9):
      tenuto, e serve già adesso.** `ImpostazioniVetrina.ImmagineOg` è `null` a database in questo
      momento: senza il ripiego, ogni link condiviso del sito oggi non avrebbe anteprima. Il costo
      è stato esattamente quello previsto — un file già esistente (`docs/brand/og-default.jpg`,
      1200×630, 35 kB, copiato in `public/`) e tre righe.

- [x] **La fascia "Aperitivo" in registro sera fissa: scelta editoriale o solo dimostrazione
      tecnica?** ✅ **CHIUSA in apply il 2026-08-12: si tiene**, e non solo per la ragione tecnica.

      Guardata affiancata al materiale in `docs/`: **due delle tre locandine hanno una lavagna
      vera dentro la fotografia** — la lavagna del menu cubano nello spazio esterno, e quella
      «Cocktail Cubani e Italiani» dietro il vassoio. La lavagna non è un espediente grafico per
      avere una fascia scura: è un oggetto che il locale usa, e la fascia lo cita. Con la home in
      tema giorno, quel rettangolo scuro in mezzo alla crema si legge come *la lavagna appoggiata
      fuori*, che è esattamente il registro che serve all'aperitivo.

      ⚠️ **Un'osservazione da non trasformare in una modifica.** Le lavagne fotografate sono grigio
      **freddo** con gesso **bianco**; la fascia è carboncino **caldo** con gesso **giallo**. I
      valori vengono dalla locandina «Aperitivo Apericosto», campionati e non scelti, e **non si
      toccano** per farli somigliare di più a queste due foto: sarebbe sostituire una misura con
      un'impressione. Annotato in `DEBITI.md` come cosa da guardare insieme all'utente, non come
      un aggiustamento da fare in fondo a un change.
