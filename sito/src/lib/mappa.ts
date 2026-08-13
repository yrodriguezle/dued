// Come questo sito porta la gente in Via del Costo.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 NON C'È ALCUNA MAPPA INCORPORATA, ED È UNA DECISIONE
//
// Il mockup disegna un riquadro «mappa interattiva» in due pagine. Le tre vie per farlo
// esistere davvero, e i loro costi:
//
//   • **iframe di Google Maps** — scrive cookie di terze parti e contatta Google al
//     caricamento della pagina, cioè **prima** che il visitatore abbia chiesto una mappa.
//     Servirebbe un banner di consenso: oggi questo sito non ne ha alcuno, e non ne ha
//     bisogno, precisamente perché non ha alcuna terza parte. Sarebbe la prima, e si
//     porterebbe dietro tutta l'infrastruttura del consenso per un riquadro decorativo.
//   • **Leaflet + tile OSM** — nessuna chiave e nessun cookie, ma resta una richiesta a
//     `tile.openstreetmap.org` per ogni riquadro visibile, più ~40 kB di JavaScript, contro
//     un budget dichiarato di meno di 60 kB in tutto. E la usage policy di OSM chiede di non
//     appoggiarsi ai loro tile per traffico di produzione.
//   • **immagine statica** — nessuna richiesta a runtime, ma per *produrla* serve comunque
//     un servizio di mappe, e ridistribuire uno screenshot di Google Maps è contro le sue
//     condizioni.
//
// Quello che la gente vuole da quel riquadro, però, non è guardare una mappa: è **arrivare**.
// E l'azione «arrivare» sul telefono apre comunque l'app di mappe di sistema. Il sito rende
// quindi un riquadro disegnato con l'indirizzo e due uscite esplicite. Zero terze parti, zero
// consenso, zero JavaScript — e il gesto utile è a un tocco invece che a due.
//
// ⚠️ Se un giorno si volesse la mappa vera in pagina, è una **scelta consapevole** con un
//    prezzo (il banner di consenso), non una svista da correggere.
// ═══════════════════════════════════════════════════════════════════════════════════════

import type { SitoPubblico } from './tipi.ts';

/**
 * L'URL per «Indicazioni».
 *
 * 🔴 Preferisce le **coordinate** all'indirizzo quando ci sono: un indirizzo si risolve con
 *    una ricerca testuale, e «Via del Costo 99» esiste in più di un comune. Le coordinate
 *    non hanno omonimi.
 *
 * ⚠️ `sito.geo` è `null` *tutto intero* quando non è impostato — mai una coppia di zeri, che
 *    sarebbe una mappa capace di indicare con sicurezza un punto nel Golfo di Guinea. Il
 *    ramo dell'indirizzo non è un ripiego teorico: oggi è quello che si usa.
 */
export function urlIndicazioni(sito: SitoPubblico): string {
  if (sito.geo) {
    const { latitudine, longitudine } = sito.geo;
    return `https://www.google.com/maps/dir/?api=1&destination=${latitudine},${longitudine}`;
  }
  const { via, cap, citta, provincia } = sito.indirizzo;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${via}, ${cap} ${citta} ${provincia}`
  )}`;
}

/** L'URL per «vedi dov'è», che è una cosa diversa da «portami lì». */
export function urlLuogo(sito: SitoPubblico): string {
  if (sito.geo) {
    const { latitudine, longitudine } = sito.geo;
    return `https://www.google.com/maps/search/?api=1&query=${latitudine},${longitudine}`;
  }
  const { via, cap, citta, provincia } = sito.indirizzo;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${via}, ${cap} ${citta} ${provincia}`
  )}`;
}
