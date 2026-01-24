import { gql, TypedDocumentNode } from "@apollo/client";
import { denominazioneMonetaFragment, registroCassaFragment } from "./fragments";

// Get all denominations
interface GetDenominazioniData {
  cashManagement: {
    denominazioni: DenominazioneMoneta[];
  };
}

export const getDenominazioni: TypedDocumentNode<GetDenominazioniData> = gql(`
  ${denominazioneMonetaFragment}
  query GetDenominazioni {
    cashManagement {
      denominazioni {
        ...DenominazioneMonetaFragment
      }
    }
  }`);

// Get single cash register by date
interface GetRegistroCassaData {
  cashManagement: {
    registroCassa: RegistroCassa;
  };
}

interface GetRegistroCassaVariables {
  data: string;
}

export const getRegistroCassa: TypedDocumentNode<GetRegistroCassaData, GetRegistroCassaVariables> = gql(`
  ${registroCassaFragment}
  query GetRegistroCassa($data: DateTime!) {
    cashManagement {
      registroCassa(data: $data) {
        ...RegistroCassaFragment
      }
    }
  }`);

// Get cash registers with relay pagination (using standard connection pattern)
export const getRegistriCassa: TypedDocumentNode<RelayData<RegistroCassa>, RelayVariables> = gql(`
  ${registroCassaFragment}
  query GetRegistriCassa($pageSize: Int!, $where: String, $orderBy: String, $after: String) {
    connection {
      registriCassa(first: $pageSize, where: $where, orderBy: $orderBy, after: $after) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
          hasPreviousPage
          startCursor
        }
        items {
          ...RegistroCassaFragment
        }
      }
    }
  }`);

// Get dashboard KPIs
interface GetDashboardKPIsData {
  cashManagement: {
    dashboardKPIs: RegistroCassaKPI;
  };
}

export const getDashboardKPIs: TypedDocumentNode<GetDashboardKPIsData> = gql(`
  query GetDashboardKPIs {
    cashManagement {
      dashboardKPIs {
        venditeOggi
        differenzaOggi
        venditeMese
        mediaMese
        trendSettimana
      }
    }
  }`);

// Get monthly summary (if still needed)
interface GetRiepilogoMensileData {
  cashManagement: {
    riepilogoMensile: RiepilogoMensileCassa;
    // Legacy alias
    monthlySummary?: RiepilogoMensileCassa;
  };
}

interface GetRiepilogoMensileVariables {
  anno: number;
  mese: number;
  // Legacy aliases
  year?: number;
  month?: number;
}

export const getRiepilogoMensile: TypedDocumentNode<GetRiepilogoMensileData, GetRiepilogoMensileVariables> = gql(`
  query GetRiepilogoMensile($anno: Int!, $mese: Int!) {
    cashManagement {
      riepilogoMensile(anno: $anno, mese: $mese) {
        mese
        anno
        totaleVendite
        totaleContanti
        totaleElettronici
        mediaGiornaliera
        giorniConDifferenze
        totaleIva
      }
    }
  }`);

// Legacy alias
export const getMonthlySummary = getRiepilogoMensile;
