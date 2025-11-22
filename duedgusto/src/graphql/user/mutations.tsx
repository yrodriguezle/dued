import { TypedDocumentNode, gql } from "@apollo/client";
import { userFragment } from "./fragment";

export type SigninValues = {
  username: string;
  password: string;
};

interface SubmitUserData {
  authentication: {
    mutateUser: User;
  };
}
interface SubmitUserValues {
  user: User;
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

