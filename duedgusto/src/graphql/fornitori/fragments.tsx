export const fornitoreFragment = `fragment FornitoreFragment on Fornitore {
  fornitoreId
  ragioneSociale
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
  creatoIl
  aggiornatoIl
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
    creatoIl
    aggiornatoIl
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
    creatoIl
    aggiornatoIl
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
    creatoIl
    aggiornatoIl
  }`;
