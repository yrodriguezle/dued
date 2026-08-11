export type FormatoMedia = "webp" | "jpg";

/**
 * URL di una variante di un media. **Unico punto del frontend che compone un URL di media.**
 *
 * Il database conserva solo la chiave (`"2026/08/caffe-a1b2c3"`): nessuno schema, nessun host,
 * nessun prefisso `/media`. Il prefisso è un dettaglio di *serving* — in sviluppo lo serve .NET
 * con UseStaticFiles, in produzione nginx con un alias — e tenerlo fuori dal dato significa che
 * un dump di produzione ripristinato in locale mostra le immagini invece di 500 link rotti.
 *
 * Non c'è alcun ramo per ambiente, e non è una semplificazione: `API_ENDPOINT` punta, in
 * entrambi gli ambienti, all'host che serve `/media/`. È lo stesso pattern di `makeRequest`
 * per `/api/`.
 */
export function mediaUrl(chiave: string, larghezza: number, formato: FormatoMedia = "webp"): string {
  return `${(window as Global).API_ENDPOINT}/media/${chiave}/${larghezza}.${formato}`;
}

/**
 * `srcset` pronto per un `<img>`, nell'ordine in cui le larghezze arrivano dal server.
 *
 * Le larghezze vanno prese da `larghezzeDisponibili` del MediaAsset e mai dedotte: la pipeline
 * non fa upscaling, quindi una sorgente da 900 px produce solo 400 e 800. Inventare le altre
 * significherebbe mettere nel srcset URL che rispondono 404, con un guasto che degrada in
 * silenzio e in modo diverso da browser a browser.
 */
export function mediaSrcSet(chiave: string, larghezze: number[], formato: FormatoMedia = "webp"): string {
  return larghezze.map((larghezza) => `${mediaUrl(chiave, larghezza, formato)} ${larghezza}w`).join(", ");
}

/**
 * La variante più piccola che copra la larghezza desiderata, o la più grande esistente se
 * nessuna la raggiunge. Serve alle anteprime: chiedere sempre 400 significherebbe emettere un
 * 404 su ogni immagine la cui sorgente era più stretta di 400 px.
 */
export function larghezzaAnteprima(larghezzeDisponibili: number[], desiderata = 400): number | null {
  if (!larghezzeDisponibili.length) {
    return null;
  }
  const ordinate = [...larghezzeDisponibili].sort((a, b) => a - b);
  return ordinate.find((larghezza) => larghezza >= desiderata) ?? ordinate[ordinate.length - 1];
}
