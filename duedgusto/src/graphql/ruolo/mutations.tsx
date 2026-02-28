import { gql, TypedDocumentNode } from "@apollo/client";
import { ruoloFragment } from "./fragments";

interface SubmitRuoloData {
  authentication: {
    mutateRuolo: Ruolo;
  };
}

export interface SubmitRuoloValues {
  ruolo: RuoloInput;
  menuIds: number[];
}

export const mutationSubmitRuolo: TypedDocumentNode<SubmitRuoloData, SubmitRuoloValues> = gql`
  ${ruoloFragment}
  mutation SubmitRuolo($ruolo: RuoloInput!, $menuIds: [Int!]!) {
    authentication {
      mutateRuolo(ruolo: $ruolo, menuIds: $menuIds) {
        ...RuoloFragment
      }
    }
  }
`;
