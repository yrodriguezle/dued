import { gql, TypedDocumentNode } from "@apollo/client";
import { denominazioneMonetaFragment, registroCassaFragment } from "./fragments";

// Get all denominations
interface GetDenominazioniData {
  gestioneCassa: {
    denominazioni: DenominazioneMoneta[];
  };
}

export const getDenominazioni: TypedDocumentNode<GetDenominazioniData> = gql(`
  ${denominazioneMonetaFragment}
  query GetDenominazioni {
    gestioneCassa {
      denominazioni {
        ...DenominazioneMonetaFragment
      }
    }
  }`);

// Get single cash register by date
interface GetRegistroCassaData {
  gestioneCassa: {
    registroCassa: RegistroCassa;
  };
}

interface GetRegistroCassaVariables {
  data: string;
}

export const getRegistroCassa: TypedDocumentNode<GetRegistroCassaData, GetRegistroCassaVariables> = gql(`
  ${registroCassaFragment}
  query GetRegistroCassa($data: DateTime!) {
    gestioneCassa {
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

// Get yearly aggregated summary (dashboard)
interface GetRiepilogoAnnualeData {
  gestioneCassa: {
    riepilogoAnnuale: RiepilogoAnnualeCassaServer;
  };
}

interface GetRiepilogoAnnualeVariables {
  anno: number;
}

export const getRiepilogoAnnuale: TypedDocumentNode<GetRiepilogoAnnualeData, GetRiepilogoAnnualeVariables> = gql(`
  query GetRiepilogoAnnuale($anno: Int!) {
    gestioneCassa {
      riepilogoAnnuale(anno: $anno) {
        anno
        mesi {
          anno
          mese
          totaleVendite
          ricavoTracciato
          ricavoNonTracciato
          speseTracciate
          speseNonTracciate
          incassoContanteTracciato
          incassiElettronici
          incassiFattura
          registri
          chiusi
          bozze
        }
      }
    }
  }`);

// Get dashboard KPIs
interface GetDashboardKPIsData {
  gestioneCassa: {
    dashboardKPIs: RegistroCassaKPI;
  };
}

/**
 * @deprecated Hook mai usato dalla nuova dashboard: usare `getRiepilogoAnnuale`
 * (change dashboard-charts-redesign). Rimozione in cleanup separato.
 */
export const getDashboardKPIs: TypedDocumentNode<GetDashboardKPIsData> = gql(`
  query GetDashboardKPIs {
    gestioneCassa {
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
  gestioneCassa: {
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

/**
 * @deprecated Il field server `riepilogoMensile` NON esiste nel backend: questa
 * query è codice morto e fallirebbe in validazione. Usare `getRiepilogoAnnuale`
 * (change dashboard-charts-redesign). Rimozione in cleanup separato.
 */
export const getRiepilogoMensile: TypedDocumentNode<GetRiepilogoMensileData, GetRiepilogoMensileVariables> = gql(`
  query GetRiepilogoMensile($anno: Int!, $mese: Int!) {
    gestioneCassa {
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

/**
 * @deprecated Alias legacy di `getRiepilogoMensile` (field server inesistente,
 * codice morto). Usare `getRiepilogoAnnuale`. Rimozione in cleanup separato.
 */
export const getMonthlySummary = getRiepilogoMensile;

// Get unpaid invoices for a supplier
interface FatturaNonPagata {
  fatturaId: number;
  numeroFattura: string;
  dataFattura: string;
  imponibile: number;
  totaleConIva?: number | null;
  stato: string;
  pagamenti: {
    pagamentoId: number;
    importo: number;
  }[];
}

interface GetFattureNonPagateData {
  gestioneCassa: {
    fattureNonPagatePerFornitore: FatturaNonPagata[];
  };
}

interface GetFattureNonPagateVariables {
  fornitoreId: number;
}

export const getFattureNonPagatePerFornitore: TypedDocumentNode<GetFattureNonPagateData, GetFattureNonPagateVariables> = gql(`
  query GetFattureNonPagatePerFornitore($fornitoreId: Int!) {
    gestioneCassa {
      fattureNonPagatePerFornitore(fornitoreId: $fornitoreId) {
        fatturaId
        numeroFattura
        dataFattura
        imponibile
        totaleConIva
        stato
        pagamenti {
          pagamentoId
          importo
        }
      }
    }
  }`);

// Get unpaid DDTs for a supplier
interface DdtNonPagato {
  ddtId: number;
  numeroDdt: string;
  dataDdt: string;
  importo: number;
}

interface GetDdtNonPagatiData {
  gestioneCassa: {
    ddtNonPagatiPerFornitore: DdtNonPagato[];
  };
}

interface GetDdtNonPagatiVariables {
  fornitoreId: number;
}

export const getDdtNonPagatiPerFornitore: TypedDocumentNode<GetDdtNonPagatiData, GetDdtNonPagatiVariables> = gql(`
  query GetDdtNonPagatiPerFornitore($fornitoreId: Int!) {
    gestioneCassa {
      ddtNonPagatiPerFornitore(fornitoreId: $fornitoreId) {
        ddtId
        numeroDdt
        dataDdt
        importo
      }
    }
  }`);
