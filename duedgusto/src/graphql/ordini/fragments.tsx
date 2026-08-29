/**
 * Una voce dell'ordine come la vede il banco.
 *
 * ⚠️ Niente `imponibile` né `importoIva`: lo scorporo è un fatto della **vendita incassata** e
 *    vive in un punto solo lato server. Chiederli qui suggerirebbe che esistano prima
 *    dell'incasso — e su un ordine aperto non esiste ancora alcuna `Vendita`.
 */
export const rigaOrdineFragment = `fragment RigaOrdineFragment on RigaOrdine {
  rigaOrdineId
  ordineId
  prodottoId
  quantita
  prezzoUnitario
  prezzoTotale
  aliquotaIva
  note
  dataOra
  prodotto {
    prodottoId
    codice
    nome
  }
}`;

/**
 * L'ordine intero, righe comprese.
 *
 * <p>Le righe stanno **dentro** il fragment e non in una query a parte perché ogni gesto che
 * l'operatore può fare su un ordine — incassarlo, dividerlo, correggerne una voce — ha bisogno
 * dei loro id: chiudere un ordine significa dire quali righe vanno in quale taglio. Un elenco
 * senza righe costringerebbe a un secondo giro di rete proprio nel momento in cui il cliente è
 * davanti alla cassa.</p>
 *
 * ℹ️ `identificativo`, `dataRegistro` e `totaleCorrente` sono **derivati dal server** e non
 *    colonne: si chiedono come qualunque altro campo, ma non esistono nel database.
 *
 * 🔴 Chi consuma questo fragment in un elenco **deve** mostrare `dataRegistro`: un ordine aperto
 *    ieri sera resta sul registro di ieri, e senza quella data l'operatore lo cercherebbe fra
 *    quelli di oggi.
 */
export const ordineFragment = `fragment OrdineFragment on Ordine {
  ordineId
  registroCassaId
  identificativo
  dataRegistro
  numero
  suffissoSplit
  stato
  metodoPagamento
  totaleOrdine
  totaleCorrente
  contanteRicevuto
  ordinePadreId
  apertoIl
  chiusoIl
  annullatoIl
  stornatoIl
  motivoAnnullamento
  motivoStorno
  righe {
    ...RigaOrdineFragment
  }
}`;

/**
 * I due fragment nell'ordine in cui GraphQL li vuole dichiarati. Si interpola questo, non i due
 * separati: `OrdineFragment` usa `RigaOrdineFragment`, e dimenticarne uno dà un errore di
 * validazione che si vede solo a runtime.
 */
export const ordineConRigheFragments = `${rigaOrdineFragment}
${ordineFragment}`;
