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

interface GetUserByIdData {
    authentication: {
      user: User;
    };
}

interface GetUserByIdVariables {
    userId: number;
}

export const getUserById: TypedDocumentNode<GetUserByIdData, GetUserByIdVariables> = gql(`
  ${userFragment}
  query GetUserById($userId: Int!) {
    authentication {
      user(userId: $userId) {
        ...UserFragment
      }
    }
  }`);
