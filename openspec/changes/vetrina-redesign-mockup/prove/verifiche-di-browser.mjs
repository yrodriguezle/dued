// Le verifiche del redesign che richiedono un browser vero.
//
// Discende da `12-verifiche-di-browser.mjs` del change `vetrina-sito-astro`, con tre
// differenze che contano:
//
//   1. le pagine sono CINQUE, non due — e le tre nuove sono quelle che nessuno ha ancora
//      guardato in entrambi i registri;
//   2. il contrasto si misura anche a 390 px, perché dal redesign esiste un layout stretto
//      con una barra fissa e una navigazione che scorre, e su quello nessuna misura fatta a
//      1100 px dice nulla;
//   3. l'etichetta del selettore del tema è cambiata forma («Registro giorno» invece di
//      «Giorno»), e un confronto per uguaglianza fallirebbe pur essendo tutto a posto.
//
// ⚠️ **Il percorso di import di Playwright dipende da dove sta questo file.** Le copie
//    archiviate dello script precedente stanno una cartella più in fondo, e il loro
//    `../../../../` non arriva più alla radice del repository: sono scripts che non
//    ripartono senza correggere quella riga. Qui il conto torna — prove → change → changes
//    → openspec → radice.
//
// Si esegue contro il BUNDLE COSTRUITO, non contro il dev server: i due falliscono in modi
// diversi, e in produzione va il secondo.
//
//   cd sito && API_INTERNA_URL=https://localhost:4012 npx astro build
//   PORT=4399 HOST=127.0.0.1 NODE_EXTRA_CA_CERTS=../backend/.certs/aspnet-dev.pem \
//     node dist/server/entry.mjs
//   node openspec/changes/vetrina-redesign-mockup/prove/verifiche-di-browser.mjs

import { mkdirSync } from 'node:fs';
import playwright from '../../../../duedgusto/node_modules/playwright/index.js';
const { chromium } = playwright;

const SITO = process.argv[2] ?? 'http://127.0.0.1:4399';
const cartella = new URL('.', import.meta.url).pathname.slice(1);
mkdirSync(cartella + 'fouc', { recursive: true });

const PAGINE = [
  ['/', 'home'],
  ['/menu', 'menu'],
  ['/aperitivo', 'aperitivo'],
  ['/locale', 'locale'],
  ['/contatti', 'contatti'],
];

let problemi = 0;
const esito = (ok, riga) => {
  if (!ok) problemi++;
  console.log(`${ok ? '  ok  ' : ' FALLITA '} ${riga}`);
};

/**
 * Imposta il registro e ATTENDE che le transizioni finiscano.
 *
 * ⚠️ Senza l'attesa la misura corre contro `transition-colors`, e il colore letto è **a metà
 *    strada** fra i due registri — un contrasto fuori soglia senza che nulla sia rotto. Il
 *    contrasto si misura sullo STATO STABILE, che è quello che il visitatore legge.
 */
async function impostaRegistro(pagina, registro) {
  await pagina.evaluate((r) => document.documentElement.setAttribute('data-tema', r), registro);
  await pagina.waitForTimeout(600);
}

const browser = await chromium.launch();

// ─────────────────────────────────────────────────────────────────────────────────────
// 1 — NESSUN FOUC, in condizioni sfavorevoli.
//
// 🔴 Un solo lampo chiaro all'apertura in tema sera fa fallire il criterio: non «quasi
//    mai», non «solo la prima volta». La prova gira con la cache disattivata e la rete
//    rallentata — le condizioni in cui il lampo, se c'è, dura abbastanza da vedersi.
// ─────────────────────────────────────────────────────────────────────────────────────
console.log('\n━━ 1 — dieci hard reload per combinazione, cache off e rete lenta ━━');

async function campiona(pagina) {
  try {
    return await pagina.evaluate(() => {
      const radice = document.documentElement;
      if (!radice) return { tema: null, chiaro: null };
      const s = getComputedStyle(radice).backgroundColor;
      const numeri = s.match(/\d+/g);
      if (!numeri) return { tema: radice.getAttribute('data-tema'), chiaro: null };
      const [r, g, b] = numeri.map(Number);
      return {
        tema: radice.getAttribute('data-tema'),
        chiaro: (r * 299 + g * 587 + b * 114) / 1000 > 128,
      };
    });
  } catch {
    // Navigazione in corso: il contesto di esecuzione è stato distrutto sotto i piedi.
    return { tema: null, chiaro: null };
  }
}

for (const stato of ['auto', 'giorno', 'sera']) {
  const contesto = await browser.newContext();
  const pagina = await contesto.newPage();

  const cdp = await contesto.newCDPSession(pagina);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 400,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: (400 * 1024) / 8,
  });

  await pagina.goto(SITO + '/');
  await pagina.evaluate((s) => localStorage.setItem('tema', s), stato);

  let lampi = 0;
  const campioni = [];
  for (let giro = 0; giro < 10; giro++) {
    await pagina.goto(SITO + '/', { waitUntil: 'commit' });
    for (let t = 0; t < 8; t++) {
      const { tema, chiaro } = await campiona(pagina);
      campioni.push(`${tema ?? '—'}/${chiaro === null ? '—' : chiaro ? 'chiaro' : 'scuro'}`);
      // 🔴 Il lampo è: registro `sera` già deciso e fondo ancora chiaro.
      if (tema === 'sera' && chiaro === true) {
        lampi++;
        await pagina.screenshot({ path: `${cartella}fouc/lampo-${stato}-${giro}-${t}.png` });
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  const registri = [...new Set(campioni.map((c) => c.split('/')[0]))].join(', ');
  esito(
    lampi === 0,
    `stato «${stato}»: 10 reload × 8 campioni — lampi: ${lampi} (registri visti: ${registri})`
  );
  await contesto.close();
}

// ─────────────────────────────────────────────────────────────────────────────────────
// 2 — CONTRASTO MISURATO SUL RENDERING, non letto nel CSS.
//
// 🔴 È la verifica che decide se D1 è stata applicata davvero: il mockup usa l'arancio di
//    marca come colore di testo in otto punti, e su crema fa 2.24. Qui si guarda ogni nodo
//    di testo di ogni pagina, in entrambi i registri e a due larghezze.
// ─────────────────────────────────────────────────────────────────────────────────────
console.log('\n━━ 2 — contrasto sulle coppie testo/sfondo reali, 5 pagine × 2 registri × 2 larghezze ━━');

/** WCAG, calcolato in pagina risalendo allo sfondo effettivo di ogni nodo di testo. */
const MISURA = `(() => {
  // 🔴 SOLO rgb()/rgba(): qualunque altra notazione restituisce null e viene segnalata,
  //    invece di essere letta a caso.
  //
  //    Costata un giro di misure sbagliate: con \`bg-sfondo/85\` Tailwind emette
  //    \`color-mix(in oklab, …)\`, che il browser riporta come \`oklab(0.968 0.0012 0.0073 /
  //    0.85)\`. Una lettura «prendi i primi tre numeri» li trattava come componenti RGB su
  //    255 — cioè un nero quasi perfetto — e produceva un 3.72 IDENTICO su ogni pagina.
  //    Sembrava un difetto di accessibilità vero e uniforme; era il misuratore.
  const rgb = (c) => {
    const m = /^rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)$/.exec((c ?? '').trim());
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const lum = (c) => {
    const v = rgb(c);
    if (!v) return null;
    const [r, g, b] = [v.r, v.g, v.b].map((x) => {
      const s = x / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  // Risale al primo sfondo **completamente opaco e leggibile**. Uno sfondo semitrasparente
  // non è lo sfondo effettivo: ciò che si vede è la composizione con quello che sta sotto, e
  // se quello che sta sotto scorre, il contrasto non è nemmeno una proprietà stabile.
  const opaco = (n) => {
    for (let e = n; e; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor;
      const v = rgb(c);
      if (v && v.a === 1) return c;
      if (c && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(c) && !v) return '__ILLEGGIBILE__' + c;
    }
    return 'rgb(255, 255, 255)';
  };
  const fuori = [];
  for (const n of document.querySelectorAll('h1,h2,h3,p,a,span,li,abbr,address,button,em,dd,dt,blockquote,footer')) {
    const testo = (n.textContent ?? '').trim();
    if (!testo || n.children.length > 0) continue;
    const s = getComputedStyle(n);
    if (s.visibility === 'hidden' || s.display === 'none' || n.offsetParent === null) continue;
    if (Number(s.opacity) === 0) continue;

    const sfondo = opaco(n);
    if (sfondo.startsWith('__ILLEGGIBILE__')) {
      // Non si inventa un numero: si dichiara che non si è potuto misurare, e si fallisce.
      fuori.push({ testo: testo.slice(0, 40), rapporto: 0, soglia: 0, px: 0,
        colore: s.color, sfondo: 'NON MISURABILE ' + sfondo.slice(15) });
      continue;
    }

    const lt = lum(s.color);
    const ls = lum(sfondo);
    if (lt === null || ls === null) continue;
    const [a, b] = [lt, ls].sort((x, y) => y - x);
    const rapporto = (a + 0.05) / (b + 0.05);
    const px = parseFloat(s.fontSize);
    const grande = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700);
    const soglia = grande ? 3 : 4.5;
    if (rapporto < soglia) {
      fuori.push({ testo: testo.slice(0, 40), rapporto: Number(rapporto.toFixed(2)), soglia, px, colore: s.color, sfondo: opaco(n) });
    }
  }
  return fuori;
})()`;

for (const [larghezza, altezza, nomeVista] of [
  [1100, 900, 'largo'],
  [390, 844, 'telefono'],
]) {
  const contesto = await browser.newContext({ viewport: { width: larghezza, height: altezza } });
  const pagina = await contesto.newPage();

  for (const [percorso] of PAGINE) {
    for (const registro of ['giorno', 'sera']) {
      await pagina.goto(SITO + percorso, { waitUntil: 'networkidle' });
      await impostaRegistro(pagina, registro);
      const fuori = await pagina.evaluate(MISURA);
      esito(
        fuori.length === 0,
        `${nomeVista.padEnd(9)} ${percorso.padEnd(11)} ${registro.padEnd(7)} coppie sotto soglia = ${fuori.length}` +
          (fuori.length
            ? `\n        ${fuori
                .map((f) => `«${f.testo}» ${f.rapporto} < ${f.soglia} (${f.colore} su ${f.sfondo})`)
                .join('\n        ')}`
            : '')
      );

      // 🔴 E nessun testo nell'arancio di MARCA di giorno, ISPEZIONANDO gli elementi — non
      //    leggendo il CSS, che un test unitario ha già letto. Di sera l'arancio pieno è
      //    invece legittimo: fa 7.53.
      //
      // ⚠️ «Di giorno» è una proprietà del SOTTOALBERO, non della pagina. Due sezioni vivono
      //    sempre in registro sera dentro una pagina che può essere chiara — la lavagna in
      //    home e l'eroe dell'aperitivo — e lì l'arancio pieno è quello giusto. Un controllo
      //    che guardasse solo il tema della radice le segnalerebbe entrambe, e la reazione
      //    naturale sarebbe spegnere proprio la cosa che funziona.
      if (registro === 'giorno') {
        const arancioni = await pagina.$$eval('*', (nodi) =>
          nodi
            .filter((n) => n.children.length === 0 && (n.textContent ?? '').trim())
            .filter((n) => getComputedStyle(n).color.replace(/\s/g, '') === 'rgb(253,133,2)')
            .filter((n) => {
              const contenitore = n.closest('[data-tema]');
              return !contenitore || contenitore.getAttribute('data-tema') !== 'sera';
            })
            .map((n) => n.textContent.trim().slice(0, 40))
        );
        esito(
          arancioni.length === 0,
          `${nomeVista.padEnd(9)} ${percorso.padEnd(11)} giorno  testi nell'arancio di marca = ${arancioni.length}` +
            (arancioni.length ? ` → ${arancioni.join(' | ')}` : '')
        );
      }
    }
  }
  await contesto.close();
}

// ─────────────────────────────────────────────────────────────────────────────────────
// 3 — LE DIECI SCHERMATE, per guardarle.
// ─────────────────────────────────────────────────────────────────────────────────────
console.log('\n━━ 3 — la comparsa allo scorrimento, e le schermate ━━');
const contesto = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pagina = await contesto.newPage();

/**
 * Scorre la pagina a tappe, come farebbe una persona, e attende.
 *
 * 🔴 **Senza questo, ogni schermata a pagina intera è bianca sotto la piega** — e sembra un
 *    guasto grave. Le sezioni nascono a `opacity: 0` (lo scrive lo script, non il CSS: senza
 *    JavaScript restano visibili) e l'`IntersectionObserver` le accende quando entrano in
 *    vista. `fullPage: true` cattura ridimensionando il viewport, non scorrendo: l'osservatore
 *    non scatta, e la prova salva dieci immagini di una pagina vuota.
 *
 *    È costato un giro di diagnosi: la prima lettura di quelle schermate è stata «mancano
 *    metà delle sezioni».
 */
async function scorriTutto(p) {
  const altezza = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < altezza; y += 600) {
    await p.evaluate((n) => window.scrollTo({ top: n, behavior: 'instant' }), y);
    await p.waitForTimeout(120);
  }
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await p.waitForTimeout(500);
}

for (const [percorso, nome] of PAGINE) {
  for (const registro of ['giorno', 'sera']) {
    await pagina.goto(SITO + percorso, { waitUntil: 'networkidle' });
    await impostaRegistro(pagina, registro);
    await scorriTutto(pagina);

    // 🔴 Il controllo che il guasto peggiore non sia passato: se lo script della comparsa si
    //    rompe, le sezioni restano a `opacity: 0` per sempre — il contenuto c'è, l'HTML è
    //    perfetto, i test unitari sono verdi, e il sito è mezzo bianco. Nessuna prova che
    //    guardi il markup può vederlo.
    const spente = await pagina.$$eval('[data-comparsa]', (nodi) =>
      nodi
        .filter((n) => Number(getComputedStyle(n).opacity) < 0.99)
        .map((n) => (n.textContent ?? '').trim().slice(0, 30).replace(/\s+/g, ' '))
    );
    esito(
      spente.length === 0,
      `${percorso.padEnd(11)} ${registro.padEnd(7)} sezioni rimaste invisibili dopo lo scorrimento = ${spente.length}` +
        (spente.length ? ` → ${spente.join(' | ')}` : '')
    );

    await pagina.screenshot({ path: `${cartella}${nome}-${registro}.png`, fullPage: true });
  }
}
console.log(`  dieci schermate salvate in ${cartella}`);

// E il telefono, dove vive la barra fissa.
const telefono = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pt = await telefono.newPage();
for (const [percorso, nome] of PAGINE.slice(0, 2)) {
  await pt.goto(SITO + percorso, { waitUntil: 'networkidle' });
  await scorriTutto(pt);
  await pt.screenshot({ path: `${cartella}telefono-${nome}.png`, fullPage: true });
}

// ─────────────────────────────────────────────────────────────────────────────────────
// 4 — LA BARRA FISSA NON COPRE LE ULTIME RIGHE.
//
// È il difetto classico di `position: fixed`: non occupa spazio nel flusso, quindi la barra
// mangia il fondo della pagina. Si nota solo scorrendo fino in fondo — cioè dopo il deploy.
// ─────────────────────────────────────────────────────────────────────────────────────
console.log('\n━━ 4 — la barra fissa del telefono non copre il piè di pagina ━━');
await pt.goto(SITO + '/', { waitUntil: 'networkidle' });
// 🔴 `behavior: 'instant'` è OBBLIGATORIO, e la ragione sta nel foglio di stile del sito:
//    `html { scroll-behavior: smooth }`. Con lo scorrimento animato, `scrollTo` parte e la
//    misura arriva mentre la pagina è ancora a metà strada — su una home di duemila pixel,
//    a un terzo. La prima stesura di questa prova ha misurato l'ultima riga del piè di
//    pagina a 1305 px sotto la barra e ha dichiarato che era COPERTA: un fallimento
//    convincente, con dentro un numero enorme, prodotto interamente dal misuratore.
//
// ⚠️ Si scorre `documentElement` e non `body`: sono due altezze diverse, e quella giusta è
//    la prima.
await pt.evaluate(() =>
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })
);
await pt.waitForTimeout(400);

const sovrapposizione = await pt.evaluate(() => {
  const barra = document.querySelector('nav[aria-label="Azioni rapide"]');
  // ⚠️ `[data-pie-pagina]` e non `footer`: <footer> non è unico in pagina — ogni citazione
  //    della sezione recensioni ne ha uno suo, ed è l'uso corretto dell'elemento. Con
  //    `querySelector('footer')` questa prova prendeva il primo blockquote, che non contiene
  //    né p né a né span, e moriva su `undefined.getBoundingClientRect()`.
  const piede = document.querySelector('[data-pie-pagina]');
  if (!barra || !piede) return { errore: 'barra o piè di pagina assenti' };
  const b = barra.getBoundingClientRect();
  const ultimo = [...piede.querySelectorAll('p,a,span')].pop();
  if (!ultimo) return { errore: 'il piè di pagina non ha righe di testo' };
  const u = ultimo.getBoundingClientRect();
  return { coperto: u.bottom > b.top, testo: ultimo.textContent.trim().slice(0, 30) };
});
esito(
  sovrapposizione.errore === undefined && sovrapposizione.coperto === false,
  sovrapposizione.errore ??
    `l'ultima riga del piè di pagina («${sovrapposizione.testo}») ${
      sovrapposizione.coperto ? 'è COPERTA dalla' : 'sta sopra la'
    } barra fissa`
);
await telefono.close();

// ─────────────────────────────────────────────────────────────────────────────────────
// 5 — IL FUSO DEL VISITATORE NON CAMBIA IL TEMA.
// ─────────────────────────────────────────────────────────────────────────────────────
console.log('\n━━ 5 — il fuso del visitatore non decide il registro ━━');
const oraRoma = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'Europe/Rome',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
}).format(new Date());
const atteso = oraRoma >= '18:00' || oraRoma < '07:00' ? 'sera' : 'giorno';

for (const fuso of ['Europe/Rome', 'America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Kiritimati']) {
  const c = await browser.newContext({ timezoneId: fuso });
  const p = await c.newPage();
  await p.goto(SITO + '/', { waitUntil: 'domcontentloaded' });
  const tema = await p.getAttribute('html', 'data-tema');
  const oraLocale = await p.evaluate(() =>
    new Intl.DateTimeFormat('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date())
  );
  esito(
    tema === atteso,
    `fuso ${fuso.padEnd(22)} ora locale ${oraLocale}  →  registro ${tema} (atteso ${atteso}, a Roma sono le ${oraRoma})`
  );
  await c.close();
}

// ─────────────────────────────────────────────────────────────────────────────────────
// 6 — IL SELETTORE: TRE STATI, e l'icona dipinta prima del primo paint.
//
// ⚠️ Il mockup ha due stati. Il terzo, `auto`, è quello che fa decidere il registro
//    all'ORA DI ROMA, ed è l'idea stessa del doppio registro: senza, restano due skin.
// ─────────────────────────────────────────────────────────────────────────────────────
console.log('\n━━ 6 — tre stati, tre reload, e una sola icona visibile ━━');
await pagina.goto(SITO + '/', { waitUntil: 'networkidle' });
await pagina.evaluate(() => localStorage.removeItem('tema'));
await pagina.reload({ waitUntil: 'networkidle' });

for (const [clic, scelta] of [
  [1, 'giorno'],
  [2, 'sera'],
  [3, 'auto'],
]) {
  await pagina.click('#tema-switch');
  const memorizzato = await pagina.evaluate(() => localStorage.getItem('tema'));
  await pagina.reload({ waitUntil: 'networkidle' });
  const dopoReload = await pagina.evaluate(() => localStorage.getItem('tema'));
  const tema = await pagina.getAttribute('html', 'data-tema');
  const daRadice = await pagina.getAttribute('html', 'data-scelta');
  const etichetta = (await pagina.textContent('#tema-etichetta')).trim();

  // Una sola icona visibile: le tre convivono nel markup e le sceglie il CSS.
  const visibili = await pagina.$$eval('#tema-switch [data-icona]', (nodi) =>
    nodi.filter((n) => getComputedStyle(n).display !== 'none').map((n) => n.dataset.icona)
  );

  const parola = scelta === 'auto' ? 'automatico' : scelta;
  const coerente =
    memorizzato === scelta &&
    dopoReload === scelta &&
    daRadice === scelta &&
    (scelta === 'auto' ? tema === atteso : tema === scelta) &&
    etichetta.toLowerCase().includes(parola) &&
    visibili.length === 1 &&
    visibili[0] === scelta;

  esito(
    coerente,
    `clic ${clic} → «${scelta}»: localStorage=${dopoReload}, data-tema=${tema}, ` +
      `data-scelta=${daRadice}, etichetta=«${etichetta}», icone visibili=[${visibili.join(',')}]`
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────
// 7 — NESSUNA FRECCIA COME CARATTERE, in nessuna pagina.
//
// 🔴 U+2192 non è nel subset latino dei nostri caratteri, e i due vicini che ci sono
//    (U+2191 ↑, U+2193 ↓) rendono la cosa facilissima da dare per scontata. Una freccia
//    scritta come carattere viene dal ripiego di sistema: cambia forma fra le piattaforme e
//    su qualche Android non c'è affatto. Nel sito sono glifi SVG.
// ─────────────────────────────────────────────────────────────────────────────────────
console.log('\n━━ 7 — nessun → come carattere ━━');
for (const [percorso] of PAGINE) {
  await pagina.goto(SITO + percorso, { waitUntil: 'networkidle' });
  const conFreccia = await pagina.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter((n) => n.children.length === 0 && (n.textContent ?? '').includes('→'))
      .map((n) => n.textContent.trim().slice(0, 40))
  );
  esito(conFreccia.length === 0, `${percorso.padEnd(11)} frecce come carattere = ${conFreccia.length}`);
}

// ─────────────────────────────────────────────────────────────────────────────────────
// 8 — ZERO RICHIESTE AI CDN DEI CARATTERI, su tutte e cinque le pagine.
// ─────────────────────────────────────────────────────────────────────────────────────
console.log('\n━━ 8 — i caratteri sono nostri: zero richieste a Google ━━');
const ospiti = new Set();
const contatore = await browser.newContext();
const pf = await contatore.newPage();
pf.on('request', (r) => {
  if (r.resourceType() === 'font') ospiti.add(new URL(r.url()).host);
});
for (const [percorso] of PAGINE) {
  await pf.goto(SITO + percorso, { waitUntil: 'networkidle' });
}
const esterni = [...ospiti].filter((h) => /fonts\.(gstatic|googleapis)\.com/.test(h));
esito(
  esterni.length === 0,
  `host dei caratteri richiesti: ${[...ospiti].join(', ') || '(nessuno)'} — esterni: ${esterni.length}`
);
await contatore.close();

console.log(`\n═══ VERIFICHE FALLITE: ${problemi} ═══`);
await browser.close();
process.exit(problemi === 0 ? 0 : 1);
