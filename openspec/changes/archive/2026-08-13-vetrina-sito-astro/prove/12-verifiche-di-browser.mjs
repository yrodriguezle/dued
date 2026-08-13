// Le verifiche di chiusura che richiedono un browser vero — task 12.3 … 12.8.
//
// Sono quelle che «se non hanno un task proprio non verranno fatte»: verranno *dichiarate
// fatte per somiglianza*, che è il modo in cui un criterio di successo smette di
// significare qualcosa. Qui vengono eseguite, e ogni numero stampato è misurato.
//
// Si esegue contro il BUNDLE COSTRUITO, non contro il dev server: i due falliscono in modi
// diversi, e la Fase 6 del progetto spedirà il secondo.

import { mkdirSync } from 'node:fs';
import playwright from '../../../../duedgusto/node_modules/playwright/index.js';
const { chromium } = playwright;

const SITO = process.argv[2] ?? 'http://127.0.0.1:4399';
const cartella = new URL('.', import.meta.url).pathname.slice(1);
mkdirSync(cartella + '12-fouc', { recursive: true });

let problemi = 0;
const esito = (ok, riga) => {
  if (!ok) problemi++;
  console.log(`${ok ? '  ok  ' : ' FALLITA '} ${riga}`);
};


/**
 * Imposta il registro e ATTENDE che le transizioni finiscano.
 *
 * ⚠️ Senza l'attesa la misura corre contro `transition-colors`, e il primo giro di questa
 *    prova ha misurato il selettore del tema a **2.11** di contrasto — che sembrava un
 *    difetto di accessibilità vero, e non lo era: il colore era **a metà strada** fra i due
 *    registri, catturato mentre interpolava. La variabile CSS era già quella giusta
 *    (`--c-inchiostro-tenue: #c9bcae`) e il `color` calcolato era ancora un valore di
 *    passaggio (`rgb(78, 89, 46)`).
 *
 *    Il contrasto si misura sullo STATO STABILE, che è quello che il visitatore legge.
 */
async function impostaRegistro(pagina, registro) {
  await pagina.evaluate((r) => document.documentElement.setAttribute('data-tema', r), registro);
  await pagina.waitForTimeout(600);
}

const browser = await chromium.launch();

// ─────────────────────────────────────────────────────────────────────────────────────
// 12.3 — NESSUN FOUC, in condizioni sfavorevoli.
//
// 🔴 Un solo lampo chiaro all'apertura in tema sera fa fallire il criterio: non «quasi
//    mai», non «solo la prima volta». Per questo la prova gira con la cache disattivata e
//    la rete rallentata — le condizioni in cui il lampo, se c'è, dura abbastanza da vedersi
//    — e campiona il colore del pixel in alto a sinistra nei primi millisecondi.
// ─────────────────────────────────────────────────────────────────────────────────────
console.log('\n━━ 12.3 — dieci hard reload per combinazione, cache off e rete lenta ━━');

/**
 * Un campione dello stato del documento: registro deciso e chiarezza del fondo.
 *
 * ⚠️ Tutto è opzionale, e non per prudenza: `waitUntil: 'commit'` ritorna quando la
 *    navigazione è **impegnata**, cioè quando `document.documentElement` può ancora non
 *    esistere. È precisamente l'istante che interessa — se il campionamento sollevasse lì,
 *    la prova salterebbe il momento in cui il lampo vive.
 */
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

  // Rete lenta: se il registro venisse deciso dopo il CSS, il lampo durerebbe.
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
    // I primi 400 ms, un campione ogni ~50 ms: è la finestra in cui un lampo vive.
    for (let t = 0; t < 8; t++) {
      const { tema, chiaro } = await campiona(pagina);
      campioni.push(`${tema ?? '—'}/${chiaro === null ? '—' : chiaro ? 'chiaro' : 'scuro'}`);
      // 🔴 Il lampo è: registro `sera` già deciso e fondo ancora chiaro.
      if (tema === 'sera' && chiaro === true) {
        lampi++;
        await pagina.screenshot({ path: `${cartella}12-fouc/12.3-lampo-${stato}-${giro}-${t}.png` });
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  const registri = [...new Set(campioni.map((c) => c.split('/')[0]))].join(', ');
  esito(lampi === 0, `stato «${stato}»: 10 reload × 8 campioni — lampi: ${lampi} (registri visti: ${registri})`);
  await contesto.close();
}

// ─────────────────────────────────────────────────────────────────────────────────────
// 12.4 — CONTRASTO MISURATO SUL RENDERING, non letto nel CSS.
// ─────────────────────────────────────────────────────────────────────────────────────
console.log('\n━━ 12.4 — contrasto misurato sulle coppie testo/sfondo reali ━━');

const contesto = await browser.newContext();
const pagina = await contesto.newPage({ viewport: { width: 1100, height: 900 } });

/** WCAG, calcolato in pagina risalendo allo sfondo effettivo di ogni nodo di testo. */
const MISURA = `(() => {
  const lum = (c) => {
    const [r, g, b] = c.match(/[\\d.]+/g).slice(0, 3).map(Number).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const opaco = (n) => {
    for (let e = n; e; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor;
      if (c && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(c)) return c;
    }
    return 'rgb(255,255,255)';
  };
  const fuori = [];
  for (const n of document.querySelectorAll('h1,h2,h3,p,a,span,li,abbr,address,button')) {
    const testo = (n.textContent ?? '').trim();
    if (!testo || n.children.length > 0) continue;
    const s = getComputedStyle(n);
    if (s.visibility === 'hidden' || s.display === 'none' || n.offsetParent === null) continue;
    const [a, b] = [lum(s.color), lum(opaco(n))].sort((x, y) => y - x);
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

for (const percorso of ['/', '/menu']) {
  for (const registro of ['giorno', 'sera']) {
    await pagina.goto(SITO + percorso, { waitUntil: 'networkidle' });
    await impostaRegistro(pagina, registro);
    const fuori = await pagina.evaluate(MISURA);
    esito(
      fuori.length === 0,
      `${percorso} in tema ${registro}: coppie sotto soglia = ${fuori.length}` +
        (fuori.length ? `\n        ${fuori.map((f) => `«${f.testo}» ${f.rapporto} < ${f.soglia} (${f.colore} su ${f.sfondo})`).join('\n        ')}` : '')
    );

    // 🔴 E nessun testo arancione di giorno, ISPEZIONANDO gli elementi — non leggendo il
    //    CSS, che un altro test ha già letto.
    const arancioni = await pagina.$$eval('*', (nodi) =>
      nodi
        .filter((n) => n.children.length === 0 && (n.textContent ?? '').trim())
        .filter((n) => getComputedStyle(n).color.replace(/\s/g, '') === 'rgb(253,133,2)')
        .map((n) => n.textContent.trim().slice(0, 40))
    );
    esito(arancioni.length === 0, `${percorso} in tema ${registro}: testi in arancio = ${arancioni.length}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────
// 12.5 — I DUE REGISTRI AFFIANCATI, negli stessi punti.
// ─────────────────────────────────────────────────────────────────────────────────────
console.log('\n━━ 12.5 — schermate dei due registri, stesse pagine e stessi punti ━━');
for (const [percorso, nome] of [['/', 'home'], ['/menu', 'menu']]) {
  for (const registro of ['giorno', 'sera']) {
    await pagina.goto(SITO + percorso, { waitUntil: 'networkidle' });
    await impostaRegistro(pagina, registro);
    await pagina.screenshot({ path: `${cartella}12.5-${nome}-${registro}.png`, fullPage: true });
  }
}
console.log('  quattro schermate salvate: 12.5-{home,menu}-{giorno,sera}.png');

// ─────────────────────────────────────────────────────────────────────────────────────
// 12.6 — IL FUSO DEL VISITATORE NON CAMBIA IL TEMA.
// ─────────────────────────────────────────────────────────────────────────────────────
console.log('\n━━ 12.6 — il fuso del visitatore non decide il registro ━━');
const oraRoma = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(new Date());
const atteso = oraRoma >= '18:00' || oraRoma < '07:00' ? 'sera' : 'giorno';

for (const fuso of ['Europe/Rome', 'America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Kiritimati']) {
  const c = await browser.newContext({ timezoneId: fuso });
  const p = await c.newPage();
  await p.goto(SITO + '/', { waitUntil: 'domcontentloaded' });
  const tema = await p.getAttribute('html', 'data-tema');
  const oraLocale = await p.evaluate(() =>
    new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())
  );
  esito(tema === atteso, `fuso ${fuso.padEnd(22)} ora locale ${oraLocale}  →  registro ${tema} (atteso ${atteso}, a Roma sono le ${oraRoma})`);
  await c.close();
}

// ─────────────────────────────────────────────────────────────────────────────────────
// 12.7 — IL TOGGLE SOPRAVVIVE AL RELOAD, giro completo.
// ─────────────────────────────────────────────────────────────────────────────────────
console.log('\n━━ 12.7 — tre stati, tre reload ━━');
await pagina.goto(SITO + '/', { waitUntil: 'networkidle' });
await pagina.evaluate(() => localStorage.removeItem('tema'));
await pagina.reload({ waitUntil: 'networkidle' });

for (const [clic, scelta] of [[1, 'giorno'], [2, 'sera'], [3, 'auto']]) {
  await pagina.click('#tema-switch');
  const memorizzato = await pagina.evaluate(() => localStorage.getItem('tema'));
  await pagina.reload({ waitUntil: 'networkidle' });
  const dopoReload = await pagina.evaluate(() => localStorage.getItem('tema'));
  const tema = await pagina.getAttribute('html', 'data-tema');
  const etichetta = (await pagina.textContent('#tema-etichetta')).trim();
  const coerente =
    memorizzato === scelta &&
    dopoReload === scelta &&
    (scelta === 'auto' ? tema === atteso : tema === scelta) &&
    etichetta.toLowerCase() === scelta;
  esito(coerente, `clic ${clic} → «${scelta}»: dopo il reload localStorage=${dopoReload}, data-tema=${tema}, etichetta=«${etichetta}»`);
}

// ─────────────────────────────────────────────────────────────────────────────────────
// 12.8 — IL LOGO SEGUE IL TEMA, E L'ISPEZIONE SPIEGA PERCHÉ.
// ─────────────────────────────────────────────────────────────────────────────────────
console.log('\n━━ 12.8 — il logo, e la diagnosi invece della sola constatazione ━━');
await pagina.goto(SITO + '/', { waitUntil: 'networkidle' });

const tagDelLogo = await pagina.$$eval('header svg, header img', (n) => n.map((e) => e.tagName.toLowerCase()));
esito(
  tagDelLogo.includes('svg') && !tagDelLogo.includes('img'),
  `nell'intestazione il logo è: ${tagDelLogo.join(', ')} — un <img> qui sarebbe un documento isolato, e currentColor si risolverebbe al nero`
);

for (const registro of ['giorno', 'sera']) {
  await impostaRegistro(pagina, registro);
  const { colore, sfondo, rapporto } = await pagina.evaluate(() => {
    const svg = document.querySelector('header svg');
    const c = getComputedStyle(svg).color;
    const s = getComputedStyle(document.body).backgroundColor;
    const lum = (x) => {
      const [r, g, b] = x.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => {
        const u = v / 255;
        return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [a, b] = [lum(c), lum(s)].sort((x, y) => y - x);
    return { colore: c, sfondo: s, rapporto: Number(((a + 0.05) / (b + 0.05)).toFixed(2)) };
  });
  esito(rapporto >= 4.5, `registro ${registro}: tracciato ${colore} su ${sfondo} — contrasto ${rapporto}`);
  await pagina.screenshot({ path: `${cartella}12.8-logo-${registro}.png`, clip: { x: 0, y: 0, width: 400, height: 120 } });
}

console.log(`\n═══ VERIFICHE FALLITE: ${problemi} ═══`);
await browser.close();
process.exit(problemi === 0 ? 0 : 1);
