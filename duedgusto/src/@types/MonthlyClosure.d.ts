// src/@types/MonthlyClosure.d.ts

type CategoriaSpesa = "Affitto" | "Utenze" | "Stipendi" | "Altro";

type SpesaMensileLibera = {
  __typename: "SpesaMensileLibera";
  spesaId: number;
  chiusuraId: number;
  descrizione: string;
  importo: number;
  categoria: CategoriaSpesa;
  creatoIl: string;
  aggiornatoIl: string;
};

type RegistroCassaMensile = {
  __typename: "RegistroCassaMensile";
  chiusuraId: number;
  registroId: number;
  incluso: boolean;
  registro: CashRegister;
};

type PagamentoMensileFornitori = {
  __typename: "PagamentoMensileFornitori";
  chiusuraId: number;
  pagamentoId: number;
  inclusoInChiusura: boolean;
  pagamento: {
    pagamentoId: number;
    dataPagamento: string;
    importo: number;
    metodoPagamento: string | null;
    note: string | null;
  };
};

type ChiusuraMensile = {
  __typename: "ChiusuraMensile";
  chiusuraId: number;
  anno: number;
  mese: number;
  ultimoGiornoLavorativo: string;

  // Proprietà calcolate (compute on-the-fly dal backend)
  ricavoTotaleCalcolato: number;
  totaleContantiCalcolato: number;
  totaleElettroniciCalcolato: number;
  totaleFattureCalcolato: number;
  speseAggiuntiveCalcolate: number;
  ricavoNettoCalcolato: number;
  totaleIvaCalcolato: number;
  totaleImponibileCalcolato: number;
  totaleLordoCalcolato: number;
  totaleDifferenzeCassaCalcolato: number;

  // Relazioni
  registriInclusi: RegistroCassaMensile[];
  speseLibere: SpesaMensileLibera[];
  pagamentiInclusi: PagamentoMensileFornitori[];

  stato: "BOZZA" | "CHIUSA" | "RICONCILIATA";
  note: string | null;
  chiusaDa: number | null;
  chiusaDaUtente: User | null;
  chiusaIl: string | null;
  creatoIl: string;
  aggiornatoIl: string;
};
