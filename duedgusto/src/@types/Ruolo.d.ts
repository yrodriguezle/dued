type Ruolo = {
  __typename: "Ruolo";
  id: number;
  nome: string;
  descrizione: string;
  utenti: Utente[];
  menuIds: number[];
} | null;

type RuoloInput = {
  id: number;
  nome: string;
  descrizione?: string;
};
