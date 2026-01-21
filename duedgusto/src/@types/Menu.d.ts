type Menu = {
  __typename: "Menu";
  id: number;
  menuPadreId: number | null;
  titolo: string;
  percorso: string;
  icona: string;
  visibile: boolean;
  posizione: number;
  percorsoFile?: string;
  nomeVista?: string;
} | null;
