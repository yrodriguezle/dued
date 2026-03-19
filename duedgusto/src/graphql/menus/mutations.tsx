import { gql, TypedDocumentNode } from "@apollo/client";
import { menuFragment } from "./fragments";

export interface MenuInput {
  id: number;
  titolo: string;
  percorso: string;
  icona: string;
  visibile: boolean;
  posizione: number;
  percorsoFile: string;
  nomeVista: string;
  menuPadreId: number | null;
}

export interface SubmitMenusValues {
  menus: MenuInput[];
}

interface SubmitMenusData {
  authentication: {
    mutateMenus: MenuNonNull[];
  };
}

type MenuNonNull = Exclude<Menu, null>;

export const mutationSubmitMenus: TypedDocumentNode<SubmitMenusData, SubmitMenusValues> = gql`
  ${menuFragment}
  mutation SubmitMenus($menus: [MenuInput!]!) {
    authentication {
      mutateMenus(menus: $menus) {
        ...MenuFragment
      }
    }
  }
`;

interface DeleteMenusData {
  authentication: {
    deleteMenus: boolean;
  };
}

export interface DeleteMenusValues {
  ids: number[];
}

export const mutationDeleteMenus: TypedDocumentNode<DeleteMenusData, DeleteMenusValues> = gql`
  mutation DeleteMenus($ids: [Int!]!) {
    authentication {
      deleteMenus(ids: $ids)
    }
  }
`;
