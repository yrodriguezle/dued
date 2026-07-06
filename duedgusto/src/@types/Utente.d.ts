// Modalita' di drag della modale condivisa (AppDialog), preferenza per-utente:
// - "free": la modale resta dove viene lasciata (reset al centro alla riapertura)
// - "elastic": snap-back all'origine al rilascio
// Fonte di verita' unica dei valori ammessi lato client (aliasata da DialogDragMode in AppDialog).
type DragModePreference = "free" | "elastic";

type Utente = {
  __typename: "Utente";
  id: number;
  nomeUtente: string;
  nome: string;
  cognome: string;
  descrizione: string;
  disabilitato: boolean;
  ruoloId: number;
  preferenzaDragModale: DragModePreference;
  ruolo: Ruolo;
  menus: Menu[];
} | null;
