import { utenteFragment } from "../utente/fragment";

export const registroCassaFragment = `
  ${utenteFragment}
  fragment RegistroCassaFragment on RegistroCassa {
    id
    data
    utenteId
    utente { ...UtenteFragment }
    totaleApertura
    totaleChiusura
    venditeContanti
    incassoContanteTracciato
    incassiElettronici
    incassiFattura
    totaleVendite
    speseFornitori
    speseGiornaliere
    contanteAtteso
    differenza
    contanteNetto
    importoIva
    note
    stato
    creatoIl
    aggiornatoIl
  }
`;

export const denominazioneMonetaFragment = `
  fragment DenominazioneMonetaFragment on DenominazioneMoneta {
    id
    valore
    tipo
    ordineVisualizzazione
  }
`;

export const conteggioMonetaFragment = `
  fragment ConteggioMonetaFragment on ConteggioMoneta {
    id
    registroCassaId
    denominazioneMonetaId
    quantita
    totale
    isApertura
  }
`;

export const incassoCassaFragment = `
  fragment IncassoCassaFragment on IncassoCassa {
    id
    registroCassaId
    tipo
    importo
  }
`;

export const spesaCassaFragment = `
  fragment SpesaCassaFragment on SpesaCassa {
    id
    registroCassaId
    descrizione
    importo
  }
`;

