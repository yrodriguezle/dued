import { TypedDocumentNode, gql } from "@apollo/client";
import { userFragment } from "./fragment";

export type SigninValues = {
  username: string;
  password: string;
};

export interface UserInput {
  userId?: number;
  userName: string;
  firstName: string;
  lastName: string;
  description: string;
  disabled: boolean;
  roleId: number;
  password?: string;
}

interface SubmitUserData {
  authentication: {
    mutateUser: User;
  };
}

export interface SubmitUserValues {
  user: UserInput;
}

export const mutationSubmitUser: TypedDocumentNode<SubmitUserData, SubmitUserValues> = gql`
  ${userFragment}
  mutation SubmitUser($user: UserInput!) {
    authentication {
      mutateUser(user: $user) {
        ...UserFragment
      }
    }
  }
`;

