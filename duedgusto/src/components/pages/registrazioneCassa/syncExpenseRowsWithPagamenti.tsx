// Helper puro per sincronizzare le righe spese della griglia con i pagamenti
// fornitori restituiti dalla mutation mutateRegistroCassa.
//
// Il matching avviene SEMPRE per chiave di business `fornitoreId|tipo|numero`
// (la stessa identità degli indici UNIQUE lato database), mai per indice:
// - passata 1: chiave esatta per le righe con numero documento valorizzato;
// - passata 2: le righe con numero vuoto (il server ha assegnato un placeholder
//   `SN-{yyyyMMdd}-{seq}`) si abbinano ai pagamenti non ancora abbinati dello
//   stesso fornitore + tipo documento, preferendo l'importo uguale, in ordine.
//
// In caso di mismatch (pagamenti non abbinabili o righe rimaste senza ID) NON
// viene restituito alcun aggiornamento parziale: il chiamante deve affidarsi al
// refetch completo del registro.

type TipoDocumentoPagamento = "FA" | "DDT";

export interface ExpenseRowSyncChanges {
  pagamentoId: number;
  fatturaId?: number;
  ddtId?: number;
  invoiceNumber?: string;
  ddtNumber?: string;
}

export interface ExpenseRowSyncUpdate<T extends Expense = Expense> {
  row: T;
  changes: ExpenseRowSyncChanges;
}

export interface SyncExpenseRowsResult<T extends Expense = Expense> {
  updates: ExpenseRowSyncUpdate<T>[];
  mismatch: boolean;
}

interface ServerPagamentoDescriptor {
  pagamento: PagamentoFornitoreRegistro;
  fornitoreId: number;
  tipo: TipoDocumentoPagamento;
  numero: string;
  matched: boolean;
}

function mismatchResult<T extends Expense>(): SyncExpenseRowsResult<T> {
  return { updates: [], mismatch: true };
}

function getRowTipo(row: Expense): TipoDocumentoPagamento {
  return row.documentType === "FA" ? "FA" : "DDT";
}

function getRowNumero(row: Expense): string {
  const numero = getRowTipo(row) === "FA" ? row.invoiceNumber : row.ddtNumber;
  return (numero ?? "").trim();
}

function toServerDescriptor(pagamento: PagamentoFornitoreRegistro): ServerPagamentoDescriptor | null {
  if (pagamento.fattura) {
    return {
      pagamento,
      fornitoreId: pagamento.fattura.fornitore.fornitoreId,
      tipo: "FA",
      numero: (pagamento.fattura.numeroFattura ?? "").trim(),
      matched: false,
    };
  }
  if (pagamento.ddt) {
    return {
      pagamento,
      fornitoreId: pagamento.ddt.fornitore.fornitoreId,
      tipo: "DDT",
      numero: (pagamento.ddt.numeroDdt ?? "").trim(),
      matched: false,
    };
  }
  return null;
}

function toChanges(server: ServerPagamentoDescriptor): ExpenseRowSyncChanges {
  return {
    pagamentoId: server.pagamento.pagamentoId,
    fatturaId: server.pagamento.fattura?.fatturaId,
    ddtId: server.pagamento.ddt?.ddtId,
    // Riscrive anche il numero documento con il valore del server (placeholder
    // SN-... incluso) per stabilità della chiave ai salvataggi successivi.
    ...(server.tipo === "FA" ? { invoiceNumber: server.numero } : { ddtNumber: server.numero }),
  };
}

/**
 * Sincronizza le righe spese di tipo pagamento fornitore con i
 * `pagamentiFornitori` restituiti dal server dopo `mutateRegistroCassa`.
 *
 * Le righe spese normali (non pagamento fornitore) vengono ignorate.
 * Non muta le righe in input: restituisce le coppie riga → modifiche da applicare.
 */
function syncExpenseRowsWithPagamenti<T extends Expense>(expenseRows: T[], pagamentiFornitori: PagamentoFornitoreRegistro[]): SyncExpenseRowsResult<T> {
  const supplierRows = (expenseRows ?? []).filter((row) => row.isPagamentoFornitore && row.fornitoreId);
  const descriptors = (pagamentiFornitori ?? []).map(toServerDescriptor);

  // Pagamento server senza fattura né DDT: non abbinabile per chiave
  if (descriptors.some((descriptor) => descriptor === null)) {
    return mismatchResult<T>();
  }
  const pool = descriptors as ServerPagamentoDescriptor[];

  const matches: { row: T; server: ServerPagamentoDescriptor }[] = [];

  // Passata 1: chiave esatta `fornitoreId|tipo|numero` per le righe con numero valorizzato
  const senzaNumero = supplierRows.filter((row) => {
    const numero = getRowNumero(row);
    if (!numero) {
      return true; // rimandata alla passata 2
    }
    const candidate = pool.find((server) => !server.matched && server.fornitoreId === row.fornitoreId && server.tipo === getRowTipo(row) && server.numero === numero);
    if (candidate) {
      candidate.matched = true;
      matches.push({ row, server: candidate });
      return false;
    }
    return true; // riga con numero non abbinata → mismatch
  });

  // Passata 2: righe senza numero → pagamenti residui per fornitore + tipo,
  // preferendo l'importo uguale, in ordine
  const nonAbbinate = senzaNumero.filter((row) => {
    if (getRowNumero(row)) {
      return true; // riga con numero rimasta dalla passata 1
    }
    const candidates = pool.filter((server) => !server.matched && server.fornitoreId === row.fornitoreId && server.tipo === getRowTipo(row));
    const candidate = candidates.find((server) => server.pagamento.importo === row.amount) ?? candidates[0];
    if (!candidate) {
      return true;
    }
    candidate.matched = true;
    matches.push({ row, server: candidate });
    return false;
  });

  const serverNonAbbinati = pool.some((server) => !server.matched);
  if (nonAbbinate.length > 0 || serverNonAbbinati) {
    return mismatchResult<T>();
  }

  return {
    updates: matches.map(({ row, server }) => ({ row, changes: toChanges(server) })),
    mismatch: false,
  };
}

export default syncExpenseRowsWithPagamenti;
