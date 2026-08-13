// Cattura confrontabile del sito, per il task 0.2 (e per il confronto del task 4.8).
//
// 🔴 Perché esiste. La spec `sito-pubblico` pretende che la prova di non regressione sia una
//    cattura prima/dopo **confrontabile con un diff**, non una lettura a occhio: la classe di
//    guasto che questo change rischia si manifesta come una pagina *quasi* uguale.
//
// Si esegue due volte per stato (`pubblicato` e `svuotato`), e produce per ciascuna pagina:
//   - il codice HTTP;
//   - l'HTML integrale;
//   - l'elenco ORDINATO delle chiavi immagine e del tag che le porta (posizione nel documento);
//   - le voci di navigazione di intestazione e piè di pagina;
//   - la sitemap.
//
// ⚠️ L'HTML integrale si salva ma NON si confronta riga per riga: contiene marcatori di dev
//    server e orari di apertura che cambiano da soli. Il confronto del task 4.8 è sui file
//    `.json` — codici, chiavi immagine, navigazione, sitemap — che sono le grandezze che la
//    spec elenca.

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = dirname(fileURLToPath(import.meta.url));
const ORIGINE = process.env.ORIGINE_SITO ?? 'http://localhost:4321';
const STATO = process.argv[2];

if (!STATO) {
  console.error('Uso: node cattura.mjs <prima|dopo>/<pubblicato|svuotato>');
  process.exit(1);
}

const PAGINE = ['/', '/menu', '/aperitivo', '/locale', '/contatti'];

/**
 * Le chiavi immagine, **in ordine di documento**, con il tag che le porta.
 *
 * 🔴 Per tag e non per occorrenza grezza: un `<picture>` ripete la stessa chiave in ogni
 *    `<source>` e nell'`<img>` di ripiego, e contarle tutte darebbe un elenco che cambia
 *    quando cambia il numero di varianti invece di quando cambia la foto.
 */
function chiaviImmagine(html) {
  return [...html.matchAll(/<(img|source|meta)\b[^>]*>/gi)]
    .map((incontro) => {
      const tag = incontro[0];
      const chiave = tag.match(/\/media\/(.+?)\/\d+\.(?:webp|jpg)/);
      if (!chiave) return null;
      const proprieta = tag.match(/property="([^"]+)"/);
      return { tag: incontro[1].toLowerCase() + (proprieta ? `[${proprieta[1]}]` : ''), chiave: chiave[1] };
    })
    .filter(Boolean);
}

/** Le voci di un `<nav aria-label="…">`: percorso ed etichetta, nell'ordine reso. */
function vociNavigazione(html, etichetta) {
  const blocco = html.match(new RegExp(`<nav[^>]*aria-label="${etichetta}"[^>]*>([\\s\\S]*?)</nav>`, 'i'));
  if (!blocco) return null;
  return [...blocco[1].matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((ancora) => ({
    percorso: ancora[1],
    etichetta: ancora[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
  }));
}

const cartella = resolve(RADICE, STATO);
mkdirSync(cartella, { recursive: true });

const riepilogo = await PAGINE.reduce(async (precedenti, percorso) => {
  const accumulato = await precedenti;
  const risposta = await fetch(`${ORIGINE}${percorso}`, { redirect: 'manual' });
  const html = await risposta.text();
  const nome = percorso === '/' ? 'home' : percorso.slice(1);

  writeFileSync(resolve(cartella, `${nome}.html`), html, 'utf8');

  return [
    ...accumulato,
    {
      percorso,
      stato: risposta.status,
      cacheControl: risposta.headers.get('cache-control'),
      immagini: chiaviImmagine(html),
      navIntestazione: vociNavigazione(html, 'Principale'),
      navPiePagina: vociNavigazione(html, 'Piè di pagina'),
    },
  ];
}, Promise.resolve([]));

// La sitemap: è una delle grandezze che la spec elenca, e viene dallo stesso filtro della
// navigazione — quindi una divergenza fra le due è già di per sé il guasto da rilevare.
const rispostaSitemap = await fetch(`${ORIGINE}/sitemap.xml`);
const sitemap = await rispostaSitemap.text();
writeFileSync(resolve(cartella, 'sitemap.xml'), sitemap, 'utf8');

// La galleria grezza del backend: è l'ingresso di tutte le regole posizionali, e senza di lei
// un confronto fra due catture non saprebbe distinguere «il codice è cambiato» da «qualcuno ha
// caricato una foto nel frattempo».
const rispostaGalleria = await fetch(`${process.env.ORIGINE_API ?? 'https://localhost:4000'}/api/public/galleria`);
const galleria = await rispostaGalleria.json();

writeFileSync(
  resolve(cartella, 'riepilogo.json'),
  JSON.stringify(
    {
      stato: STATO,
      pagine: riepilogo,
      sitemap: [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((voce) => voce[1]),
      galleriaSorgente: galleria.immagini.map((immagine) => immagine.chiave),
    },
    null,
    2
  ) + '\n',
  'utf8'
);

console.log(`Cattura «${STATO}» salvata in ${cartella}`);
riepilogo.forEach((pagina) =>
  console.log(
    `  ${pagina.percorso.padEnd(11)} ${pagina.stato}  immagini: ${pagina.immagini.map((i) => i.chiave).join(' | ') || '(nessuna)'}`
  )
);
console.log(`  sitemap: ${[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((v) => v[1]).join(' ')}`);
