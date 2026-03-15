type Fornitore = {
  __typename: "Fornitore";
  fornitoreId: number;
  ragioneSociale: string;
  partitaIva?: string | null;
  codiceFiscale?: string | null;
  email?: string | null;
  telefono?: string | null;
  indirizzo?: string | null;
  citta?: string | null;
  cap?: string | null;
  provincia?: string | null;
  paese: string;
  note?: string | null;
  attivo: boolean;
  creatoIl: string;
  aggiornatoIl: string;
  fattureAcquisto?: FatturaAcquisto[];
  documentiTrasporto?: DocumentoTrasporto[];
};

type FornitoreInput = {
  fornitoreId?: number;
  ragioneSociale: string;
  partitaIva?: string;
  codiceFiscale?: string;
  email?: string;
  telefono?: string;
  indirizzo?: string;
  citta?: string;
  cap?: string;
  provincia?: string;
  paese?: string;
  note?: string;
  attivo?: boolean;
};
