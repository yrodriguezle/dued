// Trasformazione pura dei totali annuali (RiepilogoDashboard["totaliAnno"])
// nei dati del flusso di cassa: usata sia dal Sankey Recharts
// (SankeyFlussoCassa) sia dal fallback a barre impilate x-charts
// (FlussoCassaBarreImpilate), così i due grafici mostrano SEMPRE gli stessi
// aggregati. Nessuna dipendenza da React o dalle librerie grafiche:
// interamente testabile in isolamento.
import formatCurrency from "../../../../common/bones/formatCurrency";

/** Chiave semantica della palette (useChartPalette) per nodi e link. */
export type ChiaveColoreFlusso = "vendite" | "tracciato" | "nonTracciato" | "spese" | "netto";

export interface NodoFlussoSankey {
  name: string;
  colore: ChiaveColoreFlusso;
}

export interface LinkFlussoSankey {
  source: number;
  target: number;
  value: number;
  colore: ChiaveColoreFlusso;
}

export interface DatiSankeyFlusso {
  nodes: NodoFlussoSankey[];
  links: LinkFlussoSankey[];
}

/**
 * Aggregati del flusso di cassa con tutti i valori clampati a ≥ 0
 * (il Sankey non ammette link negativi) e conservazione del flusso:
 * ricavi mostrati = spese mostrate + netto mostrato.
 */
export interface FlussoCassaAggregato {
  /** Ricavo tracciato clampato a ≥ 0. */
  ricavoTracciato: number;
  /** Ricavo non tracciato clampato a ≥ 0. */
  ricavoNonTracciato: number;
  /** Spese tracciate mostrate: min(spese tracciate, ramo tracciato). */
  speseTracciate: number;
  /** Spese non tracciate mostrate: min(spese non tracciate, ramo non tracciato). */
  speseNonTracciate: number;
  /** Residuo del ramo tracciato che confluisce nel Netto. */
  nettoTracciato: number;
  /** Residuo del ramo non tracciato che confluisce nel Netto. */
  nettoNonTracciato: number;
  /** Netto mostrato nel grafico (≥ 0). */
  netto: number;
  /** Differenza reale (può essere negativa): totaleVendite − totaleSpese. */
  nettoReale: number;
  /** true quando la differenza reale è < 0 (segnalazione testuale). */
  nettoNegativo: boolean;
  /** Note testuali sui clamp applicati (vuoto se nessun valore alterato). */
  note: string[];
}

/**
 * Clampa gli aggregati annuali per la resa grafica del flusso di denaro:
 * - i valori negativi (ricavi o spese "sporchi") sono troncati a 0 con nota;
 * - una spesa che eccede il ramo di provenienza viene limitata al ramo e
 *   l'eccedenza è sottratta dal Netto (conservazione del flusso, come da design);
 * - il netto mostrato non scende mai sotto 0: il saldo negativo reale resta
 *   in `nettoReale` / `nettoNegativo` per la segnalazione testuale.
 */
export function clampaFlussoCassa(totali: Omit<RiepilogoMeseDashboard, "mese">): FlussoCassaAggregato {
  const ricavoTracciato = Math.max(totali.ricavoTracciato, 0);
  const ricavoNonTracciato = Math.max(totali.ricavoNonTracciato, 0);
  const speseTracciateClampate = Math.max(totali.speseTracciate, 0);
  const speseNonTracciateClampate = Math.max(totali.speseNonTracciate, 0);

  // Ogni ramo di spesa non può superare il ricavo del ramo di provenienza
  const speseTracciate = Math.min(speseTracciateClampate, ricavoTracciato);
  const speseNonTracciate = Math.min(speseNonTracciateClampate, ricavoNonTracciato);

  // L'eccedenza di spesa oltre il ramo viene sottratta dal Netto
  const eccedenza = speseTracciateClampate - speseTracciate + (speseNonTracciateClampate - speseNonTracciate);
  const residuoTracciato = ricavoTracciato - speseTracciate;
  const residuoNonTracciato = ricavoNonTracciato - speseNonTracciate;
  const sottrattoDaTracciato = Math.min(residuoTracciato, eccedenza);
  const nettoTracciato = residuoTracciato - sottrattoDaTracciato;
  const nettoNonTracciato = residuoNonTracciato - Math.min(residuoNonTracciato, eccedenza - sottrattoDaTracciato);

  const nettoReale = totali.differenza;

  const note = [
    ...(totali.ricavoTracciato < 0 ? [`Ricavo tracciato negativo (€ ${formatCurrency(totali.ricavoTracciato)}): mostrato a 0 nel flusso.`] : []),
    ...(totali.ricavoNonTracciato < 0 ? [`Ricavo non tracciato negativo (€ ${formatCurrency(totali.ricavoNonTracciato)}): mostrato a 0 nel flusso.`] : []),
    ...(totali.speseTracciate < 0 ? [`Spese tracciate negative (€ ${formatCurrency(totali.speseTracciate)}): mostrate a 0 nel flusso.`] : []),
    ...(totali.speseNonTracciate < 0 ? [`Spese non tracciate negative (€ ${formatCurrency(totali.speseNonTracciate)}): mostrate a 0 nel flusso.`] : []),
    ...(eccedenza > 0 ? [`Le spese eccedono il ricavo del ramo di provenienza: l'eccedenza (€ ${formatCurrency(eccedenza)}) è sottratta dal Netto.`] : []),
  ];

  return {
    ricavoTracciato,
    ricavoNonTracciato,
    speseTracciate,
    speseNonTracciate,
    nettoTracciato,
    nettoNonTracciato,
    netto: nettoTracciato + nettoNonTracciato,
    nettoReale,
    nettoNegativo: nettoReale < 0,
    note,
  };
}

// Indici dei nodi candidati (prima del filtro dei rami vuoti)
const NODI_CANDIDATI: NodoFlussoSankey[] = [
  { name: "Vendite", colore: "vendite" },
  { name: "Ricavo tracciato", colore: "tracciato" },
  { name: "Ricavo non tracciato", colore: "nonTracciato" },
  { name: "Spese tracciate", colore: "spese" },
  { name: "Spese non tracciate", colore: "spese" },
  { name: "Netto", colore: "netto" },
];

/**
 * Costruisce nodi e link del Sankey dalla topologia di design:
 * Vendite → Ricavo tracciato / Ricavo non tracciato → Spese tracciate /
 * Spese non tracciate / Netto. I link con valore ≤ 0 sono esclusi e i nodi
 * rimasti senza collegamenti vengono rimossi (con indici rimappati):
 * nessun link negativo raggiunge mai Recharts.
 */
export function costruisciFlussoSankey(flusso: FlussoCassaAggregato): DatiSankeyFlusso {
  const linkCandidati: LinkFlussoSankey[] = [
    { source: 0, target: 1, value: flusso.ricavoTracciato, colore: "tracciato" },
    { source: 0, target: 2, value: flusso.ricavoNonTracciato, colore: "nonTracciato" },
    { source: 1, target: 3, value: flusso.speseTracciate, colore: "spese" },
    { source: 1, target: 5, value: flusso.nettoTracciato, colore: "netto" },
    { source: 2, target: 4, value: flusso.speseNonTracciate, colore: "spese" },
    { source: 2, target: 5, value: flusso.nettoNonTracciato, colore: "netto" },
  ];

  const linkPositivi = linkCandidati.filter((link) => link.value > 0);
  const indiciUsati = [...new Set(linkPositivi.flatMap((link) => [link.source, link.target]))].sort((a, b) => a - b);
  const rimappa = new Map(indiciUsati.map((originale, nuovo) => [originale, nuovo]));

  return {
    nodes: indiciUsati.map((indice) => NODI_CANDIDATI[indice]),
    links: linkPositivi.map((link) => ({
      ...link,
      source: rimappa.get(link.source) ?? 0,
      target: rimappa.get(link.target) ?? 0,
    })),
  };
}
