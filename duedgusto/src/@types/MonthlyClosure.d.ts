// src/@types/MonthlyClosure.d.ts

type CodiceMotivo = "ATTIVITA_NON_AVVIATA" | "CHIUSURA_PROGRAMMATA" | "EVENTO_ECCEZIONALE";

type GiornoEscluso = {
  data: string;
  codiceMotivo: CodiceMotivo;
  note?: string;
  dataEsclusione: string;
  utenteEsclusione: number;
};

// `CategoriaSpesa` è definita in sede condivisa in @types/RegistroCassa.d.ts.

type StatoChiusuraMensile = "BOZZA" | "CHIUSA" | "RICONCILIATA";

// Sottoinsieme dei campi del registro cassa esposti sulla chiusura mensile
// (fragment RegistroCassaMensileFragment). Contiene tutti i campi necessari a
// `aggregaRegistriPerMese` per calcolare i KPI gestionali della chiusura.
type RegistroCassaMensileRidotto = {
  __typename?: "RegistroCassa";
  id: number;
  data: string;
  totaleVendite: number;
  incassoContanteTracciato: number;
  incassiElettronici: number;
  incassiFattura: number;
  differenza: number;
  stato: StatoRegistroCassa;
  totaleApertura: number;
  totaleChiusura: number;
  speseFornitori: number;
  speseGiornaliere: number;
};

type RegistroCassaMensile = {
  __typename: "RegistroCassaMensile";
  chiusuraId: number;
  registroId: number;
  incluso: boolean;
  registro: RegistroCassaMensileRidotto;
};

type ChiusuraMensile = {
  __typename: "ChiusuraMensile";
  chiusuraId: number;
  anno: number;
  mese: number;
  // Proprietà calcolate (pura aggregazione dei registri inclusi, compute on-the-fly dal backend)
  ricavoTotaleCalcolato: number;
  totaleContantiCalcolato: number;
  totaleElettroniciCalcolato: number;
  totaleFattureCalcolato: number;
  // Spese tracciate (Σ SpeseFornitori) e non tracciate (Σ SpeseGiornaliere) dei registri inclusi.
  speseTracciateRegistriCalcolate: number;
  speseGiornaliereRegistriCalcolate: number;
  ricavoNettoCalcolato: number;
  totaleIvaCalcolato: number;
  totaleImponibileCalcolato: number;
  totaleLordoCalcolato: number;
  totaleDifferenzeCassaCalcolato: number;

  // Avvisi non bloccanti valorizzati solo nel payload di chiudiChiusuraMensile
  avvisiCompletezza: string[] | null;

  // Relazioni (chiusura = pura aggregazione dei soli registri inclusi)
  registriInclusi: RegistroCassaMensile[];

  giorniEsclusi: string | null;

  stato: StatoChiusuraMensile;
  note: string | null;
  chiusaDa: number | null;
  chiusaDaUtente: User | null;
  chiusaIl: string | null;
  createdAt: string;
  updatedAt: string;
};
