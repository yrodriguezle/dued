// src/@types/MonthlyClosure.d.ts

type MonthlyExpense = {
  __typename: "SpesaMensile";
  spesaId: number;
  chiusuraId: number;
  pagamentoId: number | null;
  pagamento: SupplierPayment | null;
  descrizione: string;
  importo: number;
  categoria: string | null;
  creatoIl: string;
  aggiornatoIl: string;
};

type ChiusuraMensile = {
  __typename: "ChiusuraMensile";
  chiusuraId: number;
  anno: number;
  mese: number;
  ultimoGiornoLavorativo: string;

  // Riepilogo incassi
  ricavoTotale: number | null;
  totaleContanti: number | null;
  totaleElettronici: number | null;
  totaleFatture: number | null;

  // Spese mensili
  speseAggiuntive: number | null;
  spese: MonthlyExpense[];

  // Totali finali
  ricavoNetto: number | null;

  stato: "BOZZA" | "CHIUSA" | "RICONCILIATA";
  note: string | null;
  chiusaDa: number | null;
  chiusaDaUtente: User | null;
  chiusaIl: string | null;
  creatoIl: string;
  aggiornatoIl: string;
};

type ChiusuraMensileInput = {
  chiusuraId?: number;
  anno: number;
  mese: number;
  ultimoGiornoLavorativo: string;
  note?: string;
  stato?: string;
  spese?: SpesaMensileInput[];
};

type SpesaMensileInput = {
  spesaId?: number;
  pagamentoId?: number;
  descrizione: string;
  importo: number;
  categoria?: string;
};
