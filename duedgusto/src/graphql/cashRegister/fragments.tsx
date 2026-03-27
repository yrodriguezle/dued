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
          aliquotaIva
        }
      }
      fattura {
        fatturaId
        numeroFattura
        dataFattura
        imponibile
        totaleConIva
        stato
        fornitore {
          fornitoreId
          ragioneSociale
          aliquotaIva
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
