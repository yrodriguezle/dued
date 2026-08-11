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

/**
 * Le impostazioni del sito nella forma amministrativa. ⚠️ Non contiene alcun campo di orario:
 * apertura, chiusura, giorni operativi e fuso stanno in `BusinessSettings` e si leggono da lì.
 */
export const impostazioniVetrinaFragment = `
  ${mediaAssetFragment}
  fragment ImpostazioniVetrinaFragment on ImpostazioniVetrina {
    impostazioniVetrinaId
    insegnaPubblica
    via
    cap
    citta
    provincia
    paese
    latitudine
    longitudine
    telefono
    email
    urlInstagram
    urlFacebook
    metaTitoloDefault
    metaDescrizioneDefault
    immagineOgId
    immagineOg { ...MediaAssetFragment }
    oraInizioTemaSera
    prenotazioniAttive
    prenotazioniPreavvisoOre
    prenotazioniCopertiMax
    turnstileSiteKey
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
