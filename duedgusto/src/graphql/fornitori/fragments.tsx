export const fornitoreFragment = `fragment FornitoreFragment on Fornitore {
  fornitoreId
  ragioneSociale
  ragioneSociale2
  partitaIva
  codiceFiscale
  email
  telefono
  indirizzo
  citta
  cap
  provincia
  paese
  note
  attivo
  aliquotaIva
  createdAt
  updatedAt
}`;

export const fatturaAcquistoFragment = `
  ${fornitoreFragment}
  fragment FatturaAcquistoFragment on FatturaAcquisto {
    fatturaId
    fornitoreId
    fornitore { ...FornitoreFragment }
    numeroFattura
    dataFattura
    imponibile
    importoIva
    totaleConIva
    stato
    dataScadenza
    note
    createdAt
    updatedAt
  }`;

export const documentoTrasportoFragment = `
  ${fornitoreFragment}
  fragment DocumentoTrasportoFragment on DocumentoTrasporto {
    ddtId
    fatturaId
    fornitoreId
    fornitore { ...FornitoreFragment }
    fattura { fatturaId numeroFattura }
    numeroDdt
    dataDdt
    importo
    note
    pagamenti {
      pagamentoId
      importo
      dataPagamento
      metodoPagamento
      note
    }
    createdAt
    updatedAt
  }`;

export const pagamentoFornitoreFragment = `
  ${fatturaAcquistoFragment}
  ${documentoTrasportoFragment}
  fragment PagamentoFornitoreFragment on PagamentoFornitore {
    pagamentoId
    fatturaId
    fattura { ...FatturaAcquistoFragment }
    ddtId
    ddt { ...DocumentoTrasportoFragment }
    dataPagamento
    importo
    metodoPagamento
    note
    createdAt
    updatedAt
  }`;
