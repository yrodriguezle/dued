export const venditaFragment = `fragment VenditaFragment on Vendita {
  venditaId
  registroCassaId
  prodottoId
  quantita
  prezzoUnitario
  prezzoTotale
  aliquotaIva
  imponibile
  importoIva
  note
  dataOra
  metodoPagamento
  createdAt
  updatedAt
  prodotto {
    prodottoId
    codice
    nome
  }
}`;

/**
 * Il prodotto come lo vede il **banco**: il minimo per disegnare un pulsante e battere una
 * riga. Niente campi di vetrina e niente metadati — a 360 px non ci sta nulla di più, e ogni
 * campo in più è banda su una rete che dietro al bancone non è mai quella buona.
 */
export const prodottoVendibileFragment = `fragment ProdottoVendibileFragment on Prodotto {
  prodottoId
  codice
  nome
  prezzo
  categoria
  aliquotaIva
}`;
