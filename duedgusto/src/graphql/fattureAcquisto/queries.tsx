import { gql } from "@apollo/client";
import { fatturaAcquistoFragment } from "../fornitori/fragments";

export const getFattureAcquisto = gql`
  ${fatturaAcquistoFragment}
  query GetFattureAcquisto {
    fornitori {
      fattureAcquisto {
        ...FatturaAcquistoFragment
      }
    }
  }
`;

export const getFatturaAcquisto = gql`
  ${fatturaAcquistoFragment}
  query GetFatturaAcquisto($fatturaId: Int!) {
    fornitori {
      fatturaAcquisto(fatturaId: $fatturaId) {
        ...FatturaAcquistoFragment
        documentiTrasporto {
          ddtId
          numeroDdt
          dataDdt
          importo
        }
        pagamenti {
          pagamentoId
          dataPagamento
          importo
          metodoPagamento
        }
      }
    }
  }
`;
