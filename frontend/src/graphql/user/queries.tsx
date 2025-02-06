import { gql, TypedDocumentNode } from "@apollo/client";
import { userFragment } from "./fragment";

interface GetUserData {
  account: {
    currentUser: User;
  }
}
export const getCurrentUser: TypedDocumentNode<GetUserData> = gql(`
  ${userFragment}
  query GetCurrentUser {
    account {
      currentUser {
        ...UserFragment
      }
    }
  }`);