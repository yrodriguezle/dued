import { gql, TypedDocumentNode } from "@apollo/client";
import { roleFragment } from "./fragments";

interface SubmitRoleData {
  authentication: {
    mutateRole: Role;
  };
}

export interface  SubmitRoleValues {
  role: RoleInput;
  menuIds: number[];
}

export const mutationSubmitRole: TypedDocumentNode<SubmitRoleData, SubmitRoleValues> = gql`
  ${roleFragment}
  mutation SubmitRole($role: RoleInput!, $menuIds: [Int!]!) {
    authentication {
      mutateRole(role: $role, menuIds: $menuIds) {
        ...RoleFragment
      }
    }
  }
`;