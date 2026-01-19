type Utente = {
  __typename: "Utente";
  id: number;
  nomeUtente: string;
  nome: string;
  cognome: string;
  descrizione: string;
  disabilitato: boolean;
  ruoloId: number;
  ruolo: Ruolo;
  menus: Menu[];
} | null;
