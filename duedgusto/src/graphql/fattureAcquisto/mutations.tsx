import { gql } from "@apollo/client";
import { fatturaAcquistoFragment } from "../fornitori/fragments";

export const mutationMutateFatturaAcquisto = gql`
  ${fatturaAcquistoFragment}
  mutation MutateFatturaAcquisto($fattura: FatturaAcquistoInput!) {
    fornitori {
      mutateFatturaAcquisto(fattura: $fattura) {
        ...FatturaAcquistoFragment
      }
    }
  }
`;

export const mutationDeleteFatturaAcquisto = gql`
  mutation DeleteFatturaAcquisto($fatturaId: Int!) {
    fornitori {
      deleteFatturaAcquisto(fatturaId: $fatturaId)
    }
  }
`;
