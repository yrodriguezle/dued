import { gql } from "@apollo/client";

export const UPDATE_BUSINESS_SETTINGS = gql`
  mutation UpdateBusinessSettings($input: BusinessSettingsInput!) {
    settings {
      updateBusinessSettings(settings: $input) {
        settingsId
        businessName
        openingTime
        closingTime
        operatingDays
        timezone
        currency
        vatRate
      }
    }
  }
`;

export const CREA_PERIODO_PROGRAMMAZIONE = gql`
  mutation CreaPeriodoProgrammazione($periodo: PeriodoProgrammazioneInput!) {
    settings {
      creaPeriodo(periodo: $periodo) {
        periodoId
        dataInizio
        dataFine
        giorniOperativi
        orarioApertura
        orarioChiusura
        settingsId
        creatoIl
        aggiornatoIl
      }
    }
  }
`;

export const AGGIORNA_PERIODO_PROGRAMMAZIONE = gql`
  mutation AggiornaPeriodoProgrammazione($periodo: PeriodoProgrammazioneInput!) {
    settings {
      aggiornaPeriodo(periodo: $periodo) {
        periodoId
        dataInizio
        dataFine
        giorniOperativi
        orarioApertura
        orarioChiusura
        settingsId
        creatoIl
        aggiornatoIl
      }
    }
  }
`;

export const ELIMINA_PERIODO_PROGRAMMAZIONE = gql`
  mutation EliminaPeriodoProgrammazione($periodoId: Int!) {
    settings {
      eliminaPeriodo(periodoId: $periodoId)
    }
  }
`;

export const CREA_GIORNO_NON_LAVORATIVO = gql`
  mutation CreaGiornoNonLavorativo($input: GiornoNonLavorativoInput!) {
    settings {
      creaGiornoNonLavorativo(input: $input) {
        giornoId
        data
        descrizione
        codiceMotivo
        ricorrente
        settingsId
        creatoIl
        aggiornatoIl
      }
    }
  }
`;

export const AGGIORNA_GIORNO_NON_LAVORATIVO = gql`
  mutation AggiornaGiornoNonLavorativo($input: GiornoNonLavorativoInput!) {
    settings {
      aggiornaGiornoNonLavorativo(input: $input) {
        giornoId
        data
        descrizione
        codiceMotivo
        ricorrente
        settingsId
        creatoIl
        aggiornatoIl
      }
    }
  }
`;

export const ELIMINA_GIORNO_NON_LAVORATIVO = gql`
  mutation EliminaGiornoNonLavorativo($giornoId: Int!) {
    settings {
      eliminaGiornoNonLavorativo(giornoId: $giornoId)
    }
  }
`;
