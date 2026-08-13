/**
 * Il prodotto nella sua forma di **cassa**. Volutamente più stretto di
 * `prodottoVetrinaFragment`: qui non serve un solo campo del sito, e chiederli avvicinerebbe
 * questa pagina a poterli scrivere — cosa che il suo input non può fare per costruzione.
 */
export const prodottoCassaFragment = `fragment ProdottoCassaFragment on Prodotto {
  prodottoId
  codice
  nome
  descrizione
  prezzo
  categoria
  unitaDiMisura
  attivo
  aliquotaIva
  createdAt
  updatedAt
}`;
