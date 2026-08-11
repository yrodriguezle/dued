export const mediaAssetFragment = `fragment MediaAssetFragment on MediaAsset {
  mediaAssetId
  chiave
  nomeOriginale
  mimeType
  larghezza
  altezza
  larghezzeDisponibili
  testoAlternativo
  didascalia
  focale
  placeholder
  cartella
  ordinamento
  pubblicato
  byteTotali
  createdAt
  updatedAt
}`;

export const prodottoVetrinaFragment = `
  ${mediaAssetFragment}
  fragment ProdottoVetrinaFragment on Prodotto {
    prodottoId
    codice
    nome
    prezzo
    categoria
    unitaDiMisura
    attivo
    visibileSulSito
    nomeVetrina
    descrizioneVetrina
    categoriaVetrina
    prezzoVetrina
    immagineId
    immagine { ...MediaAssetFragment }
    ordinamentoVetrina
    allergeni
    novita
    consigliato
    pubblicatoSulSito
    prezzoEffettivoVetrina
    createdAt
    updatedAt
  }`;
