// La sitemap, scritta a mano invece che con `@astrojs/sitemap`.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 PERCHÉ NON L'INTEGRAZIONE UFFICIALE
//
// `@astrojs/sitemap` genera la sitemap **in fase di build**, elencando le pagine che sa
// enumerare: quelle **prerenderizzate**. Questo sito è `output: 'server'` e non ha una sola
// pagina prerenderizzata — leggono tutte dati vivi a ogni richiesta. L'integrazione
// produrrebbe quindi una sitemap **vuota**, o quasi: un file valido, servito con successo,
// che dice ai motori che il sito non ha pagine.
//
// ⚠️ Ed è il tipo di guasto che non si vede: nessun errore di build, nessun 404, nessun test
//    rosso. Si scopre settimane dopo, guardando perché nessuno arriva.
//
// Le rotte sono cinque e vivono già in un posto solo, `lib/rotte.ts`, che è la stessa lista
// che disegna la navigazione. Enumerarle qui costa venti righe e non può divergere da ciò
// che il sito mostra davvero.
// ═══════════════════════════════════════════════════════════════════════════════════════

import type { APIRoute } from 'astro';
import { rotteDisponibili } from '../lib/rotte.ts';
import { leggiSito } from '../lib/api.ts';

export const GET: APIRoute = async ({ site, url }) => {
  // 🔴 La sitemap **legge l'identità**, e non è uno spreco: due rotte esistono solo se il loro
  //    testo è stato scritto, e senza questa lettura la sitemap dichiarerebbe ai motori due
  //    URL che rispondono 404. È il tipo di errore che non produce alcun sintomo — nessuna
  //    build fallisce, nessuna pagina si rompe — e che si scopre nella Search Console
  //    settimane dopo, se qualcuno la guarda.
  //
  // ⚠️ In degradazione (`sito === null`) si elencano tutte: non si sa cosa esiste, e una
  //    sitemap dimezzata perché l'API era giù per un minuto è peggio di una che elenca troppo.
  const esito = await leggiSito();
  const sito = esito.stato === 'ok' ? esito.dati : null;

  // ⚠️ `site` viene da `astro.config.mjs` ed è l'origine PUBBLICA. Il ripiego su `url` esiste
  //    solo perché il tipo lo ammette: in produzione `url` è l'host interno visto da dietro
  //    nginx, e una sitemap che elencasse quello manderebbe i motori su un host che per
  //    nessun visitatore esiste.
  const origine = site ?? new URL('/', url);

  const voci = rotteDisponibili(sito).map((rotta) => {
    const indirizzo = new URL(rotta.percorso, origine).href;
    return `  <url>
    <loc>${indirizzo}</loc>
    <priority>${rotta.priorita.toFixed(1)}</priority>
  </url>`;
  }).join('\n');

  // ⚠️ Nessun `<lastmod>`: sarebbe una data d'orologio del server, e i contenuti di queste
  //    pagine cambiano quando li cambia l'amministratore — non a ogni richiesta. Un lastmod
  //    sempre uguale a "adesso" dice ai motori che tutto è cambiato sempre, ed è il modo più
  //    veloce per farsi ignorare quel campo per sempre.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${voci}
</urlset>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Un giorno: la lista delle rotte cambia con un deploy, non con un salvataggio in
      // amministrazione.
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
