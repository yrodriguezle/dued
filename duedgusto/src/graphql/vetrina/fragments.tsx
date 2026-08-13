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
    claimVetrina
    storiaTitolo
    storiaTesto
    aperitivoTitolo
    aperitivoTesto
    aperitivoPunti
    aperitivoCategorie
    punteggioGoogle
    numeroRecensioniGoogle
    urlProfiloGoogle
    prenotazioniAttive
    prenotazioniPreavvisoOre
    prenotazioniCopertiMax
    turnstileSiteKey
    createdAt
    updatedAt
  }`;

/**
 * Una recensione riportata, nella forma amministrativa: include anche le **non pubblicate** e le
 * marche temporali, che la rotta pubblica non contiene. È la stessa asimmetria delle
 * impostazioni, ed è la ragione per cui la lettura resta dietro il guard amministratore.
 */
export const recensioneVetrinaFragment = `fragment RecensioneVetrinaFragment on RecensioneVetrina {
  recensioneVetrinaId
  autore
  testo
  fonte
  punteggio
  ordinamento
  pubblicata
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
    inLavagnaDal
    pubblicatoSulSito
    prezzoEffettivoVetrina
    createdAt
    updatedAt
  }`;
