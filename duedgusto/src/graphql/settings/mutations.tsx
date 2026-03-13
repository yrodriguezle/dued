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
