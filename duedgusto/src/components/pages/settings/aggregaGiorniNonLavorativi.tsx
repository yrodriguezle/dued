import dayjs from "dayjs";

/**
 * Codici motivo supportati dal backend (SettingsMutations.cs) con le rispettive
 * etichette italiane. Unica fonte per Select del dialog, filtro e colonna Motivo.
 */
export const CODICI_MOTIVO = [
  { value: "FESTIVITA_NAZIONALE", label: "Festività Nazionale" },
  { value: "CHIUSURA_STRAORDINARIA", label: "Chiusura Straordinaria" },
  { value: "FERIE", label: "Ferie" },
] as const;

export const motivoLabelMap: Record<string, string> = Object.fromEntries(CODICI_MOTIVO.map((m) => [m.value, m.label]));

/** Valore sentinella dei filtri: nessun vincolo su anno / motivo. */
export const TUTTI = "tutti";

export type FiltroAnno = number | typeof TUTTI;
export type FiltroMotivo = string | typeof TUTTI;

/**
 * Riga della griglia dei giorni non lavorativi.
 *
 * L'albero è piatto: le righe "intervallo" (padri) precedono le proprie foglie e
 * queste le puntano tramite `parentRowId` (treeData + treeDataParentIdField).
 * I giorni isolati restano foglie di primo livello (`parentRowId: null`).
 */
export interface RigaGiorniNonLavorativi extends Record<string, unknown> {
  rowId: string;
  parentRowId: string | null;
  tipoRiga: "intervallo" | "giorno";
  /** null sulle righe intervallo: non corrispondono a un record del database */
  giornoId: number | null;
  /** Padre: gli id di tutti i figli. Foglia: il solo id della riga */
  giorniIds: number[];
  numeroGiorni: number;
  data: string;
  dataFine: string;
  /** Data usata per ordinare: per i ricorrenti è proiettata sull'anno di riferimento */
  dataOrdinamento: string;
  /** Etichetta pronta per la cella (es. "10/08/2026 – 23/08/2026 · 14 giorni") */
  periodo: string;
  descrizione: string;
  codiceMotivo: string;
  motivo: string;
  ricorrente: boolean;
  /** null per i ricorrenti: valgono per ogni anno */
  anno: number | null;
}

// Separatore non stampabile: una descrizione contenente spazi non può collidere con un altro motivo
const SEPARATORE_CHIAVE = "\u0000";

/** Numero di giorni compresi nell'intervallo (estremi inclusi); 0 se non valido */
export function contaGiorniIntervallo(dataInizio: string, dataFine: string): number {
  const inizio = dayjs(dataInizio);
  const fine = dayjs(dataFine);
  if (!inizio.isValid() || !fine.isValid() || fine.isBefore(inizio, "day")) return 0;
  return fine.diff(inizio, "day") + 1;
}

/**
 * Anni presenti fra i giorni non ricorrenti, dal più recente. L'anno corrente c'è
 * sempre, anche senza giorni configurati: è il default del filtro.
 * I ricorrenti non contribuiscono — valgono per ogni anno e porterebbero in elenco
 * anni remoti (quello in cui la festività è stata salvata la prima volta).
 */
export function anniDisponibili(giorni: GiornoNonLavorativo[]): number[] {
  const anni = new Set(giorni.filter((g) => !g.ricorrente).map((g) => dayjs(g.data).year()));
  anni.add(dayjs().year());
  return [...anni].sort((a, b) => b - a);
}

/**
 * Filtra per anno e motivo. I giorni ricorrenti superano sempre il filtro anno:
 * si ripetono ogni anno, quindi appartengono a qualunque anno selezionato.
 */
export function filtraGiorniNonLavorativi(
  giorni: GiornoNonLavorativo[],
  anno: FiltroAnno,
  codiceMotivo: FiltroMotivo,
): GiornoNonLavorativo[] {
  return giorni
    .filter((g) => anno === TUTTI || g.ricorrente || dayjs(g.data).year() === anno)
    .filter((g) => codiceMotivo === TUTTI || g.codiceMotivo === codiceMotivo);
}

interface GiornoProiettato {
  giorno: GiornoNonLavorativo;
  chiave: string;
  dataOrdinamento: string;
}

function formattaGiorno(data: string, ricorrente: boolean): string {
  return dayjs(data).format(ricorrente ? "DD/MM" : "DD/MM/YYYY");
}

function costruisciRigaFoglia(
  giorno: GiornoNonLavorativo,
  dataOrdinamento: string,
  parentRowId: string | null,
): RigaGiorniNonLavorativi {
  return {
    rowId: `giorno:${giorno.giornoId}`,
    parentRowId,
    tipoRiga: "giorno",
    giornoId: giorno.giornoId,
    giorniIds: [giorno.giornoId],
    numeroGiorni: 1,
    data: giorno.data,
    dataFine: giorno.data,
    dataOrdinamento,
    periodo: formattaGiorno(giorno.data, giorno.ricorrente),
    descrizione: giorno.descrizione,
    codiceMotivo: giorno.codiceMotivo,
    motivo: motivoLabelMap[giorno.codiceMotivo] || giorno.codiceMotivo,
    ricorrente: giorno.ricorrente,
    anno: giorno.ricorrente ? null : dayjs(giorno.data).year(),
  };
}

function costruisciRigaIntervallo(blocco: GiornoProiettato[]): RigaGiorniNonLavorativi {
  const primo = blocco[0].giorno;
  const ultimo = blocco[blocco.length - 1].giorno;

  return {
    // La data di inizio identifica il blocco: un giorno appartiene a un solo intervallo
    // (le date sono uniche per configurazione, vincolo di unicità lato server)
    rowId: `intervallo:${primo.data}`,
    parentRowId: null,
    tipoRiga: "intervallo",
    giornoId: null,
    giorniIds: blocco.map((p) => p.giorno.giornoId),
    numeroGiorni: blocco.length,
    data: primo.data,
    dataFine: ultimo.data,
    dataOrdinamento: blocco[0].dataOrdinamento,
    periodo: `${formattaGiorno(primo.data, primo.ricorrente)} – ${formattaGiorno(ultimo.data, ultimo.ricorrente)} · ${blocco.length} giorni`,
    descrizione: primo.descrizione,
    codiceMotivo: primo.codiceMotivo,
    motivo: motivoLabelMap[primo.codiceMotivo] || primo.codiceMotivo,
    ricorrente: primo.ricorrente,
    anno: primo.ricorrente ? null : dayjs(primo.data).year(),
  };
}

/**
 * Collassa i giorni consecutivi con stessa descrizione, motivo e flag ricorrente in
 * un'unica riga "intervallo" espandibile: due settimane di ferie diventano una riga
 * invece di quattordici.
 *
 * I ricorrenti vengono proiettati su `annoRiferimento` prima del confronto, così una
 * festività salvata nel 2019 si ordina e si raggruppa insieme a quelle dell'anno in
 * corso (il matching a runtime avviene comunque su mese+giorno, lato store e backend).
 *
 * Va applicata DOPO il filtro: il conteggio "N giorni" descrive sempre ciò che è visibile.
 */
export function aggregaGiorniNonLavorativi(giorni: GiornoNonLavorativo[], annoRiferimento: number): RigaGiorniNonLavorativi[] {
  const proiettati: GiornoProiettato[] = giorni.map((giorno) => ({
    giorno,
    chiave: [giorno.descrizione, giorno.codiceMotivo, giorno.ricorrente ? "R" : "N"].join(SEPARATORE_CHIAVE),
    dataOrdinamento: giorno.ricorrente ? `${annoRiferimento}-${giorno.data.slice(5)}` : giorno.data,
  }));

  const ordinati = [...proiettati].sort((a, b) =>
    a.chiave === b.chiave ? a.dataOrdinamento.localeCompare(b.dataOrdinamento) : a.chiave.localeCompare(b.chiave),
  );

  // Blocchi di giorni contigui con la stessa chiave. Un diff di 0 giorni (duplicato,
  // impossibile col vincolo di unicità lato server) apre comunque un blocco nuovo.
  const blocchi = ordinati.reduce<GiornoProiettato[][]>((acc, corrente) => {
    const bloccoCorrente = acc[acc.length - 1];
    const precedente = bloccoCorrente?.[bloccoCorrente.length - 1];
    const contiguo =
      !!precedente &&
      precedente.chiave === corrente.chiave &&
      dayjs(corrente.dataOrdinamento).diff(dayjs(precedente.dataOrdinamento), "day") === 1;

    if (contiguo) {
      bloccoCorrente.push(corrente);
      return acc;
    }
    return [...acc, [corrente]];
  }, []);

  return [...blocchi]
    .sort((a, b) => a[0].dataOrdinamento.localeCompare(b[0].dataOrdinamento))
    .flatMap((blocco) => {
      if (blocco.length === 1) {
        return [costruisciRigaFoglia(blocco[0].giorno, blocco[0].dataOrdinamento, null)];
      }
      const padre = costruisciRigaIntervallo(blocco);
      return [padre, ...blocco.map((p) => costruisciRigaFoglia(p.giorno, p.dataOrdinamento, padre.rowId))];
    });
}
