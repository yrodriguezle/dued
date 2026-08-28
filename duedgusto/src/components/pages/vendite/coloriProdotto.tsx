/**
 * I colori delle tessere del punto vendita: **la tinta dice la categoria, la banda dice
 * l'articolo**.
 *
 * <p>Lo scopo è riconoscere il pulsante senza leggerlo. Due informazioni diverse su due canali
 * diversi, così non competono: lo sfondo appena tinto dà la zona della categoria con la coda
 * dell'occhio, la banda satura sul bordo separa un articolo dal suo vicino quando il dito è
 * già sopra.</p>
 *
 * <p>⚠️ <b>Il colore non identifica 122 articoli, e non ci prova.</b> Colori distinguibili a
 * memoria ce ne sono una decina, non centoventidue: quello che identifica la consumazione è
 * categoria + posizione stabile nella griglia + nome. La variazione dentro la categoria serve
 * a non far collidere i vicini, non a dare un'identità assoluta a ogni voce.</p>
 */

export type ModoTema = "light" | "dark";

interface TintaCategoria {
  tinta: number;
  saturazione: number;
}

/**
 * Le dieci categorie del listino 2026.
 *
 * <p>🔴 <b>Le tinte sono spaziate, non semantiche</b> — dove le due cose litigano vince la
 * spaziatura. Quattro categorie su dieci (caffetteria, brioches, aperitivo, birra) vorrebbero
 * tutte la stessa fetta di arancione: darglielo le renderebbe indistinguibili, che è
 * esattamente il contrario di quello che serve qui. Caffè bruno, brioche ambra, spritz rosso
 * e vino bordeaux tengono il colore che uno si aspetta; la birra sta nel blu perché l'oro era
 * già della brioche. È un'associazione che si impara in un turno.</p>
 *
 * <p>Aperitivo (8°) e caffetteria (25°) sono i due più vicini in tinta: li separa la
 * saturazione, viva contro spenta.</p>
 */
const CATEGORIE_NOTE: Record<string, TintaCategoria> = {
  APERITIVO: { tinta: 8, saturazione: 78 },
  CAFFETTERIA: { tinta: 25, saturazione: 45 },
  BRIOCHES: { tinta: 52, saturazione: 72 },
  CUCINA: { tinta: 100, saturazione: 42 },
  PROSECCO: { tinta: 145, saturazione: 45 },
  BIBITE: { tinta: 188, saturazione: 62 },
  BIRRA: { tinta: 218, saturazione: 58 },
  LIQUORI: { tinta: 258, saturazione: 45 },
  COCKTAIL: { tinta: 295, saturazione: 55 },
  VINO: { tinta: 338, saturazione: 55 },
};

/** Un prodotto senza categoria resta grigio: un colore inventato direbbe una cosa falsa. */
const SENZA_CATEGORIA: TintaCategoria = { tinta: 0, saturazione: 0 };

/**
 * Il ripiego per una categoria che non è nella mappa — l'anagrafica è libera e l'amministratore
 * può crearne di nuove dalla pagina Prodotti. Deterministico sul nome: la stessa categoria
 * riceve la stessa tinta a ogni caricamento, e può capitare che si avvicini a una nota.
 */
const tintaDaNome = (nome: string): TintaCategoria => {
  let accumulatore = 0;
  for (let i = 0; i < nome.length; i += 1) {
    accumulatore = (accumulatore * 31 + nome.charCodeAt(i)) % 360;
  }
  return { tinta: accumulatore, saturazione: 50 };
};

// Due assi con periodi coprimi (4 luminosità × 3 scarti di tinta = 12 combinazioni) invece di una
// rampa da N passi: con 30 voci in CAFFETTERIA una rampa darebbe scalini invisibili. Così due
// tessere adiacenti sono sempre ben separate, e la ripetizione cade lontano nella griglia.
const LIVELLI_SFONDO_CHIARO = [90, 85, 82, 88];
const LIVELLI_SFONDO_SCURO = [16, 20, 24, 18];
const LIVELLI_BANDA_CHIARO = [44, 52, 36, 60];
const LIVELLI_BANDA_SCURO = [56, 64, 48, 72];
const SCARTI_TINTA = [0, -10, 10];

export interface ColoreProdotto {
  /** Tinta tenue per l'intera tessera: la categoria, da lontano. */
  sfondo: string;
  /** Fascia satura sul bordo sinistro: l'articolo, da vicino. */
  banda: string;
}

/**
 * Il colore di una tessera.
 *
 * <p>🔴 <b>`indice` è la posizione del prodotto dentro la sua categoria nel listino intero</b>,
 * mai dentro la lista filtrata a schermo. Legarlo a quello che si vede farebbe cambiare colore
 * alle tessere a ogni lettera digitata nella ricerca — e un colore che si muove è peggio di
 * nessun colore, perché la mano ha già imparato dov'era.</p>
 */
export function coloreProdotto(categoria: string | null | undefined, indice: number, modo: ModoTema): ColoreProdotto {
  const nome = categoria?.trim().toUpperCase();
  const base = !nome ? SENZA_CATEGORIA : (CATEGORIE_NOTE[nome] ?? tintaDaNome(nome));

  const passo = Number.isFinite(indice) && indice > 0 ? Math.floor(indice) : 0;
  const scarto = base.saturazione === 0 ? 0 : SCARTI_TINTA[passo % SCARTI_TINTA.length];
  const tinta = (base.tinta + scarto + 360) % 360;

  const chiaro = modo === "light";
  const livelloSfondo = (chiaro ? LIVELLI_SFONDO_CHIARO : LIVELLI_SFONDO_SCURO)[passo % LIVELLI_SFONDO_CHIARO.length];
  const livelloBanda = (chiaro ? LIVELLI_BANDA_CHIARO : LIVELLI_BANDA_SCURO)[passo % LIVELLI_BANDA_CHIARO.length];

  // Lo sfondo tiene una frazione della saturazione: a piena forza il testo del tema ci perde
  // contrasto e la griglia diventa un mosaico da luna park.
  const saturazioneSfondo = Math.round(base.saturazione * (chiaro ? 0.75 : 0.45));

  return {
    sfondo: `hsl(${tinta}, ${saturazioneSfondo}%, ${livelloSfondo}%)`,
    banda: `hsl(${tinta}, ${base.saturazione}%, ${livelloBanda}%)`,
  };
}

/**
 * Il colore pieno di una categoria, per il pallino sui chip del filtro: è lì che si impara
 * l'associazione categoria→tinta, prima ancora di guardare la griglia.
 */
export function coloreCategoria(categoria: string | null | undefined, modo: ModoTema): string {
  return coloreProdotto(categoria, 0, modo).banda;
}

/**
 * La posizione di ogni prodotto dentro la propria categoria, presa sul listino **intero**.
 *
 * <p>Ordina per codice invece di fidarsi dell'ordine di consegna: il resolver oggi fa
 * `OrderBy(p => p.Codice)`, ma il colore di una tessera non deve dipendere da una clausola
 * che vive dall'altra parte della rete.</p>
 */
export function indiciPerCategoria(prodotti: readonly ProdottoVendibile[]): Map<number, number> {
  const conteggi = new Map<string, number>();
  const indici = new Map<number, number>();

  [...prodotti]
    .sort((primo, secondo) => primo.codice.localeCompare(secondo.codice))
    .forEach((prodotto) => {
      const chiave = prodotto.categoria?.trim().toUpperCase() ?? "";
      const prossimo = conteggi.get(chiave) ?? 0;
      indici.set(prodotto.prodottoId, prossimo);
      conteggi.set(chiave, prossimo + 1);
    });

  return indici;
}
