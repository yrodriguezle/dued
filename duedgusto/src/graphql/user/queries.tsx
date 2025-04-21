import { gql, TypedDocumentNode } from "@apollo/client";
import { userFragment } from "./fragment";

interface GetUserData {
    authentication: {
      currentUser: User;
    };
}
export const getCurrentUser: TypedDocumentNode<GetUserData> = gql(`
  ${userFragment}
  query GetCurrentUser {
    authentication {
      currentUser {
        ...UserFragment
      }
    }
  }`);
