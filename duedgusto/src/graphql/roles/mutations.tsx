import { gql, TypedDocumentNode } from "@apollo/client";
import { roleFragment } from "./fragments";

interface SubmitRoleData {
  authentication: {
    mutateRole: Role;
  };
}

export interface SubmitRoleValues {
  role: RoleInput;
}

export const mutationSubmitRole: TypedDocumentNode<SubmitRoleData, SubmitRoleValues> = gql`
  ${roleFragment}
  mutation SubmitRole($role: RoleInput!) {
    authentication {
      mutateRole(role: $role) {
        ...RoleFragment
      }
    }
  }
`;