import { utenteFragment } from "../utente/fragment";

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

export const registroCassaFragment = `
  ${utenteFragment}
  ${conteggioMonetaFragment}
  ${incassoCassaFragment}
  ${spesaCassaFragment}
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
    conteggiApertura { ...ConteggioMonetaFragment }
    conteggiChiusura { ...ConteggioMonetaFragment }
    incassi { ...IncassoCassaFragment }
    spese { ...SpesaCassaFragment }
    pagamentiFornitori {
      pagamentoId
      importo
      metodoPagamento
      dataPagamento
      note
      ddt {
        ddtId
        numeroDdt
        dataDdt
        importo
        fornitore {
          fornitoreId
          ragioneSociale
        }
      }
      fattura {
        fatturaId
        numeroFattura
        dataFattura
        imponibile
        stato
        fornitore {
          fornitoreId
          ragioneSociale
        }
      }
    }
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
