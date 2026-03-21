import { gql, useQuery } from "@apollo/client";

export const GET_BUSINESS_SETTINGS = gql`
  query GetBusinessSettings {
    settings {
      businessSettings {
        settingsId
        businessName
        openingTime
        closingTime
        operatingDays
        timezone
        currency
        vatRate
        updatedAt
        createdAt
      }
      periodiProgrammazione {
        periodoId
        dataInizio
        dataFine
        giorniOperativi
        orarioApertura
        orarioChiusura
      }
      giorniNonLavorativi {
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

export const GET_GIORNI_NON_LAVORATIVI = gql`
  query GetGiorniNonLavorativi($anno: Int) {
    settings {
      giorniNonLavorativi(anno: $anno) {
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

export function useGetGiorniNonLavorativi(anno?: number) {
  const { data, loading, error, refetch } = useQuery(GET_GIORNI_NON_LAVORATIVI, {
    variables: { anno },
  });

  const giorniNonLavorativi: GiornoNonLavorativo[] = data?.settings?.giorniNonLavorativi ?? [];

  return { giorniNonLavorativi, loading, error, refetch };
}
