// Le pagine del sito, in un posto solo.
//
// Le legge la navigazione dell'intestazione e le legge il piè di pagina. 🔴 Il mockup
// cambia pagina con uno **stato client-side** (`this.setState({ page })`): qui sono **rotte
// vere**, e non è un dettaglio di implementazione. Sono le pagine che la gente cerca —
// «apericosto thiene» è una ricerca — e uno switch client-side le renderebbe un URL solo,
// indicizzabile una volta.
//
// ⚠️ Il mockup ha una sesta voce, «Mobile»: è un mostrino con tre telefoni disegnati, serve
//    a far vedere il layout stretto, e **non è una pagina del sito**.

export interface Rotta {
  percorso: string;
  etichetta: string;
  /** Per `<title>` e per la voce di sitemap: quanto conta rispetto alla home. */
  priorita: number;
}

export const ROTTE: readonly Rotta[] = [
  { percorso: '/', etichetta: 'Home', priorita: 1.0 },
  { percorso: '/menu', etichetta: 'Menu', priorita: 0.9 },
  { percorso: '/aperitivo', etichetta: 'Aperitivo', priorita: 0.8 },
  { percorso: '/locale', etichetta: 'Il locale', priorita: 0.6 },
  { percorso: '/contatti', etichetta: 'Contatti', priorita: 0.7 },
] as const;

/**
 * Se la rotta è quella corrente.
 *
 * ⚠️ Il confronto normalizza la barra finale. Astro serve `/menu` e `/menu/` come la stessa
 *    pagina, e un confronto secco marcherebbe come "non attiva" la voce nella metà dei casi
 *    — a seconda di come ci si è arrivati, il che è il tipo di differenza che nessuno
 *    riproduce quando gliela si segnala.
 */
export function eCorrente(percorsoRotta: string, percorsoPagina: string): boolean {
  const pulisci = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);
  return pulisci(percorsoRotta) === pulisci(percorsoPagina);
}
