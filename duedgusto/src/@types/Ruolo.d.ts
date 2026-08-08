type Ruolo = {
  __typename: "Ruolo";
  id: number;
  nome: string;
  descrizione: string;
  amministratore: boolean;
  utenti: Utente[];
  menuIds: number[];
} | null;

type RuoloInput = {
  id: number;
  nome: string;
  descrizione?: string;
  amministratore?: boolean;
};
